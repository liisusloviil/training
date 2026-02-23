import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  HistoryExerciseDetails,
  HistoryExerciseSet,
  HistoryQueryInput,
  HistoryQueryResult,
  HistorySessionDetails,
  HistorySessionStatus,
} from "@/types/history";

type SessionRow = {
  id: string;
  session_date: string;
  created_at: string;
  completed_at: string | null;
  status: HistorySessionStatus;
  plan_day_id: string;
};

type DayRow = {
  id: string;
  day_label: string;
  week_id: string;
};

type WeekRow = {
  id: string;
  week_number: number;
  plan_id: string;
};

type PlanRow = {
  id: string;
  name: string;
};

type SetAggRow = {
  session_id: string;
  plan_exercise_id: string;
  reps: number;
  weight: number;
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

type SetRow = {
  id: string;
  session_id: string;
  plan_exercise_id: string;
  set_number: number;
  reps: number;
  weight: number;
};

function isMissingRepsRangeColumnsError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("prescribed_reps_min") ||
    normalized.includes("prescribed_reps_max")
  );
}

export async function getHistoryQuery(input: HistoryQueryInput): Promise<HistoryQueryResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const page = Math.max(1, input.page);
  const pageSize = Math.max(1, Math.min(50, input.pageSize));
  const status = input.status;

  const baseCountQuery = supabase
    .from("workout_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const baseRowsQuery = supabase
    .from("workout_sessions")
    .select("id, session_date, created_at, completed_at, status, plan_day_id")
    .eq("user_id", user.id);

  if (status !== "all") {
    baseCountQuery.eq("status", status);
    baseRowsQuery.eq("status", status);
  }

  if (input.from) {
    baseCountQuery.gte("session_date", input.from);
    baseRowsQuery.gte("session_date", input.from);
  }

  if (input.to) {
    baseCountQuery.lte("session_date", input.to);
    baseRowsQuery.lte("session_date", input.to);
  }

  const { count, error: countError } = await baseCountQuery;
  if (countError) {
    throw new Error(`Не удалось загрузить количество сессий истории: ${countError.message}`);
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const fromIndex = (safePage - 1) * pageSize;
  const toIndex = fromIndex + pageSize - 1;

  const { data: sessionRows, error: rowsError } = await baseRowsQuery
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(fromIndex, toIndex)
    .returns<SessionRow[]>();

  if (rowsError) {
    throw new Error(`Не удалось загрузить список истории: ${rowsError.message}`);
  }

  const sessions = sessionRows ?? [];

  if (!sessions.length) {
    return {
      items: [],
      page: safePage,
      pageSize,
      total,
      totalPages,
      status,
      from: input.from,
      to: input.to,
    };
  }

  const dayIds = Array.from(new Set(sessions.map((session) => session.plan_day_id)));

  const { data: dayRows, error: dayError } = await supabase
    .from("plan_days")
    .select("id, day_label, week_id")
    .eq("user_id", user.id)
    .in("id", dayIds)
    .returns<DayRow[]>();

  if (dayError) {
    throw new Error(`Не удалось загрузить дни плана для истории: ${dayError.message}`);
  }

  const days = dayRows ?? [];
  const dayById = new Map(days.map((day) => [day.id, day]));

  const weekIds = Array.from(new Set(days.map((day) => day.week_id)));
  const weeks: WeekRow[] = weekIds.length
    ? await fetchHistoryWeeks(supabase, user.id, weekIds)
    : [];
  const weekById = new Map(weeks.map((week) => [week.id, week]));

  const planIds = Array.from(new Set(weeks.map((week) => week.plan_id)));
  const plans: PlanRow[] = planIds.length
    ? await fetchHistoryPlans(supabase, user.id, planIds)
    : [];
  const planById = new Map(plans.map((plan) => [plan.id, plan]));

  const sessionIds = sessions.map((session) => session.id);
  const { data: setRows, error: setError } = await supabase
    .from("session_sets")
    .select("session_id, plan_exercise_id, reps, weight")
    .eq("user_id", user.id)
    .in("session_id", sessionIds)
    .returns<SetAggRow[]>();

  if (setError) {
    throw new Error(`Не удалось загрузить агрегаты сетов: ${setError.message}`);
  }

  const aggBySession = new Map<string, { setsCount: number; totalVolume: number; exerciseIds: Set<string> }>();

  for (const setRow of setRows ?? []) {
    const current = aggBySession.get(setRow.session_id) ?? {
      setsCount: 0,
      totalVolume: 0,
      exerciseIds: new Set<string>(),
    };

    current.setsCount += 1;
    current.totalVolume += Number(setRow.reps) * Number(setRow.weight);
    current.exerciseIds.add(setRow.plan_exercise_id);

    aggBySession.set(setRow.session_id, current);
  }

  const items = sessions.map((session) => {
    const day = dayById.get(session.plan_day_id);
    const week = day ? weekById.get(day.week_id) : undefined;
    const plan = week ? planById.get(week.plan_id) : undefined;
    const agg = aggBySession.get(session.id);

    return {
      id: session.id,
      sessionDate: session.session_date,
      createdAt: session.created_at,
      completedAt: session.completed_at,
      status: session.status,
      weekNumber: week?.week_number ?? 0,
      dayLabel: day?.day_label ?? "День не найден",
      planName: plan?.name ?? "План не найден",
      setsCount: agg?.setsCount ?? 0,
      exercisesCount: agg?.exerciseIds.size ?? 0,
      totalVolume: Number((agg?.totalVolume ?? 0).toFixed(2)),
    };
  });

  return {
    items,
    page: safePage,
    pageSize,
    total,
    totalPages,
    status,
    from: input.from,
    to: input.to,
  };
}

async function fetchHistoryWeeks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  weekIds: string[],
) {
  const { data, error } = await supabase
    .from("plan_weeks")
    .select("id, week_number, plan_id")
    .eq("user_id", userId)
    .in("id", weekIds)
    .returns<WeekRow[]>();

  if (error) {
    throw new Error(`Не удалось загрузить недели плана для истории: ${error.message}`);
  }

  return data ?? [];
}

