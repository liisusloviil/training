import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getSetsPayloadLimitError,
  SETS_PAYLOAD_LIMIT_MESSAGE,
} from "@/lib/workout/sets-payload-limits";

const revalidatePathMock = vi.fn();
const createClientMock = vi.fn();
const getSessionStatusForUserMock = vi.fn();
const getPlanExerciseRulesForPlanDayMock = vi.fn();
const upsertSessionSetsMock = vi.fn();
const pruneSessionSetsOutsideAllowedMock = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/db/session-queries", () => ({
  getSessionStatusForUser: getSessionStatusForUserMock,
  getPlanExerciseRulesForPlanDay: getPlanExerciseRulesForPlanDayMock,
  verifyPlanDayBelongsActivePlan: vi.fn(),
  countSessionSetsForUser: vi.fn(),
}));

vi.mock("@/lib/db/session-repository", () => ({
  upsertSessionSets: upsertSessionSetsMock,
  pruneSessionSetsOutsideAllowed: pruneSessionSetsOutsideAllowedMock,
  createWorkoutSession: vi.fn(),
  findSessionByDateAndDay: vi.fn(),
  completeWorkoutSession: vi.fn(),
}));

const { upsertSessionSetsAction } = await import("@/app/(app)/workout/actions");

function buildFormData(payload: string): FormData {
  const formData = new FormData();
  formData.set("session_id", "33333333-3333-4333-8333-333333333333");
  formData.set("sets_payload", payload);
  return formData;
}

describe("integration: sets payload guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockResolvedValue({});
  });

  it("client pre-check returns deterministic business error for oversized rows payload", () => {
    const oversizedRowsPayload = JSON.stringify(
      Array.from({ length: 301 }, (_, index) => ({
        planExerciseId: `ex-${index}`,
        setNumber: "1",
        reps: "10",
        weight: "50",
      })),
    );

    expect(getSetsPayloadLimitError(oversizedRowsPayload)).toBe(
      SETS_PAYLOAD_LIMIT_MESSAGE,
    );
  });

  it("returns null for normal payload in client pre-check", () => {
    const payload = JSON.stringify([
      {
        planExerciseId: "44444444-4444-4444-8444-444444444444",
        setNumber: "1",
        reps: "10",
        weight: "50",
      },
    ]);

    expect(getSetsPayloadLimitError(payload)).toBeNull();
  });

  it("server guard rejects oversized payload before DB reads and parse-heavy flow", async () => {
    const oversizedRowsPayload = JSON.stringify(
      Array.from({ length: 301 }, (_, index) => ({
        planExerciseId: `ex-${index}`,
        setNumber: "1",
        reps: "10",
        weight: "50",
      })),
    );

    const result = await upsertSessionSetsAction(
      { status: "idle" },
      buildFormData(oversizedRowsPayload),
    );

    expect(result.status).toBe("error");
    expect(result.message).toBe(SETS_PAYLOAD_LIMIT_MESSAGE);
    expect(getSessionStatusForUserMock).not.toHaveBeenCalled();
    expect(getPlanExerciseRulesForPlanDayMock).not.toHaveBeenCalled();
    expect(upsertSessionSetsMock).not.toHaveBeenCalled();
  });

  it("server guard also rejects payload by byte-size limit with same business message", async () => {
    const byteOversizedPayload = `[{"blob":"${"x".repeat(70_000)}"}]`;

    const result = await upsertSessionSetsAction(
      { status: "idle" },
      buildFormData(byteOversizedPayload),
    );

    expect(result.status).toBe("error");
    expect(result.message).toBe(SETS_PAYLOAD_LIMIT_MESSAGE);
    expect(getSessionStatusForUserMock).not.toHaveBeenCalled();
    expect(getPlanExerciseRulesForPlanDayMock).not.toHaveBeenCalled();
  });

  it("normal payload still saves successfully", async () => {
    getSessionStatusForUserMock.mockResolvedValue({
      sessionId: "33333333-3333-4333-8333-333333333333",
      status: "in_progress",
      planDayId: "11111111-1111-4111-8111-111111111111",
      userId: "u-1",
    });

    getPlanExerciseRulesForPlanDayMock.mockResolvedValue(
      new Map([
        [
          "44444444-4444-4444-8444-444444444444",
          {
            effectiveSetCount: 1,
            effectiveRepsMin: 8,
            effectiveRepsMax: 12,
          },
        ],
      ]),
    );

    const validPayload = JSON.stringify([
      {
        planExerciseId: "44444444-4444-4444-8444-444444444444",
        setNumber: "1",
        reps: "10",
        weight: "60",
      },
    ]);

    const result = await upsertSessionSetsAction(
      { status: "idle" },
      buildFormData(validPayload),
    );

    expect(result.status).toBe("success");
    expect(result.message).toContain("Сеты сохранены");
    expect(upsertSessionSetsMock).toHaveBeenCalledTimes(1);
    expect(pruneSessionSetsOutsideAllowedMock).toHaveBeenCalledTimes(1);
  });
});
