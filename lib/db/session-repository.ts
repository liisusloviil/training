import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionSetInput } from "@/types/session";

type SessionIdRow = { id: string };

export async function createWorkoutSession(params: {
  supabase: SupabaseClient;
  userId: string;
  planDayId: string;
  sessionDate: string;
}) {
  const { supabase, userId, planDayId, sessionDate } = params;

  const { data, error } = await supabase
    .from("workout_sessions")
    .insert({
      user_id: userId,
      plan_day_id: planDayId,
      session_date: sessionDate,
      status: "in_progress",
      completed_at: null,
    })
    .select("id")
    .single<SessionIdRow>();

  if (error) {
    throw error;
  }

  return { sessionId: data.id };
}

export async function findSessionByDateAndDay(params: {
  supabase: SupabaseClient;
  userId: string;
  planDayId: string;
  sessionDate: string;
}) {
  const { supabase, userId, planDayId, sessionDate } = params;

  const { data, error } = await supabase
    .from("workout_sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("plan_day_id", planDayId)
    .eq("session_date", sessionDate)
    .maybeSingle<SessionIdRow>();

  if (error) {
    throw new Error(`Не удалось проверить дубликат сессии: ${error.message}`);
  }

  return data?.id ?? null;
}

export async function upsertSessionSets(params: {
  supabase: SupabaseClient;
  userId: string;
  sessionId: string;
  sets: SessionSetInput[];
}) {
  const { supabase, userId, sessionId, sets } = params;

  const rows = sets.map((set) => ({
    user_id: userId,
    session_id: sessionId,
    plan_exercise_id: set.planExerciseId,
    set_number: set.setNumber,
    reps: set.reps,
    weight: set.weight,
  }));

  const { error } = await supabase
    .from("session_sets")
    .upsert(rows, {
      onConflict: "session_id,plan_exercise_id,set_number",
      ignoreDuplicates: false,
    });

  if (error) {
    throw new Error(`Не удалось сохранить сеты: ${error.message}`);
  }
}

export async function completeWorkoutSession(params: {
  supabase: SupabaseClient;
  userId: string;
  sessionId: string;
}) {
  const { supabase, userId, sessionId } = params;

  const { data, error } = await supabase
    .from("workout_sessions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .select("id")
    .maybeSingle<SessionIdRow>();

  if (error) {
    throw new Error(`Не удалось завершить сессию: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error("Сессия уже завершена или недоступна.");
  }
}
