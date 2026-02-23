import type { DayKey } from "@/types/plan";

export class ExcelImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExcelImportError";
  }
}

export type ImportFileKind = "xlsx" | "csv";

const HEADER_ALIASES = {
  week: ["неделя", "week"],
  day: ["день", "day"],
  exercise: ["упражнение", "упражнения", "exercise", "exercises"],
  intensity: ["интенсив", "интенсивность", "intensity"],
  setsReps: [
    "подходы×повторы",
    "подходыхповторы",
    "подходыxповторы",
    "подходы*повторы",
    "подходы×повторения",
    "подходыхповторения",
    "подходыxповторения",
    "подходы*повторения",
    "setsxreps",
    "sets×reps",
    "sets*reps",
  ],
};

const DAY_ALIASES: Array<{ key: DayKey; aliases: string[]; label: string }> = [
  { key: "monday", aliases: ["понедельник", "пн", "monday", "mon"], label: "Понедельник" },
  { key: "tuesday", aliases: ["вторник", "вт", "tuesday", "tue"], label: "Вторник" },
  { key: "wednesday", aliases: ["среда", "ср", "wednesday", "wed"], label: "Среда" },
  { key: "thursday", aliases: ["четверг", "чт", "thursday", "thu"], label: "Четверг" },
  { key: "friday", aliases: ["пятница", "пт", "friday", "fri"], label: "Пятница" },
  { key: "saturday", aliases: ["суббота", "сб", "saturday", "sat"], label: "Суббота" },
  { key: "sunday", aliases: ["воскресенье", "вс", "sunday", "sun"], label: "Воскресенье" },
];

const DAY_SORT_ORDER: Record<DayKey, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};

const XLSX_EXTENSION = ".xlsx";
const CSV_EXTENSION = ".csv";

export const IMPORT_GUARDRAILS = {
  maxFileSizeBytes: 5 * 1024 * 1024,
  maxSheets: 8,
  maxRowsPerSheet: 3000,
  maxColumnsPerRow: 64,
  maxExercisesTotal: 2000,
  maxParseDurationMs: 2500,
  maxWeekNumber: 52,
} as const;

export function normalizeText(value: unknown): string {
  return String(value ?? "")
    .replace(/\uFEFF/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[–—−-]/g, "-");
}

export function normalizeHeader(value: unknown): string {
  return normalizeText(value).replace(/[\s_]/g, "").replace(/[хx*]/g, "×");
}

export function sanitizeFilename(filename: string): string {
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/_+/g, "_");
  return sanitized.slice(0, 120) || "training-plan";
}

export function detectImportFileKind(filename: string): ImportFileKind | null {
  const lower = filename.trim().toLowerCase();

  if (lower.endsWith(XLSX_EXTENSION)) {
    return "xlsx";
  }

  if (lower.endsWith(CSV_EXTENSION)) {
    return "csv";
  }

  return null;
}

export function assertFileSizeLimit(size: number, contextLabel: string) {
  if (size <= 0) {
    throw new ExcelImportError(`${contextLabel}: файл пустой.`);
  }

  if (size > IMPORT_GUARDRAILS.maxFileSizeBytes) {
    throw new ExcelImportError(
      `${contextLabel}: файл слишком большой. Максимальный размер: 5 MB.`,
    );
  }
}

export function assertValidUploadFile(file: File | null): asserts file is File {
  if (!file) {
    throw new ExcelImportError("Файл не выбран. Загрузите .xlsx или .csv файл.");
  }

  const filename = file.name?.toLowerCase() ?? "";
  const fileKind = detectImportFileKind(filename);
  if (!fileKind) {
    throw new ExcelImportError("Поддерживаются только форматы .xlsx и .csv.");
  }

  if (file.size === 0) {
    throw new ExcelImportError("Файл пустой. Загрузите корректный .xlsx или .csv файл.");
  }

  assertFileSizeLimit(file.size, "Загруженный файл");
}

