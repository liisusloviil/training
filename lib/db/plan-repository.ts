import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedTrainingPlan } from "@/types/plan";

export async function saveImportedPlan(params: {
  supabase: SupabaseClient;
  parsedPlan: ParsedTrainingPlan;
  sourceFilename: string;
  sourceFilePath: string | null;
}) {
  const { supabase, parsedPlan, sourceFilename, sourceFilePath } = params;

  const { data, error } = await supabase.rpc("import_training_plan", {
    p_plan_name: parsedPlan.name,
    p_source_filename: sourceFilename,
    p_source_file_path: sourceFilePath,
    p_payload: parsedPlan,
  });

  if (error) {
    throw new Error(`Не удалось сохранить план в БД: ${error.message}`);
  }

  if (!data || typeof data !== "string") {
    throw new Error("Не удалось получить id сохранённого плана.");
  }

  return { planId: data };
}

export async function updatePlanSourceFilePath(params: {
  supabase: SupabaseClient;
  planId: string;
  userId: string;
  sourceFilePath: string;
}) {
  const { supabase, planId, userId, sourceFilePath } = params;

  const { error } = await supabase
    .from("training_plans")
    .update({ source_file_path: sourceFilePath })
    .eq("id", planId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Не удалось обновить путь исходного файла: ${error.message}`);
  }
}
