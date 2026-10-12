# Churn Intelligence Dashboards

Two interactive prototypes of churn intelligence for foodservice disposables, one from each side
of the channel. All data is synthetic.

| Folder | Point of view | What it answers |
|---|---|---|
| [`manufacturer-dashboard/`](manufacturer-dashboard/README.md) | Manufacturer, which sees demand indirectly through claims and distributor reports | Which operators are likely to stop buying our products, and why |
| [`distributor-dashboard/`](distributor-dashboard/README.md) | Distributor, which sees daily invoices directly | Which operators are buying less, dropping categories or switching products, and who should review them |
| `shared/` | — | `support.js` (the dc-runtime, generated; do not edit) and `url-state.js` (keeps each view in the link) |
| `tools/` | — | `build-single-file.js`, which makes the shareable single-file versions |

## Open

Double-click a dashboard's `.dc.html` file, or serve this folder:

```bash
python3 -m http.server 8765
```

- Manufacturer: http://localhost:8765/manufacturer-dashboard/Churn%20Dashboard.dc.html
- Distributor: http://localhost:8765/distributor-dashboard/Distributor%20Churn%20Dashboard.dc.html

Run from the folders, the pages need an internet connection, because React loads from a CDN.

## Share as a single file

```bash
node tools/build-single-file.js
```

This writes `dist/distributor-dashboard.html` and `dist/manufacturer-dashboard.html`. Each is one
file (~350 KB) with every script and React inside it. Email it or drop it in chat: it opens
anywhere, **offline**, with no folders next to it. Only the web font needs internet, and without
it the page falls back to the system font. React is downloaded once into `tools/.cache/` and
checked against the runtime's integrity hashes. `dist/` is not committed, so rebuild after
changes.

## Links

Both dashboards keep the current view in the address bar, for example
`…/Distributor Churn Dashboard.dc.html#view=operator&op=OP-10418`. Copy the link to send someone
straight to an operator. Links work in the single-file versions too.

## How the two dashboards compare

They share the same words and colours: **Risk score**, **High / Medium / Low risk**, and a
"no price is suggested" note on every AI explanation. Two numbers are deliberately defined
differently, because the two businesses see different data:

| | Manufacturer | Distributor |
|---|---|---|
| Risk bands (editable) | High > 85%, Medium 75–85% — from the original spreadsheet spec | High > 70%, Medium 40–70% |
| Revenue at risk | The operator's revenue in the **last 90 days** | The operator's **usual quarterly spend** (Oct–Mar) × risk score |
| Why | Matches the spec the dashboard was reconciled to | An operator that has already fallen away still shows what it used to be worth |

Each page states its definition next to the number, so side-by-side readings stay honest.

## Test

```bash
(cd manufacturer-dashboard && node --test)   # 73 tests: analytics, on-screen wording, metric catalog
(cd distributor-dashboard && node --test)    # 57 tests: logic, generated data, narrative
(cd shared && node --test)                   # 7 tests: link encoding and validation
(cd tools && node --test)                    # 2 tests: single-file build safety
```
