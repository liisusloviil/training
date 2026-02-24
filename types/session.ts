export type WorkoutSessionStatus = "in_progress" | "completed";

export type PlanDayOption = {
  planDayId: string;
  weekNumber: number;
  dayLabel: string;
  dayKey: string;
  sortOrder: number;
};

export type WorkoutNewContext = {
  planId: string;
  planName: string;
  dayOptions: PlanDayOption[];
};

export type SessionSetReadModel = {
  id: string;
  planExerciseId: string;
  setNumber: number;
  reps: number;
  weight: number;
};

export type SessionExerciseReadModel = {
  id: string;
  sortOrder: number;
  exerciseName: string;
  intensity: string | null;
  prescribedSets: number | null;
  prescribedReps: number | null;
  prescribedRepsMin: number | null;
  prescribedRepsMax: number | null;
  effectiveSetCount: number;
  effectiveRepsMin: number;
  effectiveRepsMax: number;
  isRepsFallback: boolean;
  selectedReps?: number;
  rawSetsReps: string;
  sets: SessionSetReadModel[];
};

export type WorkoutSessionReadModel = {
  id: string;
  status: WorkoutSessionStatus;
  sessionDate: string;
  completedAt: string | null;
  planDayId: string;
  weekNumber: number;
  dayLabel: string;
  planName: string;
  exercises: SessionExerciseReadModel[];
};

export type CreateSessionActionState = {
  status: "idle" | "error";
  message?: string;
  existingSessionId?: string;
};

export type SessionSetsActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export type CompleteSessionActionState = {
  status: "idle" | "error";
  message?: string;
};

export type SessionSetInput = {
  planExerciseId: string;
  setNumber: number;
  reps: number;
  weight: number;
};
