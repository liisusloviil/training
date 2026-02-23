import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const rlsSql = readFileSync(
  join(migrationsDir, "20260223185118_stage3_rls.sql"),
  "utf-8",
);
const storageSql = readFileSync(
  join(migrationsDir, "20260223185119_stage3_storage.sql"),
  "utf-8",
);

describe("security smoke: policy regression", () => {
  it("keeps RLS enabled for all domain tables", () => {
    const tables = [
      "training_plans",
      "plan_weeks",
      "plan_days",
      "plan_exercises",
      "workout_sessions",
      "session_sets",
    ];

    for (const table of tables) {
      expect(rlsSql).toContain(
        `alter table public.${table} enable row level security;`,
      );
    }
  });

  it("keeps CRUD policies for all domain tables", () => {
    const tables = [
      "training_plans",
      "plan_weeks",
      "plan_days",
      "plan_exercises",
      "workout_sessions",
      "session_sets",
    ];
    const operations = ["select", "insert", "update", "delete"];

    for (const table of tables) {
      for (const operation of operations) {
        expect(rlsSql).toContain(`create policy ${table}_${operation}_own`);
      }
    }
  });

  it("keeps auth.uid() ownership checks in public table policies", () => {
    const ownershipChecks = [
      "using ((select auth.uid()) = user_id)",
      "with check ((select auth.uid()) = user_id)",
    ];

    for (const check of ownershipChecks) {
      expect(rlsSql).toContain(check);
    }
  });

  it("keeps private plan-files bucket and auth.uid() prefix storage policies", () => {
    expect(storageSql).toContain("values ('plan-files', 'plan-files', false)");

    const operations = ["select", "insert", "update", "delete"];
    for (const operation of operations) {
      expect(storageSql).toContain(`create policy plan_files_${operation}_own_prefix`);
    }

    expect(storageSql).toContain("bucket_id = 'plan-files'");
    expect(storageSql).toContain("(storage.foldername(name))[1] = (select auth.uid()::text)");
  });
});
