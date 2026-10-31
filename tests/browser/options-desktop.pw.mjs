import { test, expect } from "@playwright/test";

test.describe("Phase 2 desktop completion", () => {
  test.skip(
    ({ viewport }) => viewport.width < 1024,
    "Desktop is the current product priority.",
  );

  test.beforeEach(async ({ page }) => {
    await page.goto("/options-analytics?preview=sample");
    await expect(page.getByText("Sample data", { exact: true })).toBeVisible();
    await page.waitForLoadState("networkidle");
  });

  test("chart hover inspects actual dated P&L and hidden data stays masked", async ({
    page,
  }) => {
    const chart = page.getByRole("img", { name: /^Cumulative realized P&L;/ });
    await chart.scrollIntoViewIfNeeded();
    const dots = chart.locator("circle");
    for (const [dot, date, amount] of [
      [dots.first(), "2026-08-10", /USD\s*140\.00/],
      [dots.last(), "2026-10-12", /USD\s*470\.00/],
    ]) {
      const box = await dot.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      const inspection = page.locator('[class*="inspection"]');
      await expect(inspection).toContainText(date);
      await expect(inspection).toContainText(amount);
    }
    await page.getByText("View realized P&L data", { exact: true }).click();
    await page
      .getByRole("button", { name: "Hide balances", exact: true })
      .click();
    await expect(
      page.getByLabel("Realized P&L chart hidden", { exact: true }),
    ).toBeVisible();
    expect(
      await page
        .locator("main .private-value")
        .evaluateAll((nodes) =>
          nodes.every((node) => /^[•]+$/.test(node.textContent.trim())),
        ),
    ).toBe(true);
  });

  test("USD-only currency policy, contract and date filters preserve their scopes", async ({
    page,
  }) => {
    const total = page.locator('section[aria-label="Net realized P&L"]');
    await expect(total).toContainText(/USD\s*470\.00/);
    await expect(
      page.getByRole("button", { name: "CAD", exact: true }),
    ).toHaveCount(0);
    const assumption = page.getByLabel("Options currency: USD Assumed", {
      exact: true,
    });
    if (await assumption.count()) await expect(assumption).toContainText("USD");
    else
      await expect(
        page.getByRole("combobox", { name: "Currency", exact: true }),
      ).toHaveValue("USD");
    await page.getByLabel("Underlying", { exact: true }).selectOption("MAPLE");
    await page
      .getByRole("combobox", { name: /^Contract/ })
      .selectOption("CALL");
    await expect(total).toContainText("Unavailable");
    await page.getByRole("combobox", { name: /^Contract/ }).selectOption("PUT");
    await page.getByLabel("From", { exact: true }).fill("2026-10-01");
    await page.getByLabel("Through", { exact: true }).fill("2026-10-31");
    await expect(total).toContainText(/USD\s*60\.00/);

    await page
      .getByRole("button", { name: "Reset filters", exact: true })
      .click();
    await expect(total).toContainText(/USD\s*470\.00/);
  });

  test("journal sorting keeps missing P&L last and incomplete trades unclassified", async ({
    page,
  }) => {
    const journal = page.locator('section[aria-label="Options trade journal"]');
    await journal
      .getByLabel("Sort option trades", { exact: true })
      .selectOption("pnl");
    const rows = journal.locator("tbody > tr");
    await expect(rows.first()).toContainText("ALPHA");
    await expect(rows.last()).toContainText("OMEGA");
    await journal
      .getByRole("button", {
        name: "Sort direction: Highest to lowest",
        exact: true,
      })
      .click();
    await expect(rows.first()).toContainText("BETA");
    await expect(rows.last()).toContainText("OMEGA");
    await journal
      .getByRole("searchbox", { name: "Search trades" })
      .fill("OMEGA");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("Needs review");
    await expect(rows.first()).toContainText("Outcome unclassified");
    await expect(rows.first()).toContainText("Unavailable");
    await journal
      .getByRole("button", { name: /^View trade details for OMEGA/ })
      .click();
    await expect(journal).toContainText(
      "Missing, invalid or negative fees; no zero fee is assumed.",
    );
  });

  test("history disclosure distinguishes available API pages from lifetime completeness", async ({
    page,
  }) => {
    const summary = page.getByText("Transaction history coverage · 1 account", {
      exact: true,
    });
    await summary.focus();
    await summary.press("Enter");
    const disclosure = summary.locator("..");
    await expect(disclosure).toHaveAttribute("open", "");
    await expect(disclosure).toContainText("Complete available pages");
    await expect(disclosure).toContainText(
      "Brokerage lifetime coverage remains unverified",
    );
    await expect(disclosure).not.toContainText("100%");
    await disclosure
      .getByText("Source field availability", { exact: true })
      .click();
    await expect(disclosure).toContainText(/Trade fee:\s*1 missing/);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(page.viewportSize().width);
  });
});

