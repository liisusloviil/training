# MVP Checklist (Stage 8)

Дата обновления: 23 февраля 2026

## Acceptance Matrix

| ID | Критерий | Проверка | Статус |
|---|---|---|---|
| AC-01 | Неавторизованный пользователь не попадает в защищённую зону | manual + middleware/proxy | Passed |
| AC-02 | Успешный импорт корректного `.csv/.xlsx` создаёт активный план | integration (parser) + stage QA | Passed |
| AC-03 | Некорректный файл импорта возвращает понятную ошибку | integration (parser) + stage QA | Passed |
| AC-04 | `/plan` показывает активный план из БД с правильной сортировкой | stage QA (этап 5) | Passed |
| AC-05 | Создание workout session по дате и дню работает | integration (`createSessionAction`) + stage QA | Passed |
| AC-06 | Сеты сохраняются идемпотентно и читаются повторно | integration (`upsertSessionSetsAction`) + stage QA | Passed |
| AC-07 | Завершение сессии выставляет статус/время и блокирует редактирование | integration (`completeSessionAction`) + stage QA | Passed |
| AC-08 | `/history` показывает только свои сессии с фильтрацией/пагинацией | stage QA (этап 7) | Passed |
| AC-09 | `/history/[sessionId]` показывает read-only детали и все сеты | stage QA (этап 7) | Passed |
| AC-10 | Пользователь A не читает/не обновляет данные пользователя B | security tests (`tests/security/*`) | Passed |
| AC-11 | Доступ к Storage ограничен префиксом `auth.uid()` | security tests (`tests/security/*`) | Passed |
| AC-12 | `npm test`, `npm run lint`, `npm run build` стабильны | CI-like local run | Passed |

## Зафиксированные дефекты P0/P1

Этап 8 закрыл критичный дефект редиректа в server actions:

- `createSessionAction` и `completeSessionAction`: `redirect()` вынесен из `try/catch`, чтобы не перехватывался как ошибка и не ломал UX.

Дополнительно добавлено:

- единый error contract для server actions (`lib/actions/contract.ts`);
- минимальное критичное логирование серверных ошибок (`lib/observability/server-logger.ts`).

## Итог релизной готовности

- P0/P1 open issues: `0` (по текущей test/QA-матрице).
- Release candidate: `v0.1.0-mvp`.
- Итог: `READY FOR DEMO / LIMITED RELEASE`.
