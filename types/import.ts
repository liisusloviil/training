import type { TrainingPlanPreview } from "@/types/plan";

export type ImportActionState = {
  status: "idle" | "preview" | "error" | "saved";
  message?: string;
  preview?: TrainingPlanPreview;
  tempFilePath?: string;
  sourceFilename?: string;
  planId?: string;
};
