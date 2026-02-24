import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  PlanDayOption,
  SessionExerciseReadModel,
  SessionSetReadModel,
  WorkoutNewContext,
  WorkoutSessionReadModel,
  WorkoutSessionStatus,
} from "@/types/session";

type PlanRow = {
  id: string;
  name: string;
};

type WeekRow = {
  id: string;
  week_number: number;
};

type DayRow = {
  id: string;
  week_id: string;
  day_key: string;
  day_label: string;
  sort_order: number;
};

type SessionRow = {
  id: string;
  status: WorkoutSessionStatus;
  session_date: string;
  completed_at: string | null;
  plan_day_id: string;
};

type ExerciseRow = {
  id: string;
  sort_order: number;
  exercise_name: string;
  intensity: string | null;
  prescribed_sets: number | null;
  prescribed_reps: number | null;
  prescribed_reps_min: number | null;
  prescribed_reps_max: number | null;
  raw_sets_reps: string;
};

type SetRow = {
  id: string;
  plan_exercise_id: string;
  set_number: number;
  reps: number;
  weight: number;
};

type ExerciseRule = {
  effectiveSetCount: number;
  effectiveRepsMin: number;
  effectiveRepsMax: number;
};

function isMissingRepsRangeColumnsError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("prescribed_reps_min") ||
    normalized.includes("prescribed_reps_max")
  );
}

export function resolveEffectiveSetCount(
  prescribedSets: number | null | undefined,
): number {
  if (Number.isInteger(prescribedSets) && Number(prescribedSets) > 0) {
    return Number(prescribedSets);
  }

  return 1;
}

export function resolveEffectiveRepsRange(input: {
  prescribedReps: number | null;
  prescribedRepsMin: number | null;
  prescribedRepsMax: number | null;
}): { min: number; max: number; isFallback: boolean } {
  const minFromRange = input.prescribedRepsMin;
  const maxFromRange = input.prescribedRepsMax;

  if (
    Number.isInteger(minFromRange) &&
    Number.isInteger(maxFromRange) &&
    Number(minFromRange) > 0 &&
    Number(maxFromRange) > 0 &&
    Number(minFromRange) <= Number(maxFromRange)
  ) {
    return {
      min: Number(minFromRange),
      max: Number(maxFromRange),
      isFallback: false,
    };
  }

  if (Number.isInteger(input.prescribedReps) && Number(input.prescribedReps) > 0) {
    const reps = Number(input.prescribedReps);
    return {
      min: reps,
      max: reps,
      isFallback: false,
    };
  }

  if (Number.isInteger(minFromRange) && Number(minFromRange) > 0) {
    const reps = Number(minFromRange);
    return {
      min: reps,
      max: reps,
      isFallback: false,
    };
  }

  if (Number.isInteger(maxFromRange) && Number(maxFromRange) > 0) {
    const reps = Number(maxFromRange);
    return {
      min: reps,
      max: reps,
      isFallback: false,
    };
  }

  return {
    min: 1,
    max: 1,
    isFallback: true,
  };
}

export async function getWorkoutNewContextQuery(): Promise<WorkoutNewContext | null> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: plan, error: planError } = await supabase
    .from("training_plans")
    .select("id, name")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<PlanRow>();

  if (planError) {
    throw new Error(`Не удалось получить активный план: ${planError.message}`);
  }

  if (!plan) {
    return null;
  }

  const { data: weeks, error: weeksError } = await supabase
    .from("plan_weeks")
    .select("id, week_number")
    .eq("user_id", user.id)
    .eq("plan_id", plan.id)
    .order("week_number", { ascending: true })
    .returns<WeekRow[]>();

  if (weeksError) {
    throw new Error(`Не удалось получить недели активного плана: ${weeksError.message}`);
  }

  const weekList = weeks ?? [];
  if (!weekList.length) {
    return {
      planId: plan.id,
      planName: plan.name,
      dayOptions: [],
    };
  }

  const weekIds = weekList.map((week) => week.id);

  const { data: days, error: daysError } = await supabase
    .from("plan_days")
    .select("id, week_id, day_key, day_label, sort_order")
    .eq("user_id", user.id)
    .in("week_id", weekIds)
    .order("sort_order", { ascending: true })
    .returns<DayRow[]>();

  if (daysError) {
    throw new Error(`Не удалось получить дни активного плана: ${daysError.message}`);
  }

  const weekNumberById = new Map(weekList.map((week) => [week.id, week.week_number]));

  const dayOptions: PlanDayOption[] = (days ?? [])
    .map((day) => ({
      planDayId: day.id,
      weekNumber: weekNumberById.get(day.week_id) ?? 0,
      dayLabel: day.day_label,
      dayKey: day.day_key,
      sortOrder: day.sort_order,
    }))
    .sort((a, b) => {
      if (a.weekNumber !== b.weekNumber) {
        return a.weekNumber - b.weekNumber;
      }
      return a.sortOrder - b.sortOrder;
    });

  return {
    planId: plan.id,
    planName: plan.name,
    dayOptions,
  };
}