export function detectHeaderRole(cell: unknown): keyof typeof HEADER_ALIASES | null {
  const normalized = normalizeHeader(cell);

  if (!normalized) {
    return null;
  }

  if (HEADER_ALIASES.week.some((alias) => normalized.includes(normalizeHeader(alias)))) {
    return "week";
  }

  if (HEADER_ALIASES.day.some((alias) => normalized.includes(normalizeHeader(alias)))) {
    return "day";
  }

  if (HEADER_ALIASES.exercise.some((alias) => normalized.includes(normalizeHeader(alias)))) {
    return "exercise";
  }

  if (HEADER_ALIASES.intensity.some((alias) => normalized.includes(normalizeHeader(alias)))) {
    return "intensity";
  }

  if (HEADER_ALIASES.setsReps.some((alias) => normalized.includes(normalizeHeader(alias)))) {
    return "setsReps";
  }

  return null;
}

export function parseWeekValue(value: unknown): number | null {
  const text = normalizeText(value);
  if (!text) {
    return null;
  }

  const match = text.match(/(?:неделя|week)?\s*(\d{1,2})/i);
  if (!match) {
    throw new ExcelImportError(`Не удалось распознать неделю: "${String(value)}".`);
  }

  const weekNumber = Number(match[1]);
  if (
    !Number.isInteger(weekNumber) ||
    weekNumber <= 0 ||
    weekNumber > IMPORT_GUARDRAILS.maxWeekNumber
  ) {
    throw new ExcelImportError(`Некорректный номер недели: "${String(value)}".`);
  }

  return weekNumber;
}

export function parseDayValue(value: unknown): { key: DayKey; label: string; sortOrder: number } | null {
  const text = normalizeText(value).replace(/[.:;,]/g, "");
  if (!text) {
    return null;
  }

  const found = DAY_ALIASES.find((item) =>
    item.aliases.some((alias) => text === alias || text.startsWith(`${alias} `)),
  );
  if (!found) {
    throw new ExcelImportError(`Не удалось распознать день: "${String(value)}".`);
  }

  return {
    key: found.key,
    label: found.label,
    sortOrder: DAY_SORT_ORDER[found.key],
  };
}

export function parseSetsReps(value: unknown): {
  prescribedSets: number;
  prescribedReps: number | null;
  prescribedRepsMin: number;
  prescribedRepsMax: number;
  rawSetsReps: string;
} {
  const original = String(value ?? "").trim();
  const normalized = original.replace(/[хx*]/gi, "×").replace(/\s+/g, "");
  const match = normalized.match(/^(\d{1,2})×(\d{1,3})(?:-(\d{1,3}))?$/);

  if (!match) {
    throw new ExcelImportError(
      `Некорректный формат "подходы×повторы": "${original}". ` +
        'Ожидается формат N×M или N×A-B, например 4×10 или 4×8-12.',
    );
  }

  const prescribedSets = Number(match[1]);
  const repsMin = Number(match[2]);
  const repsMax = match[3] ? Number(match[3]) : repsMin;

  if (prescribedSets <= 0 || repsMin <= 0 || repsMax <= 0) {
    throw new ExcelImportError(
      `Значения подходов и повторов должны быть > 0: "${original}".`,
    );
  }

  if (repsMin > repsMax) {
    throw new ExcelImportError(
      `Некорректный диапазон повторов: "${original}". Левая граница должна быть <= правой.`,
    );
  }

  const hasRange = repsMin !== repsMax;

  return {
    prescribedSets,
    prescribedReps: hasRange ? null : repsMin,
    prescribedRepsMin: repsMin,
    prescribedRepsMax: repsMax,
    rawSetsReps: hasRange
      ? `${prescribedSets}×${repsMin}-${repsMax}`
      : `${prescribedSets}×${repsMin}`,
  };
}

export function buildPlanNameFromFilename(filename: string): string {
  const noExtension = filename.replace(/\.(xlsx|csv)$/i, "").trim();
  return noExtension || "План тренировок";
}
