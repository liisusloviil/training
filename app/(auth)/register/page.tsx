"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUpWithPasswordAction } from "@/app/(auth)/register/actions";
import type { RegisterActionState } from "@/types/auth-register";

const initialRegisterState: RegisterActionState = {
  status: "idle",
};

export default function RegisterPage() {
  const [state, formAction, isPending] = useActionState(
    signUpWithPasswordAction,
    initialRegisterState,
  );

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>Регистрация</h1>
        <p>Создайте аккаунт по email, username и паролю.</p>

        {state.status === "error" && state.message ? (
          <div className="error-message">{state.message}</div>
        ) : null}

        {state.status === "success" && state.message ? (
          <div className="success-message">{state.message}</div>
        ) : null}

        <form className="auth-form" action={formAction}>
          <label>
            Email
            <input
              autoComplete="email"
              name="email"
              placeholder="you@example.com"
              required
              type="email"
            />
          </label>

          <label>
            Username
            <input
              autoComplete="username"
              name="username"
              placeholder="fitness_user"
              required
              type="text"
            />
          </label>

          <label>
            Пароль
            <input
              autoComplete="new-password"
              name="password"
              placeholder="Минимум 8 символов"
              required
              type="password"
            />
          </label>

          <label>
            Подтвердите пароль
            <input
              autoComplete="new-password"
              name="confirmPassword"
              placeholder="Повторите пароль"
              required
              type="password"
            />
          </label>

          <button disabled={isPending} type="submit">
            {isPending ? "Создание..." : "Создать аккаунт"}
          </button>
        </form>

        <p className="auth-switch-link">
          Уже есть аккаунт? <Link href="/login">Войти</Link>
        </p>
      </section>
    </main>
  );
}
