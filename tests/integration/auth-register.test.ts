import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.fn();
const signUpMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

const { signUpWithPasswordAction } = await import(
  "@/app/(auth)/register/actions"
);

describe("integration: auth register action", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    signUpMock.mockResolvedValue({ error: null });
    createClientMock.mockResolvedValue({
      auth: {
        signUp: signUpMock,
      },
    });
    delete process.env.AUTH_LOGIN_EMAIL_DOMAIN;
  });

  it("returns validation error for invalid login", async () => {
    const formData = new FormData();
    formData.set("login", "bad login");
    formData.set("password", "StrongPass123");
    formData.set("confirmPassword", "StrongPass123");

    const result = await signUpWithPasswordAction({ status: "idle" }, formData);

    expect(result.status).toBe("error");
    expect(result.message?.toLowerCase()).toContain("логин");
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("returns validation error for short password", async () => {
    const formData = new FormData();
    formData.set("login", "test_user");
    formData.set("password", "short");
    formData.set("confirmPassword", "short");

    const result = await signUpWithPasswordAction({ status: "idle" }, formData);

    expect(result.status).toBe("error");
    expect(result.message).toContain("Минимальная длина");
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("returns validation error for password mismatch", async () => {
    const formData = new FormData();
    formData.set("login", "test_user");
    formData.set("password", "StrongPass123");
    formData.set("confirmPassword", "StrongPass456");

    const result = await signUpWithPasswordAction({ status: "idle" }, formData);

    expect(result.status).toBe("error");
    expect(result.message).toContain("не совпадают");
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("signs up user and returns success state", async () => {
    process.env.AUTH_LOGIN_EMAIL_DOMAIN = "login.local";
    const formData = new FormData();
    formData.set("login", "new.user");
    formData.set("password", "StrongPass123");
    formData.set("confirmPassword", "StrongPass123");

    const result = await signUpWithPasswordAction({ status: "idle" }, formData);

    expect(result.status).toBe("success");
    expect(result.message).toContain("по логину");
    expect(signUpMock).toHaveBeenCalledTimes(1);
    expect(signUpMock).toHaveBeenCalledWith({
      email: "new.user@login.local",
      password: "StrongPass123",
      options: {
        data: {
          login: "new.user",
        },
      },
    });
  });

  it("returns neutral error on sign up failure", async () => {
    signUpMock.mockResolvedValue({
      error: { message: "User already registered" },
    });
    const formData = new FormData();
    formData.set("login", "existing_user");
    formData.set("password", "StrongPass123");
    formData.set("confirmPassword", "StrongPass123");

    const result = await signUpWithPasswordAction({ status: "idle" }, formData);

    expect(result.status).toBe("error");
    expect(result.message).toBe(
      "Не удалось завершить регистрацию. Проверьте данные и попробуйте снова.",
    );
    expect(result.message?.toLowerCase()).not.toContain("exists");
  });
});
