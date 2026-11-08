import { expect, test } from "./app-test.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";

async function openAccount(page) {
  const mobileAccount = page.getByRole("button", { name: "Аккаунт: настройки и выход", exact: true });
  if (await mobileAccount.isVisible()) await mobileAccount.click();
  else {
    await page.getByRole("complementary", { name: "Навигация администратора", exact: true }).hover();
    await page.mouse.wheel(0, 10000);
    const account = page.getByRole("button").filter({ hasText: "Настройки и выход" }).filter({ visible: true });
    await expect(account).toBeInViewport({ ratio: 1 });
    await account.click();
  }
  return page.getByRole("dialog", { name: "Аккаунт администратора", exact: true });
}

test("admin account controls make sign-out easy to find on desktop and mobile", async ({ page }) => {
  await page.goto("/tests/e2e/fixtures/admin-workspace.html");

  const workspace = page.getByTestId("admin-workspace-harness");
  const header = workspace.locator("main > header");
  await expect(workspace).toBeVisible();
  await expect(header).toHaveCSS("border-radius", /^(20|18)px$/);

  const mobileAccountButton = workspace.getByRole("button", { name: "Аккаунт: настройки и выход" });
  if (await mobileAccountButton.isVisible()) {
    await expect(mobileAccountButton).toContainText("Аккаунт");
    await mobileAccountButton.click();
  } else {
    const profileButton = workspace.locator("button").filter({ hasText: "Александр" }).first();
    await expect(profileButton).toContainText("Настройки и выход");
    await profileButton.click();
  }

  const accountDialog = page.getByRole("dialog", { name: "Аккаунт администратора" });
  await expect(accountDialog).toBeVisible();
  const logoutButton = accountDialog.getByRole("button", { name: "Выйти из аккаунта" });
  await expect(logoutButton).toBeVisible();
  await logoutButton.click();
  await expect(page.getByTestId("admin-harness-action")).toHaveText("logout");
});

