import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
const revalidatePathMock = vi.fn();

const createClientMock = vi.fn();
const verifyPlanDayBelongsActivePlanMock = vi.fn();
const getSessionStatusForUserMock = vi.fn();
const getExerciseIdsForPlanDayMock = vi.fn();
const countSessionSetsForUserMock = vi.fn();

const createWorkoutSessionMock = vi.fn();
const findSessionByDateAndDayMock = vi.fn();
const upsertSessionSetsMock = vi.fn();
const completeWorkoutSessionMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/db/session-queries", () => ({
  verifyPlanDayBelongsActivePlan: verifyPlanDayBelongsActivePlanMock,
  getSessionStatusForUser: getSessionStatusForUserMock,
  getExerciseIdsForPlanDay: getExerciseIdsForPlanDayMock,
  countSessionSetsForUser: countSessionSetsForUserMock,
}));

vi.mock("@/lib/db/session-repository", () => ({
  createWorkoutSession: createWorkoutSessionMock,
  findSessionByDateAndDay: findSessionByDateAndDayMock,
  upsertSessionSets: upsertSessionSetsMock,
  completeWorkoutSession: completeWorkoutSessionMock,
}));

const { createSessionAction, upsertSessionSetsAction, completeSessionAction } =
  await import("@/app/(app)/workout/actions");

describe("integration: workout actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockResolvedValue({});
  });

  it("returns validation error for invalid session date", async () => {
    const formData = new FormData();
    formData.set("plan_day_id", "11111111-1111-4111-8111-111111111111");
    formData.set("session_date", "2026-13-99");

    const result = await createSessionAction({ status: "idle" }, formData);

    expect(result.status).toBe("error");
    expect(result.message).toContain("дату");
  });

  it("returns duplicate session UX error with existing session id", async () => {
    verifyPlanDayBelongsActivePlanMock.mockResolvedValue({ ok: true, userId: "u-1" });
    createWorkoutSessionMock.mockRejectedValue({ code: "23505" });
    findSessionByDateAndDayMock.mockResolvedValue(
      "22222222-2222-4222-8222-222222222222",
    );

    const formData = new FormData();
    formData.set("plan_day_id", "11111111-1111-4111-8111-111111111111");
    formData.set("session_date", "2026-02-23");

    const result = await createSessionAction({ status: "idle" }, formData);

    expect(result.status).toBe("error");
    expect(result.message).toContain("уже существует");
    expect(result.existingSessionId).toBe(
      "22222222-2222-4222-8222-222222222222",
    );
  });

  it("upserts normalized sets and deduplicates same exercise/set pair", async () => {
    getSessionStatusForUserMock.mockResolvedValue({
      sessionId: "33333333-3333-4333-8333-333333333333",
      status: "in_progress",
      planDayId: "11111111-1111-4111-8111-111111111111",
      userId: "u-1",
    });
    getExerciseIdsForPlanDayMock.mockResolvedValue(
      new Set(["44444444-4444-4444-8444-444444444444"]),
    );

    const payload = JSON.stringify([
      {
        planExerciseId: "44444444-4444-4444-8444-444444444444",
        setNumber: "1",
        reps: "10",
        weight: "60",
      },
      {
        planExerciseId: "44444444-4444-4444-8444-444444444444",
        setNumber: "1",
        reps: "12",
        weight: "62.5",
      },
    ]);

    const formData = new FormData();
    formData.set("session_id", "33333333-3333-4333-8333-333333333333");
    formData.set("sets_payload", payload);

    const result = await upsertSessionSetsAction({ status: "idle" }, formData);

    expect(result.status).toBe("success");
    expect(upsertSessionSetsMock).toHaveBeenCalledTimes(1);

    const call = upsertSessionSetsMock.mock.calls[0]?.[0];
    expect(call?.sets).toHaveLength(1);
    expect(call?.sets[0]?.reps).toBe(12);
    expect(call?.sets[0]?.weight).toBe(62.5);
  });

  it("blocks saving sets with negative values", async () => {
    getSessionStatusForUserMock.mockResolvedValue({
      sessionId: "33333333-3333-4333-8333-333333333333",
      status: "in_progress",
      planDayId: "11111111-1111-4111-8111-111111111111",
      userId: "u-1",
    });
    getExerciseIdsForPlanDayMock.mockResolvedValue(
      new Set(["44444444-4444-4444-8444-444444444444"]),
    );

    const formData = new FormData();
    formData.set("session_id", "33333333-3333-4333-8333-333333333333");
    formData.set(
      "sets_payload",
      JSON.stringify([
        {
          planExerciseId: "44444444-4444-4444-8444-444444444444",
          setNumber: "1",
          reps: "-5",
          weight: "60",
        },
      ]),
    );

    const result = await upsertSessionSetsAction({ status: "idle" }, formData);

    expect(result.status).toBe("error");
    expect(result.message).toContain("reps");
    expect(upsertSessionSetsMock).not.toHaveBeenCalled();
  });

  it("prevents complete when no sets are saved", async () => {
    getSessionStatusForUserMock.mockResolvedValue({
      sessionId: "33333333-3333-4333-8333-333333333333",
      status: "in_progress",
      planDayId: "11111111-1111-4111-8111-111111111111",
      userId: "u-1",
    });
    countSessionSetsForUserMock.mockResolvedValue(0);

    const formData = new FormData();
    formData.set("session_id", "33333333-3333-4333-8333-333333333333");

    const result = await completeSessionAction({ status: "idle" }, formData);

    expect(result.status).toBe("error");
    expect(result.message).toContain("без сохранённых сетов");
    expect(completeWorkoutSessionMock).not.toHaveBeenCalled();
  });

  it("completes session and redirects back to workout page", async () => {
    getSessionStatusForUserMock.mockResolvedValue({
      sessionId: "33333333-3333-4333-8333-333333333333",
      status: "in_progress",
      planDayId: "11111111-1111-4111-8111-111111111111",
      userId: "u-1",
    });
    countSessionSetsForUserMock.mockResolvedValue(1);
    completeWorkoutSessionMock.mockResolvedValue(undefined);

    const formData = new FormData();
    formData.set("session_id", "33333333-3333-4333-8333-333333333333");

    await expect(
      completeSessionAction({ status: "idle" }, formData),
    ).rejects.toThrow("REDIRECT:/workout/33333333-3333-4333-8333-333333333333");

    expect(completeWorkoutSessionMock).toHaveBeenCalledTimes(1);
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/workout/33333333-3333-4333-8333-333333333333",
    );
  });
});
