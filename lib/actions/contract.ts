export type ServerActionErrorState = {
  status: "error";
  message: string;
};

export function actionError<TExtra extends Record<string, unknown> = Record<never, never>>(
  message: string,
  extra?: TExtra,
): ServerActionErrorState & TExtra {
  return {
    status: "error",
    message,
    ...(extra ?? ({} as TExtra)),
  };
}