test("admin feedback section reads messages, opens attachments and changes processing status", async ({ page }, testInfo) => {
  const path = "users/synthetic/feedback/test";
  const requests = [];
  await page.route("**/api/admin/feedback", async route => {
    const body = route.request().postDataJSON(); requests.push(body);
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(body.action === "list" ? { ok: true, items: [
      { path, type: "bug", status: "new", displayName: "Тестовый пользователь", message: "Описание тестовой ошибки", contact: "test@example.invalid", createdAt: "2026-11-05T10:00:00Z", attachments: [{ path: "feedback/synthetic/test/log.txt", name: "log.txt" }, {path:"feedback/synthetic/test/photo.png",name:"photo.png",type:"image/png"}] }
    ], nextCursor: "" } : body.action === "attachment" ? { ok: true, url: body.attachmentPath.endsWith("photo.png") ? "https://storage.googleapis.com/test/photo.png" : "https://storage.googleapis.com/test/log.txt" } : { ok: true }) });
  });
  await page.route("https://storage.googleapis.com/test/log.txt", route => route.fulfill({ contentType: "text/plain", body: "synthetic" }));
  await page.route("https://storage.googleapis.com/test/photo.png", route => route.fulfill({contentType:"image/png",body:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=","base64")}));
  await page.goto("/tests/e2e/fixtures/admin-workspace.html");
  await page.getByRole("button", { name: "Обратная связь", exact: true }).filter({ visible: true }).click();
  const inbox = page.getByTestId("admin-feedback-inbox");
  await expect(inbox).toContainText("Тестовый пользователь");
  await expect(inbox).toContainText("test@example.invalid");
  await expect(inbox.getByText("Описание тестовой ошибки",{exact:true})).toHaveCount(1);
  const photo = inbox.getByRole("img",{name:"photo.png",exact:true});
  await expect(photo).toBeVisible();
  await expect.poll(() => photo.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
  await inbox.getByRole("button",{name:"Увеличить фото photo.png"}).click();
  const viewer = page.getByRole("dialog",{name:"Просмотр фото обращения"});
  await expect(viewer).toBeVisible();
  await viewer.getByRole("button",{name:"Закрыть фото"}).click();
  await expect(viewer).not.toBeVisible();
  await page.screenshot({path:testInfo.outputPath("feedback-inbox.png")});
  await inbox.locator("summary").filter({hasText:"Файлы"}).click();
  const popup = page.waitForEvent("popup");
  await inbox.getByRole("button", { name: "log.txt Скачать" }).click();
  const fileTab = await popup; await fileTab.close();
  await inbox.getByRole("button", { name: "Отметить обработанным" }).click();
  await expect(inbox).not.toContainText("Тестовый пользователь");
  await inbox.getByRole("button", { name: "Обработанные", exact: true }).click();
  await expect(inbox).toContainText("Тестовый пользователь");
  expect(requests.some(body => body.action === "status" && body.status === "processed" && body.path === path)).toBe(true);
  await page.getByRole("button", { name: "Обзор", exact: true }).filter({ visible: true }).click();
  await expect(inbox).toHaveCount(0);
});

test("admin account actions remain available through all four actual section routes", async ({ page }, testInfo) => {
  const noErrors = failOnRuntimeErrors(page);
  if (testInfo.project.name.startsWith("desktop")) await page.setViewportSize({ width: 844, height: 390 });
  await page.route("https://firestore.googleapis.com/**", route => route.abort());
  await page.goto("/tests/e2e/fixtures/admin-workspace.html?accountRoutes=1");
  for (const section of ["Обзор", "Пользователи и роли", "Базовые программы", "Базовые упражнения"]) {
    await page.getByRole("button", { name: section, exact: true }).filter({ visible: true }).click();
    await expect(page.getByRole("heading", { name: section, exact: true, level: 1 })).toBeVisible();
    let dialog = await openAccount(page);
    await expect(dialog.getByRole("button", { name: "Настройки профиля", exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Выйти из аккаунта", exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Настройки профиля", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId("admin-harness-action")).toHaveText("profile");
    dialog = await openAccount(page);
    await dialog.getByRole("button", { name: "Выйти из аккаунта", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId("admin-harness-action")).toHaveText("logout");
    await expect.poll(() => page.evaluate(() => document.body.style.position)).not.toBe("fixed");
  }
  noErrors();
});

test("admin client card scrolls to the end of all four tabs without header or dock overlap", async ({ page }, testInfo) => {
  test.setTimeout(90000);
  const noErrors = failOnRuntimeErrors(page);
  const viewports = testInfo.project.name.startsWith("mobile")
    ? [{ width: 402, height: 874 }, { width: 320, height: 720 }, { width: 402, height: 600 }]
    : [{ width: 1440, height: 900 }, { width: 844, height: 390 }];
  await page.goto("/tests/e2e/fixtures/admin-workspace.html?clientScroll=1");
  const workspace = page.getByTestId("admin-client-profile-workspace");
  const clientPage = workspace.locator(".trainerNextClientPage");
  const tabs = clientPage.locator(".trainerNextClientTabs");
  await expect(clientPage).toBeVisible();
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const tab of ["Сводка", "Тренировки", "Питание", "Фото и замеры"]) {
      await tabs.getByRole("button", { name: tab, exact: true }).click();
      await expect(tabs.getByRole("button", { name: tab, exact: true })).toHaveAttribute("aria-pressed", "true");
      await page.mouse.move(viewport.width - 40, viewport.height - 130);
      for (let step = 0; step < 3; step++) {
        await page.mouse.wheel(0, 10000);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
      }
      const geometry = await workspace.evaluate(root => {
        const page = root.querySelector(".trainerNextClientPage"), tabs = page.querySelector(".trainerNextClientTabs"), header = root.querySelector("main > header");
        const nav = root.querySelector('nav[aria-label="Разделы админки"]');
        const navBox = nav.getClientRects().length ? nav.getBoundingClientRect() : null;
        const trainerRoot = root.querySelector(".trainerNextRoot");
        return { pageBottom: page.getBoundingClientRect().bottom, tabTop: tabs.getBoundingClientRect().top, headerBottom: header.getBoundingClientRect().bottom,
          bottomLimit: navBox?.top ?? innerHeight, trainerHeight: trainerRoot.clientHeight, trainerScrollHeight: trainerRoot.scrollHeight,
          trainerOverflow: getComputedStyle(trainerRoot).overflowY, trainerGuard: getComputedStyle(trainerRoot, "::after").display,
          documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth };
      });
      expect(geometry.pageBottom, `${viewport.width}×${viewport.height} ${tab}: ${JSON.stringify(geometry)}`).toBeLessThanOrEqual(geometry.bottomLimit - 4);
      expect(geometry.tabTop, `${tab}: ${JSON.stringify(geometry)}`).toBeGreaterThanOrEqual(geometry.headerBottom - 1);
      expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
      expect(geometry.viewportWidth).toBeLessThanOrEqual(viewport.width);
      await page.screenshot({ path: testInfo.outputPath(`admin-client-${viewport.width}-${viewport.height}-${tab}.png`) });
    }
    const dialog = await openAccount(page);
    await expect(dialog).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.body.style.position)).toBe("fixed");
    await dialog.getByRole("button", { name: "Закрыть", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.body.style.position)).not.toBe("fixed");
    await page.mouse.move(viewport.width - 40, viewport.height - 130);
    await page.mouse.wheel(0, 10000);
    await expect.poll(() => clientPage.evaluate(element => element.getBoundingClientRect().bottom)).toBeLessThanOrEqual(viewport.height - 4);
  }
  noErrors();
});
