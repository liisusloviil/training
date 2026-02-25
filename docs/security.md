# Security (Stage 3)

Дата: 23 февраля 2026

## Миграции

- `supabase/migrations/20260223185118_stage3_rls.sql`
- `supabase/migrations/20260223185119_stage3_storage.sql`
- `supabase/migrations/20260225231000_stage10_user_profiles.sql`

## Что включено

### 1) RLS на доменных таблицах

RLS включён на всех таблицах предметной области:
- `public.training_plans`
- `public.plan_weeks`
- `public.plan_days`
- `public.plan_exercises`
- `public.workout_sessions`
- `public.session_sets`
- `public.user_profiles` (RLS по `user_id = auth.uid()`, select/insert/update только для владельца)

Для каждой таблицы созданы политики `SELECT/INSERT/UPDATE/DELETE` по правилу:
- доступ только если `user_id = auth.uid()`

Это гарантирует:
- пользователь A не читает и не меняет данные пользователя B;
- владелец данных сохраняет полный CRUD-доступ к своим строкам.

Для проверки доступности username при signup добавлена функция:
- `public.is_username_available(text)` (security definer, `grant execute` для `anon/authenticated`).

### 2) Storage bucket и политики

Создан/обновлён приватный bucket:
- `plan-files` (`public = false`)

Для `storage.objects` добавлены политики `SELECT/INSERT/UPDATE/DELETE`:
- только для `bucket_id = 'plan-files'`
- только если первый сегмент пути совпадает с `auth.uid()`:
  - `(storage.foldername(name))[1] = auth.uid()::text`

Ожидаемый формат пути файла:
- `${user_id}/${plan_id}/${timestamp}_${filename}` (`.xlsx` или `.csv`)

Это гарантирует:
- пользователь может работать только с объектами внутри своей префикс-папки;
- кросс-доступ между пользователями в Storage запрещён.

## Технические примечания

- Для таблиц выданы `grant select, insert, update, delete` роли `authenticated`; реальный доступ ограничивается RLS-политиками.
- Используется `drop policy if exists ...` перед `create policy ...`, чтобы миграции можно было безопасно повторно применять в dev-среде.

## Smoke-проверки безопасности

### SQL: проверить, что RLS включён

```sql
select relname, relrowsecurity
from pg_class
where relname in (
  'training_plans',
  'plan_weeks',
  'plan_days',
  'plan_exercises',
  'workout_sessions',
  'session_sets'
)
order by relname;
```

Ожидаемо: `relrowsecurity = true` для всех таблиц.

### SQL: проверить наличие политик

```sql
select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname in ('public', 'storage')
  and (
    tablename in (
      'training_plans',
      'plan_weeks',
      'plan_days',
      'plan_exercises',
      'workout_sessions',
      'session_sets'
    )
    or (schemaname = 'storage' and tablename = 'objects')
  )
order by schemaname, tablename, policyname;
```

### Проверка сценария "свой/чужой"

1. Под пользователем A создать тестовые записи в таблицах и загрузить файл в `plan-files/A/...`.
2. Под пользователем B попытаться:
- прочитать записи A;
- изменить/удалить записи A;
- прочитать/изменить/удалить объект `plan-files/A/...`.

Ожидаемо:
- все операции с чужими данными отклоняются;
- операции со своими данными проходят.
