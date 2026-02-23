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

## Основные маршруты MVP

- `/login` — вход
- `/register` — регистрация email/password
- `/auth/callback` — подтверждение email/callback
- `/import` — импорт `.xlsx` или `.csv` плана (preview/save)
- `/plan` — активный план из БД (недели/дни/упражнения)
- `/workout/new` — создание workout session по дате и дню
- `/workout/[sessionId]` — ввод сетов и завершение сессии
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
    - если не заданы, тест берёт `TEST_USER_A_EMAIL` / `TEST_USER_A_PASSWORD`
  - `E2E_REGISTER_EMAIL_DOMAIN` (опционально, домен для генерируемых signup email, например `gmail.com`)
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
