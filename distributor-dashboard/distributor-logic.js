/**
 * Pure analytics for Distributor Churn Intelligence.
 *
 * No DOM and no framework, so every function here is unit-testable under
 * `node --test`. Self-contained: this folder does not depend on the
 * manufacturer dashboard. Loaded in the browser as `window.DistLogic`.
 *
 * "Product" objects are invoice-line rollups for one SKU at one operator:
 *   product = { name, qty: number[12], price: number[12], cost: number[12] }
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DistLogic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ------------------------------------------------------- generic helpers
  // Same implementations as the manufacturer dashboard's churn-logic.js, so
  // seeded generation stays identical; kept here so the folders stay independent.

  const sum = a => a.reduce((x, y) => x + y, 0);

  /** Population min/max/mean/stddev. Returns null when nothing is comparable. */
  function stats(values) {
    const v = values.filter(x => x != null && Number.isFinite(x));
    if (!v.length) return null;
    const asp = sum(v) / v.length;
    const variance = sum(v.map(x => (x - asp) ** 2)) / v.length;
    return { n: v.length, min: Math.min(...v), max: Math.max(...v), asp, sd: Math.sqrt(variance) };
  }

  /** Most recent quarter against the one before it. */
  function trend3(qty) {
    const recent = sum(qty.slice(9));
    const prior = sum(qty.slice(6, 9));
    return prior ? recent / prior - 1 : 0;
  }

  /** FNV-1a string hash — the seed for per-operator generation. */
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /** Small deterministic PRNG returning values in [0, 1). */
  function seeded(s) {
    let v = Math.abs(Math.trunc(s)) % 233280;
    return () => {
      v = (v * 9301 + 49297) % 233280;
      return v / 233280;
    };
  }

  /** Oct–Mar (the usual pattern), the quarter before the latest, and the latest quarter. */
  const PRIOR_IDX = [0, 1, 2, 3, 4, 5];
  const PREV_Q_IDX = [6, 7, 8];
  const RECENT_IDX = [9, 10, 11];

  const pick = (arr, idxs) => idxs.map(i => arr[i] || 0);
  const windowSum = (arr, idxs) => sum(pick(arr, idxs));
  const ratio = (num, den) => (den ? num / den : 0);

  // ----------------------------------------------------------- product mix

  /** Units and share per product over the given month indexes, largest first. */
  function shareByProduct(products, idxs) {
    const units = new Map();
    for (const p of products) units.set(p.name, (units.get(p.name) || 0) + windowSum(p.qty, idxs));
    const total = sum([...units.values()]);
    if (!total) return [];
    return [...units.entries()]
      .filter(([, u]) => u > 0)
      .map(([name, u]) => ({ name, units: u, share: u / total }))
      .sort((a, b) => b.units - a.units);
  }

  /**
   * Is the operator replacing its main product in a category with another?
   * Compares Oct–Mar with the latest quarter. A category that stopped
   * altogether is category churn, not a switch, so it returns null.
   */
  function productSwitch(products, minPts) {
    const threshold = minPts == null ? 0.2 : minPts;
    const prior = shareByProduct(products, PRIOR_IDX);
    const recent = shareByProduct(products, RECENT_IDX);
    if (!prior.length || !recent.length) return null;
    const shareIn = (list, name) => (list.find(x => x.name === name) || { share: 0 }).share;
    const from = prior[0].name;
    const fromPrior = prior[0].share;
    const fromRecent = shareIn(recent, from);
    if (fromPrior - fromRecent < threshold) return null;
    const gainers = recent
      .filter(x => x.name !== from)
      .map(x => ({ name: x.name, gain: x.share - shareIn(prior, x.name) }))
      .filter(x => x.gain > 0)
      .sort((a, b) => b.gain - a.gain);
    if (!gainers.length) return null;
    const to = gainers[0].name;
    return {
      from, to, fromPrior, fromRecent,
      toPrior: shareIn(prior, to), toRecent: shareIn(recent, to),
      shiftPts: fromPrior - fromRecent,
    };
  }

  // ------------------------------------------------------------ price / mix

  /**
   * Splits the change in average selling price between two windows into a
   * PRICE effect (same items, new prices) and a MIX effect (same prices, a
   * different basket). The two always add up to the total change:
   *
   *   Σ pr·wr − Σ pp·wp  =  Σ (pr − pp)·wr  +  Σ pp·(wr − wp)
   *
   * This separates "we raised prices" from "they are buying cheaper
   * products" — both lower revenue, but they call for different reviews.
   * All effects are returned as a share of the prior ASP.
   */
  function aspDecomposition(products, priorIdx, recentIdx) {
    const rows = products.map(p => {
      const up = windowSum(p.qty, priorIdx);
      const ur = windowSum(p.qty, recentIdx);
      const rp = sum(priorIdx.map(i => (p.qty[i] || 0) * p.price[i]));
      const rr = sum(recentIdx.map(i => (p.qty[i] || 0) * p.price[i]));
      const pr0 = ur ? rr / ur : null;
      const pp0 = up ? rp / up : null;
      // An item new to the basket has no prior price, and a dropped item no
      // recent one; borrowing the other window's price gives them zero price
      // effect, so they show up purely as mix — which is what they are.
      return { up, ur, pp: pp0 == null ? pr0 : pp0, pr: pr0 == null ? pp0 : pr0 };
    }).filter(r => r.up || r.ur);
    const Up = sum(rows.map(r => r.up));
    const Ur = sum(rows.map(r => r.ur));
    if (!Up || !Ur) return null;
    const aspPrior = sum(rows.map(r => r.pp * r.up / Up));
    const aspRecent = sum(rows.map(r => r.pr * r.ur / Ur));
    const priceEffect = sum(rows.map(r => (r.pr - r.pp) * r.ur / Ur)) / aspPrior;
    const mixEffect = sum(rows.map(r => r.pp * (r.ur / Ur - r.up / Up))) / aspPrior;
    return { aspPrior, aspRecent, change: aspRecent / aspPrior - 1, priceEffect, mixEffect };
  }

  function marginRate(rev, cost) {
    return rev > 0 ? (rev - cost) / rev : null;
  }

  // --------------------------------------------------------------- status

  /** Status of one category from its monthly units. */
  function categoryStatus(qty) {
    if (!sum(qty)) return 'Never';
    if (!qty[10] && !qty[11]) return 'Stopped';
    return trend3(qty) < -0.15 ? 'Declining' : 'Active';
  }

  /** Status of one product. "New" = first bought after Mar — usually a replacement. */
  function productStatus(qty) {
    const first = qty.findIndex(v => v > 0);
    if (first >= PREV_Q_IDX[0] - 1 && categoryStatus(qty) !== 'Stopped') return 'New';
    return categoryStatus(qty);
  }

  /**
   * Is the decline across the whole operator, confined to some categories,
   * or a change in WHAT they buy (switching or cheaper products) rather than
   * how MUCH? This is the first question the business case asks.
   */
  const SCOPE = {
    'operator-wide': 'Buying less overall',
    'category-specific': 'Dropping categories',
    'trade-down': 'Buying cheaper products',
    'product-switch': 'Switching products',
    'stable': 'Buying pattern steady',
  };

  function riskScope({ categories, revTrend, switches, mixEffect }) {
    const total = sum(categories.map(c => c.revPrior));
    const declining = sum(categories.filter(c => c.status === 'Declining' || c.status === 'Stopped').map(c => c.revPrior));
    const declShare = ratio(declining, total);
    let key = 'stable';
    if (revTrend <= -0.2 && declShare >= 0.6) key = 'operator-wide';
    else if (declShare > 0) key = 'category-specific';
    // Cheaper first: moving to a cheaper product is also a switch, and
    // "cheaper" is the more specific — and more actionable — reading.
    else if (mixEffect <= -0.05) key = 'trade-down';
    else if (switches > 0) key = 'product-switch';
    return { key, label: SCOPE[key], declShare };
  }

  /** Days since the last invoice, graded against the operator's usual interval. */
  function recencyState(daysSince, interval) {
    const r = ratio(daysSince, interval);
    const state = r <= 1.25 ? 'on-schedule' : r <= 2 ? 'late' : 'overdue';
    return { ratio: r, state };
  }

  // ---------------------------------------------------------------- review

  /**
   * Revenue at risk for one quarter: the operator's usual quarterly spend
   * (Oct–Mar, before any decline) weighted by its risk score. Using the
   * usual spend, not the latest quarter, keeps an operator that has already
   * fallen away from looking like it has little left to lose.
   */
  function revenueAtRisk(rev, prob) {
    return windowSum(rev, PRIOR_IDX) / 2 * prob;
  }

  /** Which team should review a flagged operator. Keys match DistData.REVIEW_TEAMS. */
  function reviewTeam({ flagged, scope, topDriver }) {
    if (!flagged) return 'none';
    if (topDriver === 'service') return 'service';
    if (scope === 'product-switch') return 'category';
    if (scope === 'trade-down') return 'pricing';
    if (scope === 'stable') return topDriver === 'price' ? 'pricing' : 'sales';
    return 'sales';
  }

  /** A driver contribution as a word a business user can read at a glance. */
  function strength(pts) {
    const a = Math.abs(pts);
    return a >= 0.15 ? 'Strong' : a >= 0.06 ? 'Moderate' : 'Slight';
  }

  // ----------------------------------------------------------- attribution

  /**
   * SHAP-style attribution. Drivers add up exactly to (score − base rate),
   * which is how SHAP values read on a waterfall.
   *
   * Protective drivers keep their raw effect; only the risk-raising ones are
   * rescaled to close the gap. Scaling every driver by one factor would let
   * an operator with one faint warning sign have that sign — and its
   * protective counterweights — blown up several-fold. The scale is clamped,
   * and whatever the drivers still cannot explain is booked to an explicit
   * "other" row rather than distorting the named ones.
   */
  function attribute(drivers, prob, baseRate) {
    const live = drivers.filter(d => Math.abs(d.raw) > 1e-9);
    const target = prob - baseRate;
    const pos = sum(live.filter(d => d.raw > 0).map(d => d.raw));
    const neg = sum(live.filter(d => d.raw < 0).map(d => d.raw));
    const k = pos > 0 ? Math.max(0.25, Math.min(3, (target - neg) / pos)) : 1;
    const out = live.map(d => ({ ...d, pts: d.raw > 0 ? d.raw * k : d.raw }));
    const residual = target - (pos * k + neg);
    const all = Math.abs(residual) > 1e-9 ? [...out, { key: 'other', raw: 0, pts: residual }] : out;
    return all.sort((a, b) => Math.abs(b.pts) - Math.abs(a.pts));
  }

  // --------------------------------------------------------------- service

  /** Late-delivery rate and credits-as-share-of-revenue, latest quarter vs the one before. */
  function serviceShift({ orders, late, rev, credits }) {
    const rate = (num, den, idxs) => ratio(windowSum(num, idxs), windowSum(den, idxs));
    return {
      lateRecent: rate(late, orders, RECENT_IDX),
      latePrior: rate(late, orders, PREV_Q_IDX),
      creditRecent: rate(credits, rev, RECENT_IDX),
      creditPrior: rate(credits, rev, PREV_Q_IDX),
    };
  }

  return {
    PRIOR_IDX, RECENT_IDX, PREV_Q_IDX, SCOPE,
    sum, stats, trend3, hashStr, seeded, windowSum,
    shareByProduct, productSwitch, aspDecomposition, marginRate,
    categoryStatus, productStatus, riskScope, recencyState,
    revenueAtRisk, reviewTeam, strength, attribute, serviceShift,
  };
});
