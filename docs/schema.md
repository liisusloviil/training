# Schema (Stage 2)

Дата: 23 февраля 2026

## Миграции

- `supabase/migrations/20260223184735_stage2_training_schema.sql`
- `supabase/migrations/20260223222500_stage9_reps_range.sql`

## Доменные таблицы

### `training_plans`

Назначение: заголовок импортированного плана пользователя.

Поля:
- `id uuid pk`
- `user_id uuid not null -> auth.users(id)`
- `name text not null`
- `source_filename text not null`
- `source_file_path text null`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`

Индексы:
- `(user_id, is_active, created_at desc)`

### `plan_weeks`

Назначение: недели внутри плана.

Поля:
- `id uuid pk`
- `user_id uuid not null -> auth.users(id)`
- `plan_id uuid not null -> training_plans(id)`
- `week_number int not null check > 0`
- `created_at timestamptz not null default now()`

Ограничения:
- `unique(plan_id, week_number)`

### `plan_days`

Назначение: тренировочные дни внутри недели.

Поля:
- `id uuid pk`
- `user_id uuid not null -> auth.users(id)`
- `week_id uuid not null -> plan_weeks(id)`
- `day_key text not null` (`monday..sunday`)
- `day_label text not null`
- `sort_order int not null check > 0`
- `created_at timestamptz not null default now()`

Ограничения:
- `unique(week_id, day_key)`

### `plan_exercises`

Назначение: упражнения в дне плана.

Поля:
- `id uuid pk`
- `user_id uuid not null -> auth.users(id)`
- `day_id uuid not null -> plan_days(id)`
- `sort_order int not null check > 0`
- `exercise_name text not null`
- `intensity text null`
- `prescribed_sets int null check > 0`
- `prescribed_reps int null check > 0`
- `prescribed_reps_min int null check > 0`
- `prescribed_reps_max int null check > 0`
  - если один из диапазона задан, второй тоже обязателен;
  - `prescribed_reps_min <= prescribed_reps_max`
- `raw_sets_reps text not null`
- `created_at timestamptz not null default now()`

Индексы:
- `(day_id, sort_order)`

### `workout_sessions`

Назначение: фактическая тренировка на выбранный день плана и дату.

Поля:
- `id uuid pk`
- `user_id uuid not null -> auth.users(id)`
- `plan_day_id uuid not null -> plan_days(id)`
- `session_date date not null`
- `status workout_session_status not null default 'in_progress'`
- `created_at timestamptz not null default now()`
- `completed_at timestamptz null`

Ограничения:
- `unique(user_id, session_date, plan_day_id)`
- согласованность статуса и `completed_at`:
  - `in_progress` => `completed_at is null`
  - `completed` => `completed_at is not null`

Индексы:
- `(user_id, session_date desc)`

### `session_sets`

Назначение: фактически выполненные подходы по упражнению в сессии.

Поля:
- `id uuid pk`
- `user_id uuid not null -> auth.users(id)`
- `session_id uuid not null -> workout_sessions(id)`
- `plan_exercise_id uuid not null -> plan_exercises(id)`
- `set_number int not null check > 0`
- `reps int not null check >= 0`
- `weight numeric(6,2) not null check >= 0`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Ограничения:
- `unique(session_id, plan_exercise_id, set_number)`

Индексы:
- `(session_id)`

Дополнительно:
- триггер `set_session_sets_updated_at` автоматически обновляет `updated_at` при `UPDATE`.

## Enum/типы

### `workout_session_status`

Значения:
- `in_progress`
- `completed`

## Связи (кратко)

- `training_plans 1 -> N plan_weeks`
- `plan_weeks 1 -> N plan_days`
- `plan_days 1 -> N plan_exercises`
- `plan_days 1 -> N workout_sessions`
- `workout_sessions 1 -> N session_sets`
- `plan_exercises 1 -> N session_sets`

Все FK на пользовательские данные настроены с `on delete cascade`.
