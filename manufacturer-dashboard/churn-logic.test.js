/**
 * Run with:  node --test
 * No dependencies — Node's built-in test runner only.
 */
const test = require('node:test');
const assert = require('node:assert');
const L = require('./churn-logic.js');

// ----------------------------------------------------------------- helpers

const months = v => Array(12).fill(v);
const product = (qty, price) => ({ qty: months(qty), price: months(price) });

const line = (name, status, products) => ({
  name,
  status,
  products,
  qty: Array.from({ length: 12 }, (_, i) => products.reduce((a, p) => a + p.qty[i], 0)),
});

const operator = (id, attrs, lineData = []) => ({
  id, seg: 'M', type: 'Casual Dining', region: 'Midwest', metro: 'Large Metro',
  ...attrs, lineData,
});

const near = (actual, expected, tol = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < tol, `expected ${expected}, got ${actual}`);

// ------------------------------------------------------------------- stats

test('stats computes population min/max/mean/stddev', () => {
  const s = L.stats([2, 4, 4, 4, 5, 5, 7, 9]);
  assert.equal(s.n, 8);
  assert.equal(s.min, 2);
  assert.equal(s.max, 9);
  near(s.asp, 5);
  near(s.sd, 2); // textbook population sd for this set
});

test('stats ignores null and non-finite values', () => {
  const s = L.stats([10, null, undefined, NaN, Infinity, 20]);
  assert.equal(s.n, 2);
  near(s.asp, 15);
});

test('stats returns null when nothing is comparable', () => {
  assert.equal(L.stats([]), null);
  assert.equal(L.stats([null, NaN]), null);
});

// ------------------------------------------------------------------ cohort

test('cohortFor matches on the tightest level when it has enough peers', () => {
  const target = operator('OP-1');
  const all = [target, ...Array.from({ length: 6 }, (_, i) => operator('OP-peer' + i))];
  const c = L.cohortFor(target, all, 5);
  assert.equal(c.level, 0);
  assert.equal(c.widened, false);
  assert.equal(c.thin, false);
  assert.equal(c.peers.length, 6);
  assert.ok(c.label.includes('Midwest Large Metro'));
});

test('cohortFor never includes the operator itself', () => {
  const target = operator('OP-1');
  const all = [target, ...Array.from({ length: 6 }, (_, i) => operator('OP-peer' + i))];
  assert.ok(!L.cohortFor(target, all, 5).peers.some(p => p.id === 'OP-1'));
});

test('cohortFor drops metro when the exact cell is too thin', () => {
  const target = operator('OP-1', { metro: 'Small Metro' });
  const all = [
    target,
    operator('OP-2', { metro: 'Small Metro' }),           // same cell, still only 1 peer
    ...Array.from({ length: 5 }, (_, i) => operator('OP-m' + i, { metro: 'Large Metro' })),
  ];
  const c = L.cohortFor(target, all, 5);
  assert.equal(c.level, 1);
  assert.equal(c.widened, true);
  assert.equal(c.peers.length, 6); // everyone in Midwest regardless of metro
  assert.ok(c.label.includes('any metro'));
});

test('cohortFor widens past region to national when needed', () => {
  const target = operator('OP-1', { region: 'West' });
  const all = [target, ...Array.from({ length: 5 }, (_, i) => operator('OP-e' + i, { region: 'Northeast' }))];
  const c = L.cohortFor(target, all, 5);
  assert.equal(c.level, 2);
  assert.ok(c.label.includes('national'));
});

test('cohortFor reports thin rather than inventing peers', () => {
  const target = operator('OP-1', { type: 'Lodging' });
  const all = [target, operator('OP-2', { type: 'QSR' })];
  const c = L.cohortFor(target, all, 5);
  assert.equal(c.thin, true);
  assert.equal(c.peers.length, 0);
  assert.equal(c.level, L.COHORT_LADDER.length - 1);
});

// ------------------------------------------------------------------- price

