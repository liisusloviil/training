# Developer Improvement Plan (Post Stage 8)

Дата: 23 февраля 2026  
Основание: результаты прогонов `TESTING_STAGE_8.md` (автотесты + UI smoke через MCP Playwright)

## Цель документа

Дать разработчику один рабочий план доработок MVP после завершения этапа 8:

- что нужно исправить в первую очередь;
- как проверить, что исправление действительно готово;
- какие риски блокируют полноценный релиз.

## Текущее состояние

- `npm test` — green.
- `npm run lint` — green.
- `npm run build` — green.
- live security smoke подтверждён (`tests/security/rls-storage-live.smoke.test.ts`: `3 passed`, `0 skipped`).
- UI e2e smoke подтверждён:
  - manual TC-M01...TC-M05 — `Passed`;
  - `npm run test:e2e` — стабильный прогон (3 раза подряд).
- `npm audit --omit=dev --audit-level=high` показывает `1 high` vulnerability в `xlsx` (fix отсутствует; принятое решение — ADR).

## Актуализация статуса (23 февраля 2026, после выполнения плана)

- P0-1: **Closed**
  - test users A/B созданы;
  - `tests/security/rls-storage-live.smoke.test.ts` проходит (`3 passed`, `0 skipped`).
- P0-2: **Closed**
  - manual TC-M01...TC-M05 пройдены и зафиксированы в `TESTING_STAGE_8.md`;
  - найденный дефект оформлен и закрыт (`docs/defects-log.md`, DF-001).
- P1-1: **Closed (accepted risk)**
  - решение по `xlsx` зафиксировано в ADR (`docs/adr/ADR-001-xlsx-risk.md`);
  - компенсирующие guardrails внедрены в import parser/actions.
- P1-2: **Closed**
  - добавлен Playwright e2e smoke: `tests/e2e/mvp-flow.spec.ts`;
  - добавлен CI release gate: `.github/workflows/release-gate.yml`.
  - `npm run test:e2e` стабильно проходит (`3` прогона подряд).
- P2-1: **Closed**
  - добавлены import fixtures: `tests/fixtures/import/*.xlsx`;
  - воспроизводимость зафиксирована в `docs/qa-fixtures.md`.

## Приоритеты (что делать сначала)

## P0: Разблокировать полный e2e и security live smoke

### Задача P0-1: Подготовить тестовых пользователей A/B

Что сделать:

- создать/подтвердить 2 тестовых пользователя в Supabase Auth:
  - `TEST_USER_A_EMAIL`, `TEST_USER_A_PASSWORD`
  - `TEST_USER_B_EMAIL`, `TEST_USER_B_PASSWORD`
- добавить значения в `.env.local` QA-окружения.
- убедиться, что пользователи не содержат прод-данные (live smoke удаляет тестовые записи).

Критерий готовности:

- `tests/security/rls-storage-live.smoke.test.ts` больше не пропускается и проходит полностью.

Проверка:

```bash
npm test -- tests/security/rls-storage-live.smoke.test.ts
```

### Задача P0-2: Допрогон ручного e2e UI по чеклисту этапа 8

Что сделать:

- пройти manual кейсы `TC-M01 ... TC-M05` из `TESTING_STAGE_8.md`.
- зафиксировать результат в QA-заметке (pass/fail + ссылка на дефект при fail).

Критерий готовности:

- весь manual чеклист этапа 8 имеет статус `Passed` или `Blocked` с понятной причиной и тикетом.

Проверка:

- фактический проход по маршрутам:
  - `/login`
  - `/import`
  - `/plan`
  - `/workout/new`
  - `/workout/[sessionId]`
  - `/history`
  - `/history/[sessionId]`

## P1: Снизить security-риск по импорту Excel

### Задача P1-1: Принять решение по зависимости `xlsx`

Проблема:

- runtime dependency `xlsx` имеет high advisory без доступного auto-fix через npm audit.

Что сделать (выбрать один вариант и оформить RFC/ADR):

- Вариант A: заменить `xlsx` на альтернативную библиотеку без high advisory.
- Вариант B: оставить `xlsx`, но изолировать парсинг:
  - запускать парсер в ограниченном контексте;
  - добавить лимиты/таймауты обработки;
  - формально зафиксировать accepted risk в release-документации.

Критерий готовности:

- выбранный вариант реализован и задокументирован;
- security-риск отражён прозрачно (закрыт или принят с компенсирующими мерами).

Проверка:

```bash
npm audit --omit=dev --audit-level=high
npm test
```

## P1: Автоматизировать UI e2e в CI

### Задача P1-2: Добавить Playwright e2e smoke на ключевой пользовательский поток

Что сделать:

- добавить e2e-спеку на сценарий:
  - login
  - import valid file + preview/save
  - open `/plan`
  - create workout session
  - save sets
  - complete session
  - verify `/history` и `/history/[sessionId]`
- подключить запуск в CI как обязательный gate для релизной ветки.

Критерий готовности:

- e2e тест стабильно проходит 3 прогона подряд в CI;
- падение e2e блокирует merge в release branch.

Проверка:

```bash
# пример, адаптировать под фактические npm scripts
npm run test:e2e
```

## P2: Улучшить воспроизводимость QA

### Задача P2-1: Добавить тестовые файлы-фикстуры для импорта

Что сделать:

- добавить в репозиторий:
  - 1 валидный `.xlsx` fixture;
  - 1 невалидный `.xlsx` fixture (ошибка формата sets×reps).
- использовать их в manual QA и e2e.

Критерий готовности:

- у команды один и тот же набор входных файлов для повторяемых результатов.

Проверка:

- на валидном файле import доходит до `saved`;
- на невалидном файле отображается бизнес-ошибка валидации, без падения страницы.

## Рекомендуемая последовательность исполнения

1. P0-1 (test users A/B).  
2. P0-2 (допрогон manual e2e).  
3. P1-1 (решение по `xlsx`).  
4. P1-2 (Playwright e2e в CI).  
5. P2-1 (fixtures для QA).

## Готовность к демо/ограниченному релизу (обновлённый Go/No-Go)

Релиз считать `GO`, если выполнены все пункты:

- live security smoke проходит (не skipped);
- manual e2e TC-M01...TC-M05 закрыт;
- нет открытых P0/P1 дефектов;
- `npm test`, `npm run lint`, `npm run build` остаются green;
- по `xlsx` есть зафиксированное и согласованное решение (fix или accepted risk с мерами).
