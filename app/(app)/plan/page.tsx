import Link from "next/link";
import { PlanEmptyState } from "@/components/plan/plan-empty-state";
import { PlanWeek } from "@/components/plan/plan-week";
import { getCurrentPlanQuery } from "@/lib/db/plan-queries";
import { logCriticalError } from "@/lib/observability/server-logger";
import type { ActiveTrainingPlanReadModel } from "@/types/plan";

export default async function PlanPage() {
  let plan: ActiveTrainingPlanReadModel | null = null;
  let hasReadError = false;

  try {
    plan = await getCurrentPlanQuery();
  } catch (error) {
    hasReadError = true;
    logCriticalError("plan_page_read", error);
  }

  if (hasReadError) {
    return (
      <section className="placeholder-card plan-error-state">
        <h1>Не удалось загрузить план</h1>
        <p>Попробуйте обновить страницу или повторно импортировать файл плана.</p>
        <div className="plan-page-actions">
          <Link className="ghost-button inline-button" href="/import">
            Перейти к импорту
          </Link>
        </div>
      </section>
    );
  }

  if (!plan) {
    return <PlanEmptyState />;
  }

  const totalDays = plan.weeks.reduce((sum, week) => sum + week.days.length, 0);
  const totalExercises = plan.weeks.reduce(
    (sum, week) =>
      sum + week.days.reduce((daySum, day) => daySum + day.exercises.length, 0),
    0,
  );

  return (
    <section className="plan-page">
      <header className="plan-page-header">
        <div>
          <h1>{plan.name}</h1>
          <p>
            Недель: <strong>{plan.weeks.length}</strong>, дней: <strong>{totalDays}</strong>, упражнений:{" "}
            <strong>{totalExercises}</strong>
          </p>
        </div>

        <div className="plan-page-actions">
          <Link className="ghost-button inline-button" href="/import">
            Обновить из файла
          </Link>
          <Link className="primary-link-button" href="/workout/new">
            Начать тренировку
          </Link>
        </div>
      </header>

      <div className="plan-weeks-grid">
        {plan.weeks.map((week) => (
          <PlanWeek key={week.id} week={week} />
        ))}
      </div>
    </section>
  );
}
