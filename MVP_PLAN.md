# MVP “Дневник тренировок из Excel” — план разработки

## Краткое summary
- Цель MVP: пользователь загружает `.xlsx` план тренировок, получает структуру “неделя → день → упражнения”, фиксирует фактические сеты по датам и смотрит историю.
- Базовый технический принцип: `Next.js App Router + Supabase Auth/Postgres + SheetJS`, без Prisma, с RLS-first безопасностью.
- Ключевой выбор: парсинг Excel на сервере (Server Action/Route Handler), чтобы унифицировать валидацию, снизить риск подмены данных, упростить контроль ошибок и RLS.

## A) Архитектура MVP
- Роуты/страницы:
- `/login` — вход/выход через Supabase Auth.
- `/` — редирект на `/import` (если нет плана) или `/plan` (если план есть).
- `/import` — загрузка `.xlsx`, предпросмотр результата импорта, подтверждение сохранения.
- `/plan` — просмотр импортированного плана: недели, дни, упражнения.
- `/workout/new` — создание сессии по дате и выбору дня плана.
- `/workout/[sessionId]` — страница дня: список упражнений и ввод сетов (`set_number`, `reps`, `weight`).
- `/history` — список прошлых сессий.
- `/history/[sessionId]` — детали сессии и введённые сеты.
- Где парсим `xlsx` (client/server) и почему:
- Парсим на сервере в `Server Action` (или `POST /api/import`), принимая `File` из формы.
- Причины: единая строгая валидация формата, меньше логики в клиенте, невозможность обойти бизнес-правила через модифицированный фронт, проще трассировать ошибки импорта.
- Данные на клиенте: только UI-просмотр результата парсинга и подтверждение импорта.
- Поток данных `import → plan → workout session → history`:
- `import`: пользователь загружает `.xlsx`, сервер парсит лист(ы), валидирует структуру “неделя N / день / упражнения”.
- `plan`: сервер создаёт запись плана и дочерние сущности (недели, дни, упражнения) транзакционно.
- `workout session`: пользователь создаёт сессию по дате и выбранному дню плана, вводит фактические сеты.
- `history`: пользователь видит список сессий по датам и проваливается в детали сетов.
- Какие API/Server Actions нужны:
- `signInWithOtpOrPassword`/`signOut` (через Supabase client helpers).
- `importPlanAction(file)` — загрузка, парсинг, валидация, транзакционная запись плана.
- `getCurrentPlanQuery()` — чтение активного плана пользователя.
- `createSessionAction({ plan_day_id, session_date })` — создать тренировочную сессию.
- `upsertSessionSetsAction({ session_id, sets[] })` — сохранить/обновить сеты.
- `completeSessionAction({ session_id })` — финализировать сессию.
- `getHistoryQuery({ page, from, to })` — список сессий.
- `getSessionDetailsQuery({ session_id })` — сеты и контекст упражнения.

## B) Схема Postgres
- Таблицы/поля/связи:
- `training_plans`: `id uuid pk`, `user_id uuid`, `name text`, `source_filename text`, `source_file_path text null`, `is_active boolean default true`, `created_at timestamptz`.
- `plan_weeks`: `id uuid pk`, `user_id uuid`, `plan_id uuid fk -> training_plans`, `week_number int`, `created_at`.
- `plan_days`: `id uuid pk`, `user_id uuid`, `week_id uuid fk -> plan_weeks`, `day_key text` (`monday|wednesday|friday`), `day_label text`, `sort_order int`.
- `plan_exercises`: `id uuid pk`, `user_id uuid`, `day_id uuid fk -> plan_days`, `sort_order int`, `exercise_name text`, `intensity text null`, `prescribed_sets int`, `prescribed_reps int`, `raw_sets_reps text`.
- `workout_sessions`: `id uuid pk`, `user_id uuid`, `plan_day_id uuid fk -> plan_days`, `session_date date`, `status text` (`in_progress|completed`), `created_at`, `completed_at timestamptz null`.
- `session_sets`: `id uuid pk`, `user_id uuid`, `session_id uuid fk -> workout_sessions`, `plan_exercise_id uuid fk -> plan_exercises`, `set_number int`, `reps int`, `weight numeric(6,2)`, `created_at`, `updated_at`.
- Индексы:
- `training_plans (user_id, is_active, created_at desc)`.
- `plan_weeks unique (plan_id, week_number)`.
- `plan_days unique (week_id, day_key)`.
- `plan_exercises (day_id, sort_order)`.
- `workout_sessions unique (user_id, session_date, plan_day_id)`.
- `workout_sessions (user_id, session_date desc)`.
- `session_sets unique (session_id, plan_exercise_id, set_number)`.
- `session_sets (session_id)`.
- Что хранить в Storage (если нужно):
- Опционально хранить оригинал `.xlsx` в приватном bucket `plan-files`.
- Путь: `${user_id}/${plan_id}/${timestamp}_${sanitized_filename}.xlsx`.
- В БД хранить только `source_file_path` и `source_filename`; парсенные данные хранятся в Postgres как канонический источник.

