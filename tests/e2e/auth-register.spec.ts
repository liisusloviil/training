import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

function buildUniqueEmail() {
  const fallbackDomain = "gmail.com";
  const configuredDomain = process.env.E2E_REGISTER_EMAIL_DOMAIN?.trim();
  const knownUserDomain =
    process.env.E2E_USER_EMAIL?.split("@")[1] ??
    process.env.TEST_USER_A_EMAIL?.split("@")[1];

  const domain = configuredDomain || knownUserDomain || fallbackDomain;
  return `mvp.register.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@${domain}`;
}

const neutralRegistrationError =
  "Не удалось завершить регистрацию. Проверьте данные и попробуйте снова.";

async function submitRegisterForm(page: Page, email: string, password: string) {
  await page.goto("/register");
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByLabel("Подтвердите пароль").fill(password);
  await page.getByRole("button", { name: "Создать аккаунт" }).click();
}

async function waitForRegisterResult(page: Page): Promise<{
  status: "success" | "error";
  message: string;
}> {
  const successMessage = page.locator(".success-message");
  const errorMessage = page.locator(".error-message");

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await successMessage.isVisible()) {
      return {
        status: "success",
        message: (await successMessage.first().textContent())?.trim() ?? "",
      };
    }

    if (await errorMessage.isVisible()) {
      return {
        status: "error",
        message: (await errorMessage.first().textContent())?.trim() ?? "",
      };
    }

    await page.waitForTimeout(250);
  }

  return {
    status: "error",
    message: "Не получено ни success, ни error состояние после submit.",
  };
}

test("register form submit returns user-facing state", async ({ page }) => {
  const email = buildUniqueEmail();
  const password = "RegisterPass123";

  await submitRegisterForm(page, email, password);
  const result = await waitForRegisterResult(page);

  if (result.status === "success") {
    expect(result.message).toContain("Проверьте почту и подтвердите email");
    return;
  }

  // Neutral server-side failures (for example, temporary auth email rate limits)
  // should still be surfaced as a readable business message.
  expect(result.message).toBe(neutralRegistrationError);
});

test("login and register pages are linked", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Зарегистрироваться" }).click();
  await expect(page).toHaveURL("/register");

  await page.getByRole("link", { name: "Войти" }).click();
  await expect(page).toHaveURL("/login");
});

const hasAdminConfirmFlow =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const testWithAdminConfirmFlow = hasAdminConfirmFlow ? test : test.skip;

testWithAdminConfirmFlow(
  "email confirmation callback signs user in and redirects to app",
  async ({ page }) => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const appOrigin =
      process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "") ||
      "http://localhost:3000";
    const email = buildUniqueEmail();
    const password = "RegisterPass123";
    const redirectTo = `${appOrigin}/auth/callback?next=/plan`;

    const { data, error } = await supabase.auth.admin.generateLink({
      type: "signup",
      email,
      password,
      options: {
        redirectTo,
      },
    });

    expect(error).toBeNull();
    expect(data?.properties?.hashed_token).toBeTruthy();
    expect(data?.properties?.verification_type).toBeTruthy();

    const createdUserId = data?.user?.id;

    try {
      const callbackUrl =
        `${appOrigin}/auth/callback?token_hash=${encodeURIComponent(
          data!.properties!.hashed_token,
        )}&type=${encodeURIComponent(
          String(data!.properties!.verification_type),
        )}&next=/plan`;
      await page.goto(callbackUrl);
      await expect(page).toHaveURL(/\/(plan|import)/);
    } finally {
      if (createdUserId) {
        await supabase.auth.admin.deleteUser(createdUserId);
      }
    }
  },
);
