# Defects Log

Дата обновления: 23 февраля 2026

## DF-001: Runtime error on /import in dev

- Severity: P1
- Обнаружен: manual e2e (TC-M02)
- Симптом:
  - `A "use server" file can only export async functions, found object`
  - импорт ломался в dev-режиме при submit preview.
- Причина:
  - из файлов с `"use server"` экспортировались non-async значения (`initial*State` / type alias для import action module).
- Исправление:
  - initial state перенесён в client-компоненты;
  - тип `ImportActionState` вынесен в `types/import.ts`;
  - `app/(app)/import/actions.ts` оставляет только async action export.
- Статус: Closed
- Регрессия:
  - manual повторный прогон TC-M02 — Passed.