export async function getSessionDetailsQuery(
  sessionId: string,
): Promise<WorkoutSessionReadModel | null> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: session, error: sessionError } = await supabase
    .from("workout_sessions")
    .select("id, status, session_date, completed_at, plan_day_id")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle<SessionRow>();

  if (sessionError) {
    throw new Error(`Не удалось загрузить сессию: ${sessionError.message}`);
  }

  if (!session) {
    return null;
  }

  const { data: day, error: dayError } = await supabase
    .from("plan_days")
    .select("id, week_id, day_key, day_label, sort_order")
    .eq("id", session.plan_day_id)
    .eq("user_id", user.id)
    .maybeSingle<DayRow>();

  if (dayError) {
    throw new Error(`Не удалось загрузить день плана: ${dayError.message}`);
  }

  if (!day) {
    return null;
  }

  const { data: week, error: weekError } = await supabase
    .from("plan_weeks")
    .select("id, week_number, plan_id")
    .eq("id", day.week_id)
    .eq("user_id", user.id)
    .maybeSingle<{ id: string; week_number: number; plan_id: string }>();

  if (weekError) {
    throw new Error(`Не удалось загрузить неделю плана: ${weekError.message}`);
  }

  if (!week) {
    return null;
  }

  const { data: plan, error: planError } = await supabase
    .from("training_plans")
    .select("id, name")
    .eq("id", week.plan_id)
    .eq("user_id", user.id)
    .maybeSingle<PlanRow>();

  if (planError) {
    throw new Error(`Не удалось загрузить план: ${planError.message}`);
  }

  if (!plan) {
    return null;
  }

  const { data: exercisesWithRange, error: exercisesError } = await supabase
    .from("plan_exercises")
    .select(
      "id, sort_order, exercise_name, intensity, prescribed_sets, prescribed_reps, prescribed_reps_min, prescribed_reps_max, raw_sets_reps",
    )
    .eq("user_id", user.id)
    .eq("day_id", day.id)
    .order("sort_order", { ascending: true })
    .returns<ExerciseRow[]>();

  let exercises = exercisesWithRange ?? [];
  if (exercisesError && isMissingRepsRangeColumnsError(exercisesError.message)) {
    const { data: legacyExercises, error: legacyExercisesError } = await supabase
      .from("plan_exercises")
      .select(
        "id, sort_order, exercise_name, intensity, prescribed_sets, prescribed_reps, raw_sets_reps",
      )
      .eq("user_id", user.id)
      .eq("day_id", day.id)
      .order("sort_order", { ascending: true })
      .returns<
        Array<
          Omit<ExerciseRow, "prescribed_reps_min" | "prescribed_reps_max"> & {
            prescribed_reps_min?: null;
            prescribed_reps_max?: null;
          }
        >
      >();

    if (legacyExercisesError) {
      throw new Error(`Не удалось загрузить упражнения сессии: ${legacyExercisesError.message}`);
    }

    exercises = (legacyExercises ?? []).map((row) => ({
      ...row,
      prescribed_reps_min: row.prescribed_reps,
      prescribed_reps_max: row.prescribed_reps,
    }));
  } else if (exercisesError) {
    throw new Error(`Не удалось загрузить упражнения сессии: ${exercisesError.message}`);
  }

  const { data: sets, error: setsError } = await supabase
    .from("session_sets")
    .select("id, plan_exercise_id, set_number, reps, weight")
    .eq("user_id", user.id)
    .eq("session_id", session.id)
    .order("set_number", { ascending: true })
    .returns<SetRow[]>();

  if (setsError) {
    throw new Error(`Не удалось загрузить сеты сессии: ${setsError.message}`);
  }

  const setsByExercise = new Map<string, SessionSetReadModel[]>();
  for (const set of sets ?? []) {
    const list = setsByExercise.get(set.plan_exercise_id) ?? [];
    list.push({
      id: set.id,
      planExerciseId: set.plan_exercise_id,
      setNumber: set.set_number,
      reps: set.reps,
      weight: Number(set.weight),
    });
    setsByExercise.set(set.plan_exercise_id, list);
  }

  for (const list of setsByExercise.values()) {
    list.sort((a, b) => a.setNumber - b.setNumber);
  }

  const exerciseModels: SessionExerciseReadModel[] = exercises.map((exercise) => {
    const repsRange = resolveEffectiveRepsRange({
      prescribedReps: exercise.prescribed_reps,
      prescribedRepsMin: exercise.prescribed_reps_min,
      prescribedRepsMax: exercise.prescribed_reps_max,
    });

    return {
      id: exercise.id,
      sortOrder: exercise.sort_order,
      exerciseName: exercise.exercise_name,
      intensity: exercise.intensity,
      prescribedSets: exercise.prescribed_sets,
      prescribedReps: exercise.prescribed_reps,
      prescribedRepsMin: exercise.prescribed_reps_min,
      prescribedRepsMax: exercise.prescribed_reps_max,
      effectiveSetCount: resolveEffectiveSetCount(exercise.prescribed_sets),
      effectiveRepsMin: repsRange.min,
      effectiveRepsMax: repsRange.max,
      isRepsFallback: repsRange.isFallback,
      rawSetsReps: exercise.raw_sets_reps,
      sets: setsByExercise.get(exercise.id) ?? [],
    };
  });

  return {
    id: session.id,
    status: session.status,
    sessionDate: session.session_date,
    completedAt: session.completed_at,
    planDayId: session.plan_day_id,
    weekNumber: week.week_number,
    dayLabel: day.day_label,
    planName: plan.name,
    exercises: exerciseModels,
  };
}

