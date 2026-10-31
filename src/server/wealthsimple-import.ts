import "server-only";
import { getConfig } from "./config";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { ActivityImportPreview } from "@/lib/imports/wealthsimple-activity";
import {
  createWealthsimpleDataset,
  type WealthsimpleDataset,
} from "./wealthsimple-dataset";
export { createWealthsimpleDataset } from "./wealthsimple-dataset";

export async function loadWealthsimpleDataset(
  directory = join(process.cwd(), "private-data", "wealthsimple"),
): Promise<WealthsimpleDataset | null> {
  if (getConfig().settings.demo) return null;
  // Runtime-only private exports must never become deployment trace assets.
  let entries;
  try {
    entries = await readdir(/* turbopackIgnore: true */ directory, {
      withFileTypes: true,
    });
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
  const inputs: ({ text: string } | { warning: string })[] = [];
  for (const [index, entry] of files.slice(0, 20).entries()) {
    try {
      const path = join(/* turbopackIgnore: true */ directory, entry.name);
      if ((await stat(/* turbopackIgnore: true */ path)).size > 10_000_000) {
        inputs.push({
          warning: `Export ${index + 1}: file exceeds the 10 MB limit.`,
        });
        continue;
      }
      inputs.push({
        text: await readFile(/* turbopackIgnore: true */ path, "utf8"),
      });
    } catch {
      inputs.push({ warning: `Export ${index + 1}: file could not be read.` });
    }
  }
  const dataset = createWealthsimpleDataset(inputs);
  if (files.length > 20)
    dataset.preview.warnings.push(
      "More than 20 files found; excess files were not read.",
    );
  return dataset;
}

export async function loadWealthsimplePreview(
  directory?: string,
): Promise<ActivityImportPreview | null> {
  return (await loadWealthsimpleDataset(directory))?.preview || null;
}
