# Distributor Churn Intelligence

An interactive prototype of **operator retention intelligence from a distributor's point of view**,
built from [`docs/distributor_churn_business_case.md`](docs/distributor_churn_business_case.md) (operators, categories, products). It is the companion to
the manufacturer dashboard in the repo root and uses the same runtime.

> **Prototype status: the data is synthetic.** 88 sample operators are generated in the browser
> from a seeded roster, and the book-level figures and model metrics are constants. No model is
> trained and nothing is fetched.

---

## Quick start

Double-click `Distributor Churn Dashboard.dc.html`, or serve the **repo root** over HTTP (the page loads the shared runtime from `../shared/support.js`, so keep the folders together):

```bash
cd churn_dashboard            # repo root, not this folder
python3 -m http.server 8765
open "http://localhost:8765/distributor-dashboard/Distributor%20Churn%20Dashboard.dc.html"
```

You need an internet connection, because `support.js` loads React and Babel from a CDN.

Tests use Node's built-in runner with no dependencies:

```bash
cd distributor-dashboard && node --test     # 57 tests
```

---

## Designed to be understood without training

The users are salespeople and business teams, not analysts, so every screen answers a plain
question in plain words:

- **One sentence first.** The Overview opens with "30 of 88 operators need a review, with $6.87M
  of revenue at risk per quarter…" and a button to the queue.
- **One line per operator.** Every list shows *what is happening* ("Stopped buying napkins",
  "Moving to cheaper take-out containers", "Delivery problems — 25% of orders late"), not a score
  to interpret.
- **Who should act.** Each flagged operator is routed to Sales, the Category team, Pricing or
  Customer service, with a one-line review focus.
- **A story, not a dashboard.** The operator page reads top to bottom: verdict, then what changed,
  where the decline is, the plain-words summary, the evidence, and the questions to ask.
- **No jargon on the main path.** Scores become *High / Medium / Low risk*. Model contributions
  become *Strong / Moderate / Slight*. "Mix effect" becomes *choosing cheaper products*.
- **Built-in help.** A dismissible "three steps" strip on the Overview, plus a **? Help** panel
  with a glossary.
- **Insight, not negotiation.** No text ever suggests a price, discount or offer, and every
  explanation says so. A test fails if generated text drifts into price advice or model jargon.

---

## The views (section 13 of the business case)

Four business tabs, plus Model health in a separate **Analyst** area (header link), as the
solution blueprint asks: diagnostics stay out of the operator review workflow.

| Tab | For | What it shows |
|---|---|---|
| **Overview** | Leadership | Summary sentence, book size, revenue, revenue-at-risk trend, operators per risk level, **what is happening** (5 patterns, click to filter), **who needs to act** (team workload, click to filter), the 5 operators to review first, and the categories slipping most |
| **Risk queue** | Sales / Pricing | Operators needing review, biggest revenue at risk first, with a headline, pattern, risk, last order and review team. Filter by risk level, pattern or team, export to CSV, and see healthy operators in a separate list |
| **Operator** | Business users | Verdict card, "what changed" cards, **where is the decline** at three levels (whole operator → categories → products), plain summary with 👍/👎 feedback, monthly spend, week-by-week ordering, category cards with each category's products (status, *being replaced by / replacing*), what raised and lowered the risk, price and margin, delivery and service, facts to review, questions to ask, and a printable **review brief** |
| **Category risk** | Category managers | Category cards by revenue at risk, then for one category: an insight, who is slipping and how (stopped / buying less / switching), and product share before vs now with our margin |
| **Model health** (Analyst link, not a tab) | Analytics | Hit rate, catch rate, AUC and Brier score, each explained in a sentence. Also a track record, data drift, what the model pays attention to, the score spread, and feedback counts |

**Everyday use:**

- **Links open the same view.** The address bar always reflects the tab, operator, category and
  filters (`#view=operator&op=OP-10418`), so a copied link, or the **Copy link** button on an
  operator, opens exactly that view. Hand-edited or stale links fall back to the Overview.
