# Proposed local historical storage

This is a recommendation only. Phase 1 adds no database dependency, database file, capture job, raw-response archive or persistent brokerage-data repository. The OptionHistoryRepository interface is a future seam without an implementation.

## What benefits from retention

| Data                                         | Value of future persistence                                                                                 |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Daily reported account/position observations | Build a genuinely observed record beyond provider lookbacks; retain gaps and account coverage.              |
| Transactions and source corrections          | Reconcile changing IDs/records and compute reproducible lifecycles without repeated full-history downloads. |
| Entry-time option observations               | Retain legitimate Greeks, quotes, timestamps and provenance that may be impossible to reconstruct later.    |
| Manual notes/verified associations           | Preserve user corrections and strategy annotations separately from provider facts.                          |
| Derived metrics                              | Usually recompute from versioned inputs; store an input/version hash if caching later.                      |

Current brokerage snapshots, credentials and ephemeral UI filters do not need a database. Do not archive raw API payloads by default. Lack of storage means the app only knows what the provider currently returns; reopening the app later cannot restore a missed entry observation or expand a limited historical source. Daily account-value observations cannot replace execution-time Greeks.

## SQLite tradeoffs

A single local SQLite database fits a private one-user app: transactions, uniqueness constraints, explicit migrations, no cloud service, and straightforward backup/export. It introduces retention, deletion, correction, concurrent-writer and backup responsibilities that do not exist today. SQLite's ordinary database file is not automatically encrypted. File permissions and an encrypted disk/backup protect different risks; they do not make browser display masking an access-control system.

If approved, store it outside the repository in a private application-data directory with directory mode 0700 and files 0600, keeping journals/backups equally private. Never store SnapTrade credentials in it. Repositories remain server-only; UI components receive scoped normalized projections, never SQL connections or archive paths. Confirm retention/deletion/export rules before collection begins.

## Possible schema and migration

1. Separate provider/account identity, contracts, transactions, account/position observations, entry observations and manual annotations. Keep account/currency dimensions in uniqueness keys; do not merge accounts by label or last four digits.
2. Store monetary quantities as validated decimal TEXT, with original scalar value, native currency, source field, status, observed/retrieved times, source date precision and schema/calculation versions. Do not store financial amounts as SQLite REAL for accounting.
3. Preserve provider transaction ID plus account scope. A fingerprint detects a changed source record; related external references are not unique executions. IDs can change after provider reprocessing, so conflicts need a reconciliation queue rather than guessed duplicate deletion.
4. Record actual observations with source as-of time and retrieval time separately. Never backfill missing dates using today's position values. Mark beta-generated history separately from directly observed snapshots; replace its current imported dataset as recommended by its provider rather than presenting merged revisions as original observations.
5. Start with versioned migrations and synthetic repository tests; validate read-only imports alongside current live calculations before enabling any metric from retained data. Keep native source records immutable and corrections/derived matches versioned.
6. Only after explicit approval enable bounded capture/import and private backup/restore. A scheduler, startup collection, historical market-data provider and retention policy are separate decisions. No polling is implied by this design.

## Roadmap recommendation

Move the decision about entry-Greeks capture ahead of Phase 5. A documented, legitimately accessible entry-time source may prevent irreversible history gaps. Storage alone cannot supply Greeks, and the old SnapTrade option-quote endpoint is sunset; no paid or free replacement is assumed. Begin with an approved minimum capture plan or explicitly accept that earlier entry deltas will remain unavailable. The Options Analytics MVP can still analyze eligible closed trades without delta, once cash/fee/settlement accounting is verified.