test('lineAsp weights by revenue, not a plain mean of unit prices', () => {
  const l = line('Poultry', 'Active', [product(10, 5), product(1, 100)]);
  // revenue 3*(50+100)=450 over 33 units => 13.63..., whereas a plain mean would be 52.50
  near(L.lineAsp(l, 3), 450 / 33);
});

test('lineAsp returns null for a line with no volume in the window', () => {
  assert.equal(L.lineAsp(line('Seafood', 'Stopped', [product(0, 20)]), 3), null);
});

test('lineAsp honours the requested window length', () => {
  const p = { qty: months(1), price: Array.from({ length: 12 }, (_, i) => (i < 9 ? 100 : 10)) };
  near(L.lineAsp(line('X', 'Active', [p]), 3), 10);   // last 3 months only
  near(L.lineAsp(line('X', 'Active', [p]), 12), 77.5); // (9*100 + 3*10) / 12
});

test('operatorAsp spans every line the operator buys', () => {
  const op = operator('OP-1', {}, [
    line('A', 'Active', [product(10, 10)]),
    line('B', 'Active', [product(10, 20)]),
  ]);
  near(L.operatorAsp(op, 3), 15);
});

test('peerLineStats takes min and max across peers, not across products', () => {
  const peers = [
    operator('P1', {}, [line('Poultry', 'Active', [product(1, 10)])]),
    operator('P2', {}, [line('Poultry', 'Active', [product(1, 20)])]),
    operator('P3', {}, [line('Poultry', 'Active', [product(1, 30)])]),
  ];
  const s = L.peerLineStats(peers, 'Poultry', 3);
  assert.equal(s.n, 3);
  near(s.min, 10);
  near(s.max, 30);
  near(s.asp, 20);
});

test('peerLineStats skips peers who do not buy the line at all', () => {
  const peers = [
    operator('P1', {}, [line('Poultry', 'Active', [product(1, 10)])]),
    operator('P2', {}, [line('Seafood', 'Active', [product(1, 99)])]),
  ];
  assert.equal(L.peerLineStats(peers, 'Poultry', 3).n, 1);
});

test('peerLineStats returns null when no peer buys the line', () => {
  assert.equal(L.peerLineStats([operator('P1', {}, [])], 'Poultry', 3), null);
});

// -------------------------------------------------------------- quartiles

test('quartiles gives the textbook five-number summary for odd n', () => {
  const q = L.quartiles([7, 1, 3, 5, 9]); // sorted: 1 3 5 7 9
  assert.equal(q.min, 1);
  assert.equal(q.max, 9);
  near(q.median, 5);
  near(q.q1, 3);
  near(q.q3, 7);
});

test('quartiles interpolates for even n', () => {
  const q = L.quartiles([1, 2, 3, 4]);
  near(q.median, 2.5);
  near(q.q1, 1.75); // R-7: idx 0.75 between 1 and 2
  near(q.q3, 3.25);
});

test('quartiles sorts the values and never mutates the caller array', () => {
  const input = [5, 1, 3];
  const q = L.quartiles(input);
  assert.deepEqual(q.values, [1, 3, 5]);
  assert.deepEqual(input, [5, 1, 3], 'input array must be untouched');
});

test('quartiles collapses sensibly for a single peer', () => {
  const q = L.quartiles([42]);
  assert.equal(q.n === undefined, true); // n is owned by stats(), not quartiles
  assert.equal(q.min, 42);
  assert.equal(q.max, 42);
  near(q.median, 42);
  near(q.q1, 42);
  near(q.q3, 42);
  assert.equal(q.enoughForBox, false);
});

test('quartiles handles ties without producing a negative box', () => {
  const q = L.quartiles([10, 10, 10, 10, 10]);
  near(q.q1, 10);
  near(q.q3, 10);
  assert.ok(q.q3 >= q.q1);
});

test('enoughForBox flips exactly at the documented threshold', () => {
  const below = L.quartiles(Array.from({ length: L.QUARTILE_MIN_N - 1 }, (_, i) => i));
  const at = L.quartiles(Array.from({ length: L.QUARTILE_MIN_N }, (_, i) => i));
  assert.equal(below.enoughForBox, false);
  assert.equal(at.enoughForBox, true);
});

