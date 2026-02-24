const LOGIN_REGEX = /^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])?$/;
const LOGIN_EMAIL_DOMAIN = process.env.AUTH_LOGIN_EMAIL_DOMAIN ?? "login.local";

export function normalizeLogin(value: string): string {
  return value.trim().toLowerCase();
}

export function isEmailLike(value: string): boolean {
  return value.includes("@");
}

export function isValidLogin(value: string): boolean {
  return LOGIN_REGEX.test(normalizeLogin(value));
}

export function loginToEmail(login: string): string {
  const normalized = normalizeLogin(login);
  return `${normalized}@${LOGIN_EMAIL_DOMAIN}`;
}

export function resolveAuthEmail(identifier: string): string {
  const normalized = normalizeLogin(identifier);
  if (isEmailLike(normalized)) {
    return normalized;
  }

  return loginToEmail(normalized);
}
