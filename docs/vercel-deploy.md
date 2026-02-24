# Vercel Deployment Runbook (main only)

Дата: 24 февраля 2026

## Цель

Подключить MVP к Vercel с production-деплоем только из ветки `main` и временным доменом `*.vercel.app`.

## Принятые решения

- Production branch: только `main`.
- Preview окружения: отключены.
- Backend/Auth: текущий Supabase проект.

## Предусловия

1. Локальный репозиторий содержит актуальный `main`.
2. В `main` есть рабочие проверки:
   - `npm test`
   - `npm run lint`
   - `npm run build`
3. Есть GitHub-репозиторий с доступом владельца.

## Шаг 1. Публикация репозитория в GitHub

Проверить remote:

```bash
git remote -v
```

Если `origin` не настроен:

```bash
git remote add origin <github_repo_url>
git push -u origin main
```

DoD:

- Репозиторий доступен в GitHub.
- Ветка `main` опубликована и содержит нужный коммит.

## Шаг 2. Создание проекта в Vercel

1. `Add New Project` -> `Import Git Repository`.
2. Выбрать репозиторий.
3. Убедиться, что framework определён как Next.js.
4. Build settings:
   - Build Command: `npm run build`
   - Install Command: `npm ci`
   - Output Directory: default (`.next`)
5. В Project Settings:
   - Production Branch = `main`
   - отключить auto-deploy для не-main веток.

DoD:

- Проект создан в Vercel.
- Production branch закреплён за `main`.

## Шаг 3. Переменные окружения (Production)

Обязательные:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Рекомендуемые:

- `NEXT_PUBLIC_APP_URL=https://<project>.vercel.app`
- `AUTH_LOGIN_EMAIL_DOMAIN` (если используется login -> email mapping)

Не добавлять как runtime env:

- `TEST_USER_A_*`
- `TEST_USER_B_*`
- `E2E_*`

DoD:

- Runtime env заведены в Vercel Production.
- После сохранения env выполнен успешный redeploy.

## Шаг 4. Настройка Supabase Auth для Vercel URL

Supabase -> Auth -> URL Configuration:

- Site URL: `https://<project>.vercel.app`
- Redirect URL: `https://<project>.vercel.app/auth/callback`
- Оставить локальный callback:
  `http://localhost:3000/auth/callback`

DoD:

- Login/register/callback работают на production URL без redirect ошибок.

## Шаг 5. Верификация production

Проверки на `https://<project>.vercel.app`:

1. Гость на `/plan` уходит на `/login`.
2. Вход работает.
3. `/import` обрабатывает CSV/XLSX (preview/save).
4. `/plan` показывает активный план.
5. `/workout/new` создаёт сессию.
6. `/workout/[sessionId]` сохраняет сеты и завершает сессию.
7. `/history` и `/history/[sessionId]` работают.
8. Logout закрывает доступ к защищённым маршрутам.
9. В Vercel logs нет runtime ошибок.

DoD:

- MVP user flow проходит end-to-end на production.

## Риски и контроль

- Неверный `NEXT_PUBLIC_APP_URL` или callback URL ломает auth flow.
  - Контроль: сверить URL в Vercel env и Supabase URL Configuration.
- Отсутствующие env приводят к runtime падению.
  - Контроль: preflight checklist перед первым deploy.
- Случайный deploy из нецелевой ветки.
  - Контроль: Production branch строго `main`, non-main auto-deploy отключён.

## Acceptance Criteria

1. Репозиторий подключён к Vercel.
2. Автодеплой выполняется только из `main`.
3. Production URL доступен на `*.vercel.app`.
4. Runtime env Supabase заданы в Vercel Production.
5. Supabase Redirect URLs содержат production callback.
6. Auth flow работает в production.
7. MVP flow (`import -> plan -> workout -> history`) проходит в production.
8. Документация позволяет повторить деплой без устных инструкций.
