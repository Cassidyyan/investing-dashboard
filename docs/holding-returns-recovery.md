# Holding Returns recovery

Holding returns require complete cash, quantity, ownership and cost evidence. A missing opening purchase is not proof of a short sale or zero basis.

## Evidence-based corrections

- Full available transaction pagination has no one-year or 10,000-row cutoff. Coverage, synchronization, cache age and partial failures remain visible.
- Verified closed/empty snapshots can support closed-trade evidence only when complete history, synchronization and dates independently prove a flat ending position. Current open quantities still require current evidence.
- Unambiguous internal share-transfer chains can carry original purchase cost between accounts. They never become a second purchase, sale profit or an invented cost basis; ambiguous chains remain unranked.
- Local Wealthsimple CSV evidence can enrich uniquely matched source net cash and commissions. Additional stock rows need a known security, corroborated account identity and independently reconciled ending shares. Unknown transfer/corporate actions keep additions pending.
- Holding Returns displays missing evidence and recovery steps beside unranked rows. Page uploads in Options Analytics do not change these stock-return calculations.

## Privacy

Private connection-derived results, counts, dates and aliases are intentionally omitted. Earlier Git commits may retain aggregate audit metadata and require owner review before publication. Diagnostics belong in ignored local files; tests use independently synthetic records. No raw financial export or account mapping belongs in source or screenshots.

See [CSV policy](csv-reconciliation.md) and [historical source limits](history-recovery-audit.md).
