"use server";

import { redirect } from "next/navigation";
import { isValidEmail, normalizeEmail } from "@/lib/auth-email";
import { createClient } from "@/lib/supabase/server";

function withError(message: string) {
  return `/login?error=${encodeURIComponent(message)}`;
}

export async function signInWithPasswordAction(formData: FormData) {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const nextPath = String(formData.get("next") ?? "/");

  if (!email || !password) {
    redirect(withError("Введите email и пароль."));
  }

  if (!isValidEmail(email)) {
    redirect(withError("Введите корректный email."));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(withError("Не удалось войти. Проверьте email и пароль."));
  }

  if (nextPath.startsWith("/") && !nextPath.startsWith("//")) {
    redirect(nextPath);
  }

  redirect("/");
}
