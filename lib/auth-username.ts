export const USERNAME_REGEX = /^[a-z0-9_]{3,32}$/;

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidUsername(value: string): boolean {
  return USERNAME_REGEX.test(normalizeUsername(value));
}
