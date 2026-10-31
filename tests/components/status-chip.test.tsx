import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { StatusChip } from "@/components/shared/StatusChip";

it.each(["", "not-a-date"])(
  "handles an unavailable update timestamp (%s)",
  (updatedAt) => {
    const html = renderToStaticMarkup(<StatusChip updatedAt={updatedAt} />);
    expect(html).toContain("Read-only");
    expect(html).toContain("Update time unavailable");
    expect(html).not.toContain("Invalid Date");
  },
);

it("formats a supplied timestamp in Toronto time", () => {
  const html = renderToStaticMarkup(
    <StatusChip updatedAt="2026-10-31T18:55:00Z" />,
  );
  expect(html).toMatch(/Updated 2:55.*ET/);
});