test("local CSV preview filters and pages independently without changing realized metrics", async ({
  page,
}) => {
  await page.goto("/options-analytics?preview=sample");
  await page.waitForLoadState("networkidle");
  const preview = page.getByRole("region", {
    name: "Wealthsimple CSV preview",
    exact: true,
  });
  const pnl = page.getByRole("region", {
    name: "Net realized P&L",
    exact: true,
  });
  await expect(pnl).toContainText(/USD\s*470\.00/);
  const open = preview
    .locator("summary")
    .filter({ hasText: "Review imported options activity" });
  await open.focus();
  await open.press("Enter");
  await expect(preview.locator("tbody tr")).toHaveCount(25);
  await preview
    .getByRole("button", { name: "Next CSV page", exact: true })
    .click();
  await expect(preview.locator("tbody tr")).toHaveCount(2);
  await preview
    .getByLabel("CSV source account", { exact: true })
    .selectOption("CSV account 2");
  await expect(preview.locator("tbody tr")).toHaveCount(13);
  await expect(pnl).toContainText(/USD\s*470\.00/);
  await page
    .getByRole("button", { name: "Hide balances", exact: true })
    .click();
  expect(
    await preview
      .locator(".private-value")
      .evaluateAll((nodes) =>
        nodes.every((n) => /^[•]+$/.test(n.textContent.trim())),
      ),
  ).toBe(true);
  await preview
    .getByLabel("Search CSV contracts", { exact: true })
    .fill("not-a-contract");
  await expect(
    preview.getByText("No imported options match this selection.", {
      exact: false,
    }),
  ).toBeVisible();
});

test("CSV-reconciled options show real computed fixture metrics and active source labels", async ({
  page,
}) => {
  await page.goto("/options-analytics?preview=csv");
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Sample data", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Net realized P&L", exact: true }),
  ).toContainText(/USD\s*57\.00/);
  await expect(
    page.getByText("Source for CSV-based trade estimates", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "CSV reconciliation results" }),
  ).toContainText("Options trade history uses the CSV");
  await expect(
    page.getByText("Not applied to returns", { exact: true }),
  ).toHaveCount(0);
  const preview = page.getByRole("region", {
    name: "Wealthsimple CSV preview",
    exact: true,
  });
  await preview
    .locator("summary")
    .filter({ hasText: "Review imported options activity" })
    .click();
  await expect(preview.locator("tbody tr")).toHaveCount(2);
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  const result = await new AxeBuilder({ page }).analyze();
  expect(
    result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      count: v.nodes.length,
    })),
  ).toEqual([]);
  await page
    .getByRole("button", { name: "Hide balances", exact: true })
    .click();
  expect(
    await page
      .locator("main .private-value")
      .evaluateAll((nodes) =>
        nodes.every((n) => /^[•]+$/.test(n.textContent.trim())),
      ),
  ).toBe(true);
});
