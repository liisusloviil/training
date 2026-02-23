"use client";

import { useActionState, useMemo, useState } from "react";
import {
  completeSessionAction,
  upsertSessionSetsAction,
} from "@/app/(app)/workout/actions";
import type {
  CompleteSessionActionState,
  SessionExerciseReadModel,
  SessionSetsActionState,
  WorkoutSessionStatus,
} from "@/types/session";

type DraftSetRow = {
  localId: string;
  planExerciseId: string;
  setNumber: string;
  reps: string;
  weight: string;
};

type ExerciseDraft = {
  exercise: SessionExerciseReadModel;
  rows: DraftSetRow[];
};

type SessionSetsFormProps = {
  sessionId: string;
  status: WorkoutSessionStatus;
  exercises: SessionExerciseReadModel[];
};

function makeLocalId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildInitialRows(exercise: SessionExerciseReadModel): DraftSetRow[] {
  if (!exercise.sets.length) {
    return [
      {
        localId: makeLocalId(),
        planExerciseId: exercise.id,
        setNumber: "1",
        reps: "",
        weight: "",
      },
    ];
  }

  return exercise.sets.map((set) => ({
    localId: makeLocalId(),
    planExerciseId: exercise.id,
    setNumber: String(set.setNumber),
    reps: String(set.reps),
    weight: String(set.weight),
  }));
}

export function SessionSetsForm({
  sessionId,
  status,
  exercises,
}: SessionSetsFormProps) {
  const initialSessionSetsState: SessionSetsActionState = { status: "idle" };
  const initialCompleteSessionState: CompleteSessionActionState = { status: "idle" };

  const [drafts, setDrafts] = useState<ExerciseDraft[]>(() =>
    exercises.map((exercise) => ({
      exercise,
      rows: buildInitialRows(exercise),
    })),
  );

  const isReadOnly = status === "completed";

  const [saveState, saveAction, isSaving] = useActionState(
    upsertSessionSetsAction,
    initialSessionSetsState,
  );
  const [completeState, completeAction, isCompleting] = useActionState(
    completeSessionAction,
    initialCompleteSessionState,
  );

  const payload = useMemo(
    () =>
      JSON.stringify(
        drafts.flatMap((draft) =>
          draft.rows.map((row) => ({
            planExerciseId: row.planExerciseId,
            setNumber: row.setNumber,
            reps: row.reps,
            weight: row.weight,
          })),
        ),
      ),
    [drafts],
  );

  const updateRow = (
    exerciseId: string,
    localId: string,
    field: keyof Pick<DraftSetRow, "setNumber" | "reps" | "weight">,
    value: string,
  ) => {
    setDrafts((previous) =>
      previous.map((draft) => {
        if (draft.exercise.id !== exerciseId) {
          return draft;
        }

        return {
          ...draft,
          rows: draft.rows.map((row) =>
            row.localId === localId ? { ...row, [field]: value } : row,
          ),
        };
      }),
    );
  };

  const addRow = (exerciseId: string) => {
    setDrafts((previous) =>
      previous.map((draft) => {
        if (draft.exercise.id !== exerciseId) {
          return draft;
        }

        const maxSet = draft.rows.reduce((max, row) => {
          const parsed = Number.parseInt(row.setNumber, 10);
          return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
        }, 0);

        return {
          ...draft,
          rows: [
            ...draft.rows,
            {
              localId: makeLocalId(),
              planExerciseId: exerciseId,
              setNumber: String(maxSet + 1),
              reps: "",
              weight: "",
            },
          ],
        };
      }),
    );
  };

  return (
    <section className="placeholder-card workout-card">
      <h2>Фактические сеты</h2>
      <p>
        Введите выполненные подходы. Повторное сохранение обновляет существующие
        сеты по ключу exercise + set_number.
      </p>

      {isReadOnly ? (
        <div className="success-message">
          Сессия завершена и переведена в режим только чтения.
        </div>
      ) : null}

      {saveState.status === "error" && saveState.message ? (
        <div className="error-message">{saveState.message}</div>
      ) : null}
      {saveState.status === "success" && saveState.message ? (
        <div className="success-message">{saveState.message}</div>
      ) : null}

      {completeState.status === "error" && completeState.message ? (
        <div className="error-message">{completeState.message}</div>
      ) : null}

      <form action={saveAction} className="workout-sets-form">
        <input name="session_id" type="hidden" value={sessionId} />
        <input name="sets_payload" type="hidden" value={payload} />

        <div className="workout-exercise-list">
          {drafts.map((draft) => (
            <article className="workout-exercise-card" key={draft.exercise.id}>
              <header>
                <h3>{draft.exercise.exerciseName}</h3>
                <span>
                  {draft.exercise.intensity
                    ? `${draft.exercise.intensity} · ${draft.exercise.rawSetsReps}`
                    : draft.exercise.rawSetsReps}
                </span>
              </header>

              <div className="workout-set-table">
                <div className="workout-set-row workout-set-head">
                  <span>Сет №</span>
                  <span>Повторы</span>
                  <span>Вес</span>
                </div>

                {draft.rows.map((row) => (
                  <div className="workout-set-row" key={row.localId}>
                    <input
                      disabled={isReadOnly}
                      inputMode="numeric"
                      min={1}
                      onChange={(event) =>
                        updateRow(
                          draft.exercise.id,
                          row.localId,
                          "setNumber",
                          event.target.value,
                        )
                      }
                      step={1}
                      type="number"
                      value={row.setNumber}
                    />
                    <input
                      disabled={isReadOnly}
                      inputMode="numeric"
                      min={0}
                      onChange={(event) =>
                        updateRow(
                          draft.exercise.id,
                          row.localId,
                          "reps",
                          event.target.value,
                        )
                      }
                      step={1}
                      type="number"
                      value={row.reps}
                    />
                    <input
                      disabled={isReadOnly}
                      inputMode="decimal"
                      min={0}
                      onChange={(event) =>
                        updateRow(
                          draft.exercise.id,
                          row.localId,
                          "weight",
                          event.target.value,
                        )
                      }
                      step={0.25}
                      type="number"
                      value={row.weight}
                    />
                  </div>
                ))}
              </div>

              {!isReadOnly ? (
                <button
                  className="ghost-button inline-button"
                  onClick={() => addRow(draft.exercise.id)}
                  type="button"
                >
                  Добавить сет
                </button>
              ) : null}
            </article>
          ))}
        </div>

        {!isReadOnly ? (
          <button className="primary-link-button" type="submit">
            {isSaving ? "Сохранение..." : "Сохранить сеты"}
          </button>
        ) : null}
      </form>

      {!isReadOnly ? (
        <form action={completeAction} className="workout-complete-form">
          <input name="session_id" type="hidden" value={sessionId} />
          <button className="ghost-button" type="submit">
            {isCompleting ? "Завершение..." : "Завершить тренировку"}
          </button>
        </form>
      ) : null}
    </section>
  );
}
