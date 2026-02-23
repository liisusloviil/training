import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  buildPlanPreview,
  parseTrainingPlanFile,
  parseTrainingPlanWorkbook,
} from "@/lib/excel/parser";
import { ExcelImportError, IMPORT_GUARDRAILS } from "@/lib/excel/validators";

function buildWorkbook(rows: unknown[][]) {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "План");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

function buildWorkbookWithSheets(sheetCount: number) {
  const workbook = XLSX.utils.book_new();
  const templateRows = [
    ["Неделя", "День", "Упражнение", "Интенсивность", "Подходы×повторы"],
    ["Неделя 1", "Понедельник", "Присед", "RPE 7", "4×8"],
  ];

  for (let index = 0; index < sheetCount; index += 1) {
    const worksheet = XLSX.utils.aoa_to_sheet(templateRows);
    XLSX.utils.book_append_sheet(workbook, worksheet, `Sheet_${index + 1}`);
  }

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

describe("integration: excel/csv import parser", () => {
  it("parses valid xlsx and returns normalized preview", () => {
    const file = buildWorkbook([
      ["Неделя", "День", "Упражнение", "Интенсивность", "Подходы×повторы"],
      ["Неделя 1", "Понедельник", "Присед", "RPE 7", "4×8"],
      ["", "", "Жим лёжа", "RPE 8", "5x5"],
      ["", "Среда", "Тяга", "", "3*6"],
      ["Неделя 2", "Пятница", "Жим стоя", "", "4х10"],
    ]);

    const parsed = parseTrainingPlanWorkbook(file, "test-plan.xlsx");
    const preview = buildPlanPreview(parsed);

    expect(parsed.name).toBe("test-plan");
    expect(parsed.weeks).toHaveLength(2);
    expect(preview.totalWeeks).toBe(2);
    expect(preview.totalDays).toBe(3);
    expect(preview.totalExercises).toBe(4);
    expect(parsed.weeks[0]?.days[0]?.exercises[1]?.rawSetsReps).toBe("5×5");
  });

  it("parses Training.csv fixture with week/day markers and rep ranges", () => {
    const csvPath = resolve(process.cwd(), "tests/fixtures/import/Training.csv");
    const csvBuffer = readFileSync(csvPath);

    const parsed = parseTrainingPlanFile(csvBuffer, "Training.csv");

    expect(parsed.name).toBe("Training");
    expect(parsed.weeks.length).toBeGreaterThanOrEqual(8);

    const firstExercise = parsed.weeks[0]?.days[0]?.exercises[0];
    expect(firstExercise?.exerciseName).toContain("жим");
    expect(firstExercise?.rawSetsReps).toBe("4×8-12");
    expect(firstExercise?.prescribedSets).toBe(4);
    expect(firstExercise?.prescribedReps).toBeNull();
    expect(firstExercise?.prescribedRepsMin).toBe(8);
    expect(firstExercise?.prescribedRepsMax).toBe(12);
  });

  it("fails on invalid reps range where min is greater than max", () => {
    const csvBuffer = Buffer.from(
      [
        "упражнения;интенсивность;подходы х повторения",
        "неделя 1;;",
        "понедельник;;",
        "присед;средняя;4х12-8",
      ].join("\n"),
      "utf8",
    );

    expect(() => parseTrainingPlanFile(csvBuffer, "broken-range.csv")).toThrow(
      "Левая граница",
    );
  });

  it("fails on invalid sets x reps format", () => {
    const file = buildWorkbook([
      ["Неделя", "День", "Упражнение", "Интенсивность", "Подходы×повторы"],
      ["Неделя 1", "Понедельник", "Присед", "RPE 7", "four by eight"],
    ]);

    expect(() => parseTrainingPlanWorkbook(file, "broken.xlsx")).toThrow(
      ExcelImportError,
    );
  });

  it("fails when workbook has no usable exercise rows", () => {
    const file = buildWorkbook([["какой-то", "другой", "шаблон"]]);

    expect(() => parseTrainingPlanWorkbook(file, "empty.xlsx")).toThrow(
      "В файле не найдено ни одного упражнения",
    );
  });

  it("fails when workbook has too many sheets", () => {
    const file = buildWorkbookWithSheets(IMPORT_GUARDRAILS.maxSheets + 1);

    expect(() => parseTrainingPlanWorkbook(file, "too-many-sheets.xlsx")).toThrow(
      "Слишком много листов",
    );
  });

  it("fails when input exceeds size limit", () => {
    const largeBuffer = Buffer.alloc(IMPORT_GUARDRAILS.maxFileSizeBytes + 1, 1);

    expect(() => parseTrainingPlanWorkbook(largeBuffer, "too-large.xlsx")).toThrow(
      "слишком большой",
    );
  });
});
