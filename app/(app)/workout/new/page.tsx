import Link from "next/link";
import { SessionCreateForm } from "@/components/workout/session-create-form";
import { getWorkoutNewContextQuery } from "@/lib/db/session-queries";
import type { WorkoutNewContext } from "@/types/session";

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

export default async function WorkoutNewPage() {
  let context: WorkoutNewContext | null = null;
  let hasReadError = false;

  try {
    context = await getWorkoutNewContextQuery();
  } catch {
    hasReadError = true;
  }

  if (hasReadError) {
    return (
      <section className="placeholder-card">
        <h1>Не удалось подготовить создание сессии</h1>
        <p>Попробуйте обновить страницу или вернуться к плану.</p>
        <Link className="ghost-button inline-button" href="/plan">
          Вернуться к плану
        </Link>
      </section>
    );
  }

  if (!context) {
    return (
      <section className="placeholder-card">
        <h1>Активный план не найден</h1>
        <p>Сначала импортируйте файл плана, затем создайте тренировочную сессию.</p>
        <Link className="ghost-button inline-button" href="/import">
          Импортировать файл
        </Link>
      </section>
    );
  }

  if (!context.dayOptions.length) {
    return (
      <section className="placeholder-card">
        <h1>В активном плане нет тренировочных дней</h1>
        <p>Обновите импорт файла и убедитесь, что в плане есть дни с упражнениями.</p>
        <Link className="ghost-button inline-button" href="/import">
          Обновить импорт
        </Link>
      </section>
    );
  }

  return (
    <SessionCreateForm
      dayOptions={context.dayOptions}
      defaultDate={getTodayDateString()}
    />
  );
}