## C) Supabase Security
- Какие таблицы под RLS:
- Все доменные таблицы: `training_plans`, `plan_weeks`, `plan_days`, `plan_exercises`, `workout_sessions`, `session_sets`.
- Политики (`user_id = auth.uid()`) и ключевые сценарии доступа:
- `SELECT`: разрешён только при `user_id = auth.uid()`.
- `INSERT`: разрешён только при `user_id = auth.uid()`.
- `UPDATE`: разрешён только при `user_id = auth.uid()`.
- `DELETE`: разрешён только при `user_id = auth.uid()`.
- Для Storage bucket `plan-files`: read/write только в папку префикса `auth.uid()`.
- Сценарии:
- Пользователь A не видит и не может менять планы/сессии пользователя B.
- Пользователь может читать только свои упражнения и сеты через join-цепочку.
- Создание сессии возможно только на `plan_day`, принадлежащий тому же `user_id`.

## D) План разработки (8 этапов)
- Этап 1 — Каркас проекта и инфраструктура auth. Checklist задач: подготовить Next.js App Router структуру, подключить Supabase SSR-клиенты, middleware для сессии, базовые страницы `/login` и защищённые маршруты. Definition of Done: неавторизованный пользователь уходит на `/login`, авторизованный попадает в приложение, logout работает. Какие папки/файлы будут изменены: `app/(auth)/login/page.tsx`, `app/(app)/layout.tsx`, `middleware.ts`, `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/auth.ts`.
- Этап 2 — SQL-схема и миграции. Checklist задач: создать таблицы, FK, уникальные ограничения, индексы, enum/check для статуса сессии, первичные seed-проверки. Definition of Done: схема разворачивается с нуля без ручных правок, все связи валидны. Какие папки/файлы будут изменены: `supabase/migrations/*.sql`, `supabase/seed.sql` (опционально), `docs/schema.md`.
- Этап 3 — RLS и storage policies. Checklist задач: включить RLS на таблицах, добавить `SELECT/INSERT/UPDATE/DELETE` политики, настроить private bucket и политики доступа по префиксу `auth.uid()`. Definition of Done: кросс-доступ между пользователями невозможен, позитивные сценарии для владельца работают. Какие папки/файлы будут изменены: `supabase/migrations/*_rls.sql`, `supabase/migrations/*_storage.sql`, `docs/security.md`.
- Этап 4 — Импорт Excel и парсинг. Checklist задач: реализовать загрузку файла на `/import`, парсер SheetJS для шаблона “неделя N → день → упражнение|интенсивность|подходы×повторы”, серверную валидацию и нормализацию данных, сохранение в транзакции, обработку ошибок формата. Definition of Done: корректный файл сохраняется в БД (и опционально в Storage), некорректный файл возвращает понятную ошибку с причиной. Какие папки/файлы будут изменены: `app/(app)/import/page.tsx`, `app/(app)/import/actions.ts`, `lib/excel/parser.ts`, `lib/excel/validators.ts`, `lib/db/plan-repository.ts`, `types/plan.ts`.
- Этап 5 — Просмотр плана. Checklist задач: сделать `/plan` с выводом недель, дней и упражнений в правильном порядке, реализовать fetch текущего активного плана пользователя, fallback если план пустой. Definition of Done: пользователь видит импортированную структуру 1:1 с ожидаемой и может перейти к созданию сессии. Какие папки/файлы будут изменены: `app/(app)/plan/page.tsx`, `lib/db/plan-queries.ts`, `components/plan/*`.
- Этап 6 — Сессия тренировки и ввод сетов. Checklist задач: создать `/workout/new` и `/workout/[sessionId]`, реализовать создание сессии по дате и дню, форму ввода/редактирования сетов по упражнениям, upsert сетов и завершение сессии. Definition of Done: пользователь может заполнить сеты и сохранить их без потери данных при повторном открытии. Какие папки/файлы будут изменены: `app/(app)/workout/new/page.tsx`, `app/(app)/workout/[sessionId]/page.tsx`, `app/(app)/workout/actions.ts`, `lib/db/session-repository.ts`, `components/workout/*`, `types/session.ts`.
- Этап 7 — История и просмотр прогресса. Checklist задач: сделать `/history` с пагинацией/фильтром по дате, страницу `/history/[sessionId]` с деталями сетов, быстрые агрегаты (кол-во упражнений, общий тоннаж опционально). Definition of Done: видны прошлые сессии и их фактические сеты в read-only режиме. Какие папки/файлы будут изменены: `app/(app)/history/page.tsx`, `app/(app)/history/[sessionId]/page.tsx`, `lib/db/history-queries.ts`, `components/history/*`.
- Этап 8 — Тестирование и стабилизация MVP. Checklist задач: интеграционные проверки импорт→план→сессия→история, негативные кейсы Excel, smoke RLS-сценарии, базовая обработка ошибок UI и логирование. Definition of Done: все acceptance checks проходят, критичных багов P0/P1 нет. Какие папки/файлы будут изменены: `tests/integration/*`, `tests/rls/*`, `docs/mvp-checklist.md`, `README.md`.

