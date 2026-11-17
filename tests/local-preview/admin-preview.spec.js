import { expect, test } from "@playwright/test";

async function observeIsolation(page, baseURL) {
  const externalRequests = [];
  const errors = [];
  const origin = new URL(baseURL).origin;
  page.on("pageerror", error => errors.push(error.message));
  // Fail closed if a future UI dependency attempts cloud access. An attempted
  // request also fails the assertion, even though the test blocks its transport.
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (["http:", "https:"].includes(url.protocol) && url.origin !== origin) {
      externalRequests.push(url.origin + url.pathname);
      return route.abort("blockedbyclient");
    }
    return route.continue();
  });
  return () => {
    expect(externalRequests, "Локальная админка не обращается к внешним сервисам").toEqual([]);
    expect(errors, "В настоящих компонентах нет ошибок выполнения").toEqual([]);
  };
}

async function section(page, name) {
  await page.getByRole("button", { name, exact: true }).filter({ visible: true }).click();
  await expect(page.getByRole("heading", { name, exact: true, level: 1 })).toBeVisible();
}

test("local admin uses the actual light production screens and user search", async ({ page, baseURL }, testInfo) => {
  const assertIsolation = await observeIsolation(page, baseURL);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Обзор", exact: true, level: 1 })).toBeVisible();
  await expect(page.getByText(/Harness coverage|Harness Client|Strength Base/)).toHaveCount(0);

  await section(page, "Пользователи и роли");
  const directory = page.getByTestId("admin-users-workspace");
  await expect(directory.getByText("Анна Ковалёва", { exact: true })).toBeVisible();
  await expect(directory.getByText("Алексей Соколов", { exact: true })).toBeVisible();
  const search = directory.getByPlaceholder("Имя, логин, email, Telegram или ID");
  await search.fill("Анна");
  await expect(directory.getByText("Анна Ковалёва", { exact: true })).toBeVisible();
  await expect(directory.getByText("Алексей Соколов", { exact: true })).toHaveCount(0);
  await search.fill("");
  await expect(directory.getByText("Алексей Соколов", { exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("admin-users.png") });

  await section(page, "Базовые программы");
  const firstProgram = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Базовый план · Старт", exact: true }) });
  await expect(firstProgram).toBeVisible();
  await expect(firstProgram).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.getByRole("heading", { name: "Базовый план · Масса", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Новая программа", exact: true })).toBeVisible();
  await firstProgram.getByRole("button", { name: "Посмотреть состав", exact: true }).click();
  const preview = page.getByRole("dialog");
  await expect(preview.getByRole("heading", { name: "Базовый план · Старт", exact: true })).toBeVisible();
  await preview.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(preview).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("admin-programs.png") });

  await section(page, "Базовые упражнения");
  await expect(page.getByPlaceholder("Найти упражнение")).toBeVisible();
  await expect(page.getByRole("tabpanel", { name: "Базовые упражнения", exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  assertIsolation();
});

test("new program draft stays in the local transport after navigation and reload", async ({ page, baseURL }, testInfo) => {
  const assertIsolation = await observeIsolation(page, baseURL);
  const title = `Локальная проверка · ${testInfo.project.name}`;
  await page.goto("/");
  await section(page, "Базовые программы");
  await page.getByRole("button", { name: "Новая программа", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Новая базовая программа", exact: true });
  await expect(editor).toBeVisible();
  await editor.getByRole("textbox", { name: "Название", exact: true }).fill(title);
  await editor.getByRole("textbox", { name: "Короткое описание", exact: true }).fill("Изолированная проверка сохранения без Firebase");
  await editor.getByRole("textbox", { name: /^Состав программы/ }).fill("День 1: Приседания; Планка");
  await editor.getByRole("button", { name: "Сохранить черновик", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await section(page, "Пользователи и роли");
  await section(page, "Базовые программы");
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await page.reload();
  await section(page, "Базовые программы");
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  assertIsolation();
});

test("unavailable integrations keep the trainer screen and explain local account actions", async ({ page, baseURL }) => {
  const assertIsolation = await observeIsolation(page, baseURL);
  await page.goto("/");
  await section(page, "Пользователи и роли");
  await page.getByRole("button", { name: "Открыть тренер Алексей Соколов", exact: true }).click();
  const profile = page.getByRole("region", { name: "Карточка тренера Алексей Соколов", exact: true });
  await expect(profile).toBeVisible();
  const notice = page.getByRole("complementary", { name: "Локальный просмотр", exact: true });
  for (const action of ["Программы", "Библиотека"]) {
    await profile.getByRole("button", { name: action, exact: true }).click();
    await expect(profile).toBeVisible();
    await expect(notice.getByRole("status")).toContainText("staging-окружения");
  }

  for (const action of ["Настройки профиля", "Выйти из аккаунта"]) {
    const mobileAccount = page.getByRole("button", { name: "Аккаунт: настройки и выход", exact: true });
    if (await mobileAccount.isVisible()) await mobileAccount.click();
    else await page.getByRole("button").filter({ hasText: "Настройки и выход" }).filter({ visible: true }).click();
    const account = page.getByRole("dialog", { name: "Аккаунт администратора", exact: true });
    await account.getByRole("button", { name: action, exact: true }).click();
    await expect(account).toHaveCount(0);
    await expect(notice.getByRole("status")).toContainText("staging-окружение");
    await expect(profile).toBeVisible();
  }
  assertIsolation();
});
