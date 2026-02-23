import { signInWithPasswordAction } from "@/app/(auth)/login/actions";
import Link from "next/link";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, next } = await searchParams;

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>Вход в дневник тренировок</h1>
        <p>Войдите в аккаунт Supabase, чтобы открыть приложение.</p>

        {error ? <div className="error-message">{error}</div> : null}

        <form className="auth-form" action={signInWithPasswordAction}>
          <input type="hidden" name="next" value={next ?? "/"} />

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
            Пароль
            <input
              autoComplete="current-password"
              name="password"
              placeholder="Введите пароль"
              required
              type="password"
            />
          </label>

          <button type="submit">Войти</button>
        </form>

        <p className="auth-switch-link">
          Нет аккаунта? <Link href="/register">Зарегистрироваться</Link>
        </p>
      </section>
    </main>
  );
}
