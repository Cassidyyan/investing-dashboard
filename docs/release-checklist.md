# Finish the public-release steps

The code and local commit can be completed without publishing anything. This checklist separates reproducible local work from owner/provider decisions. A local commit does not mean the repository is safe to make public.

## 1. License approval

The Phase 3 brief requires explicit owner approval before applying a project license. MIT is the proposed choice. Until approved and committed, no root license is applied and normal source export is blocked. `--review` can produce a private review snapshot without granting a license. Third-party font, SDK and dependency notices remain separate obligations.

## 2. Use a clean source snapshot instead of exposing old history

Current documentation omits personal audit statistics, but prior commits retain them. Do not change this existing repository to public with that history unreviewed. A new source-only repository is an alternative that leaves this repository, its commits and remotes intact.

After committing all reviewed changes, run:

```sh
npm run check:distribution
npm run release:export
```

The exporter requires a clean committed tree and a committed root `LICENSE` for normal export. It writes an ignored archive under `releases/` by default, with owner-only permissions. It exports **HEAD only** through `git archive`; `.git`, commit history, ignored credentials, private exports and screenshots are absent. Tracked private paths, symlinks and submodules are rejected. Existing output is never overwritten. The two independently synthetic README screenshots and upstream font notices remain included.

For a private review while license approval is pending:

```sh
npm run release:export -- --review
```

An optional final argument selects a new archive path outside the checkout or inside `releases/`. Inspect the archive before use. The exporter does not verify provider permission, approve a license, certify all data as synthetic or publish a repository. Do not distribute a review-only archive publicly.

When the publication gates are satisfied, extract the source into a separate directory and initialize a **new** Git repository there. It will have no prior history. Run installation, configuration/demo checks and the distribution scan in that fresh directory. Only then create/push to a new public remote yourself. Do not copy `.git`, `.env.local`, private-data or installed/generated files from the original checkout. No history rewrite or public push is performed automatically by the exporter.

## 3. Ask SnapTrade about the exact distribution model

Use your own private support channel; do not include keys or account data. Suggested message:

> I maintain a read-only Next.js personal dashboard. I want to distribute its source code so each operator runs an independent local copy with their own SnapTrade Personal client ID and consumer key. There is no shared hosted backend, Commercial user registration, credential collection or trading interface. Does this model require OAuth, an app profile/compliance review or another approval? Are short-lived credential-scoped process-memory reads and optional user-supplied brokerage exports permitted? Are there additional conditions on SDK redistribution, market/reference data and provider branding?

The app does not send this message or infer approval from public documentation. Record the response privately and update the public description to match any confirmed requirements. See [provider references](third-party-notices.md).

## 4. Enable a real private reporting channel

GitHub's [private vulnerability reporting documentation](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository) describes the feature for public repositories. For the new public repository, the owner should enable **Settings → Advanced Security → Private vulnerability reporting**, then verify that **Security → Advisories → Report a vulnerability** is available. If the feature is unavailable, establish and document a real private contact method. Never invent a contact address or solicit sensitive reports in a public issue. This local change does not modify remote GitHub settings or repository visibility.

## 5. Dependency follow-up

`@typescript-eslint/typescript-estree` now resolves minimatch **11.0.3** through a narrowly scoped override. Its named-function API was checked and lint/types/tests/build remain the validation gate. The legacy ESLint/plugin path still resolves minimatch **3.1.5** because it requires the older callable CommonJS API. Do not force that path to a named-export-only release or use `npm audit fix --force`.

The registry's `<11.0.1` advisory range still reports legacy development entries. The described optimization-level preprocessing implementation is absent from the installed 3.x source, but that observation is not an upstream advisory correction. Do not suppress the audit or claim a zero-advisory development tree. Await a compatible upstream/plugin update or separately review a full lint-toolchain migration. Production-only audit currently reports zero. Review the exact locked tree again before release and remove the override when a compatible upstream dependency includes the fix.

## 6. Final review

Review all source/assets, dependency licenses, Git author identity and provider terms. Only independently fictional documentation screenshots belong in a public tree. Run the checks on the exact new release commit. Keep the original private repository private until its historical metadata has an explicitly approved resolution.
