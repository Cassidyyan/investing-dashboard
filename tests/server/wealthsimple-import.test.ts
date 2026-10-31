import { afterEach, expect, it } from "vitest";
import { mkdtemp, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadWealthsimplePreview } from "@/server/wealthsimple-import";
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((d) => rm(d, { recursive: true, force: true })),
  );
});
const csv =
  "effective_date,account_id,activity_type,activity_sub_type,symbol,currency,quantity,unit_price,commission,net_cash_amount\n2026-10-01,PRIVATE_SYNTHETIC_ID,Trade,BUY,SYNTH261218C00100000,USD,1,1,0,-100";
async function folder() {
  const d = await mkdtemp(join(tmpdir(), "synthetic-import-"));
  directories.push(d);
  return d;
}
it("returns no preview when the optional local folder is absent", async () => {
  expect(
    await loadWealthsimplePreview(join(await folder(), "absent")),
  ).toBeNull();
});
it("uses aliases instead of raw identifiers/filenames, skips file copies and flags repeated fills without dropping them", async () => {
  const d = await folder();
  await writeFile(
    join(d, "private-owner.csv"),
    `${csv}\n${csv.split("\n")[1]}`,
  );
  await writeFile(join(d, "copy.csv"), `${csv}\n${csv.split("\n")[1]}`);
  await symlink(join(d, "copy.csv"), join(d, "linked.csv"));
  const preview = (await loadWealthsimplePreview(d))!;
  expect(preview).toMatchObject({
    files: 1,
    records: 2,
    accounts: 1,
    possibleDuplicates: 2,
  });
  expect(preview.rows).toHaveLength(2);
  expect(preview.rows[0].account).toBe("CSV account 1");
  expect(preview.warnings[0]).toContain("identical file");
  expect(JSON.stringify(preview)).not.toMatch(
    /PRIVATE_SYNTHETIC_ID|private-owner|copy.csv|linked.csv/,
  );
});
it("reports unsupported schemas without including source contents or paths", async () => {
  const d = await folder();
  await writeFile(join(d, "private-name.csv"), "PRIVATE_CONTENT");
  const preview = await loadWealthsimplePreview(d);
  expect(preview?.rows).toEqual([]);
  expect(preview?.warnings).toHaveLength(1);
  expect(JSON.stringify(preview)).not.toMatch(
    /PRIVATE_CONTENT|private-name|synthetic-import-/,
  );
});
