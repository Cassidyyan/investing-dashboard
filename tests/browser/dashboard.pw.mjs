import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const routes = [
  "/",
  "/accounts",
  "/cash",
  "/holdings",
  "/performance",
  "/returns",
  "/activity",
  "/options-analytics",
];
async function checkAccessibility(page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  const result = await new AxeBuilder({ page }).analyze();
  // Assertions deliberately omit node HTML/financial text from failure output.
  expect(
    result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      count: v.nodes.length,
    })),
  ).toEqual([]);
}
for (const route of routes) {
  test(`accessible default ${route}`, async ({ page }) => {
    await page.goto(route + "?preview=sample");
    await page.locator("main:visible").first().waitFor();
    await expect(page.getByText("Sample data", { exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await checkAccessibility(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (route === "/cash" && page.viewportSize().width >= 768) {
      const heights = await page
        .locator("tbody tr")
        .evaluateAll((rows) =>
          rows.map((row) => row.getBoundingClientRect().height),
        );
      expect(heights.every((height) => height <= 72)).toBe(true);
    }
    const values = page.locator("main .private-value:visible");
    const before = await values.evaluateAll((nodes) =>
      nodes.slice(0, 6).map((n) => ({
        w: n.getBoundingClientRect().width,
        h: n.getBoundingClientRect().height,
      })),
    );
    await page
      .getByRole("button", { name: "Hide balances", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Show balances", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    const after = await values.evaluateAll((nodes) =>
      nodes.slice(0, 6).map((n) => ({
        w: n.getBoundingClientRect().width,
        h: n.getBoundingClientRect().height,
      })),
    );
    expect(after).toHaveLength(before.length);
    after.forEach((size, i) => {
      expect(Math.abs(size.w - before[i].w)).toBeLessThan(0.1);
      expect(Math.abs(size.h - before[i].h)).toBeLessThan(0.1);
    });
    await checkAccessibility(page);
  });
}
for (const route of routes) {
  test(`accessible states and keyboard popover ${route}`, async ({ page }) => {
    for (const state of ["loading", "empty", "error"]) {
      await page.goto(`${route}?preview=${state}`);
      await page.locator("main:visible").first().waitFor();
      await checkAccessibility(page);
    }
    await page.goto(`${route}?preview=sample`);
    const trigger = page
      .locator("details summary")
      .filter({ visible: true })
      .first();
    if (await trigger.count()) {
      await trigger.focus();
      await trigger.press("Enter");
      await expect(trigger.locator("..")).toHaveAttribute("open", "");
      await checkAccessibility(page);
    }
  });
}
test("holdings sorting controls support every metric", async ({ page }) => {
  await page.goto("/holdings?preview=sample");
  for (const key of ["quantity", "averageCost", "price", "return", "value"]) {
    await page.getByLabel("Sort positions", { exact: true }).selectOption(key);
    await expect(page.locator("table caption").first()).toContainText(
      `Sorted by ${key}, descending`,
    );
    await page
      .getByRole("button", {
        name: "Sort direction: Highest to lowest",
        exact: true,
      })
      .click();
    await expect(page.locator("table caption").first()).toContainText(
      `Sorted by ${key}, ascending`,
    );
  }
});
test("refresh cooldown blocks repeat attempts and expires", async ({
  page,
}) => {
  await page.goto("/?preview=sample");
  await page.clock.install();
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  const cooldown = page.getByRole("button", {
    name: "Refresh available shortly",
    exact: true,
  });
  await expect(cooldown).toBeDisabled();
  // Repeat attempts remain disabled after the first refresh finishes.
  await expect(cooldown).toBeDisabled();
  await page.clock.fastForward(30_001);
  await expect(
    page.getByRole("button", { name: "Refresh", exact: true }),
  ).toBeEnabled();
});

test("allocation rows and profit components keep their geometry", async ({
  page,
}) => {
  await page.goto("/holdings?preview=sample");
  await page.waitForLoadState("networkidle");
  const rows = page.locator('[class*="allocationLine"]');
  expect(await rows.count()).toBeGreaterThan(0);
  expect(
    await rows.evaluateAll((nodes) =>
      nodes.every((n) => {
        const parts = [...n.children].map((c) => c.getBoundingClientRect());
        return (
          parts.length === 4 &&
          parts.every(
            (p) =>
              Math.abs(
                p.y + p.height / 2 - (parts[0].y + parts[0].height / 2),
              ) < 2,
          )
        );
      }),
    ),
  ).toBe(true);
  const expand = page
    .getByRole("button", { name: /^Position details for/ })
    .first();
  await expand.click();
  await expect(expand).toHaveAttribute("aria-expanded", "true");
  await checkAccessibility(page);
  await page.goto("/returns?preview=sample");
  await page.waitForLoadState("networkidle");
  const bar = page.locator('[class*="breakdown"] [class*="profitBar"]');
  expect(
    await bar.evaluate((n) => Math.round(n.getBoundingClientRect().height)),
  ).toBe(12);
  const eta = page
    .getByText("ETA", { exact: true })
    .locator("xpath=ancestor::tr");
  expect(
    await eta.evaluate((n) => n.getBoundingClientRect().height),
  ).toBeLessThan(page.viewportSize().width < 768 ? 200 : 90);
  await checkAccessibility(page);
});

test("options journal, filters and hidden chart preserve financial privacy", async ({
  page,
}) => {
  await page.goto("/options-analytics?preview=sample");
  await expect(page.getByText("Sample data", { exact: true })).toBeVisible();
  const inspect = page.getByLabel("Inspect options realization date", {
    exact: true,
  });
  await inspect.selectOption("2026-08-10");
  await expect(page.locator('[class*="inspection"]')).toContainText(
    "2026-08-10",
  );
  const row = page.getByRole("button", {
    name: /^(View|Close) trade details for ALPHA/,
  });
  await row.click();
  await expect(row).toHaveAttribute("aria-expanded", "true");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize().width);
  await expect(
    page.getByText("Execution evidence", { exact: true }),
  ).toBeVisible();
  await checkAccessibility(page);
  await page
    .getByRole("button", { name: "Hide balances", exact: true })
    .click();
  await expect(
    page.getByLabel("Realized P&L chart hidden", { exact: true }),
  ).toBeVisible();
  expect(await page.locator('main [class*="lineChart"]').count()).toBe(0);
  const money = await page.locator("main .private-value").allTextContents();
  expect(money.every((value) => /^[•]+$/.test(value.trim()))).toBe(true);
  await page
    .getByRole("button", { name: "Show balances", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Filter options by ALPHA", exact: true })
    .click();
  await expect(page.getByLabel("Underlying", { exact: true })).toHaveValue(
    "ALPHA",
  );
  await checkAccessibility(page);
  await page.getByLabel("From", { exact: true }).fill("2026-10-01");
  await expect(
    page.getByText("No option trades match these filters.", { exact: false }),
  ).toBeVisible();
});

test("holding returns explains how to recover missing evidence with keyboard-accessible reasons", async ({
  page,
}) => {
  await page.goto("/returns?preview=unranked");
  await page.waitForLoadState("networkidle");
  const reason = page
    .locator("summary")
    .filter({ hasText: "No purchase basis" })
    .first();
  await reason.focus();
  await reason.press("Enter");
  const panel = reason.locator("..").getByRole("note");
  await expect(panel).toContainText("Next step:");
  await expect(panel).toContainText("earlier purchase or transfer-in cost");
  await checkAccessibility(page);
  await reason.press("Escape");
  await expect(reason.locator("..")).not.toHaveAttribute("open", "");
  await expect(reason).toBeFocused();
});
