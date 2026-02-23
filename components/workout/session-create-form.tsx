"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  createSessionAction,
} from "@/app/(app)/workout/actions";
import type { CreateSessionActionState, PlanDayOption } from "@/types/session";

type SessionCreateFormProps = {
  dayOptions: PlanDayOption[];
  defaultDate: string;
};

export function SessionCreateForm({ dayOptions, defaultDate }: SessionCreateFormProps) {
  const initialCreateSessionState: CreateSessionActionState = { status: "idle" };

  const [state, formAction, isPending] = useActionState(
    createSessionAction,
    initialCreateSessionState,
  );

  return (
    <section className="placeholder-card workout-card">
      <h1>Новая тренировка</h1>
      <p>Выберите день плана и дату, чтобы создать тренировочную сессию.</p>

      {state.status === "error" && state.message ? (
        <div className="error-message">
          <div>{state.message}</div>
          {state.existingSessionId ? (
            <div className="error-link-wrap">
              <Link href={`/workout/${state.existingSessionId}`}>
                Открыть уже существующую сессию
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      <form action={formAction} className="workout-create-form">
        <label>
          День плана
          <select defaultValue={dayOptions[0]?.planDayId ?? ""} name="plan_day_id" required>
            {dayOptions.map((option) => (
              <option key={option.planDayId} value={option.planDayId}>
                Неделя {option.weekNumber} - {option.dayLabel}
              </option>
            ))}
          </select>
        </label>

        <label>
          Дата тренировки
          <input defaultValue={defaultDate} name="session_date" required type="date" />
        </label>

        <button type="submit">{isPending ? "Создание..." : "Создать сессию"}</button>
      </form>
    </section>
  );
}
