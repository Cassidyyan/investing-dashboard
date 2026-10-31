import { execFileSync } from "node:child_process";
import { mkdirSync, openSync, closeSync, unlinkSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
const privatePath = (path) =>
  /(?:^|\/)(?:\.git|private-data|screenshots|\.next|node_modules|releases|local-audits|test-results|playwright-report)(?:\/|$)/.test(
    path,
  ) ||
  /screenshots-tool\/\.(?:auth|artifacts)(?:\/|$)/.test(path) ||
  /\.(?:csv|sqlite3?|db|log|pem|key)$/i.test(path) ||
  (/(?:^|\/)\.env[^/]*$/.test(path) && path !== ".env.example");

/** @param {{ repo: string, output?: string, review?: boolean }} options */
export function exportSource({ repo, output, review = false }) {
  repo = resolve(repo);
  const git = (...args) =>
    execFileSync("git", ["-C", repo, ...args], { maxBuffer: 32 * 1024 * 1024 });
  if (git("status", "--porcelain", "--untracked-files=all").length)
    throw new Error(
      "Commit or remove nonignored pending changes before exporting. The archive must match the reviewed commit.",
    );
  const entries = git("ls-tree", "-rz", "HEAD")
    .toString()
    .split("\0")
    .filter(Boolean);
  for (const entry of entries) {
    const split = entry.indexOf("\t"),
      metadata = entry.slice(0, split).split(" "),
      path = entry.slice(split + 1);
    if (
      metadata[1] !== "blob" ||
      !["100644", "100755"].includes(metadata[0]) ||
      privatePath(path)
    )
      throw new Error(
        "The committed tree contains a private/generated path, symlink or submodule. Inspect it privately before exporting.",
      );
  }
  if (
    !review &&
    !entries.some((entry) => entry.slice(entry.indexOf("\t") + 1) === "LICENSE")
  )
    throw new Error(
      "Project license approval is still required. Use --review only for a private review snapshot.",
    );
  const commit = git("rev-parse", "--short=12", "HEAD").toString().trim();
  const archive = resolve(
    output ||
      resolve(
        repo,
        "releases",
        `holdings-${review ? "review" : "source"}-${commit}-${Date.now()}.tar.gz`,
      ),
  );
  const destination = relative(repo, archive).split(sep).join("/");
  if (
    !isAbsolute(destination) &&
    destination !== ".." &&
    !destination.startsWith("../") &&
    !destination.startsWith("releases/")
  )
    throw new Error(
      "Write archives outside the checkout or inside the ignored releases directory.",
    );
  mkdirSync(dirname(archive), { recursive: true });
  const fd = openSync(archive, "wx", 0o600);
  try {
    execFileSync(
      "git",
      ["-C", repo, "archive", "--format=tar.gz", "--prefix=holdings/", "HEAD"],
      { stdio: ["ignore", fd, "pipe"] },
    );
  } catch {
    closeSync(fd);
    unlinkSync(archive);
    throw new Error(
      "Source archive could not be created. No existing archive was overwritten.",
    );
  }
  closeSync(fd);
  return {
    archive,
    commit,
    files: entries.length,
    reviewOnly: review,
    includesGitHistory: false,
  };
}
