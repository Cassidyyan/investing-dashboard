import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const csv = [
  "effective_date,effective_time,account_id,activity_type,activity_sub_type,symbol,currency,quantity,unit_price,commission,net_cash_amount,direction",
  "2026-09-01,10:00:00,SYNTHETIC_UPLOAD,Trade,SELL,SYNTH261218C00100000,USD,-1,1,2,98,SHORT",
  "2026-09-02,10:00:00,SYNTHETIC_UPLOAD,Trade,BUY,SYNTH261218C00100000,USD,1,0.4,1,-41,SHORT",
].join("\n");
test.describe("Temporary CSV-first options uploads", () => {
  test.skip(
    ({ viewport }) => viewport.width < 1024,
    "Desktop is the current priority.",
  );
  test.beforeEach(async ({ page }) => {
    await page.goto("/options-analytics?preview=sample");
    await expect(page.getByText("Sample data", { exact: true })).toBeVisible();
    await page.waitForLoadState("networkidle");
  });
  test("file picker applies the CSV ledger, resets filters, and honors balance privacy", async ({
    page,
  }) => {
    await page.getByLabel("Underlying", { exact: true }).selectOption("MAPLE");
    await page.getByLabel("Wealthsimple activity CSV files").setInputFiles({
      name: "synthetic.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
    await expect(
      page.getByRole("status").filter({ hasText: "CSV applied" }),
    ).toBeVisible();
    await expect(page.getByLabel("CSV primary source")).toBeVisible();
    await expect(page.getByLabel("Underlying", { exact: true })).toHaveValue(
      "all",
    );
    await expect(
      page.locator('section[aria-label="Net realized P&L"]'),
    ).toContainText(/USD\s*57\.00/);
    await expect(page.getByText("Sample data", { exact: true })).toHaveCount(0);
    await page
      .getByRole("button", { name: "Hide balances", exact: true })
      .click();
    await expect(
      page.locator('section[aria-label="Net realized P&L"]'),
    ).not.toContainText("57.00");
    await expect(
      page.getByLabel("Realized P&L chart hidden", { exact: true }),
    ).toBeVisible();
  });
  test("drag and drop accepts CSVs; errors keep the prior import; remove restores the original", async ({
    page,
  }) => {
    const data = await page.evaluateHandle((text) => {
      const transfer = new DataTransfer();
      transfer.items.add(
        new File([text], "synthetic.csv", { type: "text/csv" }),
      );
      return transfer;
    }, csv);
    await page
      .getByLabel("Wealthsimple CSV drop area")
      .dispatchEvent("drop", { dataTransfer: data });
    const total = page.locator('section[aria-label="Net realized P&L"]');
    await expect(total).toContainText(/USD\s*57\.00/);
    await page.getByLabel("Wealthsimple activity CSV files").setInputFiles({
      name: "unsupported.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("symbol,profit\nSYNTH,1"),
    });
    await expect(
      page
        .getByRole("region", {
          name: "Import Wealthsimple activity",
          exact: true,
        })
        .getByRole("alert"),
    ).toContainText("Import not applied");
    await expect(total).toContainText(/USD\s*57\.00/);
    await page.getByRole("button", { name: "Remove uploaded CSV" }).click();
    await expect(total).toContainText(/USD\s*470\.00/);
    await expect(page.getByText("Sample data", { exact: true })).toBeVisible();
    await page.waitForLoadState("networkidle");
  });
  test("upload controls support keyboard activation and imported view passes axe", async ({
    page,
  }) => {
    const choose = page.getByRole("button", { name: "Choose CSV files" });
    await choose.focus();
    const picker = page.waitForEvent("filechooser");
    await choose.press("Enter");
    await (
      await picker
    ).setFiles({
      name: "synthetic.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
    await expect(page.getByLabel("CSV primary source")).toBeVisible();
    await page
      .getByText("Review imported options activity", { exact: true })
      .click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  });
});
