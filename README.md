# Operator Churn Intelligence

An interactive prototype dashboard for spotting foodservice **operators** (customers) who are
likely to stop buying — and for giving an account manager a concrete, plain-English reason why,
plus a printable sales call brief.

Built as a single self-contained HTML file. No build step, no `npm install`, no backend.

> **Prototype status — the data is synthetic.** Every number below is generated in the browser
> from hardcoded constants. There is no BigQuery, BQML, or API connection yet, despite the
> `BQML v1` badge in the header. See [Data](#data) before showing this to anyone as real output.

---

## Quick start

```bash
open "Churn Dashboard.dc.html"
```

That's it — double-clicking the file works too. `support.js` bootstraps itself, pulls
React 18.3.1 + ReactDOM + Babel standalone from unpkg (with SRI hashes), then mounts the
component on `DOMContentLoaded`.

**Requires an internet connection** — React and Babel are loaded from the CDN at runtime,
not bundled.

---

## What the dashboard shows

Four tabs, navigated from the header or by clicking into a row.

### 1. Overview — the whole book of business

| Panel | What it shows |
|---|---|
| **Total operators** | 20K active, vs 21K last month (−1K) |
| **Revenue by lookback window** | Last 30 / 90 / 120 days — $6M / $19M / $32M, each against the prior month with a % delta |
| **Risk tier cards** | High churn (1K), Medium (7K), Low churn (12K), each split S / M / L by customer size with a proportional bar |
| **Lost operators** | 250 — flagged High last month and have since stopped buying (S 200 · M 40 · L 10) |
| **Tier movement** | Current vs last month per tier, split into Retained / New / Net |
| **Operators trending churn** | Carried over from the last snapshot by segment, plus new entrants |
| **Operators by churn probability** | Sortable table of every operator — probability bar, revenue at risk, tier pill, Δ vs last month. Click any row to drill in. Exports to CSV. |

### 2. Operator — why this one customer is at risk

- **Headline KPIs** — churn probability, revenue at risk (90d), product lines now vs peak
- **12-month volume** — monthly unit bars, last 3 months highlighted in the tier colour
- **Purchase recency** — days since last purchase, typical reorder interval, and a *recency
  ratio* gauge (`days since ÷ typical interval`). Above 1.8× is flagged as the clearest early
  warning sign.
- **AI · Why this customer is at risk** — a plain-English paragraph written for a salesperson,
  not an analyst, plus weighted drivers ranked Major / Moderate / Minor:
  - *"Ordering 38% less than last quarter"*
  - *"Their price went up 8.5% since March"*
  - *"No order in 48 days — usually orders every 14 days"*
  - *"Stopped buying 3 of 5 product lines"*
- **Feedback** — Useful / Not right buttons on the explanation (togglable via props)

### 3. Operator · Product line — where the loss is coming from

- Table of every product line: status (**Active / Declining / Stopped**), 12-month qty and
  revenue, share of that customer's revenue, 3-month qty trend, 6-month price change
- 12-month volume bars for the selected line
- **Avg price trend** chart overlaying three series — agreement price (what they pay),
  peer average (what similar operators pay), and list price
- **AI line insight** that adapts to status, e.g. a stopped line reads *"stopped buying poultry
  after Jun 2026 … orders were steady until their price went up 9.2%, so they have likely
  switched to another supplier."*

### 4. Operator · Product — the SKU-level detail

Seven KPIs per product: Qty 12mo, Revenue 12mo, Agreement price (with % change since March),
Discount vs list, **Price vs peers**, Claim amount 12mo (`(list − agreement) × qty`), and Last
bought. Plus volume bars, the same three-series price chart, an AI product insight, and a full
cross-line product table.

### Sales call brief

The **Sales call brief** button opens a printable one-pager: situation summary, up to 6
auto-generated talking points derived from the actual stopped/declining lines and
over-peer-priced products, a product-line table, blank call notes, and Staying / Price review /
At risk outcome checkboxes. **Copy as text** or **Print / Save as PDF** (print CSS isolates the
brief from the rest of the page).

---

## Filters and controls

Applied across the whole dashboard:

- **Operator** — free-text search on name or ID
- **Price agreement** — All / Casual Dining / Healthcare / Education / QSR / Lodging
- **Predicted month** — Sep 2026 / Aug 2026 / Jul 2026
- **Customer segment** — All / S / M / L, which rescales operator counts, revenue and tier splits

Exposed as editable props (`data-props` on the script tag):

| Prop | Default | Range | Effect |
|---|---|---|---|
| `highThreshold` | 85% | 60–95 | Probability above which an operator is High churn |
| `mediumThreshold` | 75% | 40–90 | Lower bound of the Medium band |
| `showFeedback` | `true` | — | Show the Useful / Not right buttons on AI explanations |

Moving the thresholds re-tiers every operator live, including the legend ranges.

---

## Data

**All data is synthetic and hardcoded.** Nothing is fetched.

- **12 demo operators** in the `OPS` array — `[id, name, segment, agreement, type, revenue90d,
  churnProb, deltaPts, daysSinceLastPurchase, avgInterval, linesNow, linesPeak]`. They span
  93% down to 18% churn probability across Casual Dining, Healthcare, QSR, Education and Lodging.
- **Aggregate tiles** (20K operators, the $6M/$19M/$32M revenue windows, tier movement, lost
  operators) come from the `INS`, `MOVE`, `CARRY`, `LOST` and `REV` constants.
- **Everything below the operator level is generated** — product lines, SKUs, 12 months of
  quantities, prices, peer prices and list prices are synthesised per operator from a seeded PRNG
  keyed off the operator ID and revenue. That makes it **deterministic**: the same operator always
  produces the same charts across reloads.
- A 12-line product `CATALOG` (Poultry, Beef & pork, Seafood, Dairy & eggs, Produce, Bakery,
  Dry & canned, Frozen, Beverages, Disposables, Janitorial, Nutrition) is filtered per operator
  type by `TYPE_LINES`, so a Healthcare account gets Nutrition and Janitorial while a QSR gets
  Bakery and Disposables.

The decline pattern is deliberately modelled: higher churn probability ⇒ steeper volume fall in
the back half of the year ⇒ larger price increase since March ⇒ more dropped product lines. That
way the AI explanations and the charts always agree with each other.

---

## Requirements coverage

The dashboard was built from a spreadsheet spec (`uploads/Screenshot 2026-09-28 at 20.39.44.png`
— **not committed**, `/uploads` is gitignored). Every figure in that spec is reproduced exactly:
20K/21K operator counts, the three revenue windows, tier movement (1K/1K/800/300/−100 …), lost
customers 250 = 200/40/10, and both churn-insight matrices.

The spec's four drill-down requirements are all implemented:

| # | Requirement | Where |
|---|---|---|
| 1 | 12-month volume trend for the customer | Operator tab, volume bars |
| 2 | Products / product lines purchased over time | Operator tab, stacked line-count chart + Product line tab |
| 3 | Last purchased vs purchase frequency (ratio) | Operator tab, Purchase recency card + recency-ratio gauge |
| 4 | Some AI explanation | Operator / line / product AI panels + sales call brief |

---

## Files

```
Churn Dashboard.dc.html   The dashboard — template + component logic (~770 lines)
support.js                Generated dc-runtime; do not edit by hand
.gitignore                /uploads, .DS_Store
```

`Churn Dashboard.dc.html` is a `.dc.html` document: markup lives inside `<x-dc>` using `sc-for`
and `sc-if` template directives with `{{ }}` bindings, and the logic is a `class Component
extends DCLogic` in a `<script type="text/x-dc">` tag. A single `renderVals()` returns every
value the template binds to, so state flows one way and there is no DOM manipulation anywhere.

`support.js` is generated from `dc-runtime/src/*.ts` (rebuild with `cd dc-runtime && bun run
build`) — that source isn't in this repo.

---

## Status

**Done**

- Full four-level drill-down: overview → operator → product line → product
- All filters, risk-tier thresholds, and segment rescaling
- AI explanations at operator, line and product level, with feedback capture
- Sales call brief with copy-to-clipboard and print-to-PDF
- CSV export for the operator list and for a single operator's products
- Every figure reconciled against the spreadsheet spec

**Not done / known limitations**

- **No real data source.** Not wired to BigQuery, BQML, or any API — the `BQML v1` badge is a
  placeholder.
- **The Predicted month selector is cosmetic.** It changes labels and the CSV filename, but the
  underlying numbers are the same for Sep / Aug / Jul.
- **AI text is templated, not model-generated.** The summaries are string templates filled from
  the computed metrics — deterministic, and no model is called.
- **Feedback is not persisted.** Useful / Not right lives in component state and resets on reload.
- **Requires internet** for the React and Babel CDN loads.
- **No tests** and no CI.
