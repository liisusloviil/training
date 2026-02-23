# Тестирование: Этап 8 (E2E стабилизация и релизная готовность MVP)

## Что реализовано в этапе 8

Цель этапа: подтвердить end-to-end поток `auth -> import -> plan -> workout -> history`, закрыть критичные дефекты и подготовить MVP к первому демо/релизу.

Реализовано:

- Автотесты ключевых сценариев:
  - `tests/integration/import-parser.test.ts`
  - `tests/integration/workout-actions.test.ts`
- Security smoke:
  - `tests/security/policy-regression.test.ts`
  - `tests/security/rls-storage-live.smoke.test.ts` (при наличии env)
- Единый error contract server actions:
  - `lib/actions/contract.ts`
- Минимальное серверное логирование критичных ошибок:
  - `lib/observability/server-logger.ts`
- Исправление критичного дефекта redirect в workout actions.
- Финальная документация:
  - `docs/mvp-checklist.md`
  - `docs/release-readiness.md`
  - `README.md` (обновлённый quickstart)

## Подготовка к тестированию

1. Применить миграции этапов 2-4.
2. Убедиться, что bucket `plan-files` и policies этапа 3 активны.
3. Запустить приложение:

```bash
npm run dev
```

4. Для автопроверок выполнить:

```bash
npm test
npm run lint
npm run build
```

5. Для live security smoke дополнительно задать env:

- `TEST_USER_A_EMAIL`
- `TEST_USER_A_PASSWORD`
- `TEST_USER_B_EMAIL`
- `TEST_USER_B_PASSWORD`

6. Использовать фиксированные входные файлы импорта:

- `tests/fixtures/import/Training.csv`
- `tests/fixtures/import/invalid-range.csv`

## Автоматические тест-кейсы этапа 8

### TC-A01: Импорт корректного `.csv/.xlsx`
Покрытие:
- `tests/integration/import-parser.test.ts` (`parses valid xlsx...`, `parses Training.csv...`)

Ожидаемый результат:
- файл парсится;
- preview содержит корректные totals.

### TC-A02: Ошибка импорта некорректного файла
Покрытие:
- `tests/integration/import-parser.test.ts` (`fails on invalid sets x reps format`)
- `tests/integration/import-parser.test.ts` (`fails when workbook has no usable exercise rows`)

Ожидаемый результат:
- возвращается понятная ошибка валидации.

### TC-A03: Создание workout session
Покрытие:
- `tests/integration/workout-actions.test.ts`:
  - invalid date validation
  - duplicate session UX

Ожидаемый результат:
- валидная дата создаёт сессию/redirect;
- дубликат обрабатывается понятной ошибкой.

### TC-A04: Сохранение и повторное сохранение сетов
Покрытие:
- `tests/integration/workout-actions.test.ts`:
  - dedupe/upsert поведение
  - валидация на отрицательные значения

Ожидаемый результат:
- upsert обновляет существующую пару `(exercise, set_number)`, не плодит дубликаты.

### TC-A05: Завершение сессии
Покрытие:
- `tests/integration/workout-actions.test.ts`:
  - запрет завершения без сетов
  - успешное завершение + redirect + revalidate

Ожидаемый результат:
- completed проставляется корректно;
- без сетов завершение запрещено.

### TC-A06: Security policy regression
Покрытие:
- `tests/security/policy-regression.test.ts`

Ожидаемый результат:
- в миграциях есть RLS + CRUD policies + storage prefix restriction.

### TC-A07: Live RLS/Storage smoke (A/B)
Покрытие:
- `tests/security/rls-storage-live.smoke.test.ts`

Ожидаемый результат:
- пользователь B не читает/не обновляет `training_plans` пользователя A;
- пользователь B не читает и не пишет в `plan-files` под префиксом `A`.

## Ручной QA чеклист (desktop/mobile)

### TC-M01: Auth и guard
Шаги:
1. Открыть `/plan` без логина.
2. Войти через `/login`.

Ожидаемый результат:
- без авторизации редирект на `/login`;
- после логина доступ к защищённым экранам.

### TC-M02: Import UX states
Шаги:
1. На `/import` загрузить корректный `.csv` (`Training.csv`), сделать preview и save.
2. Повторить с некорректным файлом.

Ожидаемый результат:
- корректные preview/save states;
- ошибки читаемые и не "падают" на техничке.

### TC-M03: Plan после импорта
Шаги:
1. Открыть `/plan` сразу после успешного импорта.

Ожидаемый результат:
- отображается структура из БД в правильном порядке;
- есть CTA на `/workout/new`.

### TC-M04: Удобство ввода сетов
Шаги:
1. Создать сессию на `/workout/new`.
2. На `/workout/[sessionId]` заполнить и сохранить сеты.
3. Перезагрузить страницу.

Ожидаемый результат:
- значения сохраняются и читаются повторно;
- после `completed` экран становится read-only.

### TC-M05: History и навигация
Шаги:
1. Открыть `/history`.
2. Применить фильтры from/to.
3. Открыть `/history/[sessionId]`.

Ожидаемый результат:
- корректная фильтрация;
- детали read-only;
- навигация между экранами не ломается.

## Фактический прогон (23 февраля 2026)

### Auto

- `npm test -- tests/security/rls-storage-live.smoke.test.ts`:
  - `3 passed`, `0 skipped`.
- `npm run test:e2e`:
  - `2 passed` на каждом прогоне;
  - стабильность подтверждена `3` последовательными успешными прогонами.
- `npm audit --omit=dev --audit-level=high`:
  - `1 high` (`xlsx`, fix недоступен) — см. `docs/adr/ADR-001-xlsx-risk.md`.

### Manual TC-M01...TC-M05

| Кейс | Статус | Комментарий |
|---|---|---|
| TC-M01 (Auth + guard) | Passed | `/plan` без логина редиректит на `/login`, логин успешный. |
| TC-M02 (Import UX states) | Passed | `Training.csv` проходит preview/save, `invalid-range.csv` возвращает бизнес-ошибку. |
| TC-M03 (Plan after import) | Passed | `/plan` показывает структуру из БД и CTA на `/workout/new`. |
| TC-M04 (Workout input UX) | Passed | Создание сессии, сохранение сетов, повторное чтение, завершение и read-only подтверждены. |
| TC-M05 (History navigation) | Passed | `/history` фильтруется по `from/to`, детали `/history/[sessionId]` отображаются корректно. |

Примечание:

- В ходе TC-M02 найден и закрыт дефект `DF-001` (см. `docs/defects-log.md`).

## Что НЕ входит в этап 8

- Новые продуктовые фичи.
- Рефакторы без прямой пользы для стабильности MVP.
- Продвинутый мониторинг и аналитика уровня enterprise.
