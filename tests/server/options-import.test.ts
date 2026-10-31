import { expect, it, vi } from "vitest";
import { POST } from "@/app/api/options-import/route";
import { optionsCsv, optionsCsvHeader } from "../helpers/options-csv";

function request(texts = [optionsCsv], origin = "http://localhost:3000") {
  const form = new FormData();
  texts.forEach((text) =>
    form.append(
      "files",
      new File([text], "PRIVATE-owner.csv", { type: "text/csv" }),
    ),
  );
  return new Request("http://localhost:3000/api/options-import", {
    method: "POST",
    headers: { origin },
    body: form,
  });
}
it("processes CSV-first history without credentials, exposing aliases rather than filenames or source IDs", async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const { data } = await response.json();
  expect(data.historySource).toBe("csv");
  expect(data.trades).toHaveLength(1);
  expect(data.trades[0]).toMatchObject({
    status: "closed",
    realizedPnl: "57",
    fees: "3",
  });
  expect(data.accounts[0].name).toBe("CSV account 1");
  expect(JSON.stringify(data)).not.toMatch(
    /PRIVATE_SYNTHETIC_UPLOAD|PRIVATE-owner/,
  );
});
it("rejects cross-site uploads and non-multipart requests", async () => {
  expect(
    (await POST(request([optionsCsv], "https://elsewhere.invalid"))).status,
  ).toBe(403);
  expect(
    (
      await POST(
        new Request("http://localhost:3000/api/options-import", {
          method: "POST",
          headers: { origin: "http://localhost:3000" },
        }),
      )
    ).status,
  ).toBe(415);
});
it("accepts the browser Host when Next uses an internal localhost URL, without allowing another host", async () => {
  const local = request([optionsCsv], "http://127.0.0.1:3000");
  local.headers.set("host", "127.0.0.1:3000");
  expect((await POST(local)).status).toBe(200);
  const crossSite = request([optionsCsv], "http://different.invalid:3000");
  crossSite.headers.set("host", "127.0.0.1:3000");
  expect((await POST(crossSite)).status).toBe(403);
});
it("rejects an entire mixed batch rather than replacing the view with a partial import", async () => {
  const response = await POST(
    request([optionsCsv, "PRIVATE_UNSUPPORTED_CONTENT"]),
  );
  expect(response.status).toBe(422);
  expect(await response.text()).not.toMatch(/PRIVATE|data":/);
});
it("deduplicates identical files but preserves ambiguous repeated fills for review", async () => {
  const duplicateFiles = await (
    await POST(request([optionsCsv, optionsCsv]))
  ).json();
  expect(duplicateFiles.data.trades[0].realizedPnl).toBe("57");
  const repeatedRows = await (
    await POST(request([optionsCsv + "\n" + optionsCsv.split("\n")[1]]))
  ).json();
  expect(repeatedRows.data.importPreview.possibleDuplicates).toBe(2);
  expect(
    repeatedRows.data.trades.every(
      (t: { realizedPnl: unknown }) => t.realizedPnl === null,
    ),
  ).toBe(true);
});
it("rejects gain/loss schemas, stock-only exports, missing source accounts and missing dates", async () => {
  for (const text of [
    "symbol,profit\nSYNTH,1",
    optionsCsv.replaceAll("SYNTH261218C00100000", "SYNTH"),
    optionsCsv.replaceAll("PRIVATE_SYNTHETIC_UPLOAD", ""),
    optionsCsv.replaceAll(/2026-09-0[12]/g, "invalid"),
  ])
    expect((await POST(request([text]))).status).toBe(422);
});
it("enforces file-count, row and streaming byte limits", async () => {
  expect((await POST(request(Array(21).fill(optionsCsv)))).status).toBe(422);
  const row = optionsCsv.split("\n")[1];
  expect(
    (
      await POST(
        request([optionsCsvHeader + "\n" + Array(20_001).fill(row).join("\n")]),
      )
    ).status,
  ).toBe(422);
  const large = new Request("http://localhost:3000/api/options-import", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "content-type": "multipart/form-data; boundary=test",
    },
    body: new Uint8Array(10_065_537),
  });
  expect((await POST(large)).status).toBe(413);
});
it("does not retain imports for the next request or mix different uploads", async () => {
  await POST(request());
  const second = await (
    await POST(
      request([
        optionsCsv.replaceAll("SYNTH261218C00100000", "OTHER261218C00100000"),
      ]),
    )
  ).json();
  expect(second.data.trades).toHaveLength(1);
  expect(second.data.trades[0].ticker).toBe("OTHER");
  expect(JSON.stringify(second.data)).not.toContain('"ticker":"SYNTH"');
});

it("uses an uploaded export's native currency in reported mode without FX or USD relabelling", async () => {
  vi.stubEnv("HOLDINGS_OPTIONS_CURRENCY", "reported");
  try {
    const response = await POST(
      request([optionsCsv.replaceAll(",USD,", ",EUR,")]),
    );
    const { data } = await response.json();
    expect(data.trades[0]).toMatchObject({
      currency: "EUR",
      realizedPnl: "57",
    });
  } finally {
    vi.unstubAllEnvs();
  }
});
