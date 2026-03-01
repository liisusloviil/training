import { HistoryFilters } from "@/components/history/history-filters";
import { HistoryList } from "@/components/history/history-list";
import { getHistoryQuery } from "@/lib/db/history-queries";
import { logCriticalError } from "@/lib/observability/server-logger";
import type { HistoryQueryResult, HistoryStatusFilter } from "@/types/history";

type HistoryPageProps = {
  searchParams: Promise<{
    page?: string;
    from?: string;
    to?: string;
    status?: string;
  }>;
};

function parsePage(raw: string | undefined): number {
  const value = Number.parseInt(raw ?? "1", 10);
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }
  return value;
}

function parseDateFilter(raw: string | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return undefined;
  }

  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString().slice(0, 10) === raw ? raw : undefined;
}

function parseStatus(raw: string | undefined): HistoryStatusFilter {
  if (raw === "completed" || raw === "in_progress" || raw === "all") {
    return raw;
  }

  return "completed";
}

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const from = parseDateFilter(params.from);
  const to = parseDateFilter(params.to);
  const status = parseStatus(params.status);

  let result: HistoryQueryResult | null = null;
  let hasError = false;

  try {
    result = await getHistoryQuery({
      page,
      pageSize: 12,
      from,
      to,
      status,
    });
  } catch (error) {
    hasError = true;
    logCriticalError("history_page_read", error, {
      page,
      pageSize: 12,
      from,
      to,
      status,
    });
  }

  if (hasError || !result) {
    return (
      <section className="placeholder-card history-error-state">
        <h1>Не удалось загрузить историю</h1>
        <p>Проверьте фильтры и попробуйте обновить страницу.</p>
      </section>
    );
  }

  return (
    <section className="history-page">
      <header className="history-page-header">
        <div>
          <h1>История тренировок</h1>
          <p>Список сессий в read-only режиме с переходом к подробным данным.</p>
        </div>
      </header>

      <HistoryFilters from={result.from} status={result.status} to={result.to} />
      <HistoryList result={result} />
    </section>
  );
}
