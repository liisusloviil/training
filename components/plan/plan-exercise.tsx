import type { PlanExerciseReadModel } from "@/types/plan";

export function PlanExercise({ exercise }: { exercise: PlanExerciseReadModel }) {
  const prescribed =
    exercise.prescribedSets &&
    exercise.prescribedRepsMin &&
    exercise.prescribedRepsMax
      ? exercise.prescribedRepsMin === exercise.prescribedRepsMax
        ? `${exercise.prescribedSets}×${exercise.prescribedRepsMin}`
        : `${exercise.prescribedSets}×${exercise.prescribedRepsMin}-${exercise.prescribedRepsMax}`
      : exercise.rawSetsReps;

  return (
    <li className="plan-exercise-item">
      <div className="plan-exercise-main">
        <strong>{exercise.exerciseName}</strong>
        {exercise.intensity ? <span>{exercise.intensity}</span> : null}
      </div>
      <small>{prescribed}</small>
    </li>
  );
}
