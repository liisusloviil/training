import { PlanExercise } from "@/components/plan/plan-exercise";
import type { PlanDayReadModel } from "@/types/plan";

export function PlanDay({ day }: { day: PlanDayReadModel }) {
  return (
    <section className="plan-day-card">
      <header>
        <h4>{day.dayLabel}</h4>
        <span>{day.exercises.length} упр.</span>
      </header>

      {day.exercises.length ? (
        <ul>
          {day.exercises.map((exercise) => (
            <PlanExercise exercise={exercise} key={exercise.id} />
          ))}
        </ul>
      ) : (
        <p className="plan-day-empty">Для этого дня упражнения пока не заданы.</p>
      )}
    </section>
  );
}
