import Link from "next/link";
import { SessionDetails } from "@/components/history/session-details";
import { getHistorySessionDetailsQuery } from "@/lib/db/history-queries";
import type { HistorySessionDetails } from "@/types/history";

type HistoryDetailsPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function HistoryDetailsPage({ params }: HistoryDetailsPageProps) {
  const { sessionId } = await params;

  let details: HistorySessionDetails | null = null;
  let hasError = false;

  try {
    details = await getHistorySessionDetailsQuery(sessionId);
  } catch {
    hasError = true;
  }

  if (hasError) {
    return (
      <section className="placeholder-card history-error-state">
        <h1>Не удалось загрузить детали сессии</h1>
        <p>Попробуйте обновить страницу или вернуться к списку истории.</p>
        <Link className="ghost-button inline-button" href="/history">
          К истории
        </Link>
      </section>
    );
  }

  if (!details) {
    return (
      <section className="placeholder-card history-error-state">
        <h1>Сессия недоступна</h1>
        <p>Сессия не найдена или у вас нет доступа к этому `sessionId`.</p>
        <Link className="ghost-button inline-button" href="/history">
          К истории
        </Link>
      </section>
    );
  }

  return <SessionDetails details={details} />;
}
