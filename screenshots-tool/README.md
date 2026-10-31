# Dashboard screenshot tool

This folder contains the capture runner, Playwright configuration, route discovery, privacy overlays, reports and optional manual-login test. It does not modify application code, financial calculations, data-fetching logic or server API responses.

## Run

```sh
npm ci
npx playwright install chromium
npm run screenshots
```

The default run saves **at most 10 screenshots**: all seven current pages on desktop, plus Overview, Holdings and Performance on mobile. It captures only their default state, with masking enabled. Tablet and expanded/loading/empty/error/focus/range states are intentionally omitted from this quick review.

```sh
npm run screenshots                 # quick review, maximum 10 images
npm run screenshots -- --full        # optional comprehensive capture (hundreds of images)
npm run screenshots -- --quick       # explicitly select the quick review
```

The comprehensive capture behavior described below applies to `--full`. Existing screenshot folders are retained; the limit applies to each new default run.

The config starts `npm run dev -- --hostname 127.0.0.1 --port 3000` when needed and reuses a running server. Only a server started by Playwright is stopped afterward. Chromium runs sequentially to avoid request bursts. The script discovers routes from `src/app/**/page.tsx` (Next.js App Router), rather than a fixed page list. Dynamic or intercepting routes without concrete parameters are recorded as unavailable.

Outputs go to `screenshots/<timestamp>/`:

- `index.html`: contact sheet grouped by route; click an image for the full PNG.
- `manifest.json`: every screenshot, viewport, route, state, data source, warnings, failures, unavailable states and unreachable routes.
- `console-log.json`: privacy-safe console/page errors and failed/HTTP-error requests. Raw messages, URLs, query strings, response bodies, identifiers and tokens are deliberately omitted.
- `a1y-report.json`: non-blocking axe violations for desktop default states, with rule, impact and privacy-sanitized selectors. Set `SCREENSHOTS_AXE=0` to skip.

Names follow `desktop__holdings__default.png` / `mobile__returns__expanded-details-001.png`. Desktop is 1440×900; tablet 820×1180; mobile 390×844 at device scale 2 with touch/mobile emulation. Every image uses `fullPage: true`. Animations/transitions are disabled, fonts/images are awaited, and the page is scrolled once before capture. Network-idle timeouts are recorded, not silently ignored.

## Masking and data modes

```sh
npm run screenshots -- --mask       # default
npm run screenshots -- --no-mask    # potentially private screenshots
SCREENSHOTS_DATA_MODE=live npm run screenshots
SCREENSHOTS_DATA_MODE=preview npm run screenshots
```

Default `auto` mode uses the app's existing `?preview=sample`, `?preview=loading`, `?preview=empty` and `?preview=error` states where they are active. All seven routes, including Activity, have these **development-only invented fixtures**. Production ignores preview parameters, so auto mode captures its real view instead. For synthetic-only QA, use `SCREENSHOTS_DATA_MODE=preview npm run screenshots`: this requires an active preview and records a route failure rather than silently capturing live data. `live` mode never selects fixture query parameters.

Masking is a screenshot-only CSS overlay for `.private-value`, detected account suffixes and other currency amounts. It also blurs financial graphics and masks login inputs. It preserves layout and the actual app balance-toggle state, so default and balances-hidden remain separate UI states. Native option/SVG text is redacted directly where CSS pseudo-elements cannot work; this changes no control values, calculations or requests. Account names, tickers and percentages can remain visible. Review screenshots before sharing; `--no-mask` permits real amounts and account numbers. Output/session directories are git-ignored; do not commit them.

## Loading, empty and error limitations

The app fetches brokerage data in **Next.js server components**, not browser `/api` requests. Browser interception cannot replace those responses with empty arrays or HTTP 500 data without manufacturing framework payloads. The runner therefore:

- Holds the target's real RSC navigation request before it reaches the server and captures the existing stonks loading overlay (`loading`). During that intentionally pending request, network idle is impossible; the manifest explicitly records the exception. Fonts/images are still awaited.
- Also captures existing skeleton previews (`loading-skeleton`) where supported.
- Uses existing labelled empty/error fixtures where supported. These are UI previews, not claims that a server 500 was induced.
- Lists empty/error/skeleton states as unavailable on deployed servers where development previews are disabled. No framework response is fabricated to fake them.

If an RSC navigation cannot be held (for example a cached transition or a deployed gateway), that loading state is reported as unavailable and other captures continue. Live Activity and live-mode page visits can make normal read-only brokerage requests; there is no polling or forced brokerage refresh.

## Expanded controls and extra captures

The runner opens navigation menus, native disclosures (including nested row details), popovers and the estimates dialog independently, restoring their original state afterward. It also captures Show all/other-holdings controls and native select options. Native OS select popups cannot reliably appear in page screenshots, so selects are temporarily presented as native listboxes with their unchanged options; these files and manifest notes explicitly identify that adaptation.

The default expansion limit is 60 disclosures per page/viewport. Set `SCREENSHOTS_MAX_EXPANSIONS=100` if needed; any omitted expansion is listed in the manifest. Performance receives desktop captures at 1D, 5D, 1M, 3M, YTD and 1Y. Holding Returns receives a Compare return lines capture, including its real provider-not-connected explanation. Overview receives successive keyboard-focus screenshots from the header into its first card.

## Sign in once (when needed)

The local app uses server-side SnapTrade credentials already configured in `.env.local`; it has no browser login. This tool never reads that file or asks for credentials. No login step is needed for the normal local capture.

For an environment with browser authentication:

```sh
SCREENSHOTS_BASE_URL=https://your-dashboard.example npm run screenshots:login
```

A headed Chromium window and Playwright Inspector open. Sign in manually in Chromium, then click **Resume** in the Inspector. The script saves Playwright `storageState` to `screenshots-tool/.auth/storage-state.json` with private file permissions. It may contain sensitive session cookies: keep it private. Do not share it with screenshots. The capture automatically loads this file if present. Sessions based on cookies/localStorage are supported; sessionStorage-only authentication needs a different session method and is not fabricated.

```sh
SCREENSHOTS_BASE_URL=https://your-dashboard.example npm run screenshots
SCREENSHOTS_STORAGE_STATE=/private/path/session.json npm run screenshots
```

A non-local base URL skips local server startup. Base URLs must not include credentials, query parameters or fragments. Keep custom storage-state files outside Git too. The tool never automatically reconnects brokerage accounts, submits login credentials, follows external authentication redirects during capture, or invokes financial actions. Unreachable/redirected routes are reported. Traces, videos and automatic failure screenshots are disabled to prevent unmasked artifacts.

For a focused review at all three widths (still capped at ten images per run):

```sh
SCREENSHOTS_REVIEW_ROUTES=/holdings,/returns npm run screenshots
```

This captures those two routes at desktop, tablet and mobile widths (six images). Next.js development indicators are hidden in captures. Existing sample fixtures remain explicitly labelled.
