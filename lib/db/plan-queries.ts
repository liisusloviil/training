import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ActiveTrainingPlanReadModel,
  DayKey,
  PlanDayReadModel,
  PlanExerciseReadModel,
} from "@/types/plan";

type PlanRow = {
  id: string;
  name: string;
  source_filename: string;
  created_at: string;
};

type WeekRow = {
  id: string;
  week_number: number;
};

type DayRow = {
  id: string;
  week_id: string;
  day_key: DayKey;
  day_label: string;
  sort_order: number;
};

type ExerciseRow = {
  id: string;
  day_id: string;
  sort_order: number;
  exercise_name: string;
  intensity: string | null;
  prescribed_sets: number | null;
  prescribed_reps: number | null;
  prescribed_reps_min: number | null;
  prescribed_reps_max: number | null;
  raw_sets_reps: string;
};

function isMissingRepsRangeColumnsError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("prescribed_reps_min") ||
    normalized.includes("prescribed_reps_max")
  );
}

export async function getCurrentPlanQuery(): Promise<ActiveTrainingPlanReadModel | null> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: planRow, error: planError } = await supabase
    .from("training_plans")
    .select("id, name, source_filename, created_at")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<PlanRow>();

  if (planError) {
    throw new Error(`Не удалось получить активный план: ${planError.message}`);
  }

  if (!planRow) {
    return null;
  }

  const { data: weekRows, error: weekError } = await supabase
    .from("plan_weeks")
    .select("id, week_number")
    .eq("user_id", user.id)
    .eq("plan_id", planRow.id)
    .order("week_number", { ascending: true })
    .returns<WeekRow[]>();

  if (weekError) {
    throw new Error(`Не удалось получить недели плана: ${weekError.message}`);
  }

  const weeks = weekRows ?? [];
  const weekIds = weeks.map((week) => week.id);

  const dayRows: DayRow[] = weekIds.length
    ? await fetchDays(supabase, user.id, weekIds)
    : [];

  const dayIds = dayRows.map((day) => day.id);
  const exerciseRows: ExerciseRow[] = dayIds.length
    ? await fetchExercises(supabase, user.id, dayIds)
    : [];

  const exercisesByDay = new Map<string, PlanExerciseReadModel[]>();
  for (const exercise of exerciseRows) {
    const list = exercisesByDay.get(exercise.day_id) ?? [];
    list.push({
      id: exercise.id,
      sortOrder: exercise.sort_order,
      exerciseName: exercise.exercise_name,
      intensity: exercise.intensity,
      prescribedSets: exercise.prescribed_sets,
      prescribedReps: exercise.prescribed_reps,
      prescribedRepsMin: exercise.prescribed_reps_min,
      prescribedRepsMax: exercise.prescribed_reps_max,
      rawSetsReps: exercise.raw_sets_reps,
    });
    exercisesByDay.set(exercise.day_id, list);
  }

  for (const dayExercises of exercisesByDay.values()) {
    dayExercises.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const daysByWeek = new Map<string, PlanDayReadModel[]>();
  for (const day of dayRows) {
    const list = daysByWeek.get(day.week_id) ?? [];
    list.push({
      id: day.id,
      dayKey: day.day_key,
      dayLabel: day.day_label,
      sortOrder: day.sort_order,
      exercises: exercisesByDay.get(day.id) ?? [],
    });
    daysByWeek.set(day.week_id, list);
  }

  for (const weekDays of daysByWeek.values()) {
    weekDays.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  return {
    id: planRow.id,
    name: planRow.name,
    sourceFilename: planRow.source_filename,
    createdAt: planRow.created_at,
    weeks: weeks.map((week) => ({
      id: week.id,
      weekNumber: week.week_number,
      days: daysByWeek.get(week.id) ?? [],
    })),
  };
}

async function fetchDays(
  supabase: SupabaseClient,
  userId: string,
  weekIds: string[],
): Promise<DayRow[]> {
  const { data, error } = await supabase
    .from("plan_days")
    .select("id, week_id, day_key, day_label, sort_order")
    .eq("user_id", userId)
    .in("week_id", weekIds)
    .order("sort_order", { ascending: true })
    .returns<DayRow[]>();

  if (error) {
    throw new Error(`Не удалось получить дни плана: ${error.message}`);
  }

  return data ?? [];
}

async function fetchExercises(
  supabase: SupabaseClient,
  userId: string,
  dayIds: string[],
): Promise<ExerciseRow[]> {
  const { data, error } = await supabase
    .from("plan_exercises")
    .select(
      "id, day_id, sort_order, exercise_name, intensity, prescribed_sets, prescribed_reps, prescribed_reps_min, prescribed_reps_max, raw_sets_reps",
    )
    .eq("user_id", userId)
    .in("day_id", dayIds)
    .order("sort_order", { ascending: true })
    .returns<ExerciseRow[]>();

  if (error && isMissingRepsRangeColumnsError(error.message)) {
    const { data: legacyData, error: legacyError } = await supabase
      .from("plan_exercises")
      .select(
        "id, day_id, sort_order, exercise_name, intensity, prescribed_sets, prescribed_reps, raw_sets_reps",
      )
      .eq("user_id", userId)
      .in("day_id", dayIds)
      .order("sort_order", { ascending: true })
      .returns<
        Array<
          Omit<ExerciseRow, "prescribed_reps_min" | "prescribed_reps_max"> & {
            prescribed_reps_min?: null;
            prescribed_reps_max?: null;
          }
        >
      >();

    if (legacyError) {
      throw new Error(`Не удалось получить упражнения плана: ${legacyError.message}`);
    }

    return (legacyData ?? []).map((row) => ({
      ...row,
      prescribed_reps_min: row.prescribed_reps,
      prescribed_reps_max: row.prescribed_reps,
    }));
  }

  if (error) {
    throw new Error(`Не удалось получить упражнения плана: ${error.message}`);
  }

  return data ?? [];
}