test('quartiles ignores nulls and returns null when nothing is left', () => {
  const q = L.quartiles([1, null, NaN, 3]);
  assert.deepEqual(q.values, [1, 3]);
  assert.equal(L.quartiles([null, NaN]), null);
});

test('quartiles are always ordered min <= q1 <= median <= q3 <= max', () => {
  for (const len of [1, 2, 3, 4, 5, 8, 13]) {
    const vals = Array.from({ length: len }, (_, i) => (i * 37) % 101);
    const q = L.quartiles(vals);
    assert.ok(q.min <= q.q1 && q.q1 <= q.median && q.median <= q.q3 && q.q3 <= q.max,
      `ordering broken at n=${len}: ${JSON.stringify(q)}`);
  }
});

// ------------------------------------------------------------- tukey box

test('tukeyBox ends whiskers at the furthest peer inside 1.5 x IQR', () => {
  // q1 = 20, q3 = 40, IQR = 20 -> fences at -10 and 70
  const b = L.tukeyBox(L.quartiles([10, 20, 30, 40, 50]));
  near(b.whiskerLo, 10);
  near(b.whiskerHi, 50);
  assert.deepEqual(b.outliers, []);
});

test('tukeyBox flags peers beyond the fences as outliers', () => {
  // sorted 10 20 30 40 200: q1 20, q3 40, upper fence 70
  const b = L.tukeyBox(L.quartiles([200, 10, 30, 20, 40]));
  near(b.whiskerHi, 40);
  near(b.whiskerLo, 10);
  assert.deepEqual(b.outliers, [200]);
});

test('tukeyBox finds outliers on both sides', () => {
  const b = L.tukeyBox(L.quartiles([-100, 10, 11, 12, 13, 14, 300]));
  assert.deepEqual(b.outliers, [-100, 300]);
  near(b.whiskerLo, 10);
  near(b.whiskerHi, 14);
});

test('tukeyBox keeps whiskers on real peer values, never on the fence', () => {
  const b = L.tukeyBox(L.quartiles([1, 2, 3, 4, 5, 6, 7, 8]));
  assert.ok(b.inliers.includes(b.whiskerLo) && b.inliers.includes(b.whiskerHi));
});

test('tukeyBox collapses to one point when every peer pays the same', () => {
  const b = L.tukeyBox(L.quartiles([10, 10, 10, 10, 10]));
  near(b.whiskerLo, 10);
  near(b.whiskerHi, 10);
  assert.deepEqual(b.outliers, []);
});

test('tukeyBox returns null when there is nothing to summarise', () => {
  assert.equal(L.tukeyBox(null), null);
});

test('peerLineStats carries the box-plot summary alongside the old fields', () => {
  const peers = [10, 20, 30, 40, 50].map((p, i) =>
    operator('P' + i, {}, [line('Poultry', 'Active', [product(1, p)])]));
  const s = L.peerLineStats(peers, 'Poultry', 3);
  assert.equal(s.n, 5);          // pre-existing field still there
  near(s.asp, 30);               // pre-existing field still there
  assert.deepEqual(s.values, [10, 20, 30, 40, 50]);
  near(s.median, 30);
  near(s.q1, 20);
  near(s.q3, 40);
  assert.equal(s.enoughForBox, true);
});

