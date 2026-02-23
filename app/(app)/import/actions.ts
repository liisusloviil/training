"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { actionError } from "@/lib/actions/contract";
import { requireUser } from "@/lib/auth";
import { saveImportedPlan, updatePlanSourceFilePath } from "@/lib/db/plan-repository";
import { buildPlanPreview, parseTrainingPlanFile } from "@/lib/excel/parser";
import {
  ExcelImportError,
  assertFileSizeLimit,
  assertValidUploadFile,
  detectImportFileKind,
  sanitizeFilename,
} from "@/lib/excel/validators";
import { logCriticalError } from "@/lib/observability/server-logger";
import { createClient } from "@/lib/supabase/server";
import type { ImportActionState } from "@/types/import";

function toUserErrorMessage(error: unknown): string {
  if (error instanceof ExcelImportError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Не удалось обработать файл. Попробуйте снова.";
}

async function cleanupTempFile(supabase: Awaited<ReturnType<typeof createClient>>, path?: string) {
  if (!path) {
    return;
  }

  await supabase.storage.from("plan-files").remove([path]);
}

function detectUploadContentType(filename: string, fallback?: string): string {
  if (fallback && fallback.trim().length > 0) {
    return fallback;
  }

  const kind = detectImportFileKind(filename);
  if (kind === "csv") {
    return "text/csv";
  }

  return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
}

export async function importPlanAction(
  previousState: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  const intent = String(formData.get("intent") ?? "preview");

  const user = await requireUser();
  const supabase = await createClient();

  try {
    if (intent === "preview") {
      const fileEntry = formData.get("file");
      const file = fileEntry instanceof File ? fileEntry : null;
      assertValidUploadFile(file);

      const sourceFilename = sanitizeFilename(file.name);
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      const parsedPlan = parseTrainingPlanFile(fileBuffer, sourceFilename);
      const preview = buildPlanPreview(parsedPlan);

      await cleanupTempFile(supabase, previousState.tempFilePath);

      const tempFilePath = `${user.id}/imports-temp/${Date.now()}_${randomUUID()}_${sourceFilename}`;
      const { error: uploadError } = await supabase.storage
        .from("plan-files")
        .upload(tempFilePath, fileBuffer, {
          contentType: detectUploadContentType(sourceFilename, file.type),
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Не удалось сохранить временный файл для подтверждения импорта: ${uploadError.message}`);
      }

      return {
        status: "preview",
        message: "Файл успешно разобран. Проверьте структуру и подтвердите импорт.",
        preview,
        tempFilePath,
        sourceFilename,
      };
    }

    if (intent === "save") {
      const tempFilePath = String(formData.get("tempFilePath") ?? "").trim();
      const sourceFilename = sanitizeFilename(String(formData.get("sourceFilename") ?? "").trim());

      if (!tempFilePath || !sourceFilename) {
        throw new ExcelImportError("Не найден временный файл импорта. Повторите предпросмотр файла.");
      }

      if (!tempFilePath.startsWith(`${user.id}/`)) {
        throw new ExcelImportError("Недопустимый путь временного файла для текущего пользователя.");
      }

      const { data: downloadedFile, error: downloadError } = await supabase.storage
        .from("plan-files")
        .download(tempFilePath);

      if (downloadError || !downloadedFile) {
        throw new Error(
          `Не удалось получить временный файл из Storage: ${downloadError?.message ?? "файл отсутствует"}`,
        );
      }

      assertFileSizeLimit(downloadedFile.size, "Временный файл импорта");

      const parsedPlan = parseTrainingPlanFile(await downloadedFile.arrayBuffer(), sourceFilename);
      const { planId } = await saveImportedPlan({
        supabase,
        parsedPlan,
        sourceFilename,
        sourceFilePath: null,
      });

      const finalFilePath = `${user.id}/${planId}/${Date.now()}_${sourceFilename}`;
      const { error: moveError } = await supabase.storage
        .from("plan-files")
        .move(tempFilePath, finalFilePath);

      const storedPath = moveError ? tempFilePath : finalFilePath;
      await updatePlanSourceFilePath({
        supabase,
        planId,
        userId: user.id,
        sourceFilePath: storedPath,
      });

      revalidatePath("/");
      revalidatePath("/import");
      revalidatePath("/plan");

      return {
        status: "saved",
        message: moveError
          ? "План сохранён, но исходный файл остался во временной папке Storage."
          : "План успешно импортирован и сохранён.",
        planId,
      };
    }

    return actionError("Неизвестное действие формы импорта.");
  } catch (error) {
    logCriticalError("import_plan_action", error, {
      intent,
      tempFilePath: previousState.tempFilePath,
      sourceFilename: previousState.sourceFilename,
    });

    return actionError(toUserErrorMessage(error), {
      preview: previousState.preview,
      tempFilePath: previousState.tempFilePath,
      sourceFilename: previousState.sourceFilename,
    });
  }
}
