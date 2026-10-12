# Metric, visual and filter catalog

The single source of truth for what the manufacturer dashboard shows. The design doc's
"Metric, visual and filter catalog" tab is generated from these files; change them together.

| File | Holds |
|---|---|
| `metrics.json` | 84 metrics across six levels (`pf_` portfolio, `op_` operator, `ln_` operator + line, `pr_` operator + product, `bk_` product line book, `an_` analyst), each with definition, tier, visual and source |
| `screens.json` | 5 tabs (Overview, Operator, Operator · Product line, Operator · Product, Model health): question, headline metrics (max 6), sections with their own filters and sortable tables, tab filters, actions such as the review brief, drill targets |
| `filters.json` | 14 filters with values, defaults and API parameters |
| `visuals.json` | 29 standard visual components and their rules |
| `marts.json` | Data capabilities (what makes a metric Enhanced) and the 17 marts metrics are served from |
| `manufacturer.config.example.json` | Template for onboarding a manufacturer |
| `catalog.js` | Loads the catalog and resolves a screen for one manufacturer's config |
| `render-markdown.js` | Prints the doc tables from the JSON |

```bash
node --test catalog/catalog.test.js      # consistency checks (run from manufacturer-dashboard/)
node catalog/render-markdown.js metrics:op   # one doc table; no argument prints all
```

**Core vs Enhanced.** Core metrics need only claims data (operator, product, product line,
month, revenue, quantity, agreement price). Enhanced metrics list the capability they need in
`requires`; when a manufacturer's config has that capability off, `resolveScreen` drops the
metric, and drops any section left empty, so nothing renders blank.
