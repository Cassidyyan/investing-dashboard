# Options data foundations

Phase 1 prepares types and pure utilities, not an Options Analytics dashboard. These findings come from SDK 13.1.11, the application's read adapter and current official references, checked October 31, 2026. They describe supported shapes, not a claim that every Wealthsimple account supplies every optional field. No live brokerage records or entitlements were probed.

## Capability matrix

| Data                             | Current evidence                                                                                                                     | Treatment                                                                                                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current positions                | Unified AccountPosition: instrument, units, price, cost_basis, currency and cash_equivalent.                                         | Existing display normalization; supported values calculated in native currency.                                                                                            |
| Contract details                 | OptionInstrument includes ID, symbol, put/call, strike, expiry, multiplier and underlying. Future-option schema differs.             | Shared OptionContract, explicit missing/unsupported fields. Future-option valuation remains unsupported.                                                                   |
| Historical activities            | UniversalActivity includes transaction ID, type, option_type, units, price, amount, optional fee/FX, dates and legacy option_symbol. | NormalizedTransaction retains source fields, settlement/security currencies and issues.                                                                                    |
| Historical multiplier            | Legacy OptionsSymbolNullable has is_mini_option but no explicit multiplier.                                                          | Do not default to 100 or infer a complete adjusted contract from a boolean. Missing multiplier blocks future premium/P&L calculations requiring it, not quantity matching. |
| Opening/closing intent           | option_type can explicitly identify BUY_TO_OPEN, BUY_TO_CLOSE, SELL_TO_OPEN or SELL_TO_CLOSE.                                        | Use these actions; never derive intent from the amount sign or current position.                                                                                           |
| Orders/fills                     | AccountOrderRecord has broker/group IDs, role, cumulative filled/open/canceled quantities and execution price/timestamps.            | Cumulative snapshots, not unique executions. Never feed these into the transaction matcher as extra fills.                                                                 |
| Premium and fees                 | Activity price is per underlying share for options; amount is signed in the transaction currency, and fee is optional.               | Preserve source cash flow. Missing fee is not zero. Gross/net convention remains unspecified; premium receipts do not establish realized P&L.                              |
| Assignment, exercise, expiration | Activity types can describe these events.                                                                                            | Keep as unresolved lifecycle events; do not fabricate a closing price, profit, assigned-stock basis or roll.                                                               |
| Greeks/IV                        | Installed SDK contains an OptionQuote schema, but no quote operation is exposed by this app.                                         | The old option quote endpoint is sunset and must not be used. No replacement was connected.                                                                                |
| Historical entry Greeks          | Not supplied by connected position/activity/order adapters.                                                                          | Entry delta unavailable. Current Greeks, if later obtained, cannot substitute.                                                                                             |
| Historical underlying prices     | Account value history is not individual stock-price history. No historical stock-price provider is configured.                       | Stock comparison lines remain unavailable rather than reconstructed from account value.                                                                                    |

Sources: [unified positions](https://docs.snaptrade.com/reference/Account%20Information/AccountInformation_getAllAccountPositions), [activities and field semantics](https://docs.snaptrade.com/reference/Account%20Information/AccountInformation_getAccountActivities), [account data and order limitations](https://docs.snaptrade.com/docs/account-data). The [old option quote reference](https://docs.snaptrade.com/reference/Trading/Trading_getUserAccountOptionQuotes) states that it was sunset October 1, 2026 and returns 410. SDK type presence is not proof of a working endpoint.

Account value history is [beta and subject to schema/behavior changes](https://docs.snaptrade.com/reference/Account%20Information/AccountInformation_getAccountBalanceHistory), with limited/gapped coverage. The existing legacy account-return-rate call is [deprecated and not generally supported](https://docs.snaptrade.com/reference/Account%20Information/AccountInformation_getUserAccountReturnRates). Its existing safe failure behavior remains; future analytics must not depend on it. No additional requests to these endpoints were introduced.

## Model boundaries

- **Contract** identifies the instrument and source detail. Account/direction/quantity belong to a position or execution, not the reusable contract itself.
- **NormalizedTransaction** includes account/transaction/security IDs, native cash amounts, fees, dates, explicit action and optional contract. A scalar whitelist preserves original monetary inputs in memory. NormalizedOrder separately represents cumulative broker order state.
- **Execution** is one identified activity with explicit action and a nonzero absolute quantity. An external_reference_id can link related fees or FX as well as orders; it is not a unique fill ID.
- **Lifecycle** is a future container for multiple opening/closing transaction IDs, remaining quantity, dates, premiums, fees, realized P&L, entry delta/DTE, holding days, strategy/outcome and completeness/provenance. Money results stay null until an accounting rule can establish them.
- **Strategy association** links lifecycles only through a manual or verified provider association. Matching equal symbols/dates is not evidence of a covered call, cash-secured put, roll or wheel.

New fields use confirmed/calculated/estimated/missing/unsupported status and provenance. Decimal strings are serializable; BigInt coefficients are private to arithmetic helpers. Date-only or midnight-placeholder records do not establish execution ordering. Original date strings remain available for reconciliation.

OCC parsing retains the contract root, strike precision and right. Expiration century is resolved only with a supplied source date and marked calculated if it fills a missing source field. Conflicting explicit fields are not overwritten. Contract matching uses canonical symbol/right/strike/expiry and account/direction scope. Provider contract IDs can occupy different namespaces; a missing ID alone is not a license to merge incomplete contracts. Explicit multiplier conflicts block matching.

## Quantity reconciliation

`reconcileOptionExecutions` is pure, does not fetch and does not run on existing pages. It:

1. Deduplicates identical account/transaction IDs. A changed record under the same ID blocks that account's matching; no amount-only deduplication is used.
2. Requires a complete contract key, explicit action, usable trade date and nonzero quantity. Rejects future executions relative to the supplied as-of day.
3. Separates account, contract and long/short direction, then links opening quantities to later closes using FIFO edges. Multiple partial openings and closes remain separate executions.
4. Blocks groups whose necessary intraday order is uncertain. Missing/tied timestamps are not ordered by arbitrary IDs. Unmatched closes and expired unresolved open quantities produce blocking issues.
5. Preserves expiration/assignment/exercise events for later settlement reconciliation. It never infers a zero-cost close or combines different roll legs.

Its result explicitly reports reconciliation status and `accountingStatus: "not-calculated"`. Quantity edges can coexist with blocking issues about incomplete records. Consumers must gate an entire relevant account/contract on those issues before treating a lifecycle as eligible; these are not finalized trades or realized returns. There is no monetary allocation, tax accounting or automatic strategy classification.

## Entry delta and Phase 2 requirements

EntryDelta distinguishes observed, manually entered, estimated and unavailable, including an as-of time and provenance for supplied values. The connected adapter always initializes it as unavailable. No current-delta field is imported. Missing delta does not prevent unrelated quantity matching.

A future provider adapter must validate contract identity, timestamp/entry relationship, sign/convention, range and model inputs before attaching a delta. Manual annotations need an audit trail; reconstructed estimates need their own model/version and assumptions. This Phase 1 type does not claim those validators, observations or a provider integration already exist.

Before publishing realized options P&L, settle the per-share versus per-contract convention, explicit multiplier/deliverable, fee allocation, cash gross/net interpretation, FX direction, historical coverage and exercise/assignment treatment. A completed close is not sufficient if the opening basis or intervening lifecycle events are missing. Capture legitimate entry observations earlier than the long-term roadmap if approved; they may not be recoverable later.
