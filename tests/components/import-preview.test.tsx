import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ImportPreview } from "@/components/options-analytics/ImportPreview";
import { createImportPreview } from "@/dev/previews/wealthsimple-import-preview";
import { BalancePrivacyProvider } from "@/components/shared/BalancePrivacy";
it("shows only 25 preview rows with source provenance and blocks implied performance eligibility", () => {
  const html = renderToStaticMarkup(
    <ImportPreview data={createImportPreview()} />,
  );
  expect(html).toContain("Not applied to returns");
  expect(html).toContain("27 option rows");
  expect(html).toContain("Opening/closing direction is not supplied");
  expect(html).toContain("CSV account 1");
  expect(html).toContain("Next CSV page");
  expect(html.match(/<tr>/g)).toHaveLength(26);
});
it("hides imported monetary values and quantities using the shared privacy control", () => {
  const html = renderToStaticMarkup(
    <BalancePrivacyProvider initialHidden>
      <ImportPreview data={createImportPreview()} />
    </BalancePrivacyProvider>,
  );
  expect(html).toContain("Amount hidden");
  expect(html.replaceAll("\u00a0", " ")).not.toContain("USD 100.00");
  expect(html).toContain("CSV account 1");
});
