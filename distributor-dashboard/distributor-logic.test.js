/**
 * Run with:  node --test   (from this folder or the repo root)
 * No dependencies — Node's built-in test runner only.
 */
const test = require('node:test');
const assert = require('node:assert');
const L = require('./distributor-logic.js');

// ----------------------------------------------------------------- helpers

const months = v => Array(12).fill(v);
/** First six months at `a`, last six at `b`. */
const split = (a, b) => [...Array(6).fill(a), ...Array(6).fill(b)];
const prod = (name, qty, price, cost) => ({ name, qty, price: price || months(10), cost: cost || months(7) });

const near = (actual, expected, tol = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < tol, `expected ${expected}, got ${actual}`);

// ------------------------------------------------------------ product mix

test('shareByProduct sums units per product over the window, largest first', () => {
  const s = L.shareByProduct([prod('Plate A', months(30)), prod('Plate B', months(10)), prod('Plate A', months(10))], [9, 10, 11]);
  assert.deepEqual(s.map(x => x.name), ['Plate A', 'Plate B']);
  near(s[0].share, 0.8);
  assert.equal(s[0].units, 120);
});

test('shareByProduct returns an empty list when nothing was bought', () => {
  assert.deepEqual(L.shareByProduct([prod('Plate A', months(0))], [9, 10, 11]), []);
});

test('productSwitch detects the main product being replaced by another', () => {
  const sw = L.productSwitch([prod('Foam cup', split(80, 10)), prod('PET cup', split(20, 90))]);
  assert.equal(sw.from, 'Foam cup');
  assert.equal(sw.to, 'PET cup');
  near(sw.fromPrior, 0.8);
  near(sw.fromRecent, 0.1);
  near(sw.shiftPts, 0.7);
});

test('productSwitch ignores small wobbles under the threshold', () => {
  assert.equal(L.productSwitch([prod('Foam cup', split(80, 70)), prod('PET cup', split(20, 30))]), null);
});

test('productSwitch does not call a category that stopped entirely a switch', () => {
  assert.equal(L.productSwitch([prod('Foam cup', split(80, 0)), prod('PET cup', split(20, 0))]), null);
});

test('productStatus marks items that only started recently as New', () => {
  assert.equal(L.productStatus([0, 0, 0, 0, 0, 0, 0, 2, 5, 8, 9, 9]), 'New');
  assert.equal(L.productStatus([5, 5, 5, 5, 5, 5, 5, 5, 5, 3, 0, 0]), 'Stopped');
  assert.equal(L.productStatus(months(5)), 'Active');
});

// ------------------------------------------------------------- price vs mix

test('aspDecomposition attributes a pure price rise entirely to price', () => {
  const d = L.aspDecomposition([prod('GP', months(10), split(10, 11))], [0, 1, 2], [9, 10, 11]);
  near(d.aspPrior, 10);
  near(d.aspRecent, 11);
  near(d.priceEffect, 0.1);
  near(d.mixEffect, 0);
});

test('aspDecomposition attributes a shift to a cheaper item entirely to mix', () => {
  const d = L.aspDecomposition([
    prod('GP', split(10, 0), months(20)),
    prod('DART', split(0, 10), months(10)),
  ], [0, 1, 2], [9, 10, 11]);
  near(d.change, -0.5);
  near(d.priceEffect, 0);
  near(d.mixEffect, -0.5);
});

test('aspDecomposition: price and mix effects always add up to the total change', () => {
  const d = L.aspDecomposition([
    prod('GP', split(12, 4), split(20, 22)),
    prod('DART', split(4, 12), split(10, 10.5)),
  ], [0, 1, 2], [9, 10, 11]);
  near(d.priceEffect + d.mixEffect, d.change);
  assert.ok(d.mixEffect < 0 && d.priceEffect > 0);
});

test('aspDecomposition returns null when either window has no volume', () => {
  assert.equal(L.aspDecomposition([prod('GP', split(10, 0))], [0, 1, 2], [9, 10, 11]), null);
});

// --------------------------------------------------------- category status

test('categoryStatus: no volume in the last two months after buying earlier is Stopped', () => {
  assert.equal(L.categoryStatus([5, 5, 5, 5, 5, 5, 5, 5, 5, 3, 0, 0]), 'Stopped');
});

test('categoryStatus: a quarter-on-quarter drop beyond 15% is Declining', () => {
  assert.equal(L.categoryStatus([10, 10, 10, 10, 10, 10, 10, 10, 10, 7, 7, 7]), 'Declining');
});

test('categoryStatus: steady volume is Active', () => {
  assert.equal(L.categoryStatus(months(10)), 'Active');
});

// --------------------------------------------------------------- risk scope

const cat = (status, revPrior) => ({ status, revPrior });

test('riskScope: decline across most of the wallet is operator-wide', () => {
  const s = L.riskScope({ categories: [cat('Declining', 50), cat('Stopped', 30), cat('Active', 20)], revTrend: -0.35, switches: 0, mixEffect: 0 });
  assert.equal(s.key, 'operator-wide');
});

test('riskScope: decline confined to a minor category is category-specific', () => {
  const s = L.riskScope({ categories: [cat('Active', 70), cat('Stopped', 10), cat('Active', 20)], revTrend: -0.05, switches: 0, mixEffect: 0 });
  assert.equal(s.key, 'category-specific');
});

test('riskScope: steady volume with a product switch is product-switch', () => {
  const s = L.riskScope({ categories: [cat('Active', 60), cat('Active', 40)], revTrend: -0.02, switches: 1, mixEffect: 0 });
  assert.equal(s.key, 'product-switch');
});

