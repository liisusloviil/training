"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isValidEmail, normalizeEmail } from "@/lib/auth-email";
import {
  clearAuthFailures,
  isAuthAttemptBlocked,
  registerAuthFailure,
} from "@/lib/security/auth-anti-abuse";
import { createClient } from "@/lib/supabase/server";

function withError(message: string) {
  return `/login?error=${encodeURIComponent(message)}`;
}

async function readRequestHeaders() {
  try {
    return await headers();
  } catch {
    return new Headers();
  }
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

  const antiAbuseContext = {
    scope: "login" as const,
    requestHeaders: await readRequestHeaders(),
    login: email,
  };

  if (isAuthAttemptBlocked(antiAbuseContext)) {
    redirect(withError("Не удалось войти. Проверьте email и пароль."));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    registerAuthFailure(antiAbuseContext);
    redirect(withError("Не удалось войти. Проверьте email и пароль."));
  }

  clearAuthFailures(antiAbuseContext);

  if (nextPath.startsWith("/") && !nextPath.startsWith("//")) {
    redirect(nextPath);
  }

  redirect("/");
}