## E) План коммитов
- `chore(app): bootstrap Next.js app router with Supabase auth scaffolding`
- `feat(db): add training plan and workout session schema with indexes`
- `feat(security): enable RLS policies and storage access rules`
- `feat(import): implement xlsx upload, parsing, validation, and transactional save`
- `feat(plan): add plan overview page (weeks/days/exercises)`
- `feat(workout): add session creation and set input persistence`
- `feat(history): add sessions list and session detail pages`
- `test(mvp): add integration and RLS smoke coverage, finalize docs`

## F) Риски и допущения
- Формат Excel/ошибки импорта:
- Допущение: входной файл имеет устойчивый шаблон с русскими заголовками дней и строкой `подходы×повторы` в формате `N×M`.
- Риск: вариативные названия дней, merged cells, пустые строки, скрытые листы, разные символы `x/×`.
- Решение: строгая схема парсинга + нормализация + человекочитаемые сообщения об ошибке с указанием листа/строки.
- RLS и доступы:
- Допущение: все операции идут под пользовательским JWT, не через service role в runtime.
- Риск: пропущенная политика на дочерней таблице или косвенный доступ через join.
- Решение: RLS на каждой таблице + smoke-тесты “свой/чужой пользователь”.
- UX ввода сетов:
- Допущение: для MVP достаточно табличного ввода вручную, без авторасчётов и таймера отдыха.
- Риск: пользователю неудобно вводить много сетов на мобильном.
- Решение: минимизировать число полей, сохранять по кнопке и поддержать повторное открытие без потери.
- Миграции/изменение схемы:
- Допущение: в MVP допустимы простые forward-only миграции.
- Риск: изменение структуры после первых реальных файлов импорта.
- Решение: хранить `raw_sets_reps` и `source_filename` для обратной совместимости и отладки.

## G) Acceptance Criteria MVP
- Пользователь может зарегистрироваться/войти и выйти; защищённые страницы недоступны без авторизации.
- Пользователь может загрузить `.xlsx` на `/import` и получить результат импорта без падения UI.
- Файл с корректным шаблоном создаёт в БД план с неделями, днями и упражнениями.
- Файл с некорректным шаблоном не создаёт частичных данных и возвращает понятную ошибку.
- На `/plan` отображается структура “неделя → день → упражнения” в правильном порядке.
- На `/workout/new` можно создать сессию по выбранной дате и дню плана.
- На `/workout/[sessionId]` можно сохранить минимум 1 сет с полями `set_number`, `reps`, `weight`.
- Повторное открытие `/workout/[sessionId]` показывает ранее сохранённые сеты.
- На `/history` отображается список прошлых сессий пользователя по дате.
- На `/history/[sessionId]` видны все сохранённые сеты конкретной сессии.
- Пользователь A не может прочитать или изменить данные пользователя B на уровне БД (RLS).
- Импорт и сохранение сессии работают без Prisma, только через Supabase/Postgres.

Можно начинать реализацию?
