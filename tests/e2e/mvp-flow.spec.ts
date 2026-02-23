import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";

const validFixturePath = resolve(
  process.cwd(),
  "tests/fixtures/import/Training.csv",
);
const invalidFixturePath = resolve(
  process.cwd(),
  "tests/fixtures/import/invalid-range.csv",
);

const e2eUserEmail =
  process.env.E2E_USER_EMAIL ?? process.env.TEST_USER_A_EMAIL ?? "";
const e2eUserPassword =
  process.env.E2E_USER_PASSWORD ?? process.env.TEST_USER_A_PASSWORD ?? "";
const hasE2eAuth = Boolean(e2eUserEmail && e2eUserPassword);

const testWithAuth = hasE2eAuth ? test : test.skip;
test.describe.configure({ timeout: 120_000 });

async function login(page: Page) {
  await page.goto("/plan");
  await expect(page).toHaveURL(/\/login/);

  await page.getByRole("textbox", { name: "Email" }).fill(e2eUserEmail);
  await page.getByRole("textbox", { name: "Пароль" }).fill(e2eUserPassword);
  await page.getByRole("button", { name: "Войти" }).click();

  await expect(page).toHaveURL(/\/(plan|import)/);
}

function buildUniqueSessionDate(): string {
  const now = new Date();
  const offsetDays = (Date.now() % 180) + 1;
  now.setUTCDate(now.getUTCDate() + offsetDays);
  return now.toISOString().slice(0, 10);
}

testWithAuth("full mvp flow: login -> import -> plan -> workout -> history", async ({
  page,
}) => {
  await login(page);

  await page.goto("/import");
  await page.setInputFiles('input[type="file"][name="file"]', validFixturePath);
  await page.getByRole("button", { name: "Проверить файл" }).click();

  await expect(page.getByText("Предпросмотр импорта")).toBeVisible();
  await expect(page.getByText("Недель:")).toBeVisible();

  await page.getByRole("button", { name: "Подтвердить и сохранить" }).click();
  await expect(
    page.getByText("План успешно импортирован и сохранён."),
  ).toBeVisible();

  await page.goto("/plan");
  await expect(page.getByRole("heading", { name: "Training" })).toBeVisible();
  await page.getByRole("link", { name: "Начать тренировку" }).click();

  await expect(page).toHaveURL("/workout/new");
  const sessionDate = buildUniqueSessionDate();
  await page.getByLabel("Дата тренировки").fill(sessionDate);
  await page.getByRole("button", { name: "Создать сессию" }).click();

  await expect(page).toHaveURL(/\/workout\/[0-9a-f-]{36}$/);
  const workoutUrl = page.url();
  const sessionId = workoutUrl.split("/").pop() ?? "";
  expect(sessionId).toHaveLength(36);

  const spinbuttons = page.getByRole("spinbutton");
  await spinbuttons.nth(1).fill("8");
  await spinbuttons.nth(2).fill("100");
  await spinbuttons.nth(4).fill("5");
  await spinbuttons.nth(5).fill("80");

  await page.getByRole("button", { name: "Сохранить сеты" }).click();
  await expect(page.getByText("Сеты сохранены:")).toBeVisible();

  await page.reload();
  await expect(spinbuttons.nth(1)).toHaveValue("8");
  await expect(spinbuttons.nth(2)).toHaveValue("100");

  await page.getByRole("button", { name: "Завершить тренировку" }).click();
  await expect(
    page.getByText("Сессия завершена и переведена в режим только чтения."),
  ).toBeVisible();
  await expect(page.getByText("Завершена", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Открыть в истории" }).click();
  await expect(page).toHaveURL(new RegExp(`/history/${sessionId}$`));
  await expect(page.getByText("Режим только чтение")).toBeVisible();

  await page.goto("/history");
  await expect(page.getByRole("heading", { name: "История тренировок" })).toBeVisible();
  await page.getByLabel("From", { exact: true }).fill(sessionDate);
  await page.getByLabel("To", { exact: true }).fill("2099-12-31");
  await page.getByRole("button", { name: "Применить" }).click();
  await expect(page).toHaveURL(/\/history\?/);
  await expect(page.getByRole("link", { name: "Открыть детали" }).first()).toBeVisible();
});

testWithAuth("import shows business validation error for invalid fixture", async ({
  page,
}) => {
  await login(page);
  await page.goto("/import");

  await page.setInputFiles('input[type="file"][name="file"]', invalidFixturePath);
  await page.getByRole("button", { name: "Проверить файл" }).click();

  await expect(
    page.getByText("Некорректный диапазон", { exact: false }),
  ).toBeVisible();
});