export async function getSessionStatusForUser(sessionId: string) {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("workout_sessions")
    .select("id, status, plan_day_id")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle<{ id: string; status: WorkoutSessionStatus; plan_day_id: string }>();

  if (error) {
    throw new Error(`Не удалось проверить сессию: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return {
    sessionId: data.id,
    status: data.status,
    planDayId: data.plan_day_id,
    userId: user.id,
  };
}

export async function countSessionSetsForUser(sessionId: string) {
  const user = await requireUser();
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("session_sets")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("session_id", sessionId);

  if (error) {
    throw new Error(`Не удалось проверить количество сетов: ${error.message}`);
  }

  return count ?? 0;
}

export async function verifyPlanDayBelongsActivePlan(planDayId: string) {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: day, error: dayError } = await supabase
    .from("plan_days")
    .select("id, week_id")
    .eq("id", planDayId)
    .eq("user_id", user.id)
    .maybeSingle<{ id: string; week_id: string }>();

  if (dayError) {
    throw new Error(`Не удалось проверить день плана: ${dayError.message}`);
  }

  if (!day) {
    return { ok: false as const, userId: user.id };
  }

  const { data: week, error: weekError } = await supabase
    .from("plan_weeks")
    .select("id, plan_id")
    .eq("id", day.week_id)
    .eq("user_id", user.id)
    .maybeSingle<{ id: string; plan_id: string }>();

  if (weekError) {
    throw new Error(`Не удалось проверить неделю плана: ${weekError.message}`);
  }

  if (!week) {
    return { ok: false as const, userId: user.id };
  }

  const { data: plan, error: planError } = await supabase
    .from("training_plans")
    .select("id")
    .eq("id", week.plan_id)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle<{ id: string }>();

  if (planError) {
    throw new Error(`Не удалось проверить активный план: ${planError.message}`);
  }

  return {
    ok: Boolean(plan?.id) as boolean,
    userId: user.id,
  };
}

export async function getPlanExerciseRulesForPlanDay(
  planDayId: string,
): Promise<Map<string, ExerciseRule>> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("plan_exercises")
    .select("id, prescribed_sets, prescribed_reps, prescribed_reps_min, prescribed_reps_max")
    .eq("user_id", user.id)
    .eq("day_id", planDayId)
    .returns<
      Array<{
        id: string;
        prescribed_sets: number | null;
        prescribed_reps: number | null;
        prescribed_reps_min: number | null;
        prescribed_reps_max: number | null;
      }>
    >();

  if (error) {
    throw new Error(`Не удалось получить упражнения дня плана: ${error.message}`);
  }

  const rules = new Map<string, ExerciseRule>();
  for (const exercise of data ?? []) {
    const repsRange = resolveEffectiveRepsRange({
      prescribedReps: exercise.prescribed_reps,
      prescribedRepsMin: exercise.prescribed_reps_min,
      prescribedRepsMax: exercise.prescribed_reps_max,
    });

    rules.set(exercise.id, {
      effectiveSetCount: resolveEffectiveSetCount(exercise.prescribed_sets),
      effectiveRepsMin: repsRange.min,
      effectiveRepsMax: repsRange.max,
    });
  }

  return rules;
}
