"use server";

import { headers } from "next/headers";
import { isValidEmail, normalizeEmail } from "@/lib/auth-email";
import { isValidUsername, normalizeUsername } from "@/lib/auth-username";
import { createClient } from "@/lib/supabase/server";
import type { RegisterActionState } from "@/types/auth-register";

const MIN_PASSWORD_LENGTH = 8;

async function getAppOrigin(): Promise<string> {
  const envOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envOrigin) {
    return envOrigin.replace(/\/+$/, "");
  }

  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = forwardedHost ?? requestHeaders.get("host");
  const proto =
    requestHeaders.get("x-forwarded-proto") ??
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
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!isValidEmail(email)) {
    return {
      status: "error",
      message: "Введите корректный email.",
    };
  }

  if (!isValidUsername(username)) {
    return {
      status: "error",
      message:
        "Username должен содержать 3-32 символа: строчные латинские буквы, цифры или underscore.",
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
    const { data: isUsernameAvailable, error: usernameCheckError } =
      await supabase.rpc("is_username_available", {
        p_username: username,
      });

    if (usernameCheckError) {
      return {
        status: "error",
        message: "Не удалось проверить username. Попробуйте снова позже.",
      };
    }

    if (!isUsernameAvailable) {
      return {
        status: "error",
        message: "Этот username уже занят. Выберите другой.",
      };
    }

    const appOrigin = await getAppOrigin();
    const redirectUrl = new URL("/auth/callback", appOrigin);
    redirectUrl.searchParams.set("next", "/");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl.toString(),
        data: {
          username,
        },
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
        "Аккаунт создан. Проверьте почту и подтвердите email, затем войдите в приложение.",
    };
  } catch {
    return {
      status: "error",
      message: "Ошибка регистрации. Попробуйте снова позже.",
    };
  }
}