test('likeForLikeAsp holds basket mix fixed so only price differs', () => {
  // We buy 1 unit of a cheap line and 9 of an expensive one; peers buy the
  // reverse. Prices are IDENTICAL line for line, so the verdict must be 0%.
  const op = operator('OP-1', {}, [
    line('Cheap', 'Active', [product(1, 10)]),
    line('Pricey', 'Active', [product(9, 100)]),
  ]);
  const peers = [
    operator('P1', {}, [line('Cheap', 'Active', [product(9, 10)]), line('Pricey', 'Active', [product(1, 100)])]),
    operator('P2', {}, [line('Cheap', 'Active', [product(9, 10)]), line('Pricey', 'Active', [product(1, 100)])]),
  ];
  const ll = L.likeForLikeAsp(op, peers, 3);
  near(ll.mine, ll.peer);
  assert.equal(L.classifyComparison(ll.mine, ll.peer).dir, 'inline');

  // The naive comparison is badly misled by the same data.
  const naive = L.classifyComparison(L.operatorAsp(op, 3), L.stats(peers.map(p => L.operatorAsp(p, 3))).asp);
  assert.equal(naive.dir, 'above');
  assert.ok(naive.delta > 2, 'naive ASP overstates by >200% on pure mix');
});

test('likeForLikeAsp still detects a genuine price gap', () => {
  const op = operator('OP-1', {}, [line('Poultry', 'Active', [product(5, 110)])]);
  const peers = [
    operator('P1', {}, [line('Poultry', 'Active', [product(5, 100)])]),
    operator('P2', {}, [line('Poultry', 'Active', [product(5, 100)])]),
  ];
  const ll = L.likeForLikeAsp(op, peers, 3);
  near(ll.mine / ll.peer - 1, 0.1);
  assert.equal(ll.lines, 1);
});

test('likeForLikeAsp skips lines with no peer coverage and reports the count', () => {
  const op = operator('OP-1', {}, [
    line('Poultry', 'Active', [product(5, 100)]),
    line('Caviar', 'Active', [product(5, 900)]), // nobody else buys it
  ]);
  const peers = [operator('P1', {}, [line('Poultry', 'Active', [product(5, 100)])])];
  const ll = L.likeForLikeAsp(op, peers, 3);
  assert.equal(ll.lines, 1);
  near(ll.mine, 100); // the uncomparable line must not leak into our side
});

test('likeForLikeAsp returns null when nothing is comparable', () => {
  const op = operator('OP-1', {}, [line('Poultry', 'Stopped', [product(0, 100)])]);
  assert.equal(L.likeForLikeAsp(op, [operator('P1', {}, [])], 3), null);
});

// -------------------------------------------------------------- comparison

test('charging above peers reads as a DOWN arrow (spec PL1: $10 vs $9.50)', () => {
  const c = L.classifyComparison(10, 9.5);
  assert.equal(c.dir, 'above');
  assert.equal(c.arrow, '↓');
  assert.ok(c.delta > 0);
});

test('charging below peers reads as an UP arrow (spec PL3: $8 vs $9.50)', () => {
  const c = L.classifyComparison(8, 9.5);
  assert.equal(c.dir, 'below');
  assert.equal(c.arrow, '↑');
  assert.ok(c.delta < 0);
});

test('comparison inside the tolerance band is flat', () => {
  assert.equal(L.classifyComparison(10, 10).dir, 'inline');
  assert.equal(L.classifyComparison(10.2, 10).dir, 'inline'); // +2%, inside 3%
  assert.equal(L.classifyComparison(10.2, 10).arrow, '→');
});

test('comparison degrades safely with no peer data', () => {
  assert.equal(L.classifyComparison(10, null).dir, 'none');
  assert.equal(L.classifyComparison(null, 10).dir, 'none');
  assert.equal(L.classifyComparison(10, 0).dir, 'none'); // no divide-by-zero
});

// ----------------------------------------------------------- peersAlsoBuy

test('peersAlsoBuy surfaces lines most of the cohort buys and we do not', () => {
  const op = operator('OP-1', {}, [line('Poultry', 'Active', [product(1, 10)])]);
  const peers = [
    operator('P1', {}, [line('Poultry', 'Active', [product(1, 10)]), line('Seafood', 'Active', [product(2, 30)])]),
    operator('P2', {}, [line('Seafood', 'Active', [product(4, 30)])]),
    operator('P3', {}, [line('Seafood', 'Active', [product(3, 30)])]),
  ];
  const gaps = L.peersAlsoBuy(op, peers, 0.5);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].name, 'Seafood');
  assert.equal(gaps[0].buyers, 3);
  assert.equal(gaps[0].sharePct, 100);
  near(gaps[0].avgQty3, 9); // (6 + 12 + 9) units over 3 months, averaged across 3 peers
});

