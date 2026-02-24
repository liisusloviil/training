"use server";

import { redirect } from "next/navigation";
import { isValidLogin, resolveAuthEmail } from "@/lib/auth-login";
import { createClient } from "@/lib/supabase/server";

function withError(message: string) {
  return `/login?error=${encodeURIComponent(message)}`;
}

export async function signInWithPasswordAction(formData: FormData) {
  const login = String(formData.get("login") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nextPath = String(formData.get("next") ?? "/");

  if (!login || !password) {
    redirect(withError("Введите логин и пароль."));
  }

  if (!login.includes("@") && !isValidLogin(login)) {
    redirect(
      withError(
        "Логин должен содержать 3-32 символа: латинские буквы, цифры, точка, дефис или underscore.",
      ),
    );
  }

  const email = resolveAuthEmail(login);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(withError("Не удалось войти. Проверьте логин и пароль."));
  }

  if (nextPath.startsWith("/") && !nextPath.startsWith("//")) {
    redirect(nextPath);
  }

  redirect("/");
}