- **Sortable tables.** Click any column title in the Risk queue or "Who is slipping" to sort, and
  click again to reverse. "Back to default order" restores the queue order.
- **Keyboard.** Every clickable row and column title can be reached with Tab and opened with
  Enter, with a visible focus ring.
- **Phones.** Below 700px the filters fold behind a **Filters** button and the tabs scroll
  sideways.

Filters: operator search, branch, operator type, size. Editable props: `highThreshold` (70%),
`mediumThreshold` (40%), `showFeedback`.

---

## How the analysis works

**Pattern of decline** (`distributor-logic.js → riskScope`), checked in order:

| Pattern | Rule |
|---|---|
| Buying less overall | Spend down ≥ 20% and ≥ 60% of earlier spend is in falling or stopped categories |
| Dropping categories | Some categories have stopped or are falling |
| Buying cheaper products | Within categories, cheaper items lowered the average price by ≥ 5% |
| Switching products | A category's main product lost ≥ 20 points of share to another product |
| Buying pattern steady | None of the above. Any risk comes from price, service or order timing |

**Review team** (`reviewTeam`): service problems go to Customer service, product switching to the
Category team, cheaper products or price rises to Pricing, and everything else to Sales.

**Revenue at risk** = the operator's usual quarterly spend (Oct–Mar, before any decline) × risk
score. The queue, team totals and category totals all use this same definition.

**Price vs product choice** (`aspDecomposition`) splits a change in average price into a price
effect (same items, new prices) and a product-choice effect (cheaper or dearer items). The two
always add up to the total change, and they are measured within each category.

**Why the model scored it this way** (`attribute`) is a SHAP-style approximation. Drivers add up
exactly from the 30% book average to the operator's score. Protective drivers keep their raw
value, and only risk-raising drivers are rescaled.

---

## Synthetic data

- `distributor-data.js`: 8 disposables and jan-san categories with real-brand product names (GP,
  Kimberly-Clark, Dart, Pactiv and others), list prices, 3 branches, review teams, and **88
  operators**. Every figure is invented.
- Each operator has **signals** (`erosion`, `switch`, `tradedown`, `price`, `service`) plus a
  current and peak category count. `distributor-model.js` turns those into 12 months of invoice
  lines per product, seeded by operator ID, so the charts, drivers and text always agree.
- About a third of the sample is flagged (30 of 88), close to the book-level split. The 40 steady
  operators include five schools so the summer pattern is visible.
- Snapshot date is fixed at **2026-09-30**.

---

## Files

```
Distributor Churn Dashboard.dc.html   template + thin component (state, filters, help, tabs)
distributor-data.js                   catalog, roster, review teams, book constants, model metrics
distributor-logic.js                  pure analytics: product switching, price/choice split, patterns, teams, attribution
distributor-model.js                  roster → invoices → per-operator metrics
distributor-narrative.js              plain-language headline, summary, changes, levels, facts, questions, brief
distributor-rollups.js                category, product-share and team rollups
distributor-format.js                 number and date formatting
views/view-*.js                       one view-model builder per tab
*.test.js                             node --test suites
```

The only thing shared with the manufacturer dashboard is the runtime, `../shared/support.js`. The
few generic helpers (seeded PRNG, 3-month trend) are copied into `distributor-logic.js`, so this
folder does not depend on the manufacturer one.

---

## Known limitations

- **No real data or model.** Everything is generated, and the Model health numbers are constants.
- **AI text is templated**, not produced by an LLM. It is grounded in the computed metrics, which
  is the behaviour a real LLM layer should copy.
- **Seasonality covers schools only.** Education operators buy less in Jun–Aug every year; that
  dip is generated, and every trend and status is measured against it so summer is not read as
  churn (the operator page says so). Other seasonal patterns (holidays, tourism) are not modelled.
- **Feedback is not persisted** beyond the browser session. Only "hide the intro" is remembered.
