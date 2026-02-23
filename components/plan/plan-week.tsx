import { PlanDay } from "@/components/plan/plan-day";
import type { PlanWeekReadModel } from "@/types/plan";

export function PlanWeek({ week }: { week: PlanWeekReadModel }) {
  return (
    <article className="plan-week-card">
      <header className="plan-week-header">
        <h3>Неделя {week.weekNumber}</h3>
        <span>{week.days.length} дн.</span>
      </header>

      {week.days.length ? (
        <div className="plan-week-days">
          {week.days.map((day) => (
            <PlanDay day={day} key={day.id} />
          ))}
        </div>
      ) : (
        <p className="plan-week-empty">В этой неделе пока нет тренировочных дней.</p>
      )}
    </article>
  );
}
