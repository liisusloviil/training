import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { signOutAction } from "@/app/(app)/actions";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireUser();

  return (
    <div className="app-shell">
      <header className="app-header">
        <nav>
          <Link href="/import">Импорт</Link>
          <Link href="/plan">План</Link>
          <Link href="/workout/new">Новая тренировка</Link>
          <Link href="/history">История</Link>
        </nav>

        <div className="app-user">
          <span>{user.email ?? "Пользователь"}</span>
          <form action={signOutAction}>
            <button className="ghost-button" type="submit">
              Выйти
            </button>
          </form>
        </div>
      </header>

      <main className="app-content">{children}</main>
    </div>
  );
}
