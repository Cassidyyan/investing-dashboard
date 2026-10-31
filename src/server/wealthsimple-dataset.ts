import "server-only";
import { createHash } from "node:crypto";
import {
  parseWealthsimpleActivity,
  type ActivityImportPreview,
  type CsvActivity,
} from "@/lib/imports/wealthsimple-activity";

export type WealthsimpleDataset = {
  preview: ActivityImportPreview;
  activities: CsvActivity[];
  accountAliases?: Map<string, string>;
};

// Both disk imports and temporary browser uploads use the same limits and parser.
export function createWealthsimpleDataset(
  inputs: ({ text: string } | { warning: string })[],
): WealthsimpleDataset {
  const result: ActivityImportPreview = {
    files: 0,
    records: 0,
    accounts: 0,
    earliest: null,
    latest: null,
    possibleDuplicates: 0,
    rows: [],
    warnings: [],
  };
  const accounts = new Map<string, string>(),
    hashes = new Set<string>(),
    fingerprints = new Map<string, number>();
  const activities: CsvActivity[] = [];
  if (inputs.length > 20)
    result.warnings.push(
      "More than 20 files found; excess files were not read.",
    );
  for (const [index, input] of inputs.slice(0, 20).entries()) {
    const source = `Export ${index + 1}`;
    try {
      if ("warning" in input) {
        result.warnings.push(input.warning);
        continue;
      }
      const text = input.text;
      const hash = createHash("sha256").update(text).digest("hex");
      if (hashes.has(hash)) {
        result.warnings.push(
          `${source}: identical file already previewed; skipped.`,
        );
        continue;
      }
      const parsed = parseWealthsimpleActivity(text);
      if (result.records + parsed.records > 20_000) {
        result.warnings.push(
          `${source}: combined preview exceeds 20,000 activity rows; file not applied.`,
        );
        continue;
      }
      hashes.add(hash);
      result.files++;
      result.records += parsed.records;
      activities.push(...parsed.activities);
      for (const id of parsed.accounts)
        if (!accounts.has(id))
          accounts.set(id, `CSV account ${accounts.size + 1}`);
      if (
        parsed.earliest &&
        (!result.earliest || parsed.earliest < result.earliest)
      )
        result.earliest = parsed.earliest;
      if (parsed.latest && (!result.latest || parsed.latest > result.latest))
        result.latest = parsed.latest;
      if (parsed.rejected)
        result.warnings.push(
          `${source}: ${parsed.rejected} malformed rows excluded.`,
        );
      for (const { accountId, fingerprint, activity } of parsed.rows) {
        const previous = fingerprints.get(fingerprint);
        if (previous !== undefined)
          result.rows[previous].possibleDuplicate = true;
        fingerprints.set(fingerprint, result.rows.length);
        result.rows.push({
          ...activity,
          account: accounts.get(accountId) || "Unmapped account",
          source,
          id: createHash("sha256")
            .update(`${hash}:${activity.row}`)
            .digest("hex"),
          possibleDuplicate: previous !== undefined,
        });
      }
    } catch {
      result.warnings.push(
        `${source}: unsupported or unreadable CSV; source details were not logged.`,
      );
    }
  }
  result.accounts = accounts.size;
  result.possibleDuplicates = result.rows.filter(
    (r) => r.possibleDuplicate,
  ).length;
  result.rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return { preview: result, activities, accountAliases: accounts };
}
