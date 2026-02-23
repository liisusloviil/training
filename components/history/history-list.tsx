import Link from "next/link";
import type { HistoryQueryResult } from "@/types/history";

type HistoryListProps = {
  result: HistoryQueryResult;
};

function formatVolume(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function buildPageHref(result: HistoryQueryResult, page: number) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("status", result.status);

  if (result.from) {
    params.set("from", result.from);
  }

  if (result.to) {
    params.set("to", result.to);
  }

  return `/history?${params.toString()}`;
}

export function HistoryList({ result }: HistoryListProps) {
  if (!result.items.length) {
    return (
      <section className="placeholder-card history-empty-state">
        <h2>История пока пустая</h2>
        <p>После завершения тренировок здесь появятся ваши сессии.</p>
        <Link className="ghost-button inline-button" href="/workout/new">
          Начать тренировку
        </Link>
      </section>
    );
  }

  const hasPrev = result.page > 1;
  const hasNext = result.page < result.totalPages;

  return (
    <section className="history-list-wrap">
      <div className="history-list-meta">
        <span>Всего сессий: {result.total}</span>
        <span>
          Страница {result.page} из {result.totalPages}
        </span>
      </div>

      <div className="history-list">
        {result.items.map((item) => (
          <article className="history-item-card" key={item.id}>
            <header>
              <h3>{item.sessionDate}</h3>
              <span className={`session-status-badge ${item.status}`}>
                {item.status === "completed" ? "Завершена" : "В процессе"}
              </span>
            </header>

            <p>
              Неделя {item.weekNumber} - {item.dayLabel} · {item.planName}
            </p>

            <dl>
              <div>
                <dt>Сетов</dt>
                <dd>{item.setsCount}</dd>
              </div>
              <div>
                <dt>Упражнений</dt>
                <dd>{item.exercisesCount}</dd>
              </div>
              <div>
                <dt>Тоннаж</dt>
                <dd>{formatVolume(item.totalVolume)}</dd>
              </div>
            </dl>

            <Link className="primary-link-button" href={`/history/${item.id}`}>
              Открыть детали
            </Link>
          </article>
        ))}
      </div>

      <nav className="history-pagination">
        {hasPrev ? (
          <Link className="ghost-button inline-button" href={buildPageHref(result, result.page - 1)}>
            Предыдущая
          </Link>
        ) : (
          <span className="history-pagination-placeholder" />
        )}

        {hasNext ? (
          <Link className="ghost-button inline-button" href={buildPageHref(result, result.page + 1)}>
            Следующая
          </Link>
        ) : (
          <span className="history-pagination-placeholder" />
        )}
      </nav>
    </section>
  );
}
