/**
 * Shared view-model helpers: palette, risk levels, review-team colours, chart
 * geometry, table headers and CSV export. Every view-*.js file builds plain
 * objects for the template from these; nothing here touches component state.
 *
 * Loaded in the browser as `window.DistViews.common`.
 */
(function (root) {
  'use strict';
  const D = root.DistData, F = root.DistFormat, LG = root.DistLogic, T = root.DistNarrative;

  const INK = { text: '#1B1D22', muted: '#6A6E78', faint: '#A9ACB4', rule: '#E2DFD8', bar: '#C5CAD6' };
  const TIER = {
    high: { key: 'high', label: 'High risk', short: 'High', color: '#D9492F', bg: '#FBE1DB', ink: '#8E2A18', text: '#B63A24', meaning: 'Likely to cut spending sharply in the next 90 days' },
    medium: { key: 'medium', label: 'Medium risk', short: 'Medium', color: '#D69A1E', bg: '#F8EAC6', ink: '#7A5406', text: '#9A6A0A', meaning: 'Showing early warning signs' },
    low: { key: 'low', label: 'Low risk', short: 'Low', color: '#2E8A6E', bg: '#D5EDE4', ink: '#1C5E4A', text: '#2E8A6E', meaning: 'Buying normally' },
  };
  const NEUTRAL = ['#EEEBE5', '#6A6E78'];
  const STATUS = { Active: [TIER.low.bg, TIER.low.ink], Declining: [TIER.medium.bg, TIER.medium.ink], Stopped: [TIER.high.bg, TIER.high.ink], New: ['#E6E8FA', '#2F3C9E'] };
  /** Plain words for statuses in tables. */
  const STATUS_WORD = { Active: 'Buying', Declining: 'Buying less', Stopped: 'Stopped', New: 'New' };
  const SCOPE = {
    'operator-wide': [TIER.high.bg, TIER.high.ink],
    'category-specific': [TIER.medium.bg, TIER.medium.ink],
    'product-switch': ['#E6E8FA', '#2F3C9E'],
    'trade-down': ['#EFE6F7', '#5B3A80'],
    'stable': NEUTRAL,
  };
  /** One short line per scope, for cards and the help panel. */
  const SCOPE_HINT = {
    'operator-wide': 'Spending less across almost everything they buy',
    'category-specific': 'Stopped or cut back one or two categories',
    'product-switch': 'Still buying, but replacing products with different ones',
    'trade-down': 'Still buying, but choosing cheaper products',
    'stable': 'Same basket — the risk comes from price, service or order timing',
  };
  const TEAM = { sales: ['#FBE1DB', '#8E2A18'], category: ['#E6E8FA', '#2F3C9E'], pricing: ['#EFE6F7', '#5B3A80'], service: ['#F8EAC6', '#7A5406'], none: NEUTRAL };

  /** Tier lookup bound to the current threshold props (0–100). */
  const tierer = (hi, md) => p => (p > hi / 100 ? TIER.high : p >= md / 100 ? TIER.medium : TIER.low);

  /**
   * Per-operator labels that depend on the tier thresholds: risk level,
   * review team and the one-line headline. Built once per render.
   */
  function classify(book, tierOf) {
    return new Map(book.map(o => {
      const tier = tierOf(o.prob);
      const flagged = tier !== TIER.low;
      const teamKey = LG.reviewTeam({ flagged, scope: o.scope.key, topDriver: T.topRiskDriver(o) });
      return [o.id, { tier, flagged, teamKey, team: D.REVIEW_TEAMS[teamKey], headline: T.headline(o, tier.key) }];
    }));
  }

  const pill = ([bg, ink], label) => ({ label, bg, ink });
  const riskPill = (o, tier) => pill([tier.bg, tier.ink], `${tier.short} · ${Math.round(o.prob * 100)}%`);
  const trendColor = v => (v < -0.1 ? TIER.high.text : v > 0.02 ? TIER.low.text : INK.muted);
  /** "−57%" / "+4%" / "steady" — the one change format used everywhere. */
  const change = v => (v == null ? '—' : Math.abs(v) < 0.02 ? 'steady' : F.pct(v));
  const lastOrder = o => `${o.daysSince} days ago`;
  const H = (label, align = 'left') => ({ label, align });

  /** 12 vertical bars; the latest quarter is drawn in `color`. */
  function bars(values, color, fmt) {
    const mx = Math.max(1, ...values);
    return values.map((v, i) => ({
      v: v ? (fmt || F.fmtU)(v) : '', h: Math.max(v ? 2 : 0, v / mx * 82) + '%',
      m: D.MONTHS[i], bg: i >= 9 ? color : INK.bar,
    }));
  }

  /** Tiny 12-bar sparkline for cards. */
  function spark(values, color) {
    const mx = Math.max(1, ...values);
    return values.map((v, i) => ({ h: Math.max(v ? 4 : 0, v / mx * 100) + '%', bg: i >= 9 ? color : '#D6D2CA' }));
  }

  /** Stacked bars: `stacks[i]` is a list of `{ key, value, color }`. */
  function stacked(stacks) {
    const mx = Math.max(1, ...stacks.map(s => s.reduce((a, x) => a + x.value, 0)));
    return stacks.map((s, i) => ({
      m: D.MONTHS[i],
      // Column-reverse in CSS puts the first segment at the bottom.
      segs: s.map(x => ({ h: x.value / mx * 100 + '%', bg: x.color, title: x.key })),
    }));
  }

  /** Product colour — products are coloured by their maker so a switch is visible. */
  const productColor = p => F.mfrColor(p.mfr);

  /** Enter or Space activates a focusable row, the way they activate a button. */
  const onEnter = fn => e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fn();
    }
  };

  /**
   * Click-to-sort table headers. `cols` = [{ label, align, key, get }]; a
   * column without `key` is not sortable. `sort` = { key, dir } or null (the
   * table's own default order). Returns header view-models and an `order`
   * function that sorts a copy of the rows — the input is never mutated.
   */
  function sortable(cols, sort, onSort) {
    const head = cols.map(c => {
      const active = !!(sort && c.key && sort.key === c.key);
      const next = () => onSort({ key: c.key, dir: active && sort.dir === 'desc' ? 'asc' : 'desc' });
      return {
        label: c.label, align: c.align || 'left',
        arrow: active ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '',
        sort: c.key ? next : null, key: c.key ? onEnter(next) : null,
        tab: c.key ? 0 : -1, cursor: c.key ? 'pointer' : 'default',
        aria: active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none',
        title: c.key ? `Sort by ${c.label.toLowerCase()}` : '',
      };
    });
    const col = sort && cols.find(c => c.key === sort.key);
    const order = rows => (!col ? rows : [...rows].sort((a, b) => {
      const x = col.get(a), y = col.get(b);
      const cmp = typeof x === 'string' ? x.localeCompare(y) : x - y;
      return sort.dir === 'asc' ? cmp : -cmp;
    }));
    return { head, order };
  }

  /** Download rows as CSV. Browser-only; the one place views touch the DOM. */
  function csv(name, data) {
    const esc = v => { const t = String(v == null ? '' : v); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    const blob = new Blob(['﻿' + data.map(r => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  root.DistViews = Object.assign(root.DistViews || {}, {
    common: { onEnter, sortable, INK, TIER, NEUTRAL, STATUS, STATUS_WORD, SCOPE, SCOPE_HINT, TEAM, tierer, classify, pill, riskPill, trendColor, change, lastOrder, H, bars, spark, stacked, productColor, csv },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