test('riskScope: steady volume at a lower ASP from mix is trade-down', () => {
  const s = L.riskScope({ categories: [cat('Active', 60), cat('Active', 40)], revTrend: -0.08, switches: 0, mixEffect: -0.09 });
  assert.equal(s.key, 'trade-down');
});

test('riskScope: a switch to a cheaper product reads as trade-down, not just a switch', () => {
  const s = L.riskScope({ categories: [cat('Active', 60), cat('Active', 40)], revTrend: -0.1, switches: 1, mixEffect: -0.2 });
  assert.equal(s.key, 'trade-down');
});

test('riskScope: nothing moving is stable', () => {
  assert.equal(L.riskScope({ categories: [cat('Active', 1)], revTrend: 0.01, switches: 0, mixEffect: 0 }).key, 'stable');
});

// ------------------------------------------------------------------ recency

test('recencyState grades days since last invoice against the usual interval', () => {
  assert.equal(L.recencyState(4, 4).state, 'on-schedule');
  assert.equal(L.recencyState(6, 4).state, 'late');
  assert.equal(L.recencyState(12, 4).state, 'overdue');
  near(L.recencyState(12, 4).ratio, 3);
});

// ------------------------------------------------------------------ review

test('revenueAtRisk weights the usual quarterly spend by the risk score', () => {
  // Oct–Mar is the "usual" baseline: six months of 100 = 300 a quarter.
  const rev = [...Array(6).fill(100), ...Array(6).fill(20)];
  near(L.revenueAtRisk(rev, 0.5), 150);
});

test('reviewTeam sends a healthy operator to nobody', () => {
  assert.equal(L.reviewTeam({ flagged: false, scope: 'operator-wide', topDriver: 'revTrend' }), 'none');
});

test('reviewTeam routes service-led risk to customer service whatever the scope', () => {
  assert.equal(L.reviewTeam({ flagged: true, scope: 'category-specific', topDriver: 'service' }), 'service');
});

test('reviewTeam routes by the shape of the decline', () => {
  assert.equal(L.reviewTeam({ flagged: true, scope: 'operator-wide', topDriver: 'revTrend' }), 'sales');
  assert.equal(L.reviewTeam({ flagged: true, scope: 'category-specific', topDriver: 'catsLost' }), 'sales');
  assert.equal(L.reviewTeam({ flagged: true, scope: 'product-switch', topDriver: 'switch' }), 'category');
  assert.equal(L.reviewTeam({ flagged: true, scope: 'trade-down', topDriver: 'tradeDown' }), 'pricing');
  assert.equal(L.reviewTeam({ flagged: true, scope: 'stable', topDriver: 'price' }), 'pricing');
});

test('strength turns a contribution into a plain word', () => {
  assert.equal(L.strength(0.2), 'Strong');
  assert.equal(L.strength(-0.09), 'Moderate');
  assert.equal(L.strength(0.02), 'Slight');
});

// ------------------------------------------------------------- attribution

test('attribute scales driver contributions so they sum to score minus base rate', () => {
  const out = L.attribute([{ key: 'a', raw: 0.3 }, { key: 'b', raw: 0.1 }, { key: 'c', raw: -0.05 }], 0.78, 0.18);
  near(out.reduce((a, d) => a + d.pts, 0), 0.6, 1e-9);
  assert.equal(out[0].key, 'a'); // largest absolute effect first
});

test('attribute keeps protective drivers negative', () => {
  const out = L.attribute([{ key: 'up', raw: 0.2 }, { key: 'down', raw: -0.1 }], 0.4, 0.18);
  assert.ok(out.find(d => d.key === 'down').pts < 0);
});

test('attribute books an unexplained remainder as "other" rather than distorting drivers', () => {
  // Raw drivers point down but the score sits above the base rate.
  const out = L.attribute([{ key: 'down', raw: -0.05 }], 0.5, 0.18);
  const other = out.find(d => d.key === 'other');
  assert.ok(other && other.pts > 0);
  near(out.reduce((a, d) => a + d.pts, 0), 0.32, 1e-9);
});

test('attribute never inflates protective drivers to offset a faint warning sign', () => {
  const out = L.attribute([{ key: 'faint', raw: 0.01 }, { key: 'tenure', raw: -0.08 }], 0.27, 0.3);
  assert.equal(out.find(d => d.key === 'tenure').pts, -0.08);
  near(out.reduce((a, d) => a + d.pts, 0), -0.03, 1e-9);
});

test('attribute drops drivers with no effect', () => {
  const out = L.attribute([{ key: 'a', raw: 0.2 }, { key: 'zero', raw: 0 }], 0.38, 0.18);
  assert.ok(!out.some(d => d.key === 'zero'));
});

// ------------------------------------------------------------------ service

test('serviceShift compares the recent quarter of late deliveries and credits to the prior one', () => {
  const orders = months(10);
  const late = [...Array(9).fill(0), 3, 3, 3];
  const rev = months(1000);
  const credits = [...Array(9).fill(5), 40, 40, 40];
  const s = L.serviceShift({ orders, late, rev, credits });
  near(s.lateRecent, 0.3);
  near(s.latePrior, 0);
  near(s.creditRecent, 0.04);
  near(s.creditPrior, 0.005);
});

test('marginRate guards against zero revenue', () => {
  near(L.marginRate(100, 75), 0.25);
  assert.equal(L.marginRate(0, 0), null);
});
