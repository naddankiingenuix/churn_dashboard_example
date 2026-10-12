/**
 * Keeps the catalog consistent: every screen, metric, filter, visual and
 * source reference must resolve, and a manufacturer's config must switch
 * Enhanced items off cleanly. Run with:  node --test
 */
const test = require('node:test');
const assert = require('node:assert');
const C = require('./catalog.js');

const cat = C.load();
const config = C.loadConfig('manufacturer.config.example.json');
const ids = list => list.map(x => x.id);
const byId = list => new Map(list.map(x => [x.id, x]));

// ---------------------------------------------------------------- structure

test('IDs are unique within and across catalog files', () => {
  const all = [...ids(cat.metrics), ...ids(cat.filters), ...ids(cat.visuals), ...ids(cat.screens), ...ids(cat.marts)];
  const dupes = all.filter((x, i) => all.indexOf(x) !== i);
  assert.deepEqual(dupes, []);
});

test('every metric ID starts with a known level prefix', () => {
  const prefixes = Object.keys(cat.levels);
  for (const m of cat.metrics) assert.ok(prefixes.includes(m.id.split('_')[0]), m.id);
});

test('every metric has the required fields', () => {
  for (const m of cat.metrics) {
    for (const f of ['id', 'label', 'definition', 'tier', 'unit', 'format', 'direction', 'visual', 'source']) {
      assert.ok(m[f] != null && m[f] !== '', `${m.id} missing ${f}`);
    }
    assert.ok(['core', 'enhanced'].includes(m.tier), m.id);
    assert.ok(['up_good', 'down_good', 'neutral'].includes(m.direction), m.id);
  }
});

test('Enhanced metrics and filters name the data they need; Core ones need none', () => {
  const caps = Object.keys(cat.capabilities);
  for (const x of [...cat.metrics, ...cat.filters]) {
    if (x.tier === 'enhanced') {
      assert.ok(Array.isArray(x.requires) && x.requires.length, `${x.id} lists no requirement`);
      for (const r of x.requires) assert.ok(caps.includes(r), `${x.id} requires unknown capability ${r}`);
    } else {
      assert.ok(!x.requires || !x.requires.length, `${x.id} is core but has requirements`);
    }
  }
});

test('every metric source is a real mart column', () => {
  const marts = byId(cat.marts);
  for (const m of cat.metrics) {
    const mart = marts.get(m.source.mart);
    assert.ok(mart, `${m.id}: unknown mart ${m.source.mart}`);
    for (const col of m.source.columns) assert.ok(mart.columns.includes(col), `${m.id}: ${m.source.mart} has no column ${col}`);
  }
});

test('every metric uses a defined visual component', () => {
  const visuals = new Set(ids(cat.visuals));
  for (const m of cat.metrics) assert.ok(visuals.has(m.visual), `${m.id}: unknown visual ${m.visual}`);
});

// ------------------------------------------------------------------ screens

/** Every metric a screen can show: headline, sections and actions such as the review brief. */
const screenMetrics = s => [...s.headline, ...s.sections.flatMap(x => x.metrics), ...(s.actions || []).flatMap(a => a.metrics)];
const sectionFilters = s => s.sections.flatMap(x => x.filters || []);

test('the dashboard has exactly five tabs, in the agreed order', () => {
  assert.deepEqual(ids(cat.screens), ['overview', 'operator', 'line', 'product', 'analyst']);
});

test('screens reference only defined metrics, filters and screens', () => {
  const metrics = new Set(ids(cat.metrics)), filters = new Set(ids(cat.filters)), screens = new Set(ids(cat.screens));
  for (const s of cat.screens) {
    for (const m of screenMetrics(s)) assert.ok(metrics.has(m), `${s.id}: unknown metric ${m}`);
    for (const f of [...s.filters, ...sectionFilters(s)]) assert.ok(filters.has(f), `${s.id}: unknown filter ${f}`);
    for (const d of s.drill) assert.ok(screens.has(d), `${s.id}: unknown drill target ${d}`);
  }
});

test('a filter applies either to the whole tab or to one section, not both', () => {
  for (const s of cat.screens) {
    const both = sectionFilters(s).filter(f => s.filters.includes(f));
    assert.deepEqual(both, [], s.id);
  }
});