async function fetchHistoryPlans(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  planIds: string[],
) {
  const { data, error } = await supabase
    .from("training_plans")
    .select("id, name")
    .eq("user_id", userId)
    .in("id", planIds)
    .returns<PlanRow[]>();

  if (error) {
    throw new Error(`Не удалось загрузить планы для истории: ${error.message}`);
  }

  return data ?? [];
}

export async function getHistorySessionDetailsQuery(
  sessionId: string,
): Promise<HistorySessionDetails | null> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: session, error: sessionError } = await supabase
    .from("workout_sessions")
    .select("id, session_date, created_at, completed_at, status, plan_day_id")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle<SessionRow>();

  if (sessionError) {
    throw new Error(`Не удалось загрузить сессию истории: ${sessionError.message}`);
  }

  if (!session) {
    return null;
  }

  const { data: day, error: dayError } = await supabase
    .from("plan_days")
    .select("id, day_label, week_id")
    .eq("id", session.plan_day_id)
    .eq("user_id", user.id)
    .maybeSingle<DayRow>();

  if (dayError) {
    throw new Error(`Не удалось загрузить день сессии: ${dayError.message}`);
  }

  if (!day) {
    return null;
  }

  const { data: week, error: weekError } = await supabase
    .from("plan_weeks")
    .select("id, week_number, plan_id")
    .eq("id", day.week_id)
    .eq("user_id", user.id)
    .maybeSingle<WeekRow>();

  if (weekError) {
    throw new Error(`Не удалось загрузить неделю сессии: ${weekError.message}`);
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
    throw new Error(`Не удалось загрузить план сессии: ${planError.message}`);
  }

  if (!plan) {
    return null;
  }

  const { data: exerciseRowsWithRange, error: exerciseError } = await supabase
    .from("plan_exercises")
    .select(
      "id, day_id, sort_order, exercise_name, intensity, prescribed_sets, prescribed_reps, prescribed_reps_min, prescribed_reps_max, raw_sets_reps",
    )
    .eq("user_id", user.id)
    .eq("day_id", day.id)
    .order("sort_order", { ascending: true })
    .returns<ExerciseRow[]>();

  let exerciseRows = exerciseRowsWithRange ?? [];
  if (exerciseError && isMissingRepsRangeColumnsError(exerciseError.message)) {
    const { data: legacyExerciseRows, error: legacyExerciseError } = await supabase
      .from("plan_exercises")
      .select(
        "id, day_id, sort_order, exercise_name, intensity, prescribed_sets, prescribed_reps, raw_sets_reps",
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

    if (legacyExerciseError) {
      throw new Error(`Не удалось загрузить упражнения сессии: ${legacyExerciseError.message}`);
    }

    exerciseRows = (legacyExerciseRows ?? []).map((row) => ({
      ...row,
      prescribed_reps_min: row.prescribed_reps,
      prescribed_reps_max: row.prescribed_reps,
    }));
  } else if (exerciseError) {
    throw new Error(`Не удалось загрузить упражнения сессии: ${exerciseError.message}`);
  }

  const { data: setRows, error: setError } = await supabase
    .from("session_sets")
    .select("id, session_id, plan_exercise_id, set_number, reps, weight")
    .eq("user_id", user.id)
    .eq("session_id", session.id)
    .order("set_number", { ascending: true })
    .returns<SetRow[]>();

  if (setError) {
    throw new Error(`Не удалось загрузить сеты сессии: ${setError.message}`);
  }

  const setsByExercise = new Map<string, HistoryExerciseSet[]>();
  let totalVolume = 0;

  for (const setRow of setRows ?? []) {
    const list = setsByExercise.get(setRow.plan_exercise_id) ?? [];
    list.push({
      id: setRow.id,
      setNumber: setRow.set_number,
      reps: setRow.reps,
      weight: Number(setRow.weight),
    });
    setsByExercise.set(setRow.plan_exercise_id, list);

    totalVolume += Number(setRow.reps) * Number(setRow.weight);
  }

  for (const exerciseSets of setsByExercise.values()) {
    exerciseSets.sort((a, b) => a.setNumber - b.setNumber);
  }

  const exercises: HistoryExerciseDetails[] = exerciseRows.map((exercise) => ({
    id: exercise.id,
    sortOrder: exercise.sort_order,
    exerciseName: exercise.exercise_name,
    intensity: exercise.intensity,
    prescribedSets: exercise.prescribed_sets,
    prescribedReps: exercise.prescribed_reps,
    prescribedRepsMin: exercise.prescribed_reps_min,
    prescribedRepsMax: exercise.prescribed_reps_max,
    rawSetsReps: exercise.raw_sets_reps,
    sets: setsByExercise.get(exercise.id) ?? [],
  }));

  return {
    id: session.id,
    sessionDate: session.session_date,
    createdAt: session.created_at,
    completedAt: session.completed_at,
    status: session.status,
    dayLabel: day.day_label,
    weekNumber: week.week_number,
    planName: plan.name,
    setsCount: (setRows ?? []).length,
    exercisesCount: new Set((setRows ?? []).map((row) => row.plan_exercise_id)).size,
    totalVolume: Number(totalVolume.toFixed(2)),
    exercises,
  };
}
