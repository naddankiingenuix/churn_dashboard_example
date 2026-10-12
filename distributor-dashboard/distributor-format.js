/**
 * Number, date and colour formatting shared by the narrative and the views.
 * Loaded in the browser as `window.DistFormat`.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./distributor-data.js'));
  else root.DistFormat = factory(root.DistData);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (D) {
  'use strict';

  const MON_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const fmtRev = n => {
    if (n == null || !Number.isFinite(n)) return '—';
    const a = Math.abs(n), sign = n < 0 ? '−' : '';
    if (a >= 1e6) return sign + '$' + (a / 1e6).toFixed(2) + 'M';
    if (a >= 1000) return sign + '$' + Math.round(a / 1000) + 'K';
    return sign + '$' + Math.round(a);
  };
  const fmtM = n => '$' + (Number.isInteger(n) ? n : n.toFixed(1)) + 'M';
  const fmtK = n => (n == null ? '—' : n >= 1000 ? (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'K' : String(n));
  const fmtU = n => (n >= 10000 ? (n / 1000).toFixed(1) + 'k' : Math.round(n).toLocaleString('en-US'));
  /** Signed percentage with a true minus sign. */
  const pct = (v, d = 0) => (v == null || !Number.isFinite(v) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v * 100).toFixed(d) + '%');
  /** Unsigned percentage. */
  const pctU = (v, d = 0) => (v == null || !Number.isFinite(v) ? '—' : (v * 100).toFixed(d) + '%');
  /** Probability points, signed — the unit driver contributions are shown in. */
  const pts = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v * 100).toFixed(0) + ' pts';
  const money = v => (v == null ? '—' : '$' + v.toFixed(2));

  const fmtDate = iso => {
    if (!iso) return '—';
    const t = Date.parse(iso + 'T00:00:00Z');
    if (!Number.isFinite(t)) return '—';
    const d = new Date(t);
    return `${MON_ABBR[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
  };
  /** Month label for index i in the 12-month window (Oct 2025 … Sep 2026). */
  const monthYr = i => D.MONTHS[i] + (i < 3 ? ' 2025' : ' 2026');

  const mfrName = k => (D.MANUFACTURERS[k] ? D.MANUFACTURERS[k].name : '—');
  const mfrColor = k => (D.MANUFACTURERS[k] ? D.MANUFACTURERS[k].color : '#C5CAD6');

  /** "a", "a and b", "a, b and c". */
  const listJoin = items => (items.length <= 1 ? items.join('') : items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1]);

  return { fmtRev, fmtM, fmtK, fmtU, pct, pctU, pts, money, fmtDate, monthYr, mfrName, mfrColor, listJoin };
});
