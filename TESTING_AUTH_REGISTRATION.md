# Тестирование: Регистрация (Email + Username + Password)

Дата: 23 февраля 2026

## Scope

- регистрация через `/register` (email/username/password/confirmPassword);
- валидация username (нормализация lowercase, regex, уникальность);
- подтверждение email через Supabase;
- callback `/auth/callback`;
- вход через `/login` только по email/password.

## Подготовка

1. В Supabase Auth включён email sign-up.
2. В настройках Auth добавлен redirect URL:
   - `http://localhost:3000/auth/callback`
3. В `.env.local` заполнены:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_APP_URL` (рекомендуется: `http://localhost:3000`)
   - `E2E_REGISTER_EMAIL_DOMAIN` (опционально, домен для e2e signup email)
   - `SUPABASE_SERVICE_ROLE_KEY` (опционально, для e2e проверки полного confirm callback flow)

## Автотесты

- integration:
  - `tests/integration/auth-register.test.ts`
- e2e:
  - `tests/e2e/auth-register.spec.ts`
    - базовый submit-state тест проходит при success или нейтральной бизнес-ошибке;
    - полный confirm callback test запускается только при наличии `SUPABASE_SERVICE_ROLE_KEY`.

Запуск:

```bash
npm test -- tests/integration/auth-register.test.ts
npm run test:e2e
```

## Ручной QA чеклист

### TC-R01: Успешная отправка регистрации

Шаги:
1. Открыть `/register`.
2. Ввести валидные email, username и пароль (>= 8 символов).
3. Подтвердить пароль и отправить форму.

Ожидаемо:
- показывается сообщение “проверьте почту и подтвердите email”.

### TC-R01A: Невалидный username

Шаги:
1. Открыть `/register`.
2. Ввести username c пробелами или символами вне regex.
3. Отправить форму.

Ожидаемо:
- человекочитаемая ошибка валидации username.

### TC-R01B: Занятый username

Шаги:
1. Использовать username, который уже зарегистрирован.
2. Отправить форму.

Ожидаемо:
- отображается ошибка “username уже занят”.

### TC-R02: Несовпадающие пароли

Шаги:
1. Ввести разный `password` и `confirmPassword`.
2. Отправить форму.

Ожидаемо:
- человекочитаемая ошибка “пароли не совпадают”.

### TC-R03: Слабый пароль

Шаги:
1. Ввести пароль короче 8 символов.
2. Отправить форму.

Ожидаемо:
- ошибка валидации минимальной длины.

### TC-R04: Повторный email

Шаги:
1. Попробовать зарегистрировать существующий email.

Ожидаемо:
- нейтральная ошибка без раскрытия существования аккаунта.

### TC-R05: Подтверждение email

Шаги:
1. Перейти по ссылке из письма.
2. Убедиться, что запрос идёт через `/auth/callback`.

Ожидаемо:
- после успешного callback — редирект в защищённую зону (`/` или `next`).

## Definition of Done

- пользователь может отправить регистрацию на `/register`;
- signup server action валидирует данные и создаёт пользователя в Supabase Auth;
- callback `/auth/callback` обрабатывает подтверждение и редиректит в app;
- guard-логика не ломает `/login`, `/register`, `/auth/*`;
- тесты регистрации проходят стабильно.
