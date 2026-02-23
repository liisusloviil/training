export type DayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type ParsedExercise = {
  sortOrder: number;
  exerciseName: string;
  intensity: string | null;
  prescribedSets: number;
  prescribedReps: number | null;
  prescribedRepsMin: number;
  prescribedRepsMax: number;
  rawSetsReps: string;
};

export type ParsedDay = {
  dayKey: DayKey;
  dayLabel: string;
  sortOrder: number;
  exercises: ParsedExercise[];
};

export type ParsedWeek = {
  weekNumber: number;
  days: ParsedDay[];
};

export type ParsedTrainingPlan = {
  name: string;
  weeks: ParsedWeek[];
};

export type TrainingPlanPreview = {
  name: string;
  totalWeeks: number;
  totalDays: number;
  totalExercises: number;
  weeks: Array<{
    weekNumber: number;
    days: Array<{
      dayKey: DayKey;
      dayLabel: string;
      exercises: Array<{
        exerciseName: string;
        intensity: string | null;
        rawSetsReps: string;
      }>;
    }>;
  }>;
};

export type PlanExerciseReadModel = {
  id: string;
  sortOrder: number;
  exerciseName: string;
  intensity: string | null;
  prescribedSets: number | null;
  prescribedReps: number | null;
  prescribedRepsMin: number | null;
  prescribedRepsMax: number | null;
  rawSetsReps: string;
};

export type PlanDayReadModel = {
  id: string;
  dayKey: DayKey;
  dayLabel: string;
  sortOrder: number;
  exercises: PlanExerciseReadModel[];
};

export type PlanWeekReadModel = {
  id: string;
  weekNumber: number;
  days: PlanDayReadModel[];
};

export type ActiveTrainingPlanReadModel = {
  id: string;
  name: string;
  sourceFilename: string;
  createdAt: string;
  weeks: PlanWeekReadModel[];
};
