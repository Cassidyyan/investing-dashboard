# Demo image provenance

These eight PNGs were captured on October 31, 2026 from an isolated local production build using the application's explicit `HOLDINGS_DEMO_MODE=true` mode. They contain independently fictional fixture accounts, positions, balances, history and transactions—not a real portfolio.

SnapTrade credentials and the optional Logo.dev key were empty. The isolated directory contained no `.env.local` or private brokerage exports. All pages displayed the demo notice; external browser requests were blocked and none were attempted. Screenshots used Chromium, a 1440 × 1100 desktop viewport, scale factor 1, full-page capture, local fonts, and disabled animations/transitions.

| File                   | Page                 |
| ---------------------- | -------------------- |
| `overview-demo.png`    | `/`                  |
| `accounts-demo.png`    | `/accounts`          |
| `cash-demo.png`        | `/cash`              |
| `holdings-demo.png`    | `/holdings`          |
| `performance-demo.png` | `/performance`       |
| `returns-demo.png`     | `/returns`           |
| `options-demo.png`     | `/options-analytics` |
| `activity-demo.png`    | `/activity`          |

## Updating the gallery

Use a clean source copy with no credentials or private-data directory. Enable demo mode explicitly before starting the server. Verify the fictional-data notice on every page before capturing. Wait for fonts, images and rendering to settle; use the same desktop viewport and scroll through the page once to trigger any deferred content before returning to the top.

Keep only these reviewed fictional captures in this folder. Do not copy images from a real portfolio or rely on masking alone to make them suitable for public documentation. The existing capture tool writes to the separate, git-ignored `screenshots/` folder by default; see [its README](../../screenshots-tool/README.md) for synthetic preview mode and capture/privacy options.

Review each image and keep the root README's captions, routes and links in sync. No financial data or image-generation service is used to produce these UI captures.
