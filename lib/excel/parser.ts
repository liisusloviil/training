import * as XLSX from "xlsx";
import {
  IMPORT_GUARDRAILS,
  ExcelImportError,
  assertFileSizeLimit,
  buildPlanNameFromFilename,
  detectHeaderRole,
  detectImportFileKind,
  normalizeText,
  parseDayValue,
  parseSetsReps,
  parseWeekValue,
} from "@/lib/excel/validators";
import type {
  ParsedDay,
  ParsedExercise,
  ParsedTrainingPlan,
  ParsedWeek,
  TrainingPlanPreview,
} from "@/types/plan";

type HeaderMap = {
  week?: number;
  day?: number;
  exercise?: number;
  intensity?: number;
  setsReps?: number;
};

type DayDraft = {
  dayKey: ParsedDay["dayKey"];
  dayLabel: string;
  sortOrder: number;
  exercises: ParsedExercise[];
};

type WeekDraft = {
  weekNumber: number;
  days: Map<ParsedDay["dayKey"], DayDraft>;
};

type ParseContext = {
  startedAt: number;
  exercisesCount: number;
};

function assertWithinParseDeadline(context: ParseContext, scope: string) {
  if (Date.now() - context.startedAt > IMPORT_GUARDRAILS.maxParseDurationMs) {
    throw new ExcelImportError(
      `${scope}: превышено время обработки файла (${IMPORT_GUARDRAILS.maxParseDurationMs} ms).`,
    );
  }
}

function detectHeaderRow(rows: unknown[][]): { headerRowIndex: number; headerMap: HeaderMap } {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const headerMap: HeaderMap = {};

    for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
      const role = detectHeaderRole(row[colIndex]);
      if (!role) {
        continue;
      }

      headerMap[role] = colIndex;
    }

    if (headerMap.exercise !== undefined && headerMap.setsReps !== undefined) {
      return { headerRowIndex: rowIndex, headerMap };
    }
  }

  throw new ExcelImportError(
    "Не удалось найти строку заголовков. Ожидаются колонки: неделя, день, упражнение, интенсивность, подходы×повторы.",
  );
}

function getCell(row: unknown[], index: number | undefined): unknown {
  if (index === undefined) {
    return "";
  }

  return row[index] ?? "";
}

function ensureWeek(weekMap: Map<number, WeekDraft>, weekNumber: number): WeekDraft {
  const existing = weekMap.get(weekNumber);
  if (existing) {
    return existing;
  }

  const created: WeekDraft = {
    weekNumber,
    days: new Map(),
  };

  weekMap.set(weekNumber, created);
  return created;
}

function ensureDay(
  week: WeekDraft,
  dayInput: { key: ParsedDay["dayKey"]; label: string; sortOrder: number },
): DayDraft {
  const existing = week.days.get(dayInput.key);
  if (existing) {
    return existing;
  }

  const created: DayDraft = {
    dayKey: dayInput.key,
    dayLabel: dayInput.label,
    sortOrder: dayInput.sortOrder,
    exercises: [],
  };

  week.days.set(dayInput.key, created);
  return created;
}

function parseWeekMarkerFromCell(value: unknown): number | null {
  const normalized = normalizeText(value);
  if (!normalized || (!normalized.includes("неделя") && !normalized.includes("week"))) {
    return null;
  }

  return parseWeekValue(value);
}

function parseDayMarkerFromCell(
  value: unknown,
): { key: ParsedDay["dayKey"]; label: string; sortOrder: number } | null {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  try {
    return parseDayValue(value);
  } catch {
    return null;
  }
}

