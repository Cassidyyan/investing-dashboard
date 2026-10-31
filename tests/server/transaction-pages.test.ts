import { expect, it, vi } from "vitest";
import { transactionRecords } from "@/server/transaction-pages";
import type { ReadClient } from "@/server/snaptrade";
async function collect(pages: unknown[]) {
  const request = vi.fn();
  pages.forEach((page) => request.mockResolvedValueOnce({ data: page }));
  const rows = [];
  for await (const row of transactionRecords("a", {
    transactionPage: request,
  } as unknown as Pick<ReadClient, "transactionPage">))
    rows.push(row);
  return { rows, request };
}
it.each([-1, 1.5, "bad", NaN])(
  "rejects invalid pagination total %s",
  async (total) => {
    await expect(
      collect([{ data: [{ id: "one" }], pagination: { total } }]),
    ).rejects.toMatchObject({ code: "invalid_total" });
  },
);
it("rejects changing totals and records from another account", async () => {
  await expect(
    collect([
      {
        data: Array.from({ length: 1000 }, (_, i) => ({ id: String(i) })),
        pagination: { total: 1001 },
      },
      { data: [{ id: "last" }], pagination: { total: 1002 } },
    ]),
  ).rejects.toMatchObject({ code: "total_changed" });
  await expect(
    collect([
      { data: [{ id: "one", account: { id: "b" } }], pagination: { total: 1 } },
    ]),
  ).rejects.toMatchObject({ code: "account_scope_mismatch" });
});
it("rejects too-small totals, duplicate IDs and missing arrays", async () => {
  await expect(
    collect([{ data: [{ id: "one" }], pagination: { total: 0 } }]),
  ).rejects.toMatchObject({ code: "total_smaller_than_records" });
  await expect(
    collect([
      { data: [{ id: "one" }, { id: "one" }], pagination: { total: 2 } },
    ]),
  ).rejects.toMatchObject({ code: "repeated_id" });
  await expect(collect([{}])).rejects.toMatchObject({
    code: "missing_page_records",
  });
});
it("accepts an explicit empty page and preserves the existing request shape", async () => {
  const { rows, request } = await collect([
    { data: [], pagination: { total: 0 } },
  ]);
  expect(rows).toEqual([]);
  expect(request).toHaveBeenCalledExactlyOnceWith("a", 0, 1000);
});
it("uses requested account scope when optional account metadata is absent", async () => {
  const { rows } = await collect([
    {
      data: [{ id: "one", account: {} }, { id: "two" }],
      pagination: { total: 2 },
    },
  ]);
  expect(rows).toHaveLength(2);
});
it("does not count whitespace variants of the same transaction identity twice", async () => {
  await expect(
    collect([
      { data: [{ id: "one" }, { id: " one " }], pagination: { total: 2 } },
    ]),
  ).rejects.toMatchObject({ code: "repeated_id" });
});