test('no screen headlines more than 6 metrics', () => {
  for (const s of cat.screens) assert.ok(s.headline.length <= 6, `${s.id} has ${s.headline.length}`);
});

test('every metric is shown on at least one screen', () => {
  const used = new Set(cat.screens.flatMap(screenMetrics));
  assert.deepEqual(cat.metrics.filter(m => !used.has(m.id)).map(m => m.id), []);
});

test('every sortable table sorts only by columns it shows', () => {
  const tables = cat.screens.flatMap(s => s.sections).filter(x => x.table);
  assert.ok(tables.length >= 1);
  for (const t of tables) {
    const shown = new Set(t.metrics);
    for (const m of [...t.table.sortable, t.table.defaultSort.metric]) assert.ok(shown.has(m), `${t.title}: ${m}`);
  }
});

test('the Overview holds the operator list and the product line view', () => {
  const titles = cat.screens.find(s => s.id === 'overview').sections.map(x => x.title);
  assert.ok(titles.includes('Operators to review'));
  assert.ok(titles.includes('Product lines losing operators'));
});

test('the review brief is an action on the Operator tab', () => {
  const op = cat.screens.find(s => s.id === 'operator');
  assert.ok((op.actions || []).some(a => a.id === 'review_brief'));
});

test('the analyst screen is the only one restricted to analysts', () => {
  assert.deepEqual(cat.screens.filter(s => s.role === 'analyst').map(s => s.id), ['analyst']);
});

// ------------------------------------------------------------------- config

test('the example config declares every capability exactly once', () => {
  assert.deepEqual(Object.keys(config.capabilities).sort(), Object.keys(cat.capabilities).sort());
});

test('a config can only switch on filters that declare a config flag', () => {
  const flags = cat.filters.filter(f => f.configFlag).map(f => f.configFlag.replace('filters.', ''));
  assert.deepEqual(Object.keys(config.filters).sort(), flags.sort());
});

test('resolving a screen hides Enhanced metrics the manufacturer cannot supply', () => {
  const op = C.resolveScreen('operator', { ...config, capabilities: { ...config.capabilities, list_price: false } });
  const shown = op.sections.flatMap(s => s.metrics);
  assert.ok(!shown.includes('op_discount'));
  assert.ok(shown.includes('op_price_change'));
});

test('resolving a screen keeps Enhanced metrics when the data exists', () => {
  const op = C.resolveScreen('operator', { ...config, capabilities: { ...config.capabilities, list_price: true } });
  assert.ok(op.sections.flatMap(s => s.metrics).includes('op_discount'));
});

test('a section whose metrics are all hidden disappears instead of rendering empty', () => {
  const none = Object.fromEntries(Object.keys(config.capabilities).map(k => [k, false]));
  const pr = C.resolveScreen('product', { ...config, capabilities: none });
  for (const s of pr.sections) assert.ok(s.metrics.length > 0, s.title);
});

test('resolving a screen drops filters switched off in config', () => {
  const q = C.resolveScreen('overview', { ...config, filters: { territory: false, division: false, distributor: false } });
  for (const f of ['f_territory', 'f_division']) assert.ok(!q.filters.includes(f), f);
  assert.ok(q.filters.includes('f_size'));
});

test('resolving drops section filters switched off in config', () => {
  const ov = C.resolveScreen('overview', { ...config, filters: { territory: false, division: false, distributor: false } });
  const list = ov.sections.find(x => x.title === 'Operators to review');
  assert.ok(!list.filters.includes('f_distributor'));
  assert.ok(list.filters.includes('f_band'));
});

test('resolving hides Enhanced metrics inside actions too', () => {
  const op = C.resolveScreen('operator', { ...config, capabilities: { ...config.capabilities, account_ownership: false, claim_receipt_timestamp: false } });
  const brief = op.actions.find(a => a.id === 'review_brief');
  assert.ok(!brief.metrics.includes('op_reporting'));
  assert.ok(brief.metrics.includes('op_reasons'));
});

test('resolving does not mutate the catalog', () => {
  const before = JSON.stringify(C.load().screens);
  C.resolveScreen('operator', { ...config, capabilities: {} });
  assert.equal(JSON.stringify(C.load().screens), before);
});

test('resolving an unknown screen fails with a clear message', () => {
  assert.throws(() => C.resolveScreen('nope', config), /Unknown screen: nope/);
});
