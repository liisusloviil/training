import Link from "next/link";
import type { HistoryStatusFilter } from "@/types/history";

type HistoryFiltersProps = {
  from?: string;
  to?: string;
  status: HistoryStatusFilter;
};

export function HistoryFilters({ from, to, status }: HistoryFiltersProps) {
  return (
    <form action="/history" className="history-filters">
      <input name="page" type="hidden" value="1" />

      <label>
        From
        <input defaultValue={from ?? ""} name="from" type="date" />
      </label>

      <label>
        To
        <input defaultValue={to ?? ""} name="to" type="date" />
      </label>

      <label>
        Статус
        <select defaultValue={status} name="status">
          <option value="completed">Только завершенные</option>
          <option value="in_progress">Только в процессе</option>
          <option value="all">Все</option>
        </select>
      </label>

      <div className="history-filter-actions">
        <button type="submit">Применить</button>
        <Link className="ghost-button inline-button" href="/history">
          Сбросить
        </Link>
      </div>
    </form>
  );
}
