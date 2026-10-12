/**
 * Integration tests over the generated sample book: each roster story must
 * actually show up in the invoices, and the narrative must stay plain and
 * inside its guardrail. Run with:  node --test
 */
const test = require('node:test');
const assert = require('node:assert');
const D = require('./distributor-data.js');
const LG = require('./distributor-logic.js');
const M = require('./distributor-model.js');
const R = require('./distributor-rollups.js');
const T = require('./distributor-narrative.js');

const book = M.buildBook(D.ROSTER, D.BOOK.baseRate);
const byId = id => book.find(o => o.id === id);
const withSignal = s => book.filter(o => o.signals.includes(s));
const healthy = book.filter(o => !o.signals.length);
const tierOf = p => (p > 0.7 ? 'high' : p >= 0.4 ? 'medium' : 'low');
const teamOf = o => LG.reviewTeam({ flagged: tierOf(o.prob) !== 'low', scope: o.scope.key, topDriver: T.topRiskDriver(o) });

// ------------------------------------------------------------- generation

test('generation is deterministic for a given operator', () => {
  const a = M.buildOperator(D.ROSTER[0], 0.3);
  const b = M.buildOperator(D.ROSTER[0], 0.3);
  assert.deepEqual(a.rev, b.rev);
  assert.deepEqual(a.weeks, b.weeks);
});

test('generated invoices are scaled to the roster 90-day revenue', () => {
  for (const o of book) {
    const target = D.ROSTER.find(r => r.id === o.id).rev90;
    assert.ok(Math.abs(o.rev90 / target - 1) < 0.02, `${o.id}: ${o.rev90} vs ${target}`);
  }
});

test('building an operator does not mutate the roster row', () => {
  const row = D.ROSTER[0];
  const before = JSON.stringify(row);
  M.buildOperator(row, 0.3);
  assert.equal(JSON.stringify(row), before);
});

test('the book is ordered by revenue at risk, largest first', () => {
  for (let i = 1; i < book.length; i++) assert.ok(book[i - 1].revAtRisk >= book[i].revAtRisk);
});

test('erosion operators lose revenue quarter on quarter', () => {
  for (const o of withSignal('erosion')) assert.ok(o.revTrend < -0.15, `${o.id} ${o.revTrend}`);
});

test('healthy operators hold steady and keep every category', () => {
  for (const o of healthy) {
    assert.ok(Math.abs(o.revTrend) < 0.1, `${o.id} ${o.revTrend}`);
    assert.equal(o.catsLost.length, 0, o.id);
  }
});

test('operators with fewer categories now than at peak have stopped categories', () => {
  for (const o of book.filter(x => x.catsNow < x.catsPeak)) assert.equal(o.catsLost.length, o.catsPeak - o.catsNow, o.id);
});

test('schools dip in summer, but the dip is not read as decline', () => {
  const schools = healthy.filter(o => o.type === 'Education');
  assert.ok(schools.length >= 3);
  for (const o of schools) {
    assert.ok(o.revTrendRaw < -0.1, `${o.id} raw ${o.revTrendRaw}`);   // the real numbers do dip
    assert.ok(Math.abs(o.revTrend) < 0.1, `${o.id} adj ${o.revTrend}`); // the trend allows for it
    assert.ok(o.categories.every(c => c.status === 'Active'), o.id);
    assert.ok(T.facts(o).some(f => f.topic === 'Season'), o.id);
  }
});

test('the sample resembles a real book: roughly a third of operators flagged', () => {
  const share = book.filter(o => tierOf(o.prob) !== 'low').length / book.length;
  assert.ok(share > 0.25 && share < 0.45, `flagged share ${share}`);
});

test('switch operators show a like-for-like product being replaced', () => {
  for (const o of withSignal('switch')) {
    assert.ok(o.shifts.some(s => !s.cheaper), o.id);
    assert.ok(o.products.some(p => p.replacedBy), o.id);
  }
});

test('trade-down operators show a shift to cheaper products', () => {
  for (const o of withSignal('tradedown')) assert.ok(o.asp.mixEffect < -0.03, `${o.id} ${o.asp.mixEffect}`);
});

