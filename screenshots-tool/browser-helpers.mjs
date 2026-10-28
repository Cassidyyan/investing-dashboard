// Runtime-only screenshot presentation. No app files, responses or calculations are changed.
export const freezeCSS = `*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important;caret-color:transparent!important}`;
const maskCSS = `
.private-value,.private-value *,[data-screenshot-sensitive],[data-screenshot-sensitive] *{color:transparent!important;text-shadow:none!important}
.private-value,[data-screenshot-sensitive]{position:relative!important}
.private-value::after,[data-screenshot-sensitive]::after{content:'••••';position:absolute;left:0;top:0;color:#202b38!important;text-shadow:none!important;font-size:inherit;line-height:inherit;pointer-events:none}
svg[role=img],[class*=profitBar],[class*=weightTrack],[class*=sparkline],[class*=donutWrap],[class*=donut]>svg{filter:blur(10px)!important}
svg[role=img] text{visibility:hidden!important}
input[type=password],input[type=email],input[autocomplete=username]{-webkit-text-security:disc!important}
`;
export async function freeze(page) {
  if (!(await page.locator('style[data-screenshot-style="freeze"]').count())) {
    const style = await page.addStyleTag({ content: freezeCSS });
    await style.evaluate((el) =>
      el.setAttribute("data-screenshot-style", "freeze"),
    );
  }
}
export async function mask(page) {
  if (!(await page.locator('style[data-screenshot-style="mask"]').count())) {
    const style = await page.addStyleTag({ content: maskCSS });
    await style.evaluate((el) =>
      el.setAttribute("data-screenshot-style", "mask"),
    );
  }
  await page.evaluate(() => {
    const pattern =
      /(?:[•*]{2,}\s*[A-Za-z0-9-]{2,}|(?:CAD|USD|EUR|GBP|JPY)\s*[+-]?\s*\d[\d,.]*|[+$−-]?[£€$¥]\s*\d[\d,.]*)/u;
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement;
      if (
        !el ||
        el.closest("script,style,.private-value,[data-screenshot-sensitive]") ||
        !pattern.test(node.textContent || "")
      )
        continue;
      if (el.closest("option") || el instanceof SVGElement) {
        // Native option popups/SVG text cannot display HTML pseudo-element overlays.
        node.nodeValue = (node.nodeValue || "").replace(
          new RegExp(pattern.source, "gu"),
          "••••",
        );
      } else if (!["HTML", "BODY"].includes(el.tagName)) {
        el.setAttribute("data-screenshot-sensitive", "true");
      }
    }
  });
}
export async function ready(page, { pending = false } = {}) {
  const warnings = [];
  await freeze(page);
  if (!pending) {
    try {
      await page.waitForLoadState("networkidle", { timeout: 8000 });
    } catch {
      warnings.push("Network idle timed out; fonts/images were still awaited.");
    }
  } else
    warnings.push(
      "The RSC response is deliberately held; network idle is impossible during this loading capture.",
    );
  const fontReady = await page.evaluate(() =>
    Promise.race([
      document.fonts.ready.then(() => true),
      new Promise((r) => setTimeout(() => r(false), 8000)),
    ]),
  );
  if (!fontReady) warnings.push("Font readiness timed out.");
  await page.evaluate(async () => {
    const height = Math.min(document.documentElement.scrollHeight, 120000);
    for (let y = 0; y < height; y += Math.max(400, innerHeight * 0.85)) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 30));
    }
    window.scrollTo(0, 0);
  });
  const imageReady = await page.locator("img").evaluateAll((images) =>
    Promise.all(
      images.map((img) =>
        img.complete
          ? true
          : new Promise((resolve) => {
              const timer = setTimeout(() => resolve(false), 5000);
              const done = () => {
                clearTimeout(timer);
                resolve(true);
              };
              img.addEventListener("load", done, { once: true });
              img.addEventListener("error", done, { once: true });
            }),
      ),
    ),
  );
  if (imageReady.some((v) => !v))
    warnings.push("Some images did not finish within five seconds.");
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  return warnings;
}
export function attachSafeLogs(page, entry, logs) {
  const add = (event) =>
    logs.push({ route: entry.route, viewport: entry.viewport, ...event });
  const target = (request) => {
    try {
      const url = new URL(request.url());
      return url.origin === new URL(page.url()).origin
        ? url.pathname.startsWith("/_next/")
          ? "Next.js asset or data request"
          : "Application request (URL redacted)"
        : "External request (URL redacted)";
    } catch {
      return "Request (URL redacted)";
    }
  };
  page.on("console", (message) => {
    if (message.type() === "error")
      add({
        type: "console-error",
        message: /hydrati/i.test(message.text())
          ? "Hydration error (details redacted)"
          : "Console error (text redacted to protect account data and tokens)",
      });
  });
  page.on("pageerror", () =>
    add({
      type: "page-error",
      message: "Unhandled browser exception (details redacted)",
    }),
  );
  page.on("requestfailed", (request) =>
    add({
      type: "request-failed",
      target: target(request),
      resourceType: request.resourceType(),
      reason: /^net::ERR_[A-Z_]+$/.test(request.failure()?.errorText || "")
        ? request.failure().errorText
        : "Request failed (details redacted)",
    }),
  );
  page.on("response", (response) => {
    if (response.status() >= 400)
      add({
        type: "http-error",
        status: response.status(),
        target: target(response.request()),
        resourceType: response.request().resourceType(),
      });
  });
}
export function safeSelector(selector) {
  return String(selector)
    .replace(/#[\w-]+/g, "#redacted-id")
    .replace(
      /\[(?:aria-label|title|name|value|id|data-[\w-]+)=[^\]]+\]/g,
      "[redacted-attribute]",
    );
}
