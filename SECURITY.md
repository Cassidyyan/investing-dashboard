# Security

holdings is designed for one owner on a loopback-bound local server. It has no login or multi-tenant isolation and must not be exposed to a LAN, tunnel or public host. Balance hiding is presentation privacy, not authentication or encryption. A SnapTrade Personal consumer key can be powerful even when this application only exposes read operations.

## Reporting a vulnerability

Do not post secrets, account data, raw exports, screenshots, request URLs with keys, or complete provider exceptions in a public issue. Use the repository's **Security → Report a vulnerability** private advisory flow if the owner has enabled it. That capability must be enabled and tested before public release. If unavailable, open only a neutral request for a private reporting channel, with no vulnerability details or sensitive attachments; wait for a private channel before sharing details. No private contact address is invented here.

Include affected version/commit, minimal reproduction using synthetic data, expected/observed behavior and possible impact. No response-time guarantee or formal supported-release policy exists yet. The maintainer must choose those before promising service levels.

If a real credential was committed or disclosed, rotate/revoke it through its provider and review access. Git removal alone does not revoke a credential. Coordinate any history rewrite separately; this project never rewrites published history or rotates external credentials automatically.

## Local safeguards

Use your own server-side `.env.local`. Keep permissions restrictive and do not sync it into public folders. The standard scripts bind to `127.0.0.1`; the application rejects unexpected Host headers and cross-origin browser requests. The temporary CSV endpoint is stateless, same-origin and size-limited and makes no brokerage requests. It has no public file-serving or shared-upload capability. Reverse-proxy use is outside the supported security model.

Run `npm run check:config` and `npm run check:distribution`; neither prints matching secret values. The distribution scan examines nonignored project files, reachable Git blobs, configured-secret matches, common token patterns, browser bundles and deployment trace paths. It cannot identify all personally derived statistics, unknown keys, image content, inaccessible remote refs or server logs. Manually review artifacts and Git author metadata before publication. `.gitignore` does not clean prior commits.

See [the Phase 3 assessment](docs/open-source-readiness.md) for the current audit scope, known publication blockers and provider checks. Dependencies and fonts retain their upstream notices; dependency advisories and provider policies can change.