test('price operators show prices rising above normal drift and a smaller discount', () => {
  for (const o of withSignal('price')) {
    assert.ok(o.asp.priceEffect > 0.04, `${o.id} ${o.asp.priceEffect}`);
    assert.ok(o.discountNow < o.discountPrior, o.id);
  }
});

test('service operators show late deliveries rising', () => {
  for (const o of withSignal('service')) assert.ok(o.service.lateRecent - o.service.latePrior > 0.1, o.id);
});

test('each scope appears in the sample book at least once', () => {
  const scopes = new Set(book.map(o => o.scope.key));
  for (const k of Object.keys(LG.SCOPE)) assert.ok(scopes.has(k), k);
});

test('every review team gets at least one flagged operator', () => {
  const teams = new Set(book.map(teamOf));
  for (const k of Object.keys(D.REVIEW_TEAMS)) assert.ok(teams.has(k), k);
});

test('driver attributions add up to score minus base rate for every operator', () => {
  for (const o of book) {
    const total = o.attribution.reduce((a, d) => a + d.pts, 0);
    assert.ok(Math.abs(total - (o.prob - D.BOOK.baseRate)) < 1e-9, o.id);
  }
});

// -------------------------------------------------------------- narrative

const PRICE_ADVICE = /\b(offer|discount of|lower (the|their) price|match(ing)? (the|a) price|reduce (the|their) price|\$\d+(\.\d+)? per case)\b/i;
const JARGON = /\b(pts|SHAP|mix effect|recency ratio|attribution|NaN|undefined)\b|\s[.,]|\b(in|of|buying) \./;

const allText = o => {
  const tier = tierOf(o.prob);
  return [
    T.headline(o, tier), T.summary(o, tier, teamOf(o)),
    ...T.whatChanged(o).map(c => c.title + ' ' + c.detail),
    ...T.levels(o).map(l => l.verdict + ' ' + l.detail),
    ...T.facts(o).map(f => f.text), ...T.questions(o),
    ...o.attribution.map(d => T.driverText(d.key, o)),
  ].join('\n');
};

test('no narrative text ever recommends a price, discount or offer', () => {
  for (const o of book) assert.ok(!PRICE_ADVICE.test(allText(o)), `${o.id}: ${allText(o).match(PRICE_ADVICE)}`);
});

test('narrative text stays free of model jargon and broken values', () => {
  for (const o of book) assert.ok(!JARGON.test(allText(o)), `${o.id}: ${allText(o).match(JARGON)}`);
});

test('summary of a flagged operator names the review team and the scope', () => {
  const o = byId('OP-20104');
  const text = T.summary(o, 'high', teamOf(o));
  assert.match(text, /Sales should review it/);
  assert.match(text, /whole relationship|category-specific/);
});

test('a healthy operator gets a short "buying normally" headline', () => {
  assert.equal(T.headline(healthy[0], 'low'), 'Buying normally');
});

test('the levels breakdown flags the product level for a product switch', () => {
  const o = byId('OP-20123');
  const products = T.levels(o).find(l => l.level === 'Products');
  assert.ok(products.hit);
  assert.match(products.detail, /→/);
});

test('the brief text carries the guardrail', () => {
  assert.ok(T.briefText(book[0], 'high', 'sales').includes(T.GUARDRAIL));
});

// ---------------------------------------------------------------- rollups

test('category rollup revenue reconciles to operator revenue', () => {
  const total = R.categoryRollup(book).reduce((a, r) => a + r.rev12, 0);
  const expected = book.reduce((a, o) => a + o.rev12, 0);
  assert.ok(Math.abs(total - expected) < 1e-6 * expected);
});

test('product shares in a category sum to one in each window', () => {
  const rows = R.productMix(book, 'Cups & Lids');
  const near1 = v => Math.abs(v - 1) < 1e-9;
  assert.ok(near1(rows.reduce((a, r) => a + r.priorShare, 0)));
  assert.ok(near1(rows.reduce((a, r) => a + r.recentShare, 0)));
});

test('team rollup covers every flagged operator exactly once', () => {
  const rows = R.teamRollup(book, teamOf);
  const flagged = book.filter(o => tierOf(o.prob) !== 'low').length;
  assert.equal(rows.reduce((a, r) => a + r.count, 0), flagged);
});
