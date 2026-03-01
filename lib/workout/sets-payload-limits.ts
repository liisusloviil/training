const MAX_SETS_PAYLOAD_BYTES = 64_000;
const MAX_SETS_PAYLOAD_ROWS_ESTIMATE = 300;

export const SETS_PAYLOAD_LIMIT_MESSAGE =
  "Объём данных сетов превышает допустимый лимит. Уменьшите количество записей и попробуйте снова.";

function getPayloadByteSize(payload: string): number {
  return new TextEncoder().encode(payload).length;
}

function estimateRowsCount(payload: string): number {
  return (payload.match(/"planExerciseId"\s*:/g) ?? []).length;
}

export function getSetsPayloadLimitError(payload: string): string | null {
  if (getPayloadByteSize(payload) > MAX_SETS_PAYLOAD_BYTES) {
    return SETS_PAYLOAD_LIMIT_MESSAGE;
  }

  if (estimateRowsCount(payload) > MAX_SETS_PAYLOAD_ROWS_ESTIMATE) {
    return SETS_PAYLOAD_LIMIT_MESSAGE;
  }

  return null;
}
