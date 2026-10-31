# Private brokerage exports

Store downloaded brokerage exports in `private-data/wealthsimple/` at the project root. This local folder is outside `public/`; its contents must never be served as static assets. Do not place real exports in source code, tests, screenshots or documentation.

`.gitignore` excludes the entire `private-data/` directory, including future import working files, and CSV files anywhere in the repository. Normal `git add .` will skip these untracked files. Ignore rules do not remove files already tracked by Git and can be overridden with force-add. They do not encrypt local files or remove previously published history.

The local directory is created with owner-only access. The folder itself stays out of Git, so recreate it on another machine:

```sh
mkdir -p private-data/wealthsimple
chmod 700 private-data private-data/wealthsimple
```

## Download from Wealthsimple

Use the Wealthsimple website. Under **Profile → Documents → Generate document**, choose **Custom activity statement**, select the full available date range and relevant accounts, and download CSV. Also download a **Realized gain/loss report** for comparison. See [Wealthsimple's official instructions](https://help.wealthsimple.com/hc/en-ca/articles/35654428540571-Request-a-custom-statement).

Save the files in `private-data/wealthsimple/`. Credentials are not needed in the files or chat. Leave original exports unchanged; account mappings should be separate from application source.

## Verify before committing

For a file saved as `activity.csv`, run:

```sh
git check-ignore -v -- private-data/wealthsimple/activity.csv
git ls-files -- private-data/
```

The first command should identify an ignore rule. The second should print nothing. If it lists anything, the file is already tracked and needs to be removed from the index before committing.

## Import status

Open **Options Analytics → Wealthsimple CSV preview → Review imported options activity**. The page reads activity CSVs directly from this folder on the server, with no upload to another service. Refresh the page after replacing or adding a file. Search contracts, filter by source-account alias and page through the exported option rows. Brokerage filters and CSV filters are separate.

The preview supports the inspected activity schema: `effective_date`, `account_id`, `activity_type`, `activity_sub_type`, `symbol`, `currency`, `quantity`, `unit_price`, `commission` and `net_cash_amount`, with optional `direction`. Quoted CSV fields, escaped quotes, CRLF and BOM are supported. Exact decimal inputs are retained; missing/invalid fields remain unavailable. Net cash and commission are displayed as separate source fields without changing their signs or subtracting fees again. OCC symbols identify option rows; no multiplier is assumed.

The inspected export also supplies `LONG`/`SHORT` in `direction`. CSV-based trade estimates interpret BUY + LONG as opening long, SELL + LONG as closing long, SELL + SHORT as opening short and BUY + SHORT as closing short. These are **derived classifications**, not explicitly reported opening/closing instructions. The original side and action remain visible. Accounts need multiple corroborating trade matches, and incomplete lifecycles remain excluded. See [the source-precedence and reconciliation policy](csv-reconciliation.md).

The server uses generic account/export aliases; raw account identifiers and filenames stay out of client preview data and application source. Identical files are skipped. Identical rows are flagged as potential duplicates because repeated fills can be legitimate. Options use the CSV trade cohort for covered dates in uniquely matched accounts, with source labels and no duplicate API observations added to that cohort. Trade figures include reported commission and exclude unallocated account/FX fees. Holding Returns enriches matched stock activities; CSV-only additions need independent ending-share reconciliation. Unresolved records remain excluded. Both pages show reconciliation counts and source limitations.

At most 20 regular CSV files are read, each limited to 10 MB, with 20,000 activity rows across the combined preview. Symlink entries are skipped. Unreadable files and unsupported schemas get generic errors without raw content or paths. Realized gain/loss reports have a different schema and are not accepted by this activity parser; they will need a separate importer.

The original files are the only persistent import data. No normalized archive, database, personal account mapping or correction file is created. Removing the CSV removes the preview on the next page load. Saving accepted mappings or manual overrides requires a separate storage decision. Next.js output tracing excludes `private-data/` to prevent exports from being packaged into deployment artifacts. Preview values still reach your browser for display; hide balances is display privacy, not authentication. Real records must never be copied into test fixtures.

## Validation

The initial preview passed 384 synthetic unit tests and its desktop interaction check. The subsequent [reconciliation implementation](csv-reconciliation.md) adds tests for account/transaction matching, source precedence, local-clock ordering, missing settlements, duplicate claims, delayed booking and ending-share safeguards. Browser checks use synthetic fixtures only. No real-data screenshots or raw financial logs were generated.
