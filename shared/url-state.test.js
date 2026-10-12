/**
 * Run with:  node --test   (from this folder)
 */
const test = require('node:test');
const assert = require('node:assert');
const U = require('./url-state.js');

const SPEC = {
  view: { param: 'view', def: 'overview', valid: U.oneOf(['overview', 'queue', 'operator']) },
  opId: { param: 'op', def: null, valid: v => /^OP-\d{5}$/.test(v) },
  lineIdx: { param: 'line', def: 0, valid: U.intIn(0, 20), parse: U.toInt },
};

test('decode returns defaults for an empty hash', () => {
  assert.deepEqual(U.decode('', SPEC), { view: 'overview', opId: null, lineIdx: 0 });
});

test('encode then decode round-trips a state', () => {
  const state = { view: 'operator', opId: 'OP-10418', lineIdx: 3 };
  assert.deepEqual(U.decode(U.encode(state, SPEC), SPEC), state);
});

test('encode leaves out values equal to their default', () => {
  assert.equal(U.encode({ view: 'overview', opId: null, lineIdx: 0 }, SPEC), '');
  assert.equal(U.encode({ view: 'queue', opId: null, lineIdx: 0 }, SPEC), '#view=queue');
});

test('decode rejects values the spec does not allow', () => {
  const s = U.decode('#view=admin&op=<script>&line=999', SPEC);
  assert.deepEqual(s, { view: 'overview', opId: null, lineIdx: 0 });
});

test('decode rejects non-numeric and negative numbers', () => {
  assert.equal(U.decode('#line=abc', SPEC).lineIdx, 0);
  assert.equal(U.decode('#line=-1', SPEC).lineIdx, 0);
});

test('decode ignores a hash that is implausibly long', () => {
  assert.equal(U.decode('#view=queue&x=' + 'a'.repeat(3000), SPEC).view, 'overview');
});

test('encode escapes values with spaces and ampersands', () => {
  const spec = { cat: { param: 'cat', def: null, valid: () => true } };
  const hash = U.encode({ cat: 'Cups & Lids' }, spec);
  assert.equal(U.decode(hash, spec).cat, 'Cups & Lids');
});
