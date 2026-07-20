import { expect, test } from "@playwright/test";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test.setTimeout(60_000);

async function expectNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth
  }));

  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
}

async function attachScreenshot(page, testInfo, name) {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png"
  });
}

async function expectTapTargets(page, selectors, minSize = 40) {
  const failures = await page.evaluate(({ targetSelectors, minimumSize }) => {
    const isVisible = (node) => {
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();

      return (
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    return targetSelectors.flatMap((selector) => (
      [...document.querySelectorAll(selector)]
        .filter(isVisible)
        .map((node, index) => {
          const rect = node.getBoundingClientRect();
          return {
            selector,
            index,
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          };
        })
        .filter((item) => item.width < minimumSize || item.height < minimumSize)
    ));
  }, { targetSelectors: selectors, minimumSize: minSize });

  expect(failures).toEqual([]);
}

async function expectExerciseVideoFrameSpacing(page) {
  const metrics = await page.evaluate(() => {
    const rectOf = (node) => {
      const rect = node?.getBoundingClientRect();
      return rect
        ? {
            top: Math.round(rect.top),
            right: Math.round(rect.right),
            bottom: Math.round(rect.bottom),
            left: Math.round(rect.left),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          }
        : null;
    };

    const frame = document.querySelector('[data-testid="workout-exercise-video-frame"]');
    return {
      theme: document.documentElement.dataset.appTheme || "",
      frame: rectOf(frame),
      video: rectOf(frame?.querySelector("video")),
      controls: [...(frame?.querySelectorAll("button") || [])].map(rectOf)
    };
  });

  const layoutSummary = JSON.stringify(metrics);
  expect(metrics.frame, layoutSummary).not.toBeNull();
  if (metrics.theme === "warm-light") {
    expect(metrics.frame.height, layoutSummary).toBe(280);
    if (metrics.video) {
      expect(Math.abs(metrics.video.width - (metrics.frame.width - 24)), layoutSummary).toBeLessThanOrEqual(1);
      expect(metrics.video.height, layoutSummary).toBe(250);
    }
  } else {
    expect(Math.abs(metrics.frame.width - metrics.frame.height), layoutSummary).toBeLessThanOrEqual(1);
    if (metrics.video) {
      expect(Math.abs(metrics.video.width - (metrics.frame.width - 2)), layoutSummary).toBeLessThanOrEqual(1);
      expect(Math.abs(metrics.video.height - (metrics.frame.height - 2)), layoutSummary).toBeLessThanOrEqual(1);
    }
  }
}

async function expectExerciseSetsSpacing(page) {
  const metrics = await page.evaluate(() => {
    const rectOf = (node) => {
      const rect = node?.getBoundingClientRect();
      return rect
        ? {
            top: Math.round(rect.top),
            right: Math.round(rect.right),
            bottom: Math.round(rect.bottom),
            left: Math.round(rect.left),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          }
        : null;
    };

    const root = document.querySelector('[data-testid="workout-exercise-sets"]');
    const list = root?.querySelector('[data-testid="workout-exercise-set-row"]')?.parentElement;
    const rows = [...document.querySelectorAll('[data-testid="workout-exercise-set-row"]')];

    return {
      theme: document.documentElement.dataset.appTheme || "",
      viewportWidth: window.innerWidth,
      root: rectOf(root),
      list: rectOf(list),
      listClientWidth: list?.clientWidth || 0,
      listScrollWidth: list?.scrollWidth || 0,
      rows: rows.map(rectOf),
      number: rectOf(rows[0]?.children[0]),
      actions: rectOf(rows[0]?.children[2]),
      edit: rectOf(rows[0]?.children[2]?.querySelector("button")),
      complete: rectOf(rows[0]?.children[2]?.querySelector("span"))
    };
  });

  const layoutSummary = JSON.stringify(metrics);
  expect(metrics.root, layoutSummary).not.toBeNull();
  expect(metrics.list, layoutSummary).not.toBeNull();
  expect(metrics.rows, layoutSummary).toHaveLength(3);
  expect(metrics.root.left, layoutSummary).toBeGreaterThanOrEqual(0);
  expect(metrics.root.right, layoutSummary).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  expect(metrics.list.width, layoutSummary).toBe(metrics.root.width);
  expect(metrics.listScrollWidth, layoutSummary).toBeLessThanOrEqual(metrics.listClientWidth);
  if (metrics.theme === "warm-light") {
    expect(metrics.rows.every((row) => row.height === 70), layoutSummary).toBe(true);
    expect(metrics.rows[1].top - metrics.rows[0].bottom, layoutSummary).toBe(0);
    expect(metrics.number.width, layoutSummary).toBe(38);
    expect(metrics.edit.width, layoutSummary).toBe(24);
    expect(metrics.edit.height, layoutSummary).toBe(24);
    expect(metrics.complete.width, layoutSummary).toBe(36);
    expect(metrics.complete.height, layoutSummary).toBe(36);
  } else {
    expect(metrics.rows.every((row) => row.height === 60), layoutSummary).toBe(true);
    expect(metrics.rows[1].top - metrics.rows[0].bottom, layoutSummary).toBe(11);
    expect(metrics.number.width, layoutSummary).toBe(metrics.viewportWidth <= 370 ? 40 : 42);
    expect(metrics.actions.width, layoutSummary).toBe(metrics.viewportWidth <= 370 ? 92 : 94);
    expect(metrics.edit.width, layoutSummary).toBe(50);
    expect(metrics.edit.height, layoutSummary).toBe(42);
    expect(metrics.complete.width, layoutSummary).toBe(34);
    expect(metrics.complete.height, layoutSummary).toBe(34);
  }
}

async function expectWorkoutRunStageSpacing(page, expectedStage) {
  const metrics = await page.evaluate(() => {
    const rectOf = (node) => {
      const rect = node?.getBoundingClientRect();
      return rect
        ? {
            top: Math.round(rect.top),
            right: Math.round(rect.right),
            bottom: Math.round(rect.bottom),
            left: Math.round(rect.left),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          }
        : null;
    };

    const deck = document.querySelector('[data-testid="workout-run-stage"]');
    const card = document.querySelector(
      '[data-testid="workout-stage-card"], [data-testid="workout-finish-screen"]'
    );
    const panel = document.querySelector(
      '[data-css-module-scope="workout-stage-action-panel"], [data-css-module-scope="workout-finish-stage"]:has(button)'
    );
    const buttons = [...(panel?.querySelectorAll("button") || [])].map(rectOf);

    return {
      theme: document.documentElement.dataset.appTheme || "",
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      stage: deck?.dataset.workoutStage || "",
      deck: rectOf(deck),
      card: rectOf(card),
      panel: rectOf(panel),
      buttons,
      deckOverflow: deck ? getComputedStyle(deck).overflow : "",
      panelPosition: panel ? getComputedStyle(panel).position : ""
    };
  });

  const layoutSummary = JSON.stringify(metrics);
  expect(metrics.stage, layoutSummary).toBe(expectedStage);
  expect(metrics.deck, layoutSummary).not.toBeNull();
  expect(metrics.card, layoutSummary).not.toBeNull();
  expect(metrics.panel, layoutSummary).not.toBeNull();
  const shortCalmExercise = metrics.theme === "warm-light"
    && expectedStage === "exercise"
    && metrics.viewportHeight <= 860;
  expect(metrics.deckOverflow, layoutSummary).toBe(shortCalmExercise ? "auto" : "hidden");
  expect(metrics.panelPosition, layoutSummary).toBe("fixed");
  expect(metrics.deck.left, layoutSummary).toBeGreaterThanOrEqual(0);
  expect(metrics.deck.right, layoutSummary).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  expect(metrics.deck.bottom, layoutSummary).toBeLessThanOrEqual(metrics.viewportHeight + 4);
  expect(metrics.card.left, layoutSummary).toBeGreaterThanOrEqual(metrics.deck.left);
  expect(metrics.card.right, layoutSummary).toBeLessThanOrEqual(metrics.deck.right + 1);
  expect(metrics.card.top, layoutSummary).toBeGreaterThanOrEqual(metrics.deck.top);
  if (!shortCalmExercise) {
    expect(metrics.card.bottom, layoutSummary).toBeLessThanOrEqual(metrics.deck.bottom + 1);
  }
  expect(metrics.panel.left, layoutSummary).toBeGreaterThanOrEqual(0);
  expect(metrics.panel.right, layoutSummary).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  expect(metrics.panel.bottom, layoutSummary).toBeLessThanOrEqual(metrics.viewportHeight + 1);
  expect(metrics.buttons.length, layoutSummary).toBe(2);
  expect(metrics.buttons.every((button) => button.height >= 44), layoutSummary).toBe(true);
}

async function expectWorkoutCardSpacing(page) {
  const metrics = await page.evaluate(() => {
    const rectOf = (node) => {
      const rect = node?.getBoundingClientRect();
      return rect
        ? {
            y: Math.round(rect.y),
            bottom: Math.round(rect.bottom),
            height: Math.round(rect.height)
          }
        : null;
    };

    const deck = document.querySelector('[data-testid="workout-list-deck"]');

    return {
      card: rectOf(document.querySelector('[data-testid="workout-list-card"]')),
      progress: rectOf(document.querySelector('[data-testid="workout-list-progress"]')),
      startButton: rectOf(document.querySelector('[data-testid="workout-start-button"]')),
      bottomNav: rectOf(document.querySelector('[data-testid="client-bottom-nav"]')),
      deckOverflow: deck ? getComputedStyle(deck).overflow : ""
    };
  });

  expect(metrics.deckOverflow).toBe("visible");
  expect(metrics.card).not.toBeNull();
  expect(metrics.progress).not.toBeNull();
  expect(metrics.startButton).not.toBeNull();
  expect(metrics.bottomNav).not.toBeNull();
  const layoutSummary = JSON.stringify(metrics);
  expect(metrics.startButton.bottom, layoutSummary).toBeLessThanOrEqual(metrics.card.bottom);
  expect(metrics.card.bottom, layoutSummary).toBeLessThan(metrics.progress.y);
  expect(metrics.progress.bottom, layoutSummary).toBeLessThanOrEqual(metrics.bottomNav.y);
}

async function expectWorkoutPlanSpacing(page, { empty = false } = {}) {
  const metrics = await page.evaluate(({ expectEmpty }) => {
    const rectOf = (node) => {
      const rect = node?.getBoundingClientRect();
      return rect
        ? {
            top: Math.round(rect.top),
            right: Math.round(rect.right),
            bottom: Math.round(rect.bottom),
            left: Math.round(rect.left),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          }
        : null;
    };

    const rows = [...document.querySelectorAll('[data-testid="workout-plan-week"] button')];

    return {
      page: rectOf(document.querySelector('[data-testid="workout-plan-page"]')),
      stats: rectOf(document.querySelector('[data-testid="workout-plan-stats"]')),
      contentTail: rectOf(expectEmpty
        ? document.querySelector('[data-testid="workout-plan-page"] > main > div > div')
        : rows.at(-1)),
      panel: rectOf(document.querySelector('[data-testid="workout-plan-bottom-panel"]')),
      nav: rectOf(document.querySelector('[data-testid="client-training-bottom-nav"]')),
      rowCount: rows.length,
      navPosition: getComputedStyle(
        document.querySelector('[data-testid="client-training-bottom-nav"]')?.parentElement
      ).position
    };
  }, { expectEmpty: empty });

  const layoutSummary = JSON.stringify(metrics);
  expect(metrics.page, layoutSummary).not.toBeNull();
  expect(metrics.stats, layoutSummary).not.toBeNull();
  expect(metrics.contentTail, layoutSummary).not.toBeNull();
  expect(metrics.panel, layoutSummary).not.toBeNull();
  expect(metrics.nav, layoutSummary).not.toBeNull();
  expect(metrics.navPosition, layoutSummary).toBe("fixed");
  expect(metrics.panel.width, layoutSummary).toBe(metrics.nav.width);
  expect(metrics.panel.height, layoutSummary).toBe(metrics.nav.height);
  expect(metrics.panel.left, layoutSummary).toBe(metrics.nav.left);
  expect(metrics.panel.top, layoutSummary).toBe(metrics.nav.top);
  expect(metrics.stats.bottom, layoutSummary).toBeLessThan(metrics.contentTail.top);
  expect(metrics.contentTail.bottom, layoutSummary).toBeLessThan(metrics.panel.top);
  expect(metrics.rowCount, layoutSummary).toBe(empty ? 0 : 2);
}

async function expectWorkoutHistorySpacing(page, { empty = false } = {}) {
  const metrics = await page.evaluate(({ expectEmpty }) => {
    const rectOf = (node) => {
      const rect = node?.getBoundingClientRect();
      return rect
        ? {
            top: Math.round(rect.top),
            right: Math.round(rect.right),
            bottom: Math.round(rect.bottom),
            left: Math.round(rect.left),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          }
        : null;
    };

    const pageNode = document.querySelector('[data-testid="workout-history-page"]');
    const cards = [...document.querySelectorAll('[data-testid="workout-history-card"]')];
    const tail = expectEmpty
      ? document.querySelector('[data-testid="workout-history-empty"]')
      : cards.at(-1);
    const navNode = document.querySelector('[data-testid="client-bottom-nav"]');

    return {
      viewportWidth: window.innerWidth,
      page: rectOf(pageNode),
      hero: rectOf(document.querySelector('[data-testid="workout-history-hero"]')),
      stats: rectOf(document.querySelector('[data-testid="workout-history-stats"]')),
      tail: rectOf(tail),
      nav: rectOf(navNode),
      cardCount: cards.length,
      navPosition: navNode ? getComputedStyle(navNode.parentElement).position : ""
    };
  }, { expectEmpty: empty });

  const layoutSummary = JSON.stringify(metrics);
  expect(metrics.page, layoutSummary).not.toBeNull();
  expect(metrics.hero, layoutSummary).not.toBeNull();
  expect(metrics.stats, layoutSummary).not.toBeNull();
  expect(metrics.tail, layoutSummary).not.toBeNull();
  expect(metrics.nav, layoutSummary).not.toBeNull();
  expect(metrics.navPosition, layoutSummary).toBe("fixed");
  expect(metrics.page.left, layoutSummary).toBeGreaterThanOrEqual(0);
  expect(metrics.page.right, layoutSummary).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  expect(metrics.hero.bottom, layoutSummary).toBeLessThan(metrics.stats.top);
  expect(metrics.tail.bottom, layoutSummary).toBeLessThanOrEqual(metrics.page.bottom);
  expect(metrics.cardCount, layoutSummary).toBe(empty ? 0 : 2);
}

async function expectWorkoutModeSpacing(page) {
  const metrics = await page.evaluate(() => {
    const rectOf = (node) => {
      const rect = node?.getBoundingClientRect();
      return rect
        ? {
            top: Math.round(rect.top),
            right: Math.round(rect.right),
            bottom: Math.round(rect.bottom),
            left: Math.round(rect.left),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          }
        : null;
    };

    const cards = [...document.querySelectorAll('[data-testid="workout-mode-card"]')];
    const navNode = document.querySelector('[data-testid="client-bottom-nav"]');

    return {
      viewportWidth: window.innerWidth,
      page: rectOf(document.querySelector('[data-testid="workout-mode-page"]')),
      header: rectOf(document.querySelector('[data-testid="workout-mode-header"]')),
      lead: rectOf(document.querySelector('[data-testid="workout-mode-lead"]')),
      cards: rectOf(document.querySelector('[data-testid="workout-mode-cards"]')),
      firstCard: rectOf(cards[0]),
      lastCard: rectOf(cards.at(-1)),
      remember: rectOf(document.querySelector('[data-testid="workout-mode-remember"]')),
      nav: rectOf(navNode),
      cardCount: cards.length,
      navPosition: navNode ? getComputedStyle(navNode.parentElement).position : ""
    };
  });

  const layoutSummary = JSON.stringify(metrics);
  expect(metrics.page, layoutSummary).not.toBeNull();
  expect(metrics.header, layoutSummary).not.toBeNull();
  expect(metrics.lead, layoutSummary).not.toBeNull();
  expect(metrics.cards, layoutSummary).not.toBeNull();
  expect(metrics.firstCard, layoutSummary).not.toBeNull();
  expect(metrics.lastCard, layoutSummary).not.toBeNull();
  expect(metrics.remember, layoutSummary).not.toBeNull();
  expect(metrics.nav, layoutSummary).not.toBeNull();
  expect(metrics.navPosition, layoutSummary).toBe("fixed");
  expect(metrics.page.left, layoutSummary).toBeGreaterThanOrEqual(0);
  expect(metrics.page.right, layoutSummary).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  expect(metrics.header.bottom, layoutSummary).toBeLessThan(metrics.lead.top);
  expect(metrics.lead.bottom, layoutSummary).toBeLessThan(metrics.cards.top);
  expect(metrics.firstCard.bottom, layoutSummary).toBeLessThan(metrics.lastCard.top);
  expect(metrics.cards.bottom, layoutSummary).toBeLessThanOrEqual(metrics.remember.top);
  expect(metrics.cardCount, layoutSummary).toBe(2);
}

async function expectBasicQuizSpacing(page) {
  const metrics = await page.evaluate(() => {
    const rectOf = (node) => {
      const rect = node?.getBoundingClientRect();
      return rect
        ? {
            top: Math.round(rect.top),
            right: Math.round(rect.right),
            bottom: Math.round(rect.bottom),
            left: Math.round(rect.left),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          }
        : null;
    };

    const navNode = document.querySelector('[data-testid="client-bottom-nav"]');

    return {
      viewportWidth: window.innerWidth,
      page: rectOf(document.querySelector('[data-testid="basic-quiz-page"]')),
      header: rectOf(document.querySelector('[data-testid="basic-quiz-header"]')),
      card: rectOf(document.querySelector('[data-testid="basic-quiz-card"]')),
      preview: rectOf(document.querySelector('[data-testid="basic-quiz-preview"]')),
      start: rectOf(document.querySelector('[data-testid="basic-quiz-start"]')),
      nav: rectOf(navNode),
      selectCount: document.querySelectorAll('[data-testid="basic-quiz-field"] select').length,
      moduleControlCount: document.querySelectorAll('[data-testid="basic-quiz-field"] select[data-css-module-control]').length,
      navPosition: navNode ? getComputedStyle(navNode.parentElement).position : ""
    };
  });

  const layoutSummary = JSON.stringify(metrics);
  expect(metrics.page, layoutSummary).not.toBeNull();
  expect(metrics.header, layoutSummary).not.toBeNull();
  expect(metrics.card, layoutSummary).not.toBeNull();
  expect(metrics.preview, layoutSummary).not.toBeNull();
  expect(metrics.start, layoutSummary).not.toBeNull();
  expect(metrics.nav, layoutSummary).not.toBeNull();
  expect(metrics.page.left, layoutSummary).toBeGreaterThanOrEqual(0);
  expect(metrics.page.right, layoutSummary).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  expect(metrics.header.bottom, layoutSummary).toBeLessThanOrEqual(metrics.card.top);
  expect(metrics.card.bottom, layoutSummary).toBeLessThan(metrics.preview.top);
  expect(metrics.preview.bottom, layoutSummary).toBeLessThan(metrics.start.top);
  expect(metrics.selectCount, layoutSummary).toBe(3);
  expect(metrics.moduleControlCount, layoutSummary).toBe(3);
  expect(metrics.navPosition, layoutSummary).toBe("fixed");
}

async function openClientWorkoutHarness(page) {
  await page.goto("/?clientHarness=1");
  await expect(page.getByTestId("client-nav-workouts")).toBeVisible({ timeout: 40_000 });
  await page.getByTestId("client-nav-workouts").click();
}

test("client workout visual audit covers plan cards and workout modals", async ({ page }, testInfo) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  await openClientWorkoutHarness(page);
  await expect(page.getByTestId("client-harness-workouts")).toBeVisible();
  await expect(page.locator('[data-css-module-scope="workout-list"]')).toBeVisible();
  await expect(page.getByTestId("workout-list-card")).toBeVisible();
  await expectTapTargets(page, [
    '[data-testid="workout-mode-button"]',
    '[data-testid="workout-history-button"]',
    '[data-testid="workout-start-button"]',
    '[data-testid="workout-list-nav"] button',
    '[data-testid="client-bottom-nav"] button'
  ]);
  await expectWorkoutCardSpacing(page);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-workout-plan.png");

  const workoutCard = page.getByTestId("workout-list-card");
  await workoutCard.dispatchEvent("pointerdown", {
    pointerType: "touch",
    clientX: 300,
    clientY: 240
  });
  await workoutCard.dispatchEvent("pointerup", {
    pointerType: "touch",
    clientX: 120,
    clientY: 240
  });
  await expect(page.getByTestId("workout-list-progress")).toContainText("2");
  await expectWorkoutCardSpacing(page);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-workout-next-card.png");

  await page.getByTestId("workout-mode-button").click();
  await expect(page.getByTestId("workout-mode-dialog")).toBeVisible();
  await expect(page.locator('[data-testid="workout-mode-option"][aria-pressed="true"]')).toHaveCount(1);
  await expectTapTargets(page, [
    '[data-testid="workout-mode-dialog-close"]',
    '[data-testid="workout-mode-option"]'
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-workout-mode-modal.png");
  await page.getByTestId("workout-mode-dialog-close").click();
  await expect(page.getByTestId("workout-mode-dialog")).toBeHidden();

  await page.getByTestId("workout-history-button").click();
  await expect(page.getByTestId("workout-history-dialog")).toBeVisible();
  await expectTapTargets(page, [
    '[data-testid="workout-history-dialog-close"]',
    '[data-testid="workout-history-dialog-all"]'
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-workout-history-modal.png");

  assertNoRuntimeErrors();
});

test("client workout visual audit covers empty assigned plan state", async ({ page }, testInfo) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  await page.goto("/?clientHarness=1&clientWorkoutState=empty");
  await expect(page.getByTestId("client-nav-workouts")).toBeVisible({ timeout: 40_000 });
  await page.getByTestId("client-nav-workouts").click();
  await expect(page.getByTestId("client-harness-workouts")).toBeVisible();
  await expect(page.getByTestId("workout-list-empty-state")).toBeVisible();
  await expectTapTargets(page, [
    '[data-testid="workout-list-empty-state"] button',
    '[data-testid="client-bottom-nav"] button'
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-workout-empty-state.png");

  assertNoRuntimeErrors();
});

test("client workout visual audit covers AI workout dialogs", async ({ page }, testInfo) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  await page.goto("/?clientHarness=1&clientHarnessPage=workoutDialogs&clientWorkoutDialog=draft");
  await expect(page.getByTestId("client-harness-workout-dialogs")).toBeAttached({ timeout: 40_000 });
  await expect(page.getByTestId("workout-draft-restore-dialog")).toBeVisible();
  await expectTapTargets(page, ['[data-testid="workout-draft-restore-dialog"] button']);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-workout-draft-restore-dialog.png");

  await page.goto("/?clientHarness=1&clientHarnessPage=workoutDialogs&clientWorkoutDialog=readiness");
  await expect(page.getByTestId("client-harness-workout-dialogs")).toBeAttached({ timeout: 40_000 });
  await expect(page.getByTestId("workout-readiness-dialog")).toBeVisible();
  await expectTapTargets(page, [
    '[data-workout-readiness-option]',
    '[data-testid="workout-readiness-dialog"] button'
  ]);
  await page.locator('[data-workout-readiness-option="good"]').click();
  await expect(page.locator('[data-workout-readiness-option][aria-pressed="true"]')).toHaveCount(1);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-workout-readiness-dialog.png");

  await page.goto("/?clientHarness=1&clientHarnessPage=workoutDialogs&clientWorkoutDialog=post");
  await expect(page.getByTestId("client-harness-workout-dialogs")).toBeAttached({ timeout: 40_000 });
  await expect(page.getByTestId("post-workout-feedback-dialog")).toBeVisible();
  await expectTapTargets(page, ['[data-testid="post-workout-feedback-dialog"] button']);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-post-workout-feedback-dialog.png");

  await page.goto("/?clientHarness=1&clientHarnessPage=workoutDialogs&clientWorkoutDialog=exit");
  await expect(page.getByTestId("workout-exit-dialog")).toBeVisible({ timeout: 40_000 });
  await expectTapTargets(page, ['[data-testid="workout-exit-dialog"] button']);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-workout-exit-dialog.png");

  await page.goto("/?clientHarness=1&clientHarnessPage=workoutDialogs&clientWorkoutDialog=incomplete");
  await expect(page.getByTestId("workout-incomplete-dialog")).toBeVisible({ timeout: 40_000 });
  await expectTapTargets(page, ['[data-testid="workout-incomplete-dialog"] button']);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-workout-incomplete-dialog.png");

  assertNoRuntimeErrors();
});

test("CSS V2 workout list stays separated and overflow-free at target viewports", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One deterministic browser covers the viewport matrix.");

  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const viewports = [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/cssV2?clientHarness=1");
    await expect(page.getByTestId("client-nav-workouts")).toBeVisible({ timeout: 40_000 });
    await page.getByTestId("client-nav-workouts").click();
    await expect(page.locator('[data-css-module-scope="workout-list"]')).toBeVisible();
    await expectWorkoutCardSpacing(page);
    await expectNoHorizontalOverflow(page);
  }

  assertNoRuntimeErrors();
});

test("CSS V2 workout plan stays scoped, adaptive and functional", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One deterministic browser covers the viewport matrix.");

  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const viewports = [
    { width: 320, height: 720 },
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/cssV2?clientHarness=1&clientHarnessPage=workoutPlan&clientHarnessTheme=warm-light");
    await expect(page.getByTestId("client-harness-workout-plan")).toBeVisible({ timeout: 40_000 });
    await expect(page.locator('[data-css-module-scope="workout-plan"]')).toBeVisible();
    await expect(page.locator('[data-css-module-scope="training-bottom-bar"]')).toBeVisible();
    await expect(page.getByTestId("client-training-bottom-nav").locator('[aria-current="page"]'))
      .toHaveText("📋План");
    await expectTapTargets(page, [
      '[data-testid="workout-plan-week"] button',
      '[data-testid="client-training-bottom-nav"] button'
    ]);
    await expectWorkoutPlanSpacing(page);
    await expectNoHorizontalOverflow(page);
    await attachScreenshot(
      page,
      testInfo,
      `client-workout-plan-warm-${viewport.width}x${viewport.height}.png`
    );
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cssV2?clientHarness=1&clientHarnessPage=workoutPlan&clientHarnessTheme=dark-green");
  await expect(page.getByTestId("client-harness-workout-plan")).toBeVisible({ timeout: 40_000 });
  await expectWorkoutPlanSpacing(page);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-workout-plan-dark-390x844.png");

  await page.goto(
    "/cssV2?clientHarness=1&clientHarnessPage=workoutPlan&clientHarnessTheme=warm-light&clientWorkoutState=empty"
  );
  await expect(page.getByText("План пока не назначен")).toBeVisible({ timeout: 40_000 });
  await expectWorkoutPlanSpacing(page, { empty: true });
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-workout-plan-empty-390x844.png");

  await page.goto("/cssV2?clientHarness=1&clientHarnessPage=workoutPlan&clientHarnessTheme=warm-light");
  await page.getByTestId("workout-plan-week").first().locator("button").first().click();
  await expect(page.getByTestId("client-harness-workouts")).toBeVisible();

  assertNoRuntimeErrors();
});

test("CSS V2 workout history stays scoped, adaptive and functional", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One deterministic browser covers the viewport matrix.");

  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const viewports = [
    { width: 320, height: 720 },
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/cssV2?clientHarness=1&clientHarnessPage=workoutHistory&clientHarnessTheme=warm-light");
    await expect(page.getByTestId("client-harness-workout-history")).toBeVisible({ timeout: 40_000 });
    await expect(page.locator('[data-css-module-scope="workout-history"]')).toBeVisible();
    await expect(page.getByTestId("workout-history-card")).toHaveCount(2);
    await expectTapTargets(page, [
      '[data-testid="workout-history-refresh"]',
      '[data-testid="workout-history-card-main"]',
      '[data-testid="workout-history-card-toggle"]',
      '[data-testid="client-bottom-nav"] button'
    ]);
    await expectWorkoutHistorySpacing(page);
    await expectNoHorizontalOverflow(page);
    await attachScreenshot(
      page,
      testInfo,
      `client-workout-history-warm-${viewport.width}x${viewport.height}.png`
    );
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cssV2?clientHarness=1&clientHarnessPage=workoutHistory&clientHarnessTheme=dark-green");
  await expect(page.getByTestId("client-harness-workout-history")).toBeVisible({ timeout: 40_000 });
  await expectWorkoutHistorySpacing(page);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-workout-history-dark-390x844.png");

  await page.getByTestId("workout-history-card-toggle").first().click();
  await expect(page.getByTestId("workout-history-card-toggle").first()).toHaveAttribute("aria-label", "Свернуть");
  await expect(page.getByText("Жим гантелей").first()).toBeVisible();
  await page.getByTestId("workout-history-card-toggle").first().click();
  await expect(page.getByTestId("workout-history-card-toggle").first()).toHaveAttribute("aria-label", "Развернуть");

  await page.goto(
    "/cssV2?clientHarness=1&clientHarnessPage=workoutHistory&clientHarnessTheme=warm-light&clientHistoryState=swiped"
  );
  await expect(page.getByTestId("workout-history-delete-action").first()).toBeVisible({ timeout: 40_000 });
  await page.getByTestId("workout-history-delete-action").first().click();
  await expect(page.locator('[data-css-module-scope="workout-history-delete"]')).toBeVisible();
  await expectTapTargets(page, ['[data-css-module-scope="workout-history-delete"] button']);
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "Отмена" }).click();
  await expect(page.locator('[data-css-module-scope="workout-history-delete"]')).toBeHidden();

  await page.goto(
    "/cssV2?clientHarness=1&clientHarnessPage=workoutHistory&clientHarnessTheme=warm-light&clientHistoryState=empty"
  );
  await expect(page.getByText("История пустая")).toBeVisible({ timeout: 40_000 });
  await expectWorkoutHistorySpacing(page, { empty: true });
  await expectNoHorizontalOverflow(page);

  await page.goto(
    "/cssV2?clientHarness=1&clientHarnessPage=workoutHistory&clientHarnessTheme=warm-light&clientHistoryState=loading"
  );
  await expect(page.getByText("Загрузка истории...")).toBeVisible({ timeout: 40_000 });
  await expectWorkoutHistorySpacing(page, { empty: true });
  await expectNoHorizontalOverflow(page);

  assertNoRuntimeErrors();
});

test("CSS V2 workout mode stays scoped, adaptive and functional", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One deterministic browser covers the viewport matrix.");

  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const viewports = [
    { width: 320, height: 720 },
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/cssV2?clientHarness=1&clientHarnessPage=workoutMode&clientHarnessTheme=warm-light");
    await expect(page.getByTestId("client-harness-workout-mode")).toBeVisible({ timeout: 40_000 });
    await expect(page.locator('[data-css-module-scope="workout-mode"]')).toBeVisible();
    await expectTapTargets(page, [
      '[data-testid="workout-mode-header"] button',
      '[data-testid="workout-mode-card"]',
      '[data-testid="client-bottom-nav"] button'
    ]);
    await expectWorkoutModeSpacing(page);
    await expectNoHorizontalOverflow(page);
    await attachScreenshot(
      page,
      testInfo,
      `client-workout-mode-warm-${viewport.width}x${viewport.height}.png`
    );
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cssV2?clientHarness=1&clientHarnessPage=workoutMode&clientHarnessTheme=dark-green");
  await expect(page.getByTestId("client-harness-workout-mode")).toBeVisible({ timeout: 40_000 });
  await expectWorkoutModeSpacing(page);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-workout-mode-dark-390x844.png");

  const remember = page.getByTestId("workout-mode-remember").locator("input");
  await expect(remember).not.toBeChecked();
  await remember.check();
  await expect(remember).toBeChecked();

  await page.getByRole("button", { name: "Выбрать режим запуска тренировки" }).click();
  await expect(page.getByTestId("workout-mode-dialog")).toBeVisible();
  await expect(page.locator('[data-testid="workout-mode-option"][aria-pressed="true"]')).toHaveCount(1);
  await expectTapTargets(page, ['[data-testid="workout-mode-option"]']);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-workout-mode-dialog-dark-390x844.png");
  await page.getByRole("button", { name: "Закрыть выбор режима" }).click();
  await expect(page.getByTestId("workout-mode-dialog")).toBeHidden();

  await page.getByTestId("workout-mode-card").first().click();
  await expect(page.getByTestId("client-harness-workouts")).toBeVisible();

  assertNoRuntimeErrors();
});

test("CSS V2 basic workout quiz stays scoped, adaptive and functional", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One deterministic browser covers the viewport matrix.");

  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const viewports = [
    { width: 320, height: 720 },
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/cssV2?clientHarness=1&clientHarnessPage=basicQuiz&clientHarnessTheme=warm-light");
    await expect(page.getByTestId("client-harness-basic-quiz")).toBeVisible({ timeout: 40_000 });
    await expect(page.locator('[data-css-module-scope="basic-quiz"]')).toBeVisible();
    await expectTapTargets(page, [
      '[data-testid="basic-quiz-header"] button',
      '[data-testid="basic-quiz-start"]',
      '[data-testid="client-bottom-nav"] button'
    ]);
    await expectBasicQuizSpacing(page);
    await expectNoHorizontalOverflow(page);
    await attachScreenshot(
      page,
      testInfo,
      `client-basic-workout-quiz-warm-${viewport.width}x${viewport.height}.png`
    );
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cssV2?clientHarness=1&clientHarnessPage=basicQuiz&clientHarnessTheme=warm-light");
  const selects = page.getByTestId("basic-quiz-field").locator("select");
  await selects.nth(0).selectOption("beginner");
  await selects.nth(1).selectOption("beginner");
  await selects.nth(2).selectOption("3");
  await expect(selects.nth(0)).toHaveValue("beginner");
  await expect(selects.nth(1)).toHaveValue("beginner");
  await expect(selects.nth(2)).toHaveValue("3");
  await expect(page.getByTestId("basic-quiz-stats").locator("b").first()).toHaveText("3");

  await page.goto("/cssV2?clientHarness=1&clientHarnessPage=basicQuiz&clientHarnessTheme=dark-green");
  await expect(page.getByTestId("client-harness-basic-quiz")).toBeVisible({ timeout: 40_000 });
  await expectBasicQuizSpacing(page);
  await expectNoHorizontalOverflow(page);
  await page.getByTestId("basic-quiz-header").locator("button").click();
  await expect(page.getByTestId("workout-mode-dialog")).toBeVisible();
  await expectTapTargets(page, ['[data-testid="workout-mode-dialog"] button'], 38);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-basic-workout-quiz-dialog-dark-390x844.png");
  await page.getByTestId("workout-mode-dialog").locator("button").first().click();
  await expect(page.getByTestId("workout-mode-dialog")).toBeHidden();

  await page.getByTestId("basic-quiz-start").click();
  await expect(page.getByTestId("client-harness-workouts")).toBeVisible();

  assertNoRuntimeErrors();
});

test("CSS V2 workout exercise video frame stays scoped, adaptive and functional", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One deterministic browser covers the viewport matrix.");

  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const viewports = [
    { width: 320, height: 720 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 700 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/cssV2?clientHarness=1&clientHarnessPage=exerciseVideo&clientExerciseVideoState=paused&clientHarnessTheme=warm-light");
    const frame = page.getByTestId("workout-exercise-video-frame");
    await expect(frame).toBeVisible({ timeout: 40_000 });
    await expect(frame.locator("video")).toBeVisible();
    await expectExerciseVideoFrameSpacing(page);
    await expectTapTargets(page, ['[data-testid="workout-exercise-video-frame"] button'], 27);
    await expectNoHorizontalOverflow(page);
    await attachScreenshot(page, testInfo, `client-workout-exercise-video-${viewport.width}x${viewport.height}.png`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cssV2?clientHarness=1&clientHarnessPage=exerciseVideo&clientExerciseVideoState=loading&clientHarnessTheme=warm-light");
  await expect(page.getByTestId("workout-exercise-video-frame").locator("video + span")).toBeVisible();
  await expectExerciseVideoFrameSpacing(page);

  await page.goto("/cssV2?clientHarness=1&clientHarnessPage=exerciseVideo&clientExerciseVideoState=hidden&clientHarnessTheme=warm-light");
  await expect(page.getByTestId("workout-exercise-video-frame").locator("button").first()).toHaveCSS("opacity", "0");
  await expectExerciseVideoFrameSpacing(page);

  await page.goto("/cssV2?clientHarness=1&clientHarnessPage=exerciseVideo&clientExerciseVideoState=fallback&clientHarnessTheme=warm-light");
  const fallbackFrame = page.getByTestId("workout-exercise-video-frame");
  await expect(fallbackFrame.locator("video")).toHaveCount(0);
  const retryButton = fallbackFrame.getByRole("button", { name: "Повторить загрузку" });
  await expect(retryButton).toBeVisible();
  await expect(retryButton).toHaveCSS("height", "34px");
  await retryButton.click();
  await expectExerciseVideoFrameSpacing(page);
  await expectNoHorizontalOverflow(page);

  await page.goto("/cssV2?clientHarness=1&clientHarnessPage=exerciseVideo&clientExerciseVideoState=paused&clientHarnessTheme=dark-green");
  const darkFrame = page.getByTestId("workout-exercise-video-frame");
  const video = darkFrame.locator("video");
  await expect(video).toBeVisible();
  await darkFrame.locator("button").first().click();
  await expect.poll(() => video.evaluate((element) => element.paused)).toBe(false);
  await video.evaluate((element) => element.click());
  await expect.poll(() => video.evaluate((element) => element.paused)).toBe(true);
  await expectExerciseVideoFrameSpacing(page);
  await expectNoHorizontalOverflow(page);

  assertNoRuntimeErrors();
});

test("CSS V2 workout exercise sets stay scoped, adaptive and functional", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One deterministic browser covers the viewport matrix.");

  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const viewports = [
    { width: 320, height: 720 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 700 },
    { width: 1440, height: 900 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/cssV2?clientHarness=1&clientHarnessPage=exerciseSets&clientHarnessTheme=warm-light");
    const sets = page.getByTestId("workout-exercise-sets");
    await expect(sets).toBeVisible({ timeout: 40_000 });
    await expect(sets).toHaveAttribute("data-css-module-scope", "workout-exercise-sets");
    await expect(sets.getByTestId("workout-exercise-set-row")).toHaveCount(3);
    await expectTapTargets(page, ['[data-testid="workout-exercise-sets"] button'], 24);
    await expectExerciseSetsSpacing(page);
    await expectNoHorizontalOverflow(page);
    await attachScreenshot(page, testInfo, `client-workout-exercise-sets-${viewport.width}x${viewport.height}.png`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cssV2?clientHarness=1&clientHarnessPage=exerciseSets&clientExerciseSetsState=completed&clientHarnessTheme=warm-light");
  const completedRow = page.getByTestId("workout-exercise-set-row").first();
  await expect(completedRow).toHaveAttribute("aria-pressed", "true");
  await completedRow.click();
  await expect(completedRow).toHaveAttribute("aria-pressed", "false");

  await page.goto("/cssV2?clientHarness=1&clientHarnessPage=exerciseSets&clientHarnessTheme=warm-light");
  const sets = page.getByTestId("workout-exercise-sets");
  await expect(sets).toBeVisible({ timeout: 40_000 });
  await sets.locator("button").first().click();
  const modal = page.getByTestId("workout-set-edit-modal");
  await expect(modal).toBeVisible();
  await expect(modal.getByTestId("workout-set-wheel-picker")).toHaveCount(2);
  const modalWidth = await modal.evaluate((node) => node.getBoundingClientRect().width);
  expect(modalWidth).toBeLessThanOrEqual(358);
  await expect(modal.getByTestId("workout-set-wheel-picker").first()).toHaveCSS("height", "210px");
  await modal.getByRole("option", { name: "12", exact: true }).first().click();
  await modal.locator(":scope > button").click();
  await expect(modal).toBeHidden();
  await expect(page.getByTestId("workout-exercise-set-row").first()).toContainText("12 повторений");

  await page.goto("/cssV2?clientHarness=1&clientHarnessPage=exerciseSets&clientExerciseSetsState=bodyweight&clientHarnessTheme=warm-light");
  await page.getByTestId("workout-exercise-sets").locator("button").first().click();
  await expect(page.getByTestId("workout-set-edit-modal").getByTestId("workout-set-wheel-picker")).toHaveCount(1);
  await expectNoHorizontalOverflow(page);

  await page.goto("/cssV2?clientHarness=1&clientHarnessPage=exerciseSets&clientHarnessTheme=dark-green");
  await expect(page.getByTestId("workout-exercise-sets")).toBeVisible({ timeout: 40_000 });
  await expect(page.getByTestId("workout-exercise-set-row")).toHaveCount(3);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-workout-exercise-sets-dark-390x844.png");

  assertNoRuntimeErrors();
});

test("CSS V2 workout run overlays stay scoped, adaptive and functional", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One deterministic browser covers the viewport matrix.");

  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const viewports = [
    { width: 320, height: 720 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 700 },
    { width: 1440, height: 900 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/cssV2?clientHarness=1&clientHarnessPage=workoutRunOverlays&clientHarnessTheme=warm-light");
    const scope = page.locator('[data-css-module-scope="workout-stage-heading"]');
    const closeButton = page.getByRole("button", { name: "Выйти из тренировки" });
    const backButton = page.getByRole("button", { name: "Вернуться к предыдущему экрану" });
    await expect(scope).toBeVisible({ timeout: 40_000 });
    await expect(closeButton).toHaveCSS("width", "44px");
    await expect(closeButton).toHaveCSS("height", "44px");
    await expect(backButton).toHaveCSS("width", "44px");
    await expect(backButton).toHaveCSS("height", "44px");
    await expectNoHorizontalOverflow(page);
    await attachScreenshot(page, testInfo, `client-workout-run-overlays-${viewport.width}x${viewport.height}.png`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cssV2?clientHarness=1&clientHarnessPage=workoutRunOverlays&clientWorkoutRunOverlayState=saved&clientHarnessTheme=warm-light");
  const backButton = page.getByRole("button", { name: "Вернуться к предыдущему экрану" });
  await expect(backButton).toHaveCSS("width", "44px");
  await expect(backButton).toHaveCSS("height", "44px");
  await backButton.click();
  await expect(page.getByTestId("client-harness-main")).toBeVisible();

  await page.goto("/cssV2?clientHarness=1&clientHarnessPage=workoutRunOverlays&clientWorkoutRunOverlayState=notFound&clientHarnessTheme=warm-light");
  await page.getByRole("button", { name: /Главное меню/ }).click();
  await expect(page.getByTestId("client-harness-main")).toBeVisible();

  await page.goto("/cssV2?clientHarness=1&clientHarnessPage=workoutRunOverlays&clientWorkoutRunOverlayState=fullscreen&clientHarnessTheme=warm-light");
  const fullscreen = page.getByTestId("workout-fullscreen-video-overlay");
  await expect(fullscreen).toBeVisible();
  await expect(fullscreen).toHaveCSS("position", "fixed");
  await expect(fullscreen).toHaveCSS("width", "390px");
  await expect(fullscreen).toHaveCSS("height", "844px");
  await expect(fullscreen.locator("video")).toHaveCSS("border-radius", "18px");
  await page.getByRole("button", { name: "Закрыть видео" }).click();
  await expect(page.getByTestId("client-harness-main")).toBeVisible();

  await page.goto("/cssV2?clientHarness=1&clientHarnessPage=workoutRunOverlays&clientHarnessTheme=dark-green");
  await expect(page.locator('[data-css-module-scope="workout-stage-heading"]')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-workout-run-overlays-dark-390x844.png");

  assertNoRuntimeErrors();
});

test("CSS V2 workout run stages stay scoped and adaptive through the full flow", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One deterministic browser covers the viewport matrix.");

  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const primaryViewports = [
    { width: 320, height: 720 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 700 },
    { width: 1440, height: 900 }
  ];

  for (const stage of ["warmup", "exercise"]) {
    for (const viewport of primaryViewports) {
      await page.setViewportSize(viewport);
      await page.goto(
        `/cssV2?clientHarness=1&clientHarnessPage=workoutRunStage&clientWorkoutRunStage=${stage}&clientHarnessTheme=warm-light`
      );
      await expect(page.getByTestId("workout-run-stage")).toBeVisible({ timeout: 40_000 });
      await expect(page.getByTestId("workout-run-stage")).toHaveAttribute(
        "data-css-module-scope",
        "workout-run-stage"
      );
      await expectWorkoutRunStageSpacing(page, stage);
      await expectNoHorizontalOverflow(page);
      await attachScreenshot(
        page,
        testInfo,
        `client-workout-run-${stage}-${viewport.width}x${viewport.height}.png`
      );
    }
  }

  for (const viewport of [
    { width: 320, height: 720 },
    { width: 390, height: 844 },
    { width: 768, height: 700 }
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(
      "/cssV2?clientHarness=1&clientHarnessPage=workoutRunStage&clientWorkoutRunStage=finish&clientHarnessTheme=warm-light"
    );
    await expect(page.getByTestId("workout-finish-screen")).toBeVisible({ timeout: 40_000 });
    await expectWorkoutRunStageSpacing(page, "finish");
    await expectNoHorizontalOverflow(page);
    await attachScreenshot(
      page,
      testInfo,
      `client-workout-run-finish-${viewport.width}x${viewport.height}.png`
    );
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    "/cssV2?clientHarness=1&clientHarnessPage=workoutRunStage&clientWorkoutRunStage=saved&clientHarnessTheme=warm-light"
  );
  await expect(page.getByTestId("workout-run-stage")).toBeVisible({ timeout: 40_000 });
  await expectWorkoutRunStageSpacing(page, "finish");
  await expect(page.getByTestId("workout-finish-card").locator("textarea")).toHaveCount(0);

  for (const stage of ["exercise", "finish"]) {
    await page.goto(
      `/cssV2?clientHarness=1&clientHarnessPage=workoutRunStage&clientWorkoutRunStage=${stage}&clientHarnessTheme=dark-green`
    );
    await expect(page.getByTestId("workout-run-stage")).toBeVisible({ timeout: 40_000 });
    await expectWorkoutRunStageSpacing(page, stage);
    await expectNoHorizontalOverflow(page);
    await attachScreenshot(page, testInfo, `client-workout-run-${stage}-dark-390x844.png`);
  }

  await page.goto(
    "/cssV2?clientHarness=1&clientHarnessPage=workoutRunStage&clientWorkoutRunStage=warmup&clientHarnessTheme=warm-light"
  );
  const warmupPreset = page.locator('[data-css-module-control="workout-warmup"][aria-pressed]').first();
  await warmupPreset.click();
  await expect(warmupPreset).toHaveAttribute("aria-pressed", "true");
  await page.locator('[data-css-module-scope="workout-stage-action-panel"] button').nth(1).click();
  await expect(page.getByTestId("workout-run-stage")).toHaveAttribute("data-workout-stage", "exercise");

  await page.getByTestId("workout-exercise-support").locator("button").nth(1).click();
  const noteModal = page.getByTestId("workout-exercise-note-modal");
  await expect(noteModal).toBeVisible();
  await noteModal.locator("button").first().click();
  await expect(noteModal).toBeHidden();

  await page.locator('[data-css-module-scope="workout-stage-action-panel"] button').nth(1).click();
  await expect(page.getByTestId("workout-run-stage")).toHaveAttribute("data-workout-stage", "exercise");
  await page.locator('[data-css-module-scope="workout-stage-action-panel"] button').nth(1).click();
  await expect(page.getByTestId("workout-run-stage")).toHaveAttribute("data-workout-stage", "finish");
  await page.getByTestId("workout-finish-card").locator("textarea").fill("Тестовый комментарий");
  await page.locator('[data-css-module-scope="workout-finish-stage"]:has(button) button').nth(1).click();
  await expect(page.getByTestId("workout-finish-card").locator("textarea")).toHaveCount(0);

  assertNoRuntimeErrors();
});
