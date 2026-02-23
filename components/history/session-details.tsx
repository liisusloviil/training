import Link from "next/link";
import type { HistorySessionDetails } from "@/types/history";

function formatVolume(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

export function SessionDetails({ details }: { details: HistorySessionDetails }) {
  return (
    <section className="history-details-page">
      <header className="history-details-header">
        <div>
          <h1>{details.sessionDate}</h1>
          <p>
            Неделя {details.weekNumber} - {details.dayLabel} · {details.planName}
          </p>
        </div>

        <div className="history-details-meta">
          <span className={`session-status-badge ${details.status}`}>
            {details.status === "completed" ? "Завершена" : "В процессе"}
          </span>
          <Link className="ghost-button inline-button" href="/history">
            К списку истории
          </Link>
        </div>
      </header>

      <section className="placeholder-card history-details-summary">
        <h2>Сводка</h2>
        <dl>
          <div>
            <dt>Сетов</dt>
            <dd>{details.setsCount}</dd>
          </div>
          <div>
            <dt>Упражнений</dt>
            <dd>{details.exercisesCount}</dd>
          </div>
          <div>
            <dt>Тоннаж</dt>
            <dd>{formatVolume(details.totalVolume)}</dd>
          </div>
        </dl>
        <p className="history-readonly-note">Режим только чтение: редактирование доступно на экране тренировки.</p>
      </section>

      <div className="history-exercise-list">
        {details.exercises.map((exercise) => (
          <article className="history-exercise-card" key={exercise.id}>
            <header>
              <h3>{exercise.exerciseName}</h3>
              <span>
                {exercise.intensity
                  ? `${exercise.intensity} · ${exercise.rawSetsReps}`
                  : exercise.rawSetsReps}
              </span>
            </header>

            {exercise.sets.length ? (
              <div className="history-sets-table">
                <div className="history-sets-row history-sets-head">
                  <span>Сет №</span>
                  <span>Повторы</span>
                  <span>Вес</span>
                </div>

                {exercise.sets.map((set) => (
                  <div className="history-sets-row" key={set.id}>
                    <span>{set.setNumber}</span>
                    <span>{set.reps}</span>
                    <span>{set.weight}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="plan-day-empty">Сеты для упражнения не сохранены.</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
