# Release Readiness (MVP v0.1.0)

Дата: 23 февраля 2026

## Scope Freeze

В релиз входят только возможности MVP:

- auth
- register + email confirmation callback
- import (`.xlsx/.csv`) + save в БД
- plan view из БД
- workout session + sets + complete
- history list/details (read-only)

Не входят:

- новые продуктовые фичи;
- нефункциональный рефактор "на будущее";
- расширенная аналитика/enterprise monitoring.

## Go / No-Go Checklist

| Проверка | Статус | Комментарий |
|---|---|---|
| Все этапы 1–8 имеют тестовые заметки | Done | `TESTING_STAGE_1.md` ... `TESTING_STAGE_8.md` |
| Acceptance matrix закрыта | Done | см. `docs/mvp-checklist.md` |
| P0/P1 дефекты отсутствуют | Done | критичный redirect-bug закрыт |
| `npm test` зелёный | Done | integration + security smoke |
| `npm run lint` зелёный | Done | без ошибок |
| `npm run build` зелёный | Done | production build успешен |
| `npm run test:e2e` стабилен | Done | 3 последовательных прогона успешны |
| Регистрация покрыта (integration + e2e) | Done | `tests/integration/auth-register.test.ts`, `tests/e2e/auth-register.spec.ts` |
| RLS/Storage smoke покрыт | Done | live smoke выполнен: `3 passed`, `0 skipped` |
| Manual QA TC-M01...TC-M05 закрыт | Done | результаты зафиксированы в `TESTING_STAGE_8.md` |
| Решение по `xlsx` advisory зафиксировано | Done | ADR: `docs/adr/ADR-001-xlsx-risk.md` |
| Дефекты manual QA задокументированы | Done | `docs/defects-log.md` |
| README отражает актуальный quickstart | Done | обновлён под этапы 1-8 |

## Runbook перед демо/выкатом

1. Обновить зависимости:

```bash
npm install
```

2. Проверить `.env.local` (Supabase URL/anon key).
3. Убедиться, что SQL-миграции применены.
4. Прогнать обязательные проверки:

```bash
npm test
npm run lint
npm run build
```

5. Выполнить ручной smoke по критичным экранам:
- `/login`
- `/import` (preview/save/error)
- `/plan`
- `/workout/new`
- `/workout/[sessionId]`
- `/history`
- `/history/[sessionId]`

6. Выполнить live security smoke (если есть env для двух тестовых пользователей):

```bash
npm test -- tests/security/rls-storage-live.smoke.test.ts
```

7. Выполнить UI e2e smoke:

```bash
npm run test:e2e
```

8. Проверить signup flow:
- `/register` принимает `email + username + password + confirmPassword` и показывает check-email state;
- `/auth/callback` корректно завершает подтверждение;
- `/login` (email/password) и `/register` связаны ссылками и guard работает.

9. Проверить отсутствие открытых P0/P1 в текущем списке дефектов.

## Минимальный контракт ошибок (server actions)

- Формат ошибки: `{ status: "error", message: string, ...extra }`
- Реализовано в `lib/actions/contract.ts`
- Критичные серверные ошибки логируются через `lib/observability/server-logger.ts`

## Артефакты релиза

- acceptance matrix: `docs/mvp-checklist.md`
- security policy notes: `docs/security.md`
- accepted risk ADR: `docs/adr/ADR-001-xlsx-risk.md`
- import format contract: `docs/import-format.md`
- defects log: `docs/defects-log.md`
- import fixtures: `docs/qa-fixtures.md`
- auth registration checklist: `TESTING_AUTH_REGISTRATION.md`
- stage QA notes: `TESTING_STAGE_1.md` ... `TESTING_STAGE_8.md`
- release candidate tag/версия: `v0.1.0-mvp`

## Cloud Deploy Checklist (Vercel, main only)

- [ ] GitHub `origin` настроен, `main` опубликована
- [ ] Vercel проект создан из GitHub репозитория
- [ ] Production Branch в Vercel = `main`
- [ ] Auto-deploy не-main веток отключён
- [ ] В Vercel Production заданы:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_APP_URL` (рекомендовано)
- [ ] В Supabase Auth URL Configuration заданы:
  - `https://<project>.vercel.app`
  - `https://<project>.vercel.app/auth/callback`
  - `http://localhost:3000/auth/callback` (для локальной разработки)
- [ ] На `https://<project>.vercel.app` пройден MVP smoke flow

Подробный runbook: `docs/vercel-deploy.md`.
