export type HistoryStatusFilter = "completed" | "in_progress" | "all";
export type HistorySessionStatus = "in_progress" | "completed";

export type HistoryListItem = {
  id: string;
  sessionDate: string;
  createdAt: string;
  completedAt: string | null;
  status: HistorySessionStatus;
  weekNumber: number;
  dayLabel: string;
  planName: string;
  setsCount: number;
  exercisesCount: number;
  totalVolume: number;
};

export type HistoryQueryInput = {
  page: number;
  pageSize: number;
  from?: string;
  to?: string;
  status: HistoryStatusFilter;
};

export type HistoryQueryResult = {
  items: HistoryListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  status: HistoryStatusFilter;
  from?: string;
  to?: string;
};

export type HistoryExerciseSet = {
  id: string;
  setNumber: number;
  reps: number;
  weight: number;
};

export type HistoryExerciseDetails = {
  id: string;
  sortOrder: number;
  exerciseName: string;
  intensity: string | null;
  prescribedSets: number | null;
  prescribedReps: number | null;
  prescribedRepsMin: number | null;
  prescribedRepsMax: number | null;
  rawSetsReps: string;
  sets: HistoryExerciseSet[];
};

export type HistorySessionDetails = {
  id: string;
  sessionDate: string;
  createdAt: string;
  completedAt: string | null;
  status: HistorySessionStatus;
  dayLabel: string;
  weekNumber: number;
  planName: string;
  setsCount: number;
  exercisesCount: number;
  totalVolume: number;
  exercises: HistoryExerciseDetails[];
};
