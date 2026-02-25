# Training Diary MVP (v0.1.0)

MVP покрывает полный пользовательский поток:

- `auth` (`/login`)
- `auth register` (`/register`, `/auth/callback`)
- `import` (`/import`)
- `plan` (`/plan`)
- `workout` (`/workout/new`, `/workout/[sessionId]`)
- `history` (`/history`, `/history/[sessionId]`)

## Технологии

- Next.js 16 (App Router, Server Actions)
- Supabase (Auth, Postgres, Storage, RLS)
- TypeScript
- Vitest (integration + security smoke)

## Быстрый старт

1. Установить зависимости:

```bash
npm install
```

2. Создать `.env.local`:

```bash
cp .env.example .env.local
```

3. Заполнить переменные:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL` (рекомендуется, например `http://localhost:3000`)

4. Настроить Supabase Auth Redirect URLs:

- добавить `http://localhost:3000/auth/callback` в Redirect URLs;
- для production добавить соответствующий домен callback.

5. Применить SQL-миграции из `supabase/migrations` в порядке имени файла.

6. Запустить приложение:

```bash
npm run dev
```

## Deploy on Vercel (main only)

Текущая стратегия деплоя:

- production деплой только из ветки `main`;
- домен на старте: `https://<project>.vercel.app`;
- preview окружения не используются.

### 1. Подготовить GitHub origin

В локальном репозитории должен быть привязан удалённый GitHub:

```bash
git remote -v
```

Если `origin` отсутствует, добавить его и запушить `main`:

```bash
git remote add origin <github_repo_url>
git push -u origin main
```

### 2. Настроить проект в Vercel

- Import Git Repository -> выбрать репозиторий;
- Framework: Next.js (autodetect);
- Build Command: `npm run build`;
- Install Command: `npm ci`;
- Production Branch: `main`;
- отключить авто-deploy не-main веток.

### 3. Настроить env (Vercel -> Production)

Обязательные runtime env:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Рекомендуемые:

- `NEXT_PUBLIC_APP_URL=https://<project>.vercel.app`

Не требуются для runtime в Vercel:

- `TEST_USER_A_*`, `TEST_USER_B_*`, `E2E_*`.

### 4. Настроить Supabase Auth URL Configuration

- Site URL: `https://<project>.vercel.app`
- Redirect URL: `https://<project>.vercel.app/auth/callback`
- Локальный redirect для dev сохраняется:
  `http://localhost:3000/auth/callback`

### 5. Проверить production flow

1. Неавторизованный переход на `/plan` редиректит на `/login`.
2. `/login` и `/register` работают, callback завершает auth.
3. Полный MVP путь работает: `/import -> /plan -> /workout/new -> /workout/[sessionId] -> /history`.
4. В Vercel logs нет runtime ошибок Server Actions/Route handlers.

Подробный runbook: `docs/vercel-deploy.md`.

## Основные маршруты MVP

- `/login` — вход
- `/register` — регистрация email/username/password
- `/auth/callback` — callback маршрута auth (опционально)
- `/import` — импорт `.xlsx` или `.csv` плана (preview/save)
- `/plan` — активный план из БД (недели/дни/упражнения)
- `/workout/new` — создание workout session по дате и дню
- `/workout/[sessionId]` — ввод сетов (фиксированные подходы по плану, выбор reps через выпадающий список на упражнение) и завершение сессии
- `/history` — список прошлых сессий (read-only)
- `/history/[sessionId]` — детали сессии (read-only)

## Проверки качества

```bash
npm test
npm run lint
npm run build
```

`npm test` запускает:

- `tests/integration/*` — ключевой бизнес-flow
- `tests/integration/auth-register.test.ts` — регистрация (валидации/нейтральные ошибки)
- `tests/security/policy-regression.test.ts` — smoke-проверка наличия RLS/Storage политик
- `tests/security/rls-storage-live.smoke.test.ts` — live smoke A/B (только при наличии env)
- `tests/e2e/*` — запускаются отдельно через `npm run test:e2e`

## Live security smoke (опционально)

Для запуска `tests/security/rls-storage-live.smoke.test.ts` добавьте в `.env.local`:

- `TEST_USER_A_EMAIL`
- `TEST_USER_A_PASSWORD`
- `TEST_USER_B_EMAIL`
- `TEST_USER_B_PASSWORD`

Пример QA env:

```env
TEST_USER_A_EMAIL=user.a@example.com
TEST_USER_A_PASSWORD=StrongPasswordA
TEST_USER_B_EMAIL=user.b@example.com
TEST_USER_B_PASSWORD=StrongPasswordB
```

Требования:

- оба пользователя существуют в Supabase Auth;
- bucket `plan-files` и stage-3 policies применены;
- у тестовых пользователей нет критичных прод-данных (тест удаляет созданные smoke-артефакты).

Без этих переменных live security тест будет пропущен, остальные тесты выполнятся.

## UI e2e Smoke

Запуск:

```bash
npm run test:e2e
```

Требования:

- корректно заполнены:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `E2E_USER_EMAIL` и `E2E_USER_PASSWORD`
    - если `E2E_USER_EMAIL` не задан, тест берёт `TEST_USER_A_EMAIL`
  - `SUPABASE_SERVICE_ROLE_KEY` (опционально, включает e2e проверку полного confirm callback flow)

Используемые import fixtures:

- `tests/fixtures/import/Training.csv`
- `tests/fixtures/import/invalid-range.csv`

CI gate:

- `.github/workflows/release-gate.yml` запускает `test/lint/build` и `npm run test:e2e`;
- для CI нужно настроить secrets:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `E2E_USER_EMAIL`
  - `E2E_USER_PASSWORD`

## Security Note (`xlsx`)

- В `xlsx` есть `high` advisory без auto-fix на момент 23 февраля 2026.
- Для MVP принят риск с компенсирующими мерами (guardrails на размер/структуру/время парсинга).
- Подробности: `docs/adr/ADR-001-xlsx-risk.md`.

## Документация по этапам

- `MVP_PLAN.md` — полный план разработки
- `TESTING_STAGE_1.md` ... `TESTING_STAGE_8.md` — инструкции и чеклисты для тестировщика
- `TESTING_AUTH_REGISTRATION.md` — тест-план регистрации
- `docs/developer-improvement-plan.md` — план доработок после этапа 8 (приоритеты, DoD, проверки)
- `docs/adr/ADR-001-xlsx-risk.md` — решение по security-риску `xlsx`
- `docs/import-format.md` — контракт формата импорта (`.xlsx/.csv`, маркеры недели/дня, `N×M` и `N×A-B`)
- `docs/qa-fixtures.md` — эталонные файлы для воспроизводимого QA
- `docs/defects-log.md` — журнал дефектов и фиксов
- `docs/schema.md` — схема БД
- `docs/security.md` — RLS/storage политика
- `docs/mvp-checklist.md` — acceptance matrix MVP
- `docs/release-readiness.md` — релизный runbook и критерии go/no-go
