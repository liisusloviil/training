import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentPlanQueryMock = vi.fn();
const getHistoryQueryMock = vi.fn();
const getHistorySessionDetailsQueryMock = vi.fn();
const getWorkoutNewContextQueryMock = vi.fn();
const getSessionDetailsQueryMock = vi.fn();

const planEmptyStateMock = vi.fn(() => "PLAN_EMPTY_STATE");
const planWeekMock = vi.fn(() => "PLAN_WEEK");
const historyFiltersMock = vi.fn(() => "HISTORY_FILTERS");
const historyListMock = vi.fn(() => "HISTORY_LIST");
const sessionDetailsMock = vi.fn(() => "SESSION_DETAILS");
const sessionCreateFormMock = vi.fn(() => "SESSION_CREATE_FORM");
const sessionHeaderMock = vi.fn(() => "SESSION_HEADER");
const sessionSetsFormMock = vi.fn(() => "SESSION_SETS_FORM");

const logCriticalErrorMock = vi.fn();

function serializeResultTree(result: unknown): string {
  const seen = new WeakSet<object>();

  return JSON.stringify(
    result,
    (_key, value) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) {
          return "[circular]";
        }

        seen.add(value);
      }

      if (typeof value === "function") {
        return "[function]";
      }

      if (typeof value === "symbol") {
        return value.toString();
      }

      return value;
    },
    2,
  );
}

vi.mock("@/lib/db/plan-queries", () => ({
  getCurrentPlanQuery: getCurrentPlanQueryMock,
}));

vi.mock("@/lib/db/history-queries", () => ({
  getHistoryQuery: getHistoryQueryMock,
  getHistorySessionDetailsQuery: getHistorySessionDetailsQueryMock,
}));

vi.mock("@/lib/db/session-queries", () => ({
  getWorkoutNewContextQuery: getWorkoutNewContextQueryMock,
  getSessionDetailsQuery: getSessionDetailsQueryMock,
}));

vi.mock("@/lib/observability/server-logger", () => ({
  logCriticalError: logCriticalErrorMock,
}));

vi.mock("@/components/plan/plan-empty-state", () => ({
  PlanEmptyState: planEmptyStateMock,
}));

vi.mock("@/components/plan/plan-week", () => ({
  PlanWeek: planWeekMock,
}));

vi.mock("@/components/history/history-filters", () => ({
  HistoryFilters: historyFiltersMock,
}));

vi.mock("@/components/history/history-list", () => ({
  HistoryList: historyListMock,
}));

vi.mock("@/components/history/session-details", () => ({
  SessionDetails: sessionDetailsMock,
}));

vi.mock("@/components/workout/session-create-form", () => ({
  SessionCreateForm: sessionCreateFormMock,
}));

vi.mock("@/components/workout/session-header", () => ({
  SessionHeader: sessionHeaderMock,
}));

vi.mock("@/components/workout/session-sets-form", () => ({
  SessionSetsForm: sessionSetsFormMock,
}));

const PlanPageModule = await import("@/app/(app)/plan/page");
const HistoryPageModule = await import("@/app/(app)/history/page");
const HistoryDetailsPageModule = await import("@/app/(app)/history/[sessionId]/page");
const WorkoutNewPageModule = await import("@/app/(app)/workout/new/page");
const WorkoutSessionPageModule = await import("@/app/(app)/workout/[sessionId]/page");

const PlanPage = PlanPageModule.default;
const HistoryPage = HistoryPageModule.default;
const HistoryDetailsPage = HistoryDetailsPageModule.default;
const WorkoutNewPage = WorkoutNewPageModule.default;
const WorkoutSessionPage = WorkoutSessionPageModule.default;

describe("integration: read-page observability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("plan page keeps fallback UI and logs structured read error", async () => {
    const error = new Error("plan read failed");
    getCurrentPlanQueryMock.mockRejectedValue(error);

    const result = await PlanPage();
    const serialized = serializeResultTree(result);

    expect(logCriticalErrorMock).toHaveBeenCalledWith("plan_page_read", error);
    expect(planEmptyStateMock).not.toHaveBeenCalled();
    expect(serialized).toContain("Не удалось загрузить план");
    expect(serialized).toContain("/import");
  });

  it("history page keeps fallback UI and logs read context", async () => {
    const error = new Error("history read failed");
    getHistoryQueryMock.mockRejectedValue(error);

    const result = await HistoryPage({
      searchParams: Promise.resolve({
        page: "2",
        from: "2026-02-01",
        to: "2026-02-29",
        status: "completed",
      }),
    });
    const serialized = serializeResultTree(result);

    expect(logCriticalErrorMock).toHaveBeenCalledWith("history_page_read", error, {
      page: 2,
      pageSize: 12,
      from: "2026-02-01",
      to: undefined,
      status: "completed",
    });
    expect(historyFiltersMock).not.toHaveBeenCalled();
    expect(historyListMock).not.toHaveBeenCalled();
    expect(serialized).toContain("Не удалось загрузить историю");
  });

  it("history details page keeps fallback UI and logs sessionId", async () => {
    const error = new Error("history details failed");
    getHistorySessionDetailsQueryMock.mockRejectedValue(error);

    const result = await HistoryDetailsPage({
      params: Promise.resolve({
        sessionId: "33333333-3333-4333-8333-333333333333",
      }),
    });
    const serialized = serializeResultTree(result);

    expect(logCriticalErrorMock).toHaveBeenCalledWith(
      "history_session_page_read",
      error,
      {
        sessionId: "33333333-3333-4333-8333-333333333333",
      },
    );
    expect(sessionDetailsMock).not.toHaveBeenCalled();
    expect(serialized).toContain("Не удалось загрузить детали сессии");
    expect(serialized).toContain("/history");
  });

  it("workout new page keeps fallback UI and logs read error", async () => {
    const error = new Error("workout new failed");
    getWorkoutNewContextQueryMock.mockRejectedValue(error);

    const result = await WorkoutNewPage();
    const serialized = serializeResultTree(result);

    expect(logCriticalErrorMock).toHaveBeenCalledWith("workout_new_page_read", error);
    expect(sessionCreateFormMock).not.toHaveBeenCalled();
    expect(serialized).toContain("Не удалось подготовить создание сессии");
    expect(serialized).toContain("/plan");
  });

  it("workout session page keeps fallback UI and logs session context", async () => {
    const error = new Error("workout session failed");
    getSessionDetailsQueryMock.mockRejectedValue(error);

    const result = await WorkoutSessionPage({
      params: Promise.resolve({
        sessionId: "44444444-4444-4444-8444-444444444444",
      }),
    });
    const serialized = serializeResultTree(result);

    expect(logCriticalErrorMock).toHaveBeenCalledWith(
      "workout_session_page_read",
      error,
      {
        sessionId: "44444444-4444-4444-8444-444444444444",
      },
    );
    expect(sessionHeaderMock).not.toHaveBeenCalled();
    expect(sessionSetsFormMock).not.toHaveBeenCalled();
    expect(serialized).toContain("Не удалось загрузить сессию");
    expect(serialized).toContain("/workout/new");
  });
});
