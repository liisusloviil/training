"use server";

import { isValidLogin, loginToEmail, normalizeLogin } from "@/lib/auth-login";
import { createClient } from "@/lib/supabase/server";
import type { RegisterActionState } from "@/types/auth-register";

const MIN_PASSWORD_LENGTH = 8;

export async function signUpWithPasswordAction(
  _previousState: RegisterActionState,
  formData: FormData,
): Promise<RegisterActionState> {
  const login = normalizeLogin(String(formData.get("login") ?? ""));
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!isValidLogin(login)) {
    return {
      status: "error",
      message:
        "Логин должен содержать 3-32 символа: латинские буквы, цифры, точка, дефис или underscore.",
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
    const email = loginToEmail(login);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          login,
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
      message: "Аккаунт создан. Теперь можно войти по логину и паролю.",
    };
  } catch {
    return {
      status: "error",
      message: "Ошибка регистрации. Попробуйте снова позже.",
    };
  }
}
