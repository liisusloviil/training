import Link from "next/link";
import type { WorkoutSessionReadModel } from "@/types/session";

export function SessionHeader({ session }: { session: WorkoutSessionReadModel }) {
  const statusLabel =
    session.status === "completed" ? "Завершена" : "В процессе";
  const historyHref =
    session.status === "completed" ? `/history/${session.id}` : "/history";
  const historyLabel =
    session.status === "completed" ? "Открыть в истории" : "История";

  return (
    <header className="workout-session-header">
      <div>
        <h1>
          Неделя {session.weekNumber} - {session.dayLabel}
        </h1>
        <p>
          План: <strong>{session.planName}</strong> · Дата: <strong>{session.sessionDate}</strong>
        </p>
      </div>

      <div className="workout-session-meta">
        <span className={`session-status-badge ${session.status}`}>
          {statusLabel}
        </span>
        <div className="workout-session-links">
          <Link className="ghost-button inline-button" href="/plan">
            К плану
          </Link>
          <Link className="ghost-button inline-button" href={historyHref}>
            {historyLabel}
          </Link>
        </div>
      </div>
    </header>
  );
}
