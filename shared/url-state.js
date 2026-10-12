/**
 * Keeps a dashboard's view in the URL hash, so a link opens the same view:
 *   …/Distributor Churn Dashboard.dc.html#view=operator&op=OP-10418
 *
 * A link is outside input, so `decode` only accepts values a spec allows and
 * falls back to the default for anything else. `encode` writes only values
 * that differ from the default, keeping links short.
 *
 * spec = { stateKey: { param: 'op', def: null, valid: v => boolean, parse?: s => value } }
 *
 * Loaded in the browser as `window.UrlState`; required by url-state.test.js.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.UrlState = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAX_HASH = 2000; // anything longer is not a link we wrote

  function decode(hash, spec) {
    const out = Object.fromEntries(Object.entries(spec).map(([k, s]) => [k, s.def]));
    const raw = String(hash || '').replace(/^#/, '');
    if (!raw || raw.length > MAX_HASH) return out;
    let params;
    try {
      params = new URLSearchParams(raw);
    } catch (e) {
      return out;
    }
    for (const [key, s] of Object.entries(spec)) {
      if (!params.has(s.param)) continue;
      const text = params.get(s.param);
      const value = s.parse ? s.parse(text) : text;
      if (value != null && value === value && s.valid(value)) out[key] = value; // value === value rejects NaN
    }
    return out;
  }

  function encode(state, spec) {
    const params = new URLSearchParams();
    for (const [key, s] of Object.entries(spec)) {
      const v = state[key];
      if (v != null && v !== s.def) params.set(s.param, String(v));
    }
    const text = params.toString();
    return text ? '#' + text : '';
  }

  /** Rewrites the hash without adding history entries. Safe where history is unavailable. */
  function write(state, spec) {
    try {
      const hash = encode(state, spec);
      const url = location.pathname + location.search + hash;
      if (url !== location.pathname + location.search + location.hash) history.replaceState(null, '', url || location.pathname);
    } catch (e) {
      /* sandboxed frame or file:// restrictions — the link just won't update */
    }
  }

  const oneOf = values => v => values.includes(v);
  const intIn = (lo, hi) => v => Number.isInteger(v) && v >= lo && v <= hi;
  const toInt = s => (/^\d{1,4}$/.test(s) ? Number(s) : null);

  return { decode, encode, write, oneOf, intIn, toInt };
});
