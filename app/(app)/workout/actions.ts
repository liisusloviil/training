"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actionError } from "@/lib/actions/contract";
import {
  completeWorkoutSession,
  createWorkoutSession,
  findSessionByDateAndDay,
  pruneSessionSetsOutsideAllowed,
  upsertSessionSets,
} from "@/lib/db/session-repository";
import {
  countSessionSetsForUser,
  getPlanExerciseRulesForPlanDay,
  getSessionStatusForUser,
  verifyPlanDayBelongsActivePlan,
} from "@/lib/db/session-queries";
import { logCriticalError } from "@/lib/observability/server-logger";
import { createClient } from "@/lib/supabase/server";
import { getSetsPayloadLimitError } from "@/lib/workout/sets-payload-limits";
import type {
  CompleteSessionActionState,
  CreateSessionActionState,
  SessionSetInput,
  SessionSetsActionState,
} from "@/types/session";

function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed.toISOString().slice(0, 10) === value;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function toInt(value: unknown): number {
  if (typeof value === "number") {
    return Number.isInteger(value) ? value : Number.NaN;
  }

  const normalized = String(value ?? "").trim();
  if (!/^-?\d+$/.test(normalized)) {
    return Number.NaN;
  }

  return Number(normalized);
}

function toFloat(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  const normalized = String(value ?? "").trim().replace(",", ".");
  if (!normalized) {
    return Number.NaN;
  }

  return Number(normalized);
}

type IncomingSet = {
  planExerciseId?: unknown;
  setNumber?: unknown;
  reps?: unknown;
  weight?: unknown;
};

function parseSetPayload(payload: string): IncomingSet[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new Error("Некорректный формат переданных сетов.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Некорректный формат переданных сетов.");
  }

  return parsed as IncomingSet[];
}

export async function createSessionAction(
  _previousState: CreateSessionActionState,
  formData: FormData,
): Promise<CreateSessionActionState> {
  const planDayId = String(formData.get("plan_day_id") ?? "").trim();
  const sessionDate = String(formData.get("session_date") ?? "").trim();

  if (!isUuid(planDayId)) {
    return actionError("Выберите корректный день плана.");
  }

  if (!isValidDateString(sessionDate)) {
    return actionError("Укажите корректную дату тренировки.");
  }

  const check = await verifyPlanDayBelongsActivePlan(planDayId);
  if (!check.ok) {
    return actionError(
      "Выбранный день не принадлежит активному плану текущего пользователя.",
    );
  }

  const supabase = await createClient();
  let sessionId: string | null = null;

  try {
    const created = await createWorkoutSession({
      supabase,
      userId: check.userId,
      planDayId,
      sessionDate,
    });
    sessionId = created.sessionId;
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : "";

    if (code === "23505") {
      const existingSessionId = await findSessionByDateAndDay({
        supabase,
        userId: check.userId,
        planDayId,
        sessionDate,
      });

      return actionError("Сессия на выбранную дату и день уже существует.", {
        existingSessionId: existingSessionId ?? undefined,
      });
    }

    logCriticalError("create_session_action", error, {
      planDayId,
      sessionDate,
      userId: check.userId,
    });

    return actionError(
      error instanceof Error ? error.message : "Не удалось создать сессию.",
    );
  }

  redirect(`/workout/${sessionId}`);
}

