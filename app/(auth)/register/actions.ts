"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { RegisterActionState } from "@/types/auth-register";

const MIN_PASSWORD_LENGTH = 8;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function getAppOrigin(): Promise<string> {
  const envOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envOrigin) {
    return envOrigin.replace(/\/+$/, "");
  }

  const headersStore = await headers();
  const forwardedHost = headersStore.get("x-forwarded-host");
  const host = forwardedHost ?? headersStore.get("host");
  const proto =
    headersStore.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "development" ? "http" : "https");

  if (host) {
    return `${proto}://${host}`;
  }

  return "http://localhost:3000";
}

export async function signUpWithPasswordAction(
  _previousState: RegisterActionState,
  formData: FormData,
): Promise<RegisterActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!isValidEmail(email)) {
    return {
      status: "error",
      message: "Введите корректный email.",
    };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      status: "error",
      message: `Минимальная длина пароля: ${MIN_PASSWORD_LENGTH} символов.`,
    };
  }

  if (password !== confirmPassword) {
    return {
      status: "error",
      message: "Пароли не совпадают.",
    };
  }

  try {
    const supabase = await createClient();
    const appOrigin = await getAppOrigin();
    const emailRedirectTo = `${appOrigin}/auth/callback?next=/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
      },
    });

    if (error) {
      return {
        status: "error",
        message:
          "Не удалось завершить регистрацию. Проверьте данные и попробуйте снова.",
      };
    }

    return {
      status: "success",
      message:
        "Аккаунт создан. Проверьте почту и подтвердите email, чтобы войти в приложение.",
    };
  } catch {
    return {
      status: "error",
      message: "Ошибка регистрации. Попробуйте снова позже.",
    };
  }
}
