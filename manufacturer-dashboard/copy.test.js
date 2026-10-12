/**
 * Guards the wording of the dashboard. Run with:  node --test
 *
 * The AI text supports the salesperson with facts; it must not tell them
 * what price to offer (negotiation stays human — the rep cannot see what
 * competitors are quoting). The screens are for business users, so model
 * jargon and leftover "customer" wording are kept out of visible text.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, 'Churn Dashboard.dc.html'), 'utf8');
// Comments are for developers, not users — strip them before checking copy.
const visible = html
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const banned = (label, re) => test(`no ${label} in user-facing text`, () => {
  const m = visible.match(re);
  assert.equal(m, null, `found: "${m && m[0]}"`);
});

banned('price instructions', /suggested next step|consider matching|offer a price|lowering the price|price review|talk pricing|agree new terms|review pricing|best way to (keep|protect)/i);
banned('"ASP" jargon', /\bASP\b/);
banned('standard-deviation symbol', /σ/);
banned('"recency ratio" jargon', /recency ratio/i);
banned('placeholder model badge', /BQML/);
banned('cosmetic predicted-month selector', /Predicted month/);
banned('"customer" wording (the dashboard is about operators)', /\bcustomers?\b/i);
banned('down arrow meaning "above peers"', /↓/);
// Same risk vocabulary as the distributor dashboard, so the two read alike side by side.
banned('old tier names', /High churn|Low churn|label: 'Medium'/);
banned('"churn probability" (the shared term is "risk score")', /churn prob/i);

test('clickable rows are reachable by keyboard', () => {
  const rows = visible.match(/<div onClick="\{\{ [a-z]\.(open|pick) \}\}"[^>]*>/g) || [];
  assert.ok(rows.length >= 4, 'expected the operator, line, peer and product rows');
  for (const row of rows) assert.match(row, /tabIndex="0"/, row.slice(0, 60));
});

test('the operator table headers are sortable', () => {
  assert.match(visible, /sc-for list="\{\{ tableHead \}\}"[^>]*>\s*<div[^>]*onClick="\{\{ h\.sort \}\}"/);
});

test('every AI panel carries the no-price guardrail', () => {
  const panels = (visible.match(/class="?[^"]*\bai\b|>AI</g) || []).length;
  assert.ok(panels >= 3, 'expected the operator, line and product AI panels');
  assert.match(visible, /No price is suggested/);
});
