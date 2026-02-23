# Тестирование: Этап 2 (SQL-схема и миграции)

## Что реализовано в этапе 2

Цель этапа: подготовить схему БД Supabase/Postgres для MVP.

Реализовано:
- Миграция схемы:
  - `supabase/migrations/20260223184735_stage2_training_schema.sql`
- Seed/smoke SQL:
  - `supabase/seed.sql`
- Документация схемы:
  - `docs/schema.md`

Созданы сущности:
- `training_plans`
- `plan_weeks`
- `plan_days`
- `plan_exercises`
- `workout_sessions`
- `session_sets`
- enum `workout_session_status` (`in_progress`, `completed`)

## Подготовка к тестированию

1. Нужен доступ к проекту Supabase (SQL Editor или psql).
2. Применить миграцию из файла:
   - `supabase/migrations/20260223184735_stage2_training_schema.sql`
3. Выполнить SQL из `supabase/seed.sql` для smoke-проверок.

## Ручные тест-кейсы (этап 2)

### TC-01: Миграция разворачивается без ошибок
Шаги:
1. Открыть SQL Editor в Supabase.
2. Выполнить SQL из `supabase/migrations/20260223184735_stage2_training_schema.sql`.

Ожидаемый результат:
- Скрипт выполняется полностью без ошибок.
- Все таблицы и enum создаются.

### TC-02: Проверка наличия таблиц и enum через seed smoke
Шаги:
1. Выполнить SQL из `supabase/seed.sql`.

Ожидаемый результат:
- Для всех таблиц поле `exists = true`.
- В enum возвращаются оба значения:
  - `in_progress`
  - `completed`

### TC-03: Проверка уникальности недели внутри плана
Шаги:
1. Создать тестового пользователя в `auth.users` (или использовать существующего).
2. Добавить запись в `training_plans`.
3. Добавить `plan_weeks` с `week_number = 1`.
4. Повторно попытаться добавить в тот же `plan_id` ещё одну неделю с `week_number = 1`.

Ожидаемый результат:
- Вторая вставка отклоняется по `unique(plan_id, week_number)`.

### TC-04: Проверка уникальности дня в неделе
Шаги:
1. Для одной недели (`plan_weeks.id`) вставить день с `day_key = 'monday'`.
2. Повторно вставить день с тем же `day_key = 'monday'` в ту же неделю.

Ожидаемый результат:
- Вторая вставка отклоняется по `unique(week_id, day_key)`.

### TC-05: Проверка уникальности сессии на дату/день
Шаги:
1. Для одного пользователя и одного `plan_day_id` создать `workout_sessions` на дату `2026-02-23`.
2. Повторить вставку с теми же `user_id`, `plan_day_id`, `session_date`.

Ожидаемый результат:
- Вторая вставка отклоняется по `unique(user_id, session_date, plan_day_id)`.

### TC-06: Проверка согласованности `status` и `completed_at`
Шаги:
1. Попробовать вставить `workout_sessions` со `status = 'in_progress'` и заполненным `completed_at`.
2. Попробовать вставить `workout_sessions` со `status = 'completed'` и `completed_at = null`.

Ожидаемый результат:
- Оба варианта отклоняются check-ограничением.

### TC-07: Проверка уникальности сета
Шаги:
1. Создать `session_sets` для одной пары (`session_id`, `plan_exercise_id`) с `set_number = 1`.
2. Повторно вставить запись с теми же (`session_id`, `plan_exercise_id`, `set_number`).

Ожидаемый результат:
- Вторая вставка отклоняется по `unique(session_id, plan_exercise_id, set_number)`.

### TC-08: Проверка триггера `updated_at`
Шаги:
1. Вставить запись в `session_sets`.
2. Запомнить `updated_at`.
3. Выполнить `update` этой записи (например, изменить `weight`).

Ожидаемый результат:
- `updated_at` изменился на более позднее значение.

## Что НЕ входит в этап 2 (ожидаемо)

- RLS-политики и storage policies (это этап 3).
- CRUD-логика импорта/тренировок на уровне приложения.
- UI для просмотра данных из таблиц.