test('peersAlsoBuy counts a line we STOPPED buying as a gap', () => {
  const op = operator('OP-1', {}, [line('Seafood', 'Stopped', [product(0, 30)])]);
  const peers = [
    operator('P1', {}, [line('Seafood', 'Active', [product(1, 30)])]),
    operator('P2', {}, [line('Seafood', 'Active', [product(1, 30)])]),
  ];
  assert.equal(L.peersAlsoBuy(op, peers, 0.5)[0].name, 'Seafood');
});

test('peersAlsoBuy ignores lines below the share threshold', () => {
  const op = operator('OP-1', {}, []);
  const peers = [
    operator('P1', {}, [line('Nutrition', 'Active', [product(1, 10)])]),
    operator('P2', {}, []),
    operator('P3', {}, []),
  ];
  assert.equal(L.peersAlsoBuy(op, peers, 0.5).length, 0); // only 1 of 3
});

test('peersAlsoBuy is empty with no peers', () => {
  assert.deepEqual(L.peersAlsoBuy(operator('OP-1', {}, []), [], 0.5), []);
});

// ---------------------------------------------------------------- contract

test('contractStatus measures from the snapshot date, not wall-clock today', () => {
  const s = L.contractStatus({ to: '2026-12-31' }, '2026-09-30');
  assert.equal(s.daysLeft, 92);
  assert.equal(s.state, 'expiring'); // inside the 120-day warning window
  assert.equal(s.label, 'Expires in 92 days');
});

test('contractStatus flags an agreement that has already lapsed', () => {
  const s = L.contractStatus({ to: '2026-06-30' }, '2026-09-30');
  assert.equal(s.state, 'expired');
  assert.equal(s.daysLeft, -92);
  assert.equal(s.label, 'Expired 92 days ago');
});

test('contractStatus treats a far-off renewal as healthy', () => {
  assert.equal(L.contractStatus({ to: '2027-06-30' }, '2026-09-30').state, 'active');
});

test('contractStatus handles today and missing data', () => {
  assert.equal(L.contractStatus({ to: '2026-09-30' }, '2026-09-30').label, 'Expires today');
  assert.equal(L.contractStatus(null, '2026-09-30').state, 'unknown');
  assert.equal(L.contractStatus({ to: 'not-a-date' }, '2026-09-30').state, 'unknown');
});

// ------------------------------------------------------------------ volume

test('volumeWindows returns trailing 3/6/9 month totals', () => {
  const qty = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
  const v = L.volumeWindows(qty);
  assert.equal(v.m3, 10 + 11 + 12);
  assert.equal(v.m6, 7 + 8 + 9 + 10 + 11 + 12);
  assert.equal(v.m9, 4 + 5 + 6 + 7 + 8 + 9 + 10 + 11 + 12);
});

test('trend3 compares the last quarter against the one before', () => {
  near(L.trend3([0, 0, 0, 0, 0, 0, 10, 10, 10, 15, 15, 15]), 0.5);
  assert.equal(L.trend3(months(0)), 0); // no divide-by-zero
});

// -------------------------------------------------------------- generation

test('skuBase is deterministic and price-like', () => {
  const a = L.skuBase('Chicken breast IQF 40lb');
  assert.equal(a, L.skuBase('Chicken breast IQF 40lb'));
  assert.notEqual(a, L.skuBase('Ribeye steak 12oz'));
  assert.ok(a >= 16 && a <= 108, `expected a plausible case price, got ${a}`);
});

test('seeded produces a repeatable stream in [0,1)', () => {
  const draw = s => Array.from({ length: 5 }, () => s());
  assert.deepEqual(draw(L.seeded(123)), draw(L.seeded(123)));
  for (const v of draw(L.seeded(7))) assert.ok(v >= 0 && v < 1);
});
