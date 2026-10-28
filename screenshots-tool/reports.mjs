import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";
import { runDirectory } from "./settings.mjs";
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export async function writeReports(manifest, logs, accessibility) {
  await mkdir(runDirectory, { recursive: true });
  manifest.summary = {
    captured: manifest.captures.length,
    failed: manifest.failures.length,
    unavailable: manifest.unavailable.length,
    unreachableRoutes: [
      ...new Set(
        manifest.reachability.filter((r) => !r.reachable).map((r) => r.route),
      ),
    ],
  };
  for (const [file, data] of [
    ["manifest.json", manifest],
    ["console-log.json", logs],
    ["a1y-report.json", accessibility],
  ])
    await writeFile(
      path.join(runDirectory, file),
      await format(JSON.stringify(data), { parser: "json" }),
    );
  const groups = [...new Set(manifest.captures.map((c) => c.route))]
    .map(
      (route) =>
        `<section><h2>${escape(route)}</h2><div class="grid">${manifest.captures
          .filter((c) => c.route === route)
          .map(
            (c) =>
              `<figure><a href="${escape(c.file)}"><img loading="lazy" src="${escape(c.file)}" alt="${escape(c.viewport + " " + c.state)}" /></a><figcaption>${escape(c.file)}</figcaption></figure>`,
          )
          .join("")}</div></section>`,
    )
    .join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Dashboard UI screenshots</title><style>body{font-family:system-ui,sans-serif;margin:32px;color:#202b38;background:#f5f7f9}h1{font-size:28px}h2{margin-top:40px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:24px}figure{margin:0;background:white;border:1px solid #dfe5ea;border-radius:12px;overflow:hidden}img{display:block;width:100%;height:300px;object-fit:contain;object-position:top;background:#edf2f4}figcaption{font-size:12px;padding:12px;overflow-wrap:anywhere}a{color:#146d7c}li{margin:8px 0}</style></head><body><h1>Dashboard UI review</h1><p>${manifest.summary.captured} captures · ${manifest.summary.failed} failures · ${manifest.summary.unavailable} unavailable states · masking ${manifest.masked ? "on" : "OFF"}</p><p>Click an image for its full-page PNG. See <a href="manifest.json">manifest</a>, <a href="console-log.json">browser diagnostics</a> and <a href="a1y-report.json">accessibility report</a>.</p>${groups}<section><h2>States not captured</h2><ul>${[...manifest.failures, ...manifest.unavailable].map((e) => `<li>${escape(e.viewport || "")} ${escape(e.route)} ${escape(e.state)}: ${escape(e.reason)}</li>`).join("") || "<li>None</li>"}</ul></section></body></html>`;
  await writeFile(
    path.join(runDirectory, "index.html"),
    await format(html, { parser: "html" }),
  );
}