export async function upsertSessionSetsAction(
  _previousState: SessionSetsActionState,
  formData: FormData,
): Promise<SessionSetsActionState> {
  const sessionId = String(formData.get("session_id") ?? "").trim();
  const setsPayload = String(formData.get("sets_payload") ?? "").trim();

  if (!isUuid(sessionId)) {
    return actionError("Некорректный идентификатор сессии.");
  }

  if (!setsPayload) {
    return actionError("Не переданы данные сетов для сохранения.");
  }

  const payloadLimitError = getSetsPayloadLimitError(setsPayload);
  if (payloadLimitError) {
    return actionError(payloadLimitError);
  }

  const session = await getSessionStatusForUser(sessionId);
  if (!session) {
    return actionError("Сессия не найдена или недоступна.");
  }

  if (session.status === "completed") {
    return actionError("Сессия уже завершена и доступна только для чтения.");
  }

  const exerciseRules = await getPlanExerciseRulesForPlanDay(session.planDayId);

  let incomingSets: IncomingSet[];
  try {
    incomingSets = parseSetPayload(setsPayload);
  } catch (error) {
    return actionError(
      error instanceof Error ? error.message : "Некорректный формат сетов.",
    );
  }

  const validSets = new Map<string, SessionSetInput>();
  const repsByExercise = new Map<string, number>();

  for (let index = 0; index < incomingSets.length; index += 1) {
    const row = incomingSets[index];
    const rowNumber = index + 1;

    const planExerciseId = String(row.planExerciseId ?? "").trim();
    const setNumberRaw = String(row.setNumber ?? "").trim();
    const repsRaw = String(row.reps ?? "").trim();
    const weightRaw = String(row.weight ?? "").trim();

    if (!isUuid(planExerciseId)) {
      return actionError(`Строка ${rowNumber}: некорректный planExerciseId.`);
    }

    const exerciseRule = exerciseRules.get(planExerciseId);
    if (!exerciseRule) {
      return actionError(
        `Строка ${rowNumber}: упражнение не принадлежит дню этой сессии.`,
      );
    }

    if (!setNumberRaw || !repsRaw || !weightRaw) {
      return actionError(
        `Строка ${rowNumber}: заполните set_number, reps и weight для каждого подхода.`,
      );
    }

    const setNumber = toInt(row.setNumber);
    const reps = toInt(row.reps);
    const weight = toFloat(row.weight);

    if (!Number.isInteger(setNumber) || setNumber <= 0) {
      return actionError(
        `Строка ${rowNumber}: set_number должен быть целым числом > 0.`,
      );
    }

    if (setNumber > exerciseRule.effectiveSetCount) {
      return actionError(
        `Строка ${rowNumber}: set_number превышает число подходов по плану (${exerciseRule.effectiveSetCount}).`,
      );
    }

    if (!Number.isInteger(reps) || reps < 0) {
      return actionError(
        `Строка ${rowNumber}: reps должен быть целым числом >= 0.`,
      );
    }

    if (reps < exerciseRule.effectiveRepsMin || reps > exerciseRule.effectiveRepsMax) {
      return actionError(
        `Строка ${rowNumber}: reps вне допустимого диапазона ${exerciseRule.effectiveRepsMin}-${exerciseRule.effectiveRepsMax}.`,
      );
    }

    if (!Number.isFinite(weight) || weight < 0) {
      return actionError(`Строка ${rowNumber}: weight должен быть числом >= 0.`);
    }

    const previousReps = repsByExercise.get(planExerciseId);
    if (previousReps !== undefined && previousReps !== reps) {
      return actionError(
        `Строка ${rowNumber}: для упражнения все подходы должны иметь одинаковый reps.`,
      );
    }
    repsByExercise.set(planExerciseId, reps);

    const key = `${planExerciseId}-${setNumber}`;
    validSets.set(key, {
      planExerciseId,
      setNumber,
      reps,
      weight,
    });
  }

  if (!validSets.size) {
    return actionError("Добавьте минимум один корректный сет для сохранения.");
  }

  const countsByExercise = new Map<string, number>();
  for (const set of validSets.values()) {
    countsByExercise.set(
      set.planExerciseId,
      (countsByExercise.get(set.planExerciseId) ?? 0) + 1,
    );
  }

  for (const [exerciseId, rule] of exerciseRules.entries()) {
    const actualCount = countsByExercise.get(exerciseId) ?? 0;
    if (actualCount !== rule.effectiveSetCount) {
      return actionError(
        `Упражнение содержит неполный набор подходов: ожидается ${rule.effectiveSetCount}, получено ${actualCount}.`,
      );
    }
  }

  const supabase = await createClient();

  try {
    const values = Array.from(validSets.values());

    await upsertSessionSets({
      supabase,
      userId: session.userId,
      sessionId,
      sets: values,
    });

    await pruneSessionSetsOutsideAllowed({
      supabase,
      userId: session.userId,
      sessionId,
      planExerciseIds: Array.from(exerciseRules.keys()),
      allowedCompositeKeys: new Set(
        values.map((set) => `${set.planExerciseId}-${set.setNumber}`),
      ),
    });

    revalidatePath(`/workout/${sessionId}`);

    return {
      status: "success",
      message: `Сеты сохранены: ${validSets.size} шт.`,
    };
  } catch (error) {
    logCriticalError("upsert_session_sets_action", error, {
      sessionId,
      setsCount: validSets.size,
    });
    return actionError(
      error instanceof Error ? error.message : "Не удалось сохранить сеты.",
    );
  }
}

export async function completeSessionAction(
  _previousState: CompleteSessionActionState,
  formData: FormData,
): Promise<CompleteSessionActionState> {
  const sessionId = String(formData.get("session_id") ?? "").trim();

  if (!isUuid(sessionId)) {
    return actionError("Некорректный идентификатор сессии.");
  }

  const session = await getSessionStatusForUser(sessionId);
  if (!session) {
    return actionError("Сессия не найдена или недоступна.");
  }

  if (session.status === "completed") {
    return actionError("Сессия уже завершена.");
  }

  const setCount = await countSessionSetsForUser(sessionId);
  if (setCount <= 0) {
    return actionError("Нельзя завершить тренировку без сохранённых сетов.");
  }

  const supabase = await createClient();
  let isCompleted = false;

  try {
    await completeWorkoutSession({
      supabase,
      userId: session.userId,
      sessionId,
    });
    isCompleted = true;
  } catch (error) {
    logCriticalError("complete_session_action", error, {
      sessionId,
      userId: session.userId,
    });
    return actionError(
      error instanceof Error ? error.message : "Не удалось завершить сессию.",
    );
  }

  if (isCompleted) {
    revalidatePath(`/workout/${sessionId}`);
    redirect(`/workout/${sessionId}`);
  }

  return actionError("Не удалось завершить сессию.");
}
