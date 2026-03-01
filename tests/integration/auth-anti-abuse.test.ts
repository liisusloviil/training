import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const DEFAULT_IP = "203.0.113.10";
const LOGIN_NEUTRAL_ERROR = "Не удалось войти. Проверьте email и пароль.";
const REGISTER_NEUTRAL_ERROR =
  "Не удалось завершить регистрацию. Проверьте данные и попробуйте снова.";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
const headersMock = vi.fn();
const createClientMock = vi.fn();
const signInWithPasswordMock = vi.fn();
const signUpMock = vi.fn();
const rpcMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/headers", () => ({
  headers: headersMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

const { signInWithPasswordAction } = await import("@/app/(auth)/login/actions");
const { signUpWithPasswordAction } = await import("@/app/(auth)/register/actions");

function buildLoginFormData(options?: {
  email?: string;
  password?: string;
  next?: string;
}): FormData {
  const formData = new FormData();
  formData.set("email", options?.email ?? "anti-abuse-login@example.com");
  formData.set("password", options?.password ?? "WrongPass123");
  formData.set("next", options?.next ?? "/plan");
  return formData;
}

function buildRegisterFormData(options?: {
  email?: string;
  username?: string;
  password?: string;
  confirmPassword?: string;
}): FormData {
  const formData = new FormData();
  formData.set("email", options?.email ?? "anti-abuse-register@example.com");
  formData.set("username", options?.username ?? "anti_abuse_user");
  formData.set("password", options?.password ?? "StrongPass123");
  formData.set("confirmPassword", options?.confirmPassword ?? "StrongPass123");
  return formData;
}

describe("integration: auth anti-abuse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();

    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

    headersMock.mockResolvedValue(
      new Headers({
        "x-forwarded-for": DEFAULT_IP,
      }),
    );

    createClientMock.mockResolvedValue({
      rpc: rpcMock,
      auth: {
        signInWithPassword: signInWithPasswordMock,
        signUp: signUpMock,
      },
    });

    signInWithPasswordMock.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });
    rpcMock.mockResolvedValue({ data: true, error: null });
    signUpMock.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("throttles repeated login failures for one ip + login with neutral response", async () => {
    const throttledEmail = "anti-abuse-login-throttle@example.com";
    const encodedNeutralError = encodeURIComponent(LOGIN_NEUTRAL_ERROR);

    for (let attempt = 0; attempt < 8; attempt += 1) {
      await expect(
        signInWithPasswordAction(buildLoginFormData({ email: throttledEmail })),
      ).rejects.toThrow(
        `REDIRECT:/login?error=${encodedNeutralError}`,
      );
    }

    expect(signInWithPasswordMock).toHaveBeenCalledTimes(8);

    await expect(
      signInWithPasswordAction(buildLoginFormData({ email: throttledEmail })),
    ).rejects.toThrow(`REDIRECT:/login?error=${encodedNeutralError}`);

    expect(signInWithPasswordMock).toHaveBeenCalledTimes(8);
  });

  it("allows successful login after anti-abuse block window", async () => {
    const recoveringEmail = "anti-abuse-login-recovery@example.com";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00.000Z"));

    const encodedNeutralError = encodeURIComponent(LOGIN_NEUTRAL_ERROR);

    for (let attempt = 0; attempt < 8; attempt += 1) {
      await expect(
        signInWithPasswordAction(buildLoginFormData({ email: recoveringEmail })),
      ).rejects.toThrow(
        `REDIRECT:/login?error=${encodedNeutralError}`,
      );
    }

    await expect(
      signInWithPasswordAction(buildLoginFormData({ email: recoveringEmail })),
    ).rejects.toThrow(`REDIRECT:/login?error=${encodedNeutralError}`);
    expect(signInWithPasswordMock).toHaveBeenCalledTimes(8);

    signInWithPasswordMock.mockResolvedValue({ error: null });
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);

    await expect(
      signInWithPasswordAction(
        buildLoginFormData({
          email: recoveringEmail,
          next: "/workout/new",
        }),
      ),
    ).rejects.toThrow("REDIRECT:/workout/new");

    expect(signInWithPasswordMock).toHaveBeenCalledTimes(9);
  });

  it("throttles repeated registration failures for one ip + email", async () => {
    const throttledRegisterEmail = "anti-abuse-register-throttle@example.com";
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "rpc unavailable" },
    });

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const result = await signUpWithPasswordAction(
        { status: "idle" },
        buildRegisterFormData({ email: throttledRegisterEmail }),
      );

      expect(result.status).toBe("error");
      expect(result.message).toBe(
        "Не удалось проверить username. Попробуйте снова позже.",
      );
    }

    expect(rpcMock).toHaveBeenCalledTimes(8);
    expect(signUpMock).not.toHaveBeenCalled();

    const blockedResult = await signUpWithPasswordAction(
      { status: "idle" },
      buildRegisterFormData({ email: throttledRegisterEmail }),
    );

    expect(blockedResult.status).toBe("error");
    expect(blockedResult.message).toBe(REGISTER_NEUTRAL_ERROR);
    expect(blockedResult.message?.toLowerCase()).not.toContain("rpc");
    expect(rpcMock).toHaveBeenCalledTimes(8);
  });

  it("allows successful registration after anti-abuse window expires", async () => {
    const recoveringRegisterEmail = "anti-abuse-register-recover-window@example.com";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00.000Z"));

    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "temporary rpc failure" },
    });

    for (let attempt = 0; attempt < 8; attempt += 1) {
      await signUpWithPasswordAction(
        { status: "idle" },
        buildRegisterFormData({ email: recoveringRegisterEmail }),
      );
    }

    const blockedResult = await signUpWithPasswordAction(
      { status: "idle" },
      buildRegisterFormData({ email: recoveringRegisterEmail }),
    );
    expect(blockedResult.status).toBe("error");
    expect(blockedResult.message).toBe(REGISTER_NEUTRAL_ERROR);
    expect(rpcMock).toHaveBeenCalledTimes(8);

    rpcMock.mockResolvedValue({ data: true, error: null });
    signUpMock.mockResolvedValue({ error: null });
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);

    const successResult = await signUpWithPasswordAction(
      { status: "idle" },
      buildRegisterFormData({
        email: "anti-abuse-register-recovery@example.com",
        username: "anti_abuse_recovery",
      }),
    );

    expect(successResult.status).toBe("success");
    expect(successResult.message).toContain("Аккаунт создан");
    expect(signUpMock).toHaveBeenCalledTimes(1);
  });
});
