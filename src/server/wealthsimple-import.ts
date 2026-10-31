import "server-only";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import {
  parseWealthsimpleActivity,
  type ActivityImportPreview,
  type CsvActivity,
} from "@/lib/imports/wealthsimple-activity";

export async function loadWealthsimpleDataset(
  directory = join(process.cwd(), "private-data", "wealthsimple"),
): Promise<{
  preview: ActivityImportPreview;
  activities: CsvActivity[];
} | null> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    return {
      activities: [],
      preview: {
        files: 0,
        records: 0,
        accounts: 0,
        earliest: null,
        latest: null,
        possibleDuplicates: 0,
        rows: [],
        warnings: ["Local import folder could not be read."],
      },
    };
  }
  const files = entries
    .filter((e) => e.isFile() && /\.csv$/i.test(e.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!files.length) return null;
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
  if (files.length > 20)
    result.warnings.push(
      "More than 20 files found; excess files were not read.",
    );
  for (const [index, entry] of files.slice(0, 20).entries()) {
    const source = `Export ${index + 1}`;
    try {
      const path = join(directory, entry.name);
      if ((await stat(path)).size > 10_000_000) {
        result.warnings.push(`${source}: file exceeds the 10 MB limit.`);
        continue;
      }
      const text = await readFile(path, "utf8");
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
  return { preview: result, activities };
}
export async function loadWealthsimplePreview(
  directory?: string,
): Promise<ActivityImportPreview | null> {
  return (await loadWealthsimpleDataset(directory))?.preview || null;
}
