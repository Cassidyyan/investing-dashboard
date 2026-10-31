# Third-party notices and release checks

This document records an inventory, not a grant of rights for the holdings application. **No root project license has been selected.** MIT is recommended for the owner's consideration because it is a short permissive software license; applying it requires the owner's approval and accurate copyright ownership. See the [OSI MIT text](https://opensource.org/license/mit). Do not treat public visibility as an open-source license.

## Code dependencies

Installed manifest/lockfile metadata identifies Next.js, React, React DOM, server-only, TypeScript, ESLint and Vitest under MIT; Playwright and axe-core integration packages have their own upstream notices. The installed `snaptrade-typescript-sdk` 13.1.11 manifest declares **Unlicense**. Its published package does not include a separate license text file. Check the [upstream SDK](https://github.com/passiv/snaptrade-sdks/tree/master/sdks/typescript) and retain applicable notices before redistributing a bundled application. SDK licensing does not grant rights to SnapTrade's hosted API, market data or branding.

Dependencies are installed through `npm ci`; vendored dependency source is not committed. npm's dependency licenses vary, including MIT, Apache-2.0, BSD and ISC. The locked image pipeline includes optional `@img/sharp-libvips-*` binaries under LGPL-3.0-or-later, and some Sharp binaries carry combined Apache/LGPL/MIT notices. axe-core and lightningcss use MPL-2.0; caniuse-lite declares CC-BY-4.0. A bundled binary distribution must review these specific notice/source obligations rather than assuming a permissive application license covers them. Review the exact locked transitive tree for a release artifact rather than assuming every package shares the application's eventual license. Run `npm audit` for current advisories; an advisory-free result is not a security guarantee. The full dependency advisory query also reports a moderate minimatch denial-of-service advisory ([GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)) through development tooling (initially 16 affected/dependent entries, no high/critical entries at audit time). Production-only audit reports zero. The typescript-estree path is now narrowly overridden to patched minimatch 11.0.3, which retains its required named-function API. The registry still reports 15 moderate development entries from the legacy callable 3.1.5 path. A blanket override would break callers and was not applied; use a compatible reviewed upstream/tooling update before release. The current ESLint 9 package emits a deprecation warning and should be reviewed for a compatible future tooling upgrade; this phase does not change application dependency versions.

## Local fonts

Inter, Cormorant Garamond and League Spartan are installed via Fontsource and served locally. Their bundled font licenses are **SIL Open Font License 1.1**. Complete upstream copyright and license text is retained unchanged in:

- [Inter](licenses/Inter-OFL.txt)
- [Cormorant Garamond](licenses/Cormorant-Garamond-OFL.txt)
- [League Spartan](licenses/League-Spartan-OFL.txt)

Retain those notices with distributions containing the fonts. OFL reserved-name/modification conditions still apply. No proprietary Wealthsimple Sans, Financier Display, paid brand kit or third-party UI mockup is bundled.

## Logos, icons and screenshots

Existing UI icons are inline code/SVG; no downloaded paid icon pack was found. Optional ticker images are fetched from Logo.dev using the operator's own publishable key, not bundled as a logo library. Preserve the existing [Logo.dev attribution](https://www.logo.dev/products/logo-api) and review the operator's plan and usage requirements. Ticker/brand images remain subject to their owners' rights; a service subscription is not trademark ownership. With no key, the app uses its existing fallback.

Only independently fictional demo screenshots may be included in public documentation. The two README captures are generated from the explicit credential-free demo, with no private exports, external logo URLs or live requests. Historical local screenshot folders and saved browser states remain ignored and must not be uploaded. The `holdings` wordmark is project text; no provider endorsement is claimed. Trademark/name clearance has not been independently established.

## External provider confirmation required

The [Personal authentication guide](https://docs.snaptrade.com/docs/personal-vs-commercial) supports direct Personal keys for individuals operating their own tools. The [Build with AI guide](https://docs.snaptrade.com/docs/build-with-ai) recommends OAuth when connecting other Personal users. The [developer terms](https://snaptrade.com/developer-terms-of-use) separately address API access, market-data storage/redistribution and application compliance.

Before distributing a project for other operators, confirm with SnapTrade that independently operated local copies using each person's own Personal key fit the intended use. Ask about any app-profile/compliance requirements, allowed process-memory history reuse, user-provided exports, and the separation between SDK redistribution and API/market-data rights. The terms reviewed do not establish a blanket open-source distribution authorization. Do not market a hosted multi-user service under this local Personal-key design.

No credentials, live market data or brokerage exports are shipped. Bank of Canada reference-rate data is requested at runtime for estimates; it is not a Wealthsimple execution feed. Check the [Bank of Canada terms](https://www.bankofcanada.ca/terms/) when changing rate-data redistribution or attribution. Supported brokerage capabilities and user/provider terms may change.