function parseRows(
  rows: unknown[][],
  sourceLabel: string,
  weekMap: Map<number, WeekDraft>,
  context: ParseContext,
) {
  const { headerRowIndex, headerMap } = detectHeaderRow(rows);

  let currentWeek: number | null = null;
  let currentDay: { key: ParsedDay["dayKey"]; label: string; sortOrder: number } | null = null;

  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    if (rowIndex % 50 === 0) {
      assertWithinParseDeadline(context, sourceLabel);
    }

    const row = rows[rowIndex] ?? [];
    const line = rowIndex + 1;

    const weekRaw = getCell(row, headerMap.week);
    const dayRaw = getCell(row, headerMap.day);
    const exerciseRaw = String(getCell(row, headerMap.exercise) ?? "").trim();
    const intensityRaw = String(getCell(row, headerMap.intensity) ?? "").trim();
    const setsRepsRaw = String(getCell(row, headerMap.setsReps) ?? "").trim();

    const hasAnyValue = row.some((cell) => normalizeText(cell).length > 0);
    if (!hasAnyValue) {
      continue;
    }

    if (normalizeText(weekRaw)) {
      currentWeek = parseWeekValue(weekRaw);
    } else if (headerMap.week === undefined) {
      for (const cell of row) {
        const parsedWeek = parseWeekMarkerFromCell(cell);
        if (parsedWeek !== null) {
          currentWeek = parsedWeek;
          break;
        }
      }
    }

    if (normalizeText(dayRaw)) {
      currentDay = parseDayValue(dayRaw);
    } else if (headerMap.day === undefined) {
      for (const cell of row) {
        const parsedDay = parseDayMarkerFromCell(cell);
        if (parsedDay) {
          currentDay = parsedDay;
          break;
        }
      }
    }

    const isMetadataOnlyRow = !exerciseRaw && !setsRepsRaw;
    if (isMetadataOnlyRow) {
      continue;
    }

    if (!setsRepsRaw) {
      const markerWeek = parseWeekMarkerFromCell(exerciseRaw);
      if (markerWeek !== null) {
        currentWeek = markerWeek;
        continue;
      }

      const markerDay = parseDayMarkerFromCell(exerciseRaw);
      if (markerDay) {
        currentDay = markerDay;
        continue;
      }
    }

    if (!currentWeek) {
      throw new ExcelImportError(
        `${sourceLabel}, строка ${line}: упражнение указано раньше, чем неделя.`,
      );
    }

    if (!currentDay) {
      throw new ExcelImportError(
        `${sourceLabel}, строка ${line}: упражнение указано раньше, чем день недели.`,
      );
    }

    if (!exerciseRaw) {
      throw new ExcelImportError(
        `${sourceLabel}, строка ${line}: заполните название упражнения.`,
      );
    }

    if (!setsRepsRaw) {
      throw new ExcelImportError(
        `${sourceLabel}, строка ${line}: заполните колонку подходы×повторы.`,
      );
    }

    const parsedSetsReps = parseSetsReps(setsRepsRaw);
    context.exercisesCount += 1;
    if (context.exercisesCount > IMPORT_GUARDRAILS.maxExercisesTotal) {
      throw new ExcelImportError(
        `Файл содержит слишком много упражнений (${context.exercisesCount}). ` +
          `Максимум: ${IMPORT_GUARDRAILS.maxExercisesTotal}.`,
      );
    }

    const weekDraft = ensureWeek(weekMap, currentWeek);
    const dayDraft = ensureDay(weekDraft, currentDay);

    dayDraft.exercises.push({
      sortOrder: dayDraft.exercises.length + 1,
      exerciseName: exerciseRaw,
      intensity: intensityRaw || null,
      prescribedSets: parsedSetsReps.prescribedSets,
      prescribedReps: parsedSetsReps.prescribedReps,
      prescribedRepsMin: parsedSetsReps.prescribedRepsMin,
      prescribedRepsMax: parsedSetsReps.prescribedRepsMax,
      rawSetsReps: parsedSetsReps.rawSetsReps,
    });
  }
}

