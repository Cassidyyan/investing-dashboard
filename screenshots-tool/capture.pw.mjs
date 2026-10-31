import { test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import {
  appURL,
  captureMode,
  captureLimit,
  capturePlan,
  baseURL,
  dataMode,
  discoverRoutes,
  masked,
  maxExpansions,
  runDirectory,
  storageState,
  viewports,
} from "./settings.mjs";
import {
  attachSafeLogs,
  mask,
  ready,
  safeSelector,
} from "./browser-helpers.mjs";
import { writeReports } from "./reports.mjs";

const unsupportedData =
  "Next.js server components fetch brokerage data on the server. Browser interception cannot safely return empty/500 data for this route, and no active development preview exists. Application/API code was not changed.";
const errorKind = (error) =>
  error?.name === "TimeoutError" ? "Timed out" : "Browser action failed";
const token = (n) => String(n).padStart(3, "0");

test("Capture all discovered dashboard routes", async ({ browser }) => {
  const routes = discoverRoutes(),
    logs = [],
    accessibility = [];
  const manifest = {
    createdAt: new Date().toISOString(),
    framework: "Next.js App Router",
    baseURL,
    masked,
    captureMode,
    captureLimit: Number.isFinite(captureLimit) ? captureLimit : null,
    plannedCaptures:
      captureMode === "quick"
        ? capturePlan(routes)
        : "All route/viewports/states",
    requestedDataMode: dataMode,
    routes,
    viewports,
    captures: [],
    failures: [],
    unavailable: [],
    reachability: [],
    notes: [
      ...(captureMode === "quick"
        ? [
            "Quick review: at most 10 default-state captures. Extra viewports and states are intentionally omitted; use --full for the complete suite.",
          ]
        : []),
      "No traces, videos, HTML snapshots, response bodies or raw console text are recorded.",
      "Default masking protects account suffixes and amounts while keeping the app's actual visibility toggle state.",
      "Empty/error previews use existing fixtures, not fabricated RSC response payloads.",
      "Native select options are shown using a temporary listbox presentation; OS popups are not reliably included in full-page screenshots.",
    ],
  };
  await mkdir(runDirectory, { recursive: true });
  const persist = () => writeReports(manifest, logs, accessibility);
  const issue = (list, route, viewport, state, reason) =>
    list.push({ route: route.route, viewport: viewport.name, state, reason });

  async function capture(page, route, viewport, state, info = {}) {
    if (manifest.captures.length >= captureLimit) return false;
    try {
      const warnings = await ready(page, { pending: !!info.pending });
      if (masked) await mask(page);
      const file = `${viewport.name}__${route.slug}__${state}.png`;
      await page.screenshot({
        path: path.join(runDirectory, file),
        fullPage: true,
        animations: "disabled",
        caret: "hide",
        timeout: 20000,
      });
      manifest.captures.push({
        file,
        route: route.route,
        viewport: viewport.name,
        state,
        dataSource: info.dataSource || "live",
        masked,
        warnings,
        ...(info.note ? { note: info.note } : {}),
      });
      await persist();
      return true;
    } catch (error) {
      issue(
        manifest.failures,
        route,
        viewport,
        state,
        `${errorKind(error)} during screenshot preparation/capture; details redacted.`,
      );
      await persist();
      return false;
    }
  }
  async function action(page, route, viewport, state, info, operation) {
    try {
      await operation();
      return await capture(page, route, viewport, state, info);
    } catch (error) {
      issue(
        manifest.failures,
        route,
        viewport,
        state,
        `${errorKind(error)} while opening the requested UI state; details redacted.`,
      );
      return false;
    }
  }
  async function visit(page, route, preview) {
    const target = new URL(appURL(route.route, preview));
    const response = await page.goto(target.href, {
      waitUntil: "domcontentloaded",
    });
    if (!response || response.status() >= 400)
      throw new Error("Route returned an HTTP error");
    const actual = new URL(page.url());
    if (
      actual.origin !== target.origin ||
      actual.pathname.replace(/\/$/, "") !== target.pathname.replace(/\/$/, "")
    )
      throw new Error("Route redirected; authentication may be required");
    await page.locator("main:visible").first().waitFor({ state: "visible" });
    await ready(page);
    return await page
      .getByText("Sample data", { exact: true })
      .first()
      .isVisible();
  }
  async function showBalances(page, shown) {
    const button = page.getByRole("button", {
      name: shown ? /^Show balances$/ : /^Hide balances$/,
    });
    if ((await button.count()) && (await button.first().isVisible()))
      await button.first().click();
    const expected = page.getByRole("button", {
      name: shown ? /^Hide balances$/ : /^Show balances$/,
    });
    return await expected
      .first()
      .isVisible()
      .catch(() => false);
  }
  async function axe(page, route) {
    if (process.env.SCREENSHOTS_AXE === "0") return;
    try {
      const results = await new AxeBuilder({ page }).analyze();
      accessibility.push({
        route: route.route,
        viewport: "desktop",
        violations: results.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          helpUrl: v.helpUrl,
          selectors: v.nodes.flatMap((n) => n.target.map(safeSelector)),
        })),
      });
    } catch {
      accessibility.push({
        route: route.route,
        viewport: "desktop",
        error: "Accessibility analysis could not complete; details redacted.",
      });
    }
  }
  async function expanded(page, route, viewport, info) {
    // Every open state is independent. Do not click Refresh, reconnect or write actions.
    const toggles = page.locator("button[aria-controls][aria-expanded]");
    for (let i = 0; i < (await toggles.count()); i++) {
      const button = toggles.nth(i);
      if (!(await button.isVisible())) continue;
      await action(
        page,
        route,
        viewport,
        `expanded-menu-${token(i + 1)}`,
        info,
        async () => {
          await button.click();
        },
      );
      await page.keyboard.press("Escape");
      if ((await button.getAttribute("aria-expanded")) === "true")
        await button.click();
    }
    const details = page.locator("details"),
      count = await details.count();
    const initial = await details.evaluateAll((nodes) =>
      nodes.map((n) => n.open),
    );
    let captured = 0;
    for (let i = 0; i < count; i++) {
      const target = details.nth(i);
      if (
        await target.evaluate(
          (n) => !!n.closest("dialog:not([open]), [hidden]"),
        )
      )
        continue;
      if (captured >= maxExpansions) {
        issue(
          manifest.unavailable,
          route,
          viewport,
          "remaining-expanded-disclosures",
          "Expansion safety limit reached; raise SCREENSHOTS_MAX_EXPANSIONS to capture more.",
        );
        break;
      }
      const summary = target.locator(":scope > summary");
      if (!(await summary.count())) continue;
      const ok = await action(
        page,
        route,
        viewport,
        `expanded-details-${token(i + 1)}`,
        info,
        async () => {
          await target.evaluate((n) => {
            for (
              let p = n.parentElement?.closest("details");
              p;
              p = p.parentElement?.closest("details")
            )
              p.open = true;
          });
          await summary.waitFor({ state: "visible" });
          if (!(await target.evaluate((n) => n.open))) {
            await summary.focus();
            await summary.press("Enter");
            if (!(await target.evaluate((n) => n.open)))
              throw new Error("Disclosure did not open");
          }
        },
      );
      if (ok) captured++;
      await details.evaluateAll(
        (nodes, states) =>
          nodes.forEach((n, j) => {
            n.open = states[j] || false;
          }),
        initial,
      );
    }
    const dialogs = page.locator('button[aria-haspopup="dialog"]');
    for (let i = 0; i < (await dialogs.count()); i++) {
      if (!(await dialogs.nth(i).isVisible())) continue;
      await action(
        page,
        route,
        viewport,
        `expanded-dialog-${token(i + 1)}`,
        info,
        async () => {
          await dialogs.nth(i).focus();
          await dialogs.nth(i).press("Enter");
          await page.locator("dialog[open]").waitFor({ state: "visible" });
        },
      );
      await page.keyboard.press("Escape");
    }
    const selects = page.locator("select");
    for (let i = 0; i < (await selects.count()); i++) {
      if (!(await selects.nth(i).isVisible())) continue;
      const originalSize = await selects.nth(i).getAttribute("size");
      await action(
        page,
        route,
        viewport,
        `expanded-select-${token(i + 1)}`,
        {
          ...info,
          note: "Temporary native listbox view of the unchanged options; OS popup windows cannot be reliably captured by page screenshots.",
        },
        async () => {
          await selects.nth(i).evaluate((n) => {
            n.size = Math.min(8, Math.max(2, n.options.length));
          });
        },
      );
      await selects.nth(i).evaluate((n, value) => {
        if (value === null) n.removeAttribute("size");
        else n.setAttribute("size", value);
      }, originalSize);
    }
    const more = page.getByRole("button").filter({
      hasText:
        /^(Show all|View other holdings|View all holdings|Other holdings|Show more)/i,
    });
    // Snapshot locators before their accessible text changes on expansion.
    const handles = await more.elementHandles();
    for (let i = 0; i < handles.length; i++) {
      if (!(await handles[i].isVisible())) continue;
      await action(
        page,
        route,
        viewport,
        `expanded-more-${token(i + 1)}`,
        info,
        () => handles[i].click(),
      );
      if (await handles[i].isVisible())
        await handles[i].click().catch(() => {});
    }
  }
  async function loading(context, route, viewport) {
    const stage = routes.find(
      (r) => r.route !== route.route && r.preview && !r.unsupported,
    );
    if (!stage) {
      issue(
        manifest.unavailable,
        route,
        viewport,
        "loading",
        "No alternate navigation page exists to hold an RSC transition.",
      );
      return;
    }
    const page = await context.newPage();
    attachSafeLogs(page, { route: route.route, viewport: viewport.name }, logs);
    let held = false,
      release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    try {
      await visit(page, stage, dataMode === "live" ? undefined : "sample");
      const target = new URL(appURL(route.route));
      await page.route("**/*", async (intercepted) => {
        const request = intercepted.request(),
          url = new URL(request.url());
        if (
          url.origin === target.origin &&
          url.pathname === target.pathname &&
          (request.headers().rsc === "1" || url.searchParams.has("_rsc"))
        ) {
          held = true;
          await gate;
          await intercepted.abort().catch(() => {});
        } else await intercepted.continue();
      });
      const index = await page
        .locator("a")
        .evaluateAll(
          (links, href) =>
            links.findIndex((a) => a.getAttribute("href") === href),
          route.route,
        );
      if (index < 0) throw new Error("No navigation link for route");
      // The app's normal Next Link handler starts its real navigation loader.
      await page
        .locator("a")
        .nth(index)
        .evaluate((a) => a.click());
      await page.locator(".stonk-overlay").waitFor({ state: "visible" });
      for (let i = 0; i < 30 && !held; i++) await page.waitForTimeout(100);
      if (!held) throw new Error("No interceptable RSC request");
      await capture(page, route, viewport, "loading", {
        pending: true,
        dataSource: "held RSC navigation",
        note: "The target's real Next.js navigation response is held before reaching the server. The previous page is visible beneath the app's loading overlay.",
      });
    } catch {
      issue(
        manifest.unavailable,
        route,
        viewport,
        "loading",
        "Could not hold an uncached Next.js RSC navigation. Existing loading skeleton previews are captured separately where supported.",
      );
    } finally {
      release();
      await page.close();
    }
  }
  async function focus(page, route, viewport, info) {
    await page.locator('a[href="#overview-main"]').focus();
    let enteredCard = false;
    for (let i = 0; i < 24; i++) {
      await capture(
        page,
        route,
        viewport,
        `keyboard-focus-${token(i + 1)}`,
        info,
      );
      const inside = await page.evaluate(
        () =>
          !!document
            .querySelector('section[aria-label="Portfolio value"]')
            ?.contains(document.activeElement),
      );
      if (enteredCard && !inside) break;
      if (inside) enteredCard = true;
      await page.keyboard.press("Tab");
    }
    if (!enteredCard)
      issue(
        manifest.unavailable,
        route,
        viewport,
        "keyboard-focus-first-card",
        "The first Overview card was not reached in 24 tab stops.",
      );
  }
  try {
    const plan = capturePlan(routes);
    for (const viewport of viewports) {
      if (
        captureMode === "quick" &&
        !plan.some((p) => p.viewport === viewport.name)
      )
        continue;
      const { name, ...device } = viewport;
      const context = await browser.newContext({
        ...device,
        storageState: storageState(),
        locale: "en-CA",
        timezoneId: "America/Toronto",
        colorScheme: "light",
        reducedMotion: "reduce",
        serviceWorkers: "block",
      });
      await context.addCookies([
        { name: "balances-hidden", value: "0", url: baseURL },
      ]);
      try {
        for (const route of routes) {
          if (
            captureMode === "quick" &&
            !plan.some((p) => p.route === route.route && p.viewport === name)
          )
            continue;
          if (route.unsupported) {
            issue(
              manifest.unavailable,
              route,
              viewport,
              "route",
              route.unsupported,
            );
            manifest.reachability.push({
              route: route.route,
              viewport: name,
              reachable: false,
            });
            continue;
          }
          const page = await context.newPage();
          attachSafeLogs(page, { route: route.route, viewport: name }, logs);
          let previewActive = false;
          try {
            previewActive = await visit(
              page,
              route,
              dataMode !== "live" && route.preview ? "sample" : undefined,
            );
            if (dataMode === "preview" && !previewActive)
              throw new Error("Required preview is unavailable");
            manifest.reachability.push({
              route: route.route,
              viewport: name,
              reachable: true,
              dataSource: previewActive ? "development preview" : "live",
            });
            const info = {
              dataSource: previewActive ? "development preview" : "live",
            };
            await showBalances(page, true);
            if (name === "desktop") await axe(page, route);
            await capture(page, route, viewport, "default", info);
            if (captureMode === "quick") continue;
            if (await showBalances(page, false))
              await capture(page, route, viewport, "balances-hidden", info);
            else
              issue(
                manifest.unavailable,
                route,
                viewport,
                "balances-hidden",
                "No balance visibility control is exposed on this page.",
              );
            await showBalances(page, true);
            await expanded(page, route, viewport, info);
            const comparison = page.getByRole("button", {
              name: /^Compare return lines$/,
            });
            if (await comparison.count()) {
              await comparison.click();
              await capture(page, route, viewport, "compare-return-lines", {
                ...info,
                note: "The existing comparison view requires a historical stock-price provider; this captures its honest not-connected state.",
              });
              await page
                .getByRole("button", {
                  name: /^(Leaderboard|Lifetime leaderboard)$/,
                })
                .click();
            }
            const rangeGroup = page.getByRole("group", {
              name: "Historical date range",
              exact: true,
            });
            if (name === "desktop" && (await rangeGroup.count()))
              for (const range of ["1D", "5D", "1M", "3M", "YTD", "1Y"]) {
                const button = rangeGroup.getByRole("button", {
                  name: range,
                  exact: true,
                });
                if ((await button.count()) && (await button.isEnabled()))
                  await action(
                    page,
                    route,
                    viewport,
                    `range-${range.toLowerCase()}`,
                    info,
                    () => button.click(),
                  );
                else
                  issue(
                    manifest.unavailable,
                    route,
                    viewport,
                    `range-${range.toLowerCase()}`,
                    "Requested range is not enabled in the existing UI.",
                  );
              }
            if (name === "desktop" && route.route === "/")
              await focus(page, route, viewport, info);
            await loading(context, route, viewport);
            for (const state of ["loading", "empty", "error"]) {
              if (!previewActive) {
                issue(
                  manifest.unavailable,
                  route,
                  viewport,
                  state === "loading" ? "loading-skeleton" : state,
                  unsupportedData,
                );
                continue;
              }
              try {
                const active = await visit(page, route, state);
                if (!active) {
                  issue(
                    manifest.unavailable,
                    route,
                    viewport,
                    state,
                    "This preview state is not enabled by the running server.",
                  );
                  continue;
                }
                await capture(
                  page,
                  route,
                  viewport,
                  state === "loading" ? "loading-skeleton" : state,
                  {
                    dataSource: "development preview",
                    note: "Existing labelled fixture state; server-side brokerage calls cannot be intercepted by the browser.",
                  },
                );
              } catch {
                issue(
                  manifest.failures,
                  route,
                  viewport,
                  state,
                  "Could not navigate to the existing development preview; details redacted.",
                );
              }
            }
          } catch {
            manifest.reachability.push({
              route: route.route,
              viewport: name,
              reachable: false,
            });
            issue(
              manifest.failures,
              route,
              viewport,
              "route",
              "Route could not be reached or an interaction failed. Check the server and saved login state; raw errors are intentionally redacted.",
            );
          } finally {
            await page.close();
            await persist();
          }
          console.log(
            `${name} ${route.route}: ${manifest.captures.length} captured so far; ${manifest.failures.length} failed.`,
          );
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await persist();
  }
  console.log(
    `Screenshots: ${manifest.summary.captured} captured, ${manifest.summary.failed} failed, ${manifest.summary.unavailable} unavailable states.`,
  );
  console.log(`Output: ${runDirectory}`);
});
