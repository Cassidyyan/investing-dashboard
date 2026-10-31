// Read-only, redacted publication check. Never prints matching contents/values.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { parseEnv } from "node:util";
const git = (...args) =>
  execFileSync("git", args, { maxBuffer: 64 * 1024 * 1024 });
const findings = [];
const known = [];
for (const file of readdirSync(".").filter(
  (f) => /^\.env(?:\.|$)/.test(f) && f !== ".env.example",
)) {
  try {
    for (const [key, value] of Object.entries(
      parseEnv(readFileSync(file, "utf8")),
    ))
      if (/KEY|SECRET|TOKEN|SNAPTRADE/.test(key) && value.length >= 12)
        known.push(Buffer.from(value));
  } catch {
    findings.push({
      scope: "local",
      path: ".env files",
      reason: "Could not read local secret inventory; inspect privately.",
    });
  }
}
const patterns = [
  /gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|AKIA[A-Z0-9]{16}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /(?:consumerKey|SNAPTRADE_CONSUMER_KEY)\s*[:=]\s*["'][A-Za-z0-9_/-]{20,}["']/,
];
const privatePath = (path) =>
  /^(?:private-data|screenshots|\.next|node_modules)\//.test(path) ||
  /\.(?:csv|sqlite3?|db|log)$/i.test(path) ||
  (/(?:^|\/)\.env[^/]*$/.test(path) && path !== ".env.example") ||
  /screenshots-tool\/\.(?:auth|artifacts)\//.test(path);
function inspect(data, scope, path) {
  if (known.some((value) => data.includes(value)))
    findings.push({
      scope,
      path,
      reason: "Matches a configured local credential; rotate if exposed.",
    });
  if (patterns.some((pattern) => pattern.test(data.toString("utf8"))))
    findings.push({
      scope,
      path,
      reason: "Potential literal credential/token; inspect privately.",
    });
}
const files = [
  ...new Set(
    git("ls-files", "--cached", "--others", "--exclude-standard", "-z")
      .toString()
      .split("\0")
      .filter(Boolean),
  ),
];
for (const path of files) {
  if (privatePath(path))
    findings.push({
      scope: "worktree",
      path,
      reason: "Private/generated path is not excluded.",
    });
  if (existsSync(path)) inspect(readFileSync(path), "worktree", path);
}
let blobs = 0;
for (const entry of git("rev-list", "--objects", "--all")
  .toString()
  .trim()
  .split("\n")) {
  if (!entry) continue;
  const [oid, ...parts] = entry.split(" "),
    path = parts.join(" ");
  if (git("cat-file", "-t", oid).toString().trim() !== "blob") continue;
  blobs++;
  const location = `${oid.slice(0, 12)}:${path}`;
  if (privatePath(path))
    findings.push({
      scope: "history",
      path: location,
      reason: "Private/generated path exists in reachable Git history.",
    });
  inspect(git("cat-file", "blob", oid), "history", location);
}
function walk(directory, visit) {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path, visit);
    else if (entry.isFile()) visit(path);
  }
}
let bundles = 0;
walk(".next/static", (path) => {
  if (!path.endsWith(".js")) return;
  bundles++;
  const data = readFileSync(path);
  inspect(data, "browser-bundle", relative(".", path));
  if (/api\.snaptrade\.com|snapTrade\/registerUser/.test(data.toString()))
    findings.push({
      scope: "browser-bundle",
      path,
      reason: "Possible brokerage SDK/client code in browser bundle.",
    });
});
walk(".next/server", (path) => {
  if (!path.endsWith(".nft.json")) return;
  if (
    JSON.parse(readFileSync(path, "utf8")).files.some((file) =>
      /(?:^|\/)private-data\/|(?:^|\/)\.env(?:\.|$)|\.csv$/i.test(file),
    )
  )
    findings.push({
      scope: "deployment-trace",
      path,
      reason: "Private/generated file included in deployment trace.",
    });
});
console.log(
  JSON.stringify(
    {
      worktreeFiles: files.length,
      historicalBlobs: blobs,
      browserBundles: bundles,
      findings,
      limitations:
        "Pattern and configured-secret checks cannot prove all data is synthetic. Review assets, unknown credentials, Git author metadata, other refs/remotes, and licensing before publication.",
    },
    null,
    2,
  ),
);
if (findings.length) process.exitCode = 1;
