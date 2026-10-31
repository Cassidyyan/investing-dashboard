import { afterEach, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { exportSource } from "../../scripts/lib/source-export.mjs";
const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0))
    rmSync(folder, { recursive: true, force: true });
});
function fixture(licensed = true) {
  const repo = mkdtempSync(join(tmpdir(), "synthetic-export-"));
  folders.push(repo);
  const git = (...args: string[]) =>
    execFileSync(
      "git",
      [
        "-c",
        "commit.gpgsign=false",
        "-c",
        `core.hooksPath=${join(repo, ".disabled-hooks")}`,
        "-C",
        repo,
        ...args,
      ],
      { stdio: "pipe" },
    );
  git("init", "--quiet");
  writeFileSync(join(repo, "README.md"), "Synthetic fixture only.");
  writeFileSync(join(repo, ".gitignore"), ".env.local\n*.csv\nreleases/\n");
  writeFileSync(
    join(repo, ".env.example"),
    "SNAPTRADE_CLIENT_ID=\nSNAPTRADE_CONSUMER_KEY=\n",
  );
  writeFileSync(
    join(repo, ".env.local"),
    "PRIVATE_SYNTHETIC_VALUE_MUST_NOT_EXPORT",
  );
  writeFileSync(
    join(repo, "financial.csv"),
    "PRIVATE_SYNTHETIC_EXPORT_MUST_NOT_EXPORT",
  );
  if (licensed)
    writeFileSync(
      join(repo, "LICENSE"),
      "License text for this synthetic fixture only.",
    );
  const commit = () => {
    git("add", "--all");
    git(
      "-c",
      "user.name=Synthetic Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "--quiet",
      "-m",
      "Synthetic source fixture",
    );
  };
  commit();
  return { repo, git, commit };
}
it("exports committed source without Git history, ignored credentials or financial exports", () => {
  const { repo } = fixture();
  const result = exportSource({ repo });
  const tar = gunzipSync(readFileSync(result.archive)).toString();
  expect(tar).toContain("holdings/README.md");
  expect(tar).toContain("holdings/.env.example");
  expect(tar).not.toMatch(/PRIVATE_SYNTHETIC|holdings\/\.git\//);
  expect(result.includesGitHistory).toBe(false);
});
it("requires a project license except for an explicitly private review snapshot", () => {
  const { repo } = fixture(false);
  expect(() => exportSource({ repo })).toThrow("license approval");
  expect(exportSource({ repo, review: true }).reviewOnly).toBe(true);
});
it("blocks dirty trees instead of silently archiving an older unreviewed revision", () => {
  const { repo } = fixture();
  writeFileSync(join(repo, "README.md"), "Pending changes");
  expect(() => exportSource({ repo })).toThrow("pending changes");
});
it("rejects private files even if force-added to a clean commit", () => {
  const { repo, git, commit } = fixture();
  git("add", "--force", "financial.csv");
  commit();
  expect(() => exportSource({ repo })).toThrow("private/generated");
});
it("rejects tracked symlinks", () => {
  const { repo, commit } = fixture();
  symlinkSync(".env.local", join(repo, "leak"));
  commit();
  expect(() => exportSource({ repo })).toThrow("symlink");
});
it("never overwrites existing output and keeps archives out of source directories", () => {
  const { repo } = fixture();
  const first = exportSource({ repo });
  expect(() => exportSource({ repo, output: first.archive })).toThrow();
  expect(() =>
    exportSource({ repo, output: join(repo, "source.tar.gz") }),
  ).toThrow("ignored releases");
});