function finalizePlan(name: string, weekMap: Map<number, WeekDraft>): ParsedTrainingPlan {
  const weeks: ParsedWeek[] = Array.from(weekMap.values())
    .sort((a, b) => a.weekNumber - b.weekNumber)
    .map((week) => {
      const days: ParsedDay[] = Array.from(week.days.values())
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((day) => ({
          dayKey: day.dayKey,
          dayLabel: day.dayLabel,
          sortOrder: day.sortOrder,
          exercises: day.exercises,
        }));

      return {
        weekNumber: week.weekNumber,
        days,
      };
    });

  const hasExercises = weeks.some((week) => week.days.some((day) => day.exercises.length > 0));

  if (!hasExercises) {
    throw new ExcelImportError("В файле не найдено ни одного упражнения для импорта.");
  }

  return {
    name,
    weeks,
  };
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index] ?? "";

    if (char === '"') {
      const next = line[index + 1] ?? "";
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (char === ";" && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function parseCsvRows(buffer: Buffer): unknown[][] {
  const text = buffer.toString("utf-8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/);
  return lines.map((line) => parseCsvLine(line));
}

export function parseTrainingPlanWorkbook(
  input: ArrayBuffer | Buffer,
  sourceFilename: string,
): ParsedTrainingPlan {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  assertFileSizeLimit(buffer.byteLength, "Импортируемый файл");

  const context: ParseContext = {
    startedAt: Date.now(),
    exercisesCount: 0,
  };

  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });

  if (!workbook.SheetNames.length) {
    throw new ExcelImportError("Файл не содержит листов для импорта.");
  }

  if (workbook.SheetNames.length > IMPORT_GUARDRAILS.maxSheets) {
    throw new ExcelImportError(
      `Слишком много листов в файле (${workbook.SheetNames.length}). ` +
        `Максимум: ${IMPORT_GUARDRAILS.maxSheets}.`,
    );
  }

  const weekMap = new Map<number, WeekDraft>();

  for (const sheetName of workbook.SheetNames) {
    assertWithinParseDeadline(context, `Лист "${sheetName}"`);

    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      continue;
    }

    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false,
    });

    if (!rows.length) {
      continue;
    }

    if (rows.length > IMPORT_GUARDRAILS.maxRowsPerSheet) {
      throw new ExcelImportError(
        `Лист "${sheetName}" слишком большой (${rows.length} строк). ` +
          `Максимум: ${IMPORT_GUARDRAILS.maxRowsPerSheet}.`,
      );
    }

    for (const row of rows) {
      if ((row?.length ?? 0) > IMPORT_GUARDRAILS.maxColumnsPerRow) {
        throw new ExcelImportError(
          `Лист "${sheetName}" содержит слишком много колонок в строке. ` +
            `Максимум: ${IMPORT_GUARDRAILS.maxColumnsPerRow}.`,
        );
      }
    }

    try {
      parseRows(rows, `Лист "${sheetName}"`, weekMap, context);
    } catch (error) {
      if (error instanceof ExcelImportError && error.message.includes("строку заголовков")) {
        continue;
      }

      throw error;
    }
  }

  return finalizePlan(buildPlanNameFromFilename(sourceFilename), weekMap);
}

export function parseTrainingPlanCsv(
  input: ArrayBuffer | Buffer,
  sourceFilename: string,
): ParsedTrainingPlan {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  assertFileSizeLimit(buffer.byteLength, "Импортируемый файл");

  const context: ParseContext = {
    startedAt: Date.now(),
    exercisesCount: 0,
  };

  const rows = parseCsvRows(buffer);

  if (!rows.length) {
    throw new ExcelImportError("CSV-файл пустой. Загрузите корректный файл.");
  }

  if (rows.length > IMPORT_GUARDRAILS.maxRowsPerSheet) {
    throw new ExcelImportError(
      `CSV содержит слишком много строк (${rows.length}). Максимум: ${IMPORT_GUARDRAILS.maxRowsPerSheet}.`,
    );
  }

  for (const row of rows) {
    if ((row?.length ?? 0) > IMPORT_GUARDRAILS.maxColumnsPerRow) {
      throw new ExcelImportError(
        `CSV содержит слишком много колонок в строке. Максимум: ${IMPORT_GUARDRAILS.maxColumnsPerRow}.`,
      );
    }
  }

  const weekMap = new Map<number, WeekDraft>();
  parseRows(rows, "CSV", weekMap, context);

  return finalizePlan(buildPlanNameFromFilename(sourceFilename), weekMap);
}

export function parseTrainingPlanFile(
  input: ArrayBuffer | Buffer,
  sourceFilename: string,
): ParsedTrainingPlan {
  const fileKind = detectImportFileKind(sourceFilename);

  if (!fileKind) {
    throw new ExcelImportError("Поддерживаются только форматы .xlsx и .csv.");
  }

  if (fileKind === "xlsx") {
    return parseTrainingPlanWorkbook(input, sourceFilename);
  }

  return parseTrainingPlanCsv(input, sourceFilename);
}

export function buildPlanPreview(plan: ParsedTrainingPlan): TrainingPlanPreview {
  let totalDays = 0;
  let totalExercises = 0;

  for (const week of plan.weeks) {
    totalDays += week.days.length;
    for (const day of week.days) {
      totalExercises += day.exercises.length;
    }
  }

  return {
    name: plan.name,
    totalWeeks: plan.weeks.length,
    totalDays,
    totalExercises,
    weeks: plan.weeks.map((week) => ({
      weekNumber: week.weekNumber,
      days: week.days.map((day) => ({
        dayKey: day.dayKey,
        dayLabel: day.dayLabel,
        exercises: day.exercises.map((exercise) => ({
          exerciseName: exercise.exerciseName,
          intensity: exercise.intensity,
          rawSetsReps: exercise.rawSetsReps,
        })),
      })),
    })),
  };
}
