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
  setNumber: number;
  weight: string;
  savedReps?: number;
};

type ExerciseDraft = {
  exercise: SessionExerciseReadModel;
  effectiveSetCount: number;
  repsMin: number;
  repsMax: number;
  isRepsFallback: boolean;
  selectedReps: number;
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

function toPositiveInt(value: number | null | undefined, fallback: number): number {
  if (Number.isInteger(value) && Number(value) > 0) {
    return Number(value);
  }

  return fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildRepsOptions(min: number, max: number): number[] {
  const start = toPositiveInt(min, 1);
  const end = Math.max(start, toPositiveInt(max, start));

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function buildEditableDraft(exercise: SessionExerciseReadModel): ExerciseDraft {
  const effectiveSetCount = toPositiveInt(exercise.effectiveSetCount, 1);
  const repsMin = toPositiveInt(exercise.effectiveRepsMin, 1);
  const repsMax = Math.max(repsMin, toPositiveInt(exercise.effectiveRepsMax, repsMin));

  const setsByNumber = new Map(
    exercise.sets
      .filter((set) => set.setNumber >= 1 && set.setNumber <= effectiveSetCount)
      .map((set) => [set.setNumber, set]),
  );

  const firstSetReps = exercise.sets.find((set) => Number.isInteger(set.reps))?.reps;
  const selectedReps = clamp(
    Number.isInteger(firstSetReps) ? Number(firstSetReps) : repsMin,
    repsMin,
    repsMax,
  );

  const rows: DraftSetRow[] = Array.from({ length: effectiveSetCount }, (_, index) => {
    const setNumber = index + 1;
    const existing = setsByNumber.get(setNumber);

    return {
      localId: makeLocalId(),
      setNumber,
      weight: existing ? String(existing.weight) : "",
    };
  });

  return {
    exercise,
    effectiveSetCount,
    repsMin,
    repsMax,
    isRepsFallback: exercise.isRepsFallback,
    selectedReps,
    rows,
  };
}

function buildReadOnlyDraft(exercise: SessionExerciseReadModel): ExerciseDraft {
  const rows: DraftSetRow[] = [...exercise.sets]
    .sort((a, b) => a.setNumber - b.setNumber)
    .map((set) => ({
      localId: makeLocalId(),
      setNumber: set.setNumber,
      weight: String(set.weight),
      savedReps: set.reps,
    }));

  const firstReps = rows[0]?.savedReps;
  const safeReps = Number.isInteger(firstReps) ? Number(firstReps) : 1;

  return {
    exercise,
    effectiveSetCount: Math.max(rows.length, 1),
    repsMin: safeReps,
    repsMax: safeReps,
    isRepsFallback: false,
    selectedReps: safeReps,
    rows,
  };
}

function RepsControl(props: {
  draft: ExerciseDraft;
  exerciseIndex: number;
  isReadOnly: boolean;
  onChange: (value: number) => void;
}) {
  const { draft, exerciseIndex, isReadOnly, onChange } = props;
  const controlLabel = `Повторы для упражнения ${exerciseIndex + 1}: ${draft.exercise.exerciseName}`;

  if (isReadOnly) {
    return null;
  }

  if (draft.repsMin === draft.repsMax) {
    return (
      <div className="workout-reps-static">
        {controlLabel}: <strong>{draft.repsMin}</strong>{" "}
        <small>{draft.isRepsFallback ? "(по умолчанию)" : "(фиксировано планом)"}</small>
      </div>
    );
  }

  const repsOptions = buildRepsOptions(draft.repsMin, draft.repsMax);

  return (
    <div className="workout-reps-control">
      <div className="workout-reps-control-head">
        <span>{controlLabel}</span>
        <strong>{draft.selectedReps}</strong>
      </div>
      <select
        aria-label={controlLabel}
        onChange={(event) => onChange(Number(event.target.value))}
        value={String(draft.selectedReps)}
      >
        {repsOptions.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      <small>
        Диапазон: {draft.repsMin}-{draft.repsMax}
      </small>
    </div>
  );
}

export function SessionSetsForm({
  sessionId,
  status,
  exercises,
}: SessionSetsFormProps) {
  const initialSessionSetsState: SessionSetsActionState = { status: "idle" };
  const initialCompleteSessionState: CompleteSessionActionState = { status: "idle" };

  const isReadOnly = status === "completed";

  const [drafts, setDrafts] = useState<ExerciseDraft[]>(() =>
    exercises.map((exercise) =>
      isReadOnly ? buildReadOnlyDraft(exercise) : buildEditableDraft(exercise),
    ),
  );

  const [saveState, saveAction, isSaving] = useActionState(
    upsertSessionSetsAction,
    initialSessionSetsState,
  );
  const [completeState, completeAction, isCompleting] = useActionState(
    completeSessionAction,
    initialCompleteSessionState,
  );

  const payload = useMemo(() => {
    if (isReadOnly) {
      return "[]";
    }

    return JSON.stringify(
      drafts.flatMap((draft) =>
        draft.rows.map((row) => ({
          planExerciseId: draft.exercise.id,
          setNumber: String(row.setNumber),
          reps: String(draft.selectedReps),
          weight: row.weight.trim(),
        })),
      ),
    );
  }, [drafts, isReadOnly]);

  const updateWeight = (
    exerciseId: string,
    setNumber: number,
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
            row.setNumber === setNumber ? { ...row, weight: value } : row,
          ),
        };
      }),
    );
  };

  const updateSelectedReps = (exerciseId: string, value: number) => {
    setDrafts((previous) =>
      previous.map((draft) => {
        if (draft.exercise.id !== exerciseId) {
          return draft;
        }

        return {
          ...draft,
          selectedReps: clamp(value, draft.repsMin, draft.repsMax),
        };
      }),
    );
  };

  return (
    <section className="placeholder-card workout-card">
      <h2>Фактические сеты</h2>
      <p>
        Повторы выбираются один раз на упражнение и применяются ко всем
        подходам. Количество подходов фиксируется планом.
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
          {drafts.map((draft, draftIndex) => (
            <article className="workout-exercise-card" key={draft.exercise.id}>
              <header>
                <h3>{draft.exercise.exerciseName}</h3>
                <span>
                  {draft.exercise.intensity
                    ? `${draft.exercise.intensity} · ${draft.exercise.rawSetsReps}`
                    : draft.exercise.rawSetsReps}
                </span>
              </header>

              <RepsControl
                draft={draft}
                exerciseIndex={draftIndex}
                isReadOnly={isReadOnly}
                onChange={(value) => updateSelectedReps(draft.exercise.id, value)}
              />

              <div className="workout-set-table">
                <div className="workout-set-row workout-set-head">
                  <span>Сет №</span>
                  <span>Повторы</span>
                  <span>Вес</span>
                </div>

                {draft.rows.map((row) => (
                  <div className="workout-set-row" key={row.localId}>
                    <span className="workout-set-static">#{row.setNumber}</span>
                    <span className="workout-set-static">
                      {isReadOnly
                        ? row.savedReps ?? draft.selectedReps
                        : draft.selectedReps}
                    </span>

                    {isReadOnly ? (
                      <span className="workout-set-static">{row.weight}</span>
                    ) : (
                      <input
                        aria-label={`Вес: ${draft.exercise.exerciseName}, сет ${row.setNumber}`}
                        inputMode="decimal"
                        min={0}
                        onChange={(event) =>
                          updateWeight(
                            draft.exercise.id,
                            row.setNumber,
                            event.target.value,
                          )
                        }
                        step={0.25}
                        type="number"
                        value={row.weight}
                      />
                    )}
                  </div>
                ))}
              </div>
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
