/**
 * Model Health (analytics team) — every metric is paired with a sentence a
 * business user can read, e.g. "of every 100 operators flagged High, 74 did
 * cut spending".
 *
 * build(ctx) → template values.
 */
(function (root) {
  'use strict';
  const D = root.DistData, F = root.DistFormat, T = root.DistNarrative;
  const { TIER, pill, H } = root.DistViews.common;

  const LABELS = {
    revTrend: 'Spending trend', frequency: 'How often they order', recency: 'Days since last order',
    catsLost: 'Categories stopped', switch: 'Product switching', tradeDown: 'Moving to cheaper products',
    price: 'Price changes', service: 'Late deliveries & credits', tenure: 'Years as an operator',
    breadth: 'Number of categories bought', size: 'Operator size',
  };
  const PSI = v => (v <= 0.1 ? ['Stable', TIER.low] : v <= 0.2 ? ['Watch', TIER.medium] : ['Check', TIER.high]);

  function build(ctx) {
    const { book, state, tierOf } = ctx;
    const M = D.MODEL;
    const keys = Object.keys(LABELS);
    const imp = keys.map(k => ({ k, v: book.reduce((a, o) => a + Math.abs((o.attribution.find(d => d.key === k) || { pts: 0 }).pts), 0) / book.length }))
      .filter(x => x.v > 0).sort((a, b) => b.v - a.v);
    const impMax = Math.max(0.001, ...imp.map(x => x.v));
    const bins = Array.from({ length: 10 }, (_, i) => book.filter(o => Math.min(9, Math.floor(o.prob * 10)) === i).length);
    const binMax = Math.max(1, ...bins);
    const sessionFb = Object.values(state.fb).filter(Boolean);
    const useful = M.feedback.useful + sessionFb.filter(v => v === 'up').length;
    const notRight = M.feedback.notRight + sessionFb.filter(v => v === 'down').length;
    const p = Math.round(M.metrics.precisionHigh * 100), r = Math.round(M.metrics.recallHigh * 100);
    return {
      model: {
        version: M.version, label: M.label, trainedThrough: M.trainedThrough,
        metrics: [
          { label: 'Hit rate (precision)', v: p + '%', sub: `Of every 100 operators flagged High risk, ${p} did cut spending within 90 days.` },
          { label: 'Catch rate (recall)', v: r + '%', sub: `Of every 100 operators that cut spending, ${r} had been flagged High beforehand.` },
          { label: 'Ranking quality (AUC)', v: M.metrics.auc.toFixed(2), sub: 'How well the score puts risky operators above safe ones. 0.5 is a coin flip, 1.0 is perfect.' },
          { label: 'Calibration (Brier)', v: M.metrics.brier.toFixed(3), sub: 'How close the risk % is to what really happens. Lower is better.' },
        ],
      },
      backHead: [H('Month scored'), H('Flagged High', 'right'), H('Did cut spending', 'right'), H('Hit rate', 'right'), H('All that cut spending', 'right'), H('Catch rate', 'right')],
      backRows: M.backtest.map(b => ({ month: b.month, flagged: b.flagged, hit: b.hit, prec: F.pctU(b.hit / b.flagged), eroded: b.eroded, rec: F.pctU(b.hit / b.eroded) })),
      drift: M.drift.map(d => { const [label, t] = PSI(d.psi); return { feature: d.feature, psi: d.psi.toFixed(2), w: Math.min(100, d.psi / 0.3 * 100) + '%', bg: t.color, status: pill([t.bg, t.ink], label) }; }),
      importance: imp.map(x => ({ label: LABELS[x.k], v: F.pctU(x.v / imp.reduce((a, y) => a + y.v, 0)), w: x.v / impMax * 100 + '%' })),
      scoreBins: bins.map((n, i) => ({ n: n || '', h: n / binMax * 100 + '%', bg: tierOf((i + 0.5) / 10).color, label: i * 10 + '%' })),
      feedback: { useful, notRight, rate: F.pctU(useful / (useful + notRight)) },
      guardrail: T.GUARDRAIL,
    };
  }

  root.DistViews.health = { build };
})(typeof globalThis !== 'undefined' ? globalThis : this);
