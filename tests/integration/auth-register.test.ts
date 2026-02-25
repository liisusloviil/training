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
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  it("returns validation error for invalid email", async () => {
    const formData = new FormData();
    formData.set("email", "bad-email");
    formData.set("password", "StrongPass123");
    formData.set("confirmPassword", "StrongPass123");

    const result = await signUpWithPasswordAction({ status: "idle" }, formData);

    expect(result.status).toBe("error");
    expect(result.message?.toLowerCase()).toContain("email");
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("returns validation error for short password", async () => {
    const formData = new FormData();
    formData.set("email", "test.user@example.com");
    formData.set("password", "short");
    formData.set("confirmPassword", "short");

    const result = await signUpWithPasswordAction({ status: "idle" }, formData);

    expect(result.status).toBe("error");
    expect(result.message).toContain("Минимальная длина");
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("returns validation error for password mismatch", async () => {
    const formData = new FormData();
    formData.set("email", "test.user@example.com");
    formData.set("password", "StrongPass123");
    formData.set("confirmPassword", "StrongPass456");

    const result = await signUpWithPasswordAction({ status: "idle" }, formData);

    expect(result.status).toBe("error");
    expect(result.message).toContain("не совпадают");
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("signs up user with emailRedirectTo and returns success state", async () => {
    const formData = new FormData();
    formData.set("email", "new.user@example.com");
    formData.set("password", "StrongPass123");
    formData.set("confirmPassword", "StrongPass123");

    const result = await signUpWithPasswordAction({ status: "idle" }, formData);

    expect(result.status).toBe("success");
    expect(result.message).toContain("Проверьте почту");
    expect(signUpMock).toHaveBeenCalledTimes(1);
    expect(signUpMock).toHaveBeenCalledWith({
      email: "new.user@example.com",
      password: "StrongPass123",
      options: {
        emailRedirectTo: "http://localhost:3000/auth/callback?next=%2F",
      },
    });
  });

  it("returns neutral error on sign up failure", async () => {
    signUpMock.mockResolvedValue({
      error: { message: "User already registered" },
    });
    const formData = new FormData();
    formData.set("email", "existing.user@example.com");
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
