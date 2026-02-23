"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  importPlanAction,
} from "@/app/(app)/import/actions";
import type { ImportActionState } from "@/types/import";

function SubmitButton(props: { label: string; className?: string }) {
  return (
    <button className={props.className} type="submit">
      {props.label}
    </button>
  );
}

function ImportMessage({ state }: { state: ImportActionState }) {
  if (!state.message) {
    return null;
  }

  if (state.status === "error") {
    return <div className="error-message">{state.message}</div>;
  }

  return <div className="success-message">{state.message}</div>;
}

export function ImportFlow() {
  const initialImportState: ImportActionState = {
    status: "idle",
  };

  const [state, formAction, isPending] = useActionState(importPlanAction, initialImportState);

  return (
    <section className="placeholder-card import-card">
      <h1>Импорт плана тренировок</h1>
      <p>Загрузите `.xlsx` или `.csv`, проверьте распознанную структуру и подтвердите импорт.</p>

      <ImportMessage state={state} />

      {state.status !== "saved" ? (
        <form action={formAction} className="import-form">
          <input name="intent" type="hidden" value="preview" />

          <label>
            Файл плана (`.xlsx` или `.csv`)
            <input accept=".xlsx,.csv,text/csv" name="file" required type="file" />
          </label>

          <SubmitButton label={isPending ? "Обработка..." : "Проверить файл"} />
        </form>
      ) : null}

      {state.status === "preview" && state.preview && state.tempFilePath && state.sourceFilename ? (
        <>
          <div className="preview-summary">
            <h2>Предпросмотр импорта</h2>
            <p>
              План: <strong>{state.preview.name}</strong>
            </p>
            <p>
              Недель: <strong>{state.preview.totalWeeks}</strong>, дней: <strong>{state.preview.totalDays}</strong>,
              упражнений: <strong>{state.preview.totalExercises}</strong>
            </p>
          </div>

          <div className="preview-weeks">
            {state.preview.weeks.map((week) => (
              <article key={week.weekNumber} className="preview-week">
                <h3>Неделя {week.weekNumber}</h3>
                {week.days.map((day) => (
                  <div key={`${week.weekNumber}-${day.dayKey}`} className="preview-day">
                    <h4>{day.dayLabel}</h4>
                    <ul>
                      {day.exercises.map((exercise, index) => (
                        <li key={`${day.dayKey}-${index}`}>
                          <span>{exercise.exerciseName}</span>
                          <small>
                            {exercise.intensity ? `${exercise.intensity} • ` : ""}
                            {exercise.rawSetsReps}
                          </small>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </article>
            ))}
          </div>

          <form action={formAction} className="import-confirm-form">
            <input name="intent" type="hidden" value="save" />
            <input name="tempFilePath" type="hidden" value={state.tempFilePath} />
            <input name="sourceFilename" type="hidden" value={state.sourceFilename} />
            <SubmitButton
              className="confirm-button"
              label={isPending ? "Сохранение..." : "Подтвердить и сохранить"}
            />
          </form>
        </>
      ) : null}

      {state.status === "saved" ? (
        <div className="success-panel">
          <p>Импорт завершён. Теперь можно перейти на страницу плана.</p>
          <Link className="ghost-button inline-button" href="/plan">
            Открыть /plan
          </Link>
        </div>
      ) : null}
    </section>
  );
}
