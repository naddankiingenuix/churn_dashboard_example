/**
 * Pure analytics for Operator Churn Intelligence.
 *
 * No DOM and no framework, so every function here is unit-testable under
 * `node --test`. Loaded in the browser as `window.ChurnLogic`; required
 * directly by churn-logic.test.js.
 *
 * "Line" and "operator" objects passed in are the shapes built by buildOp()
 * in Churn Dashboard.dc.html:
 *   line = { name, status, qty: number[12], products: [{ qty: number[12], price: number[12] }] }
 *   op   = { id, seg, type, region, metro, lineData: line[] }
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChurnLogic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MONTH_COUNT = 12;
  const SEG_LABEL = { S: 'Small', M: 'Medium', L: 'Large' };
  const DAY_MS = 86400000;

  const sum = a => a.reduce((x, y) => x + y, 0);
  const lastN = (arr, n) => arr.slice(Math.max(0, MONTH_COUNT - n));

  /** Population min/max/mean/stddev. Returns null when nothing is comparable. */
  function stats(values) {
    const v = values.filter(x => x != null && Number.isFinite(x));
    if (!v.length) return null;
    const asp = sum(v) / v.length;
    const variance = sum(v.map(x => (x - asp) ** 2)) / v.length;
    return { n: v.length, min: Math.min(...v), max: Math.max(...v), asp, sd: Math.sqrt(variance) };
  }

  // ---------------------------------------------------------------- cohort

  /**
   * Progressive widening ladder. We walk down it until a level holds enough
   * peers to be worth comparing against, so a thin cohort can never quietly
   * masquerade as a tight one — the level actually used is always reported.
   */
  const COHORT_LADDER = [
    { keys: ['seg', 'type', 'region', 'metro'], label: o => `${SEG_LABEL[o.seg]} · ${o.type} · ${o.region} ${o.metro}` },
    { keys: ['seg', 'type', 'region'], label: o => `${SEG_LABEL[o.seg]} · ${o.type} · ${o.region}, any metro` },
    { keys: ['seg', 'type'], label: o => `${SEG_LABEL[o.seg]} · ${o.type} · national` },
    { keys: ['type'], label: o => `${o.type} · all sizes, national` },
  ];

  function cohortFor(op, allOps, minN) {
    const floor = minN == null ? 5 : minN;
    const last = COHORT_LADDER.length - 1;
    for (let i = 0; i <= last; i++) {
      const level = COHORT_LADDER[i];
      const peers = allOps.filter(o => o.id !== op.id && level.keys.every(k => o[k] === op[k]));
      if (peers.length >= floor || i === last) {
        return {
          peers, level: i, widened: i > 0, thin: peers.length < floor,
          label: level.label(op), minN: floor,
        };
      }
    }
  }

  // ----------------------------------------------------------------- price

  /**
   * Revenue-weighted average selling price for a product line over the most
   * recent `months`. Weighting by revenue (not a plain mean of unit prices)
   * keeps a high-volume staple from being outvoted by an occasional specialty
   * buy. Returns null when the line had no volume in the window.
   */
  function lineAsp(line, months) {
    const window = months == null ? 3 : months;
    const from = Math.max(0, MONTH_COUNT - window);
    let rev = 0;
    let qty = 0;
    for (const p of line.products) {
      for (let i = from; i < MONTH_COUNT; i++) {
        rev += p.qty[i] * p.price[i];
        qty += p.qty[i];
      }
    }
    return qty > 0 ? rev / qty : null;
  }

  /** Weighted ASP across every line an operator still buys. */
  function operatorAsp(op, months) {
    const window = months == null ? 3 : months;
    const from = Math.max(0, MONTH_COUNT - window);
    let rev = 0;
    let qty = 0;
    for (const line of op.lineData) {
      for (const p of line.products) {
        for (let i = from; i < MONTH_COUNT; i++) {
          rev += p.qty[i] * p.price[i];
          qty += p.qty[i];
        }
      }
    }
    return qty > 0 ? rev / qty : null;
  }

  /**
   * Min / max / mean / stddev of peer ASPs for one product line.
   *
   * NOTE: min and max are taken ACROSS PEERS (each peer contributes one
   * line-level ASP), matching the "Peer Group Min / Peer Group Max" column
   * headers in the spec — not across products within a single peer's line.
   */
  function peerLineStats(peerOps, lineName, months) {
    const window = months == null ? 3 : months;
    const asps = [];
    const qtys = [];
    for (const peer of peerOps) {
      const line = peer.lineData.find(l => l.name === lineName);
      if (!line) continue;
      const asp = lineAsp(line, window);
      if (asp == null) continue;
      asps.push(asp);
      qtys.push(sum(lastN(line.qty, window)));
    }
    const s = stats(asps);
    return s ? { ...s, avgQty: sum(qtys) / qtys.length, ...quartiles(asps) } : null;
  }

  /** Smallest cohort for which quartiles say anything. Below this, draw dots. */
  const QUARTILE_MIN_N = 5;

  /**
   * Linear-interpolated percentile (the R-7 / PERCENTILE.INC convention, the
   * same one NumPy and Excel use by default). `sorted` must already be sorted
   * ascending.
   */
  function percentile(sorted, p) {
    if (!sorted.length) return null;
    if (sorted.length === 1) return sorted[0];
    const idx = (sorted.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  }

  /**
   * Five-number summary for a box plot, plus the sorted values themselves so
   * the chart can always plot the individual peers.
   *
   * `enoughForBox` is the honesty flag: with only a handful of peers a box and
   * whisker implies a distribution that isn't there, so the caller draws bare
   * dots instead. The quartiles are still returned — they are simply not
   * something to draw a box around.
   */
  function quartiles(values) {
    const v = values.filter(x => x != null && Number.isFinite(x)).sort((a, b) => a - b);
    if (!v.length) return null;
    return {
      values: v,
      min: v[0],
      max: v[v.length - 1],
      q1: percentile(v, 0.25),
      median: percentile(v, 0.5),
      q3: percentile(v, 0.75),
      enoughForBox: v.length >= QUARTILE_MIN_N,
    };
  }

  /**
   * Tukey whiskers for a `quartiles()` summary: each whisker ends at the most
   * extreme peer still inside 1.5 x IQR of the box, and anyone beyond is an
   * outlier drawn on its own. Whiskers always sit on a real peer's price, so
   * the chart never shows a value nobody actually pays.
   */
  function tukeyBox(q) {
    if (!q) return null;
    const reach = 1.5 * (q.q3 - q.q1);
    const loFence = q.q1 - reach;
    const hiFence = q.q3 + reach;
    const inliers = q.values.filter(v => v >= loFence && v <= hiFence);
    const outliers = q.values.filter(v => v < loFence || v > hiFence);
    return {
      whiskerLo: inliers.length ? inliers[0] : q.q1,
      whiskerHi: inliers.length ? inliers[inliers.length - 1] : q.q3,
      inliers,
      outliers,
    };
  }

  /**
   * Like-for-like ASP: ours and the cohort's, both weighted by THIS operator's
   * own volume mix, over the lines where a peer comparison actually exists.
   *
   * A plain operator-level ASP against a plain peer ASP conflates price with
   * basket composition — an operator that has stopped buying its cheap lines
   * looks expensive even when every line it still buys is competitively
   * priced. Holding the mix fixed isolates the price effect, which is the
   * question being asked ("am I selling above the peers in that area?").
   */
  function likeForLikeAsp(op, peerOps, months) {
    const window = months == null ? 3 : months;
    let mineNum = 0, peerNum = 0, den = 0, lines = 0;
    for (const line of op.lineData) {
      const qty = sum(lastN(line.qty, window));
      if (!qty) continue;
      const mine = lineAsp(line, window);
      const peer = peerLineStats(peerOps, line.name, window);
      if (mine == null || !peer) continue;
      mineNum += mine * qty;
      peerNum += peer.asp * qty;
      den += qty;
      lines++;
    }
    return den ? { mine: mineNum / den, peer: peerNum / den, lines } : null;
  }

  /**
   * Commercial position of our price against the peer average.
   *
   * Arrow direction follows the spec's worked example, where charging ABOVE
   * the peer ASP was marked with a down arrow: the arrow reads as commercial
   * position, not magnitude. Above peers = unfavourable = churn risk.
   */
  function classifyComparison(opAsp, peerAsp, tol) {
    const band = tol == null ? 0.03 : tol;
    if (opAsp == null || peerAsp == null || !peerAsp) {
      return { dir: 'none', arrow: '—', delta: null };
    }
    const delta = opAsp / peerAsp - 1;
    if (delta > band) return { dir: 'above', arrow: '↓', delta };
    if (delta < -band) return { dir: 'below', arrow: '↑', delta };
    return { dir: 'inline', arrow: '→', delta };
  }

  /**
   * Product lines that most of the cohort buys and this operator does not —
   * either never bought, or stopped. Answers "what are similar customers
   * buying that this one isn't".
   */
  function peersAlsoBuy(op, peerOps, minShare) {
    const share = minShare == null ? 0.5 : minShare;
    if (!peerOps.length) return [];
    const mine = new Set(op.lineData.filter(l => l.status !== 'Stopped').map(l => l.name));
    const tally = new Map();
    for (const peer of peerOps) {
      for (const line of peer.lineData) {
        if (line.status === 'Stopped' || mine.has(line.name)) continue;
        const entry = tally.get(line.name) || { buyers: 0, qty: 0, asps: [] };
        const asp = lineAsp(line, 3);
        tally.set(line.name, {
          buyers: entry.buyers + 1,
          qty: entry.qty + sum(lastN(line.qty, 3)),
          asps: asp == null ? entry.asps : [...entry.asps, asp],
        });
      }
    }
    return [...tally.entries()]
      .filter(([, e]) => e.buyers / peerOps.length >= share)
      .map(([name, e]) => {
        const s = stats(e.asps);
        return {
          name,
          buyers: e.buyers,
          peerCount: peerOps.length,
          sharePct: Math.round(e.buyers / peerOps.length * 100),
          avgQty3: e.qty / e.buyers,
          asp: s ? s.asp : null,
        };
      })
      .sort((a, b) => b.buyers - a.buyers || b.avgQty3 - a.avgQty3);
  }

  // -------------------------------------------------------------- contract

  function daysUntil(iso, asOf) {
    const from = Date.parse(asOf + 'T00:00:00Z');
    const to = Date.parse(iso + 'T00:00:00Z');
    if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
    return Math.round((to - from) / DAY_MS);
  }

  /**
   * Contract lifecycle state as of the snapshot date (NOT wall-clock today —
   * the dashboard must render identically whenever it is opened).
   */
  function contractStatus(contract, asOf, warnDays) {
    const warn = warnDays == null ? 120 : warnDays;
    if (!contract || !contract.to) return { daysLeft: null, state: 'unknown', label: 'No agreement on file' };
    const daysLeft = daysUntil(contract.to, asOf);
    if (daysLeft == null) return { daysLeft: null, state: 'unknown', label: 'Dates unavailable' };
    if (daysLeft < 0) return { daysLeft, state: 'expired', label: `Expired ${Math.abs(daysLeft)} days ago` };
    if (daysLeft === 0) return { daysLeft, state: 'expiring', label: 'Expires today' };
    if (daysLeft <= warn) return { daysLeft, state: 'expiring', label: `Expires in ${daysLeft} days` };
    return { daysLeft, state: 'active', label: `Expires in ${daysLeft} days` };
  }

  /** Trailing 3 / 6 / 9 month volume totals, for the contract table. */
  function volumeWindows(qty) {
    return { m3: sum(lastN(qty, 3)), m6: sum(lastN(qty, 6)), m9: sum(lastN(qty, 9)) };
  }

  /** Most recent quarter against the one before it. */
  function trend3(qty) {
    const recent = sum(qty.slice(9));
    const prior = sum(qty.slice(6, 9));
    return prior ? recent / prior - 1 : 0;
  }

  // ------------------------------------------------------------ generation

  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function seeded(s) {
    let v = Math.abs(Math.trunc(s)) % 233280;
    return () => {
      v = (v * 9301 + 49297) % 233280;
      return v / 233280;
    };
  }

  /**
   * Base unit price for a SKU, derived from its name alone.
   *
   * This is what makes peer comparison meaningful: the same product must cost
   * roughly the same everywhere, with each operator's negotiated position
   * applied on top. Drawing a fresh random base per operator (as the original
   * prototype did) would make peer min/max/ASP pure noise.
   */
  function skuBase(name) {
    const rnd = seeded(hashStr(name));
    rnd();
    return +(16 + rnd() * 92).toFixed(2);
  }

  return {
    SEG_LABEL, COHORT_LADDER,
    sum, stats, cohortFor,
    lineAsp, operatorAsp, likeForLikeAsp, peerLineStats, classifyComparison, peersAlsoBuy,
    percentile, quartiles, tukeyBox, QUARTILE_MIN_N,
    daysUntil, contractStatus, volumeWindows, trend3,
    hashStr, seeded, skuBase,
  };
});
