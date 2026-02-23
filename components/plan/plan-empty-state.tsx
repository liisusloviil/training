import Link from "next/link";

export function PlanEmptyState() {
  return (
    <section className="placeholder-card plan-empty-state">
      <h1>План тренировок пока не импортирован</h1>
      <p>Загрузите Excel-файл, чтобы увидеть структуру недель, дней и упражнений.</p>
      <Link className="ghost-button inline-button" href="/import">
        Импортировать файл
      </Link>
    </section>
  );
}
