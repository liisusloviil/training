import Link from "next/link";
import { SessionHeader } from "@/components/workout/session-header";
import { SessionSetsForm } from "@/components/workout/session-sets-form";
import { getSessionDetailsQuery } from "@/lib/db/session-queries";
import type { WorkoutSessionReadModel } from "@/types/session";

type WorkoutSessionPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function WorkoutSessionPage({ params }: WorkoutSessionPageProps) {
  const { sessionId } = await params;

  let session: WorkoutSessionReadModel | null = null;
  let hasReadError = false;

  try {
    session = await getSessionDetailsQuery(sessionId);
  } catch {
    hasReadError = true;
  }

  if (hasReadError) {
    return (
      <section className="placeholder-card">
        <h1>Не удалось загрузить сессию</h1>
        <p>Попробуйте обновить страницу или создать новую тренировку.</p>
        <Link className="ghost-button inline-button" href="/workout/new">
          Перейти к созданию сессии
        </Link>
      </section>
    );
  }

  if (!session) {
    return (
      <section className="placeholder-card">
        <h1>Сессия не найдена</h1>
        <p>Возможно, у вас нет доступа к этой сессии или она была удалена.</p>
        <Link className="ghost-button inline-button" href="/workout/new">
          Создать новую сессию
        </Link>
      </section>
    );
  }

  return (
    <section className="workout-page">
      <SessionHeader session={session} />
      <SessionSetsForm
        exercises={session.exercises}
        sessionId={session.id}
        status={session.status}
      />
    </section>
  );
}
