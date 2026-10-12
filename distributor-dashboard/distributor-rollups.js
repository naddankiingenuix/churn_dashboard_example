/**
 * Book-level rollups across built operators — the Overview and Category Risk
 * views. Pure functions over the output of DistModel.buildBook. Loaded in the
 * browser as `window.DistRollups`.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./distributor-data.js'), require('./distributor-logic.js'));
  } else {
    root.DistRollups = factory(root.DistData, root.DistLogic);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (D, LG) {
  'use strict';

  const { sum, windowSum, PRIOR_IDX, RECENT_IDX } = LG;
  const N = D.MONTHS.length;

  /** Every (operator, category) pair for one category name. */
  const holdings = (operators, name) =>
    operators.flatMap(o => o.categories.filter(x => x.name === name).map(x => ({ o, x })));

  /**
   * One row per category. "Revenue at risk" is each eroding holding's usual
   * quarterly spend (Oct–Mar) weighted by the operator's risk score — the
   * same definition the operator list uses, so the two reconcile.
   */
  function categoryRollup(operators) {
    return D.CATEGORY_NAMES.map((name, ci) => {
      const hs = holdings(operators, name);
      const qty = Array.from({ length: N }, (_, i) => sum(hs.map(h => h.x.qty[i])));
      // Trend on de-seasonalised volume, so the school summer break is not read as erosion.
      const qtyAdj = Array.from({ length: N }, (_, i) => sum(hs.map(h => h.x.qtyAdj[i])));
      const eroding = hs.filter(h => h.x.status === 'Declining' || h.x.status === 'Stopped');
      return {
        name, color: D.CATEGORY_C[ci],
        buyers: hs.filter(h => h.x.status !== 'Stopped').length,
        rev12: sum(hs.map(h => h.x.rev12)),
        trend: LG.trend3(qtyAdj),
        qty,
        declining: hs.filter(h => h.x.status === 'Declining').length,
        stopped: hs.filter(h => h.x.status === 'Stopped').length,
        switches: hs.filter(h => h.x.shift).length,
        riskRev: sum(eroding.map(h => LG.revenueAtRisk(h.x.rev, h.o.prob))),
        eroding,
        switching: hs.filter(h => h.x.shift),
      };
    }).filter(r => r.rev12 > 0);
  }

  /** Units per product per month for one category — the stacked chart. */
  function categoryStack(operators, name) {
    const products = holdings(operators, name).flatMap(h => h.x.products);
    const names = [...new Set(products.map(p => p.name))];
    return Array.from({ length: N }, (_, i) => names
      .map(n => ({ name: n, mfr: products.find(p => p.name === n).mfr, units: sum(products.filter(p => p.name === n).map(p => p.qty[i])) }))
      .filter(s => s.units > 0));
  }

  /**
   * Each product's share of one category's units, before (Oct–Mar) vs now
   * (Jul–Sep), plus our recent gross margin on it — a switch to a lower-margin
   * product costs the distributor even when the operator stays.
   */
  function productMix(operators, name) {
    const products = holdings(operators, name).flatMap(h => h.x.products);
    const prior = LG.shareByProduct(products, PRIOR_IDX);
    const recent = LG.shareByProduct(products, RECENT_IDX);
    const shareIn = (list, n) => (list.find(x => x.name === n) || { share: 0 }).share;
    return [...new Set([...prior, ...recent].map(x => x.name))].map(n => {
      const ps = products.filter(p => p.name === n);
      const rev = sum(ps.map(p => sum(RECENT_IDX.map(i => p.qty[i] * p.price[i]))));
      const cost = sum(ps.map(p => sum(RECENT_IDX.map(i => p.qty[i] * p.cost[i]))));
      return {
        name: n, mfr: ps[0].mfr, tier: ps[0].tier,
        priorShare: shareIn(prior, n), recentShare: shareIn(recent, n),
        delta: shareIn(recent, n) - shareIn(prior, n),
        gm: LG.marginRate(rev, cost),
      };
    }).sort((a, b) => b.recentShare - a.recentShare);
  }

  /** Flagged operators and revenue at risk per review team. */
  function teamRollup(operators, teamOf) {
    return Object.keys(D.REVIEW_TEAMS).filter(k => k !== 'none').map(k => {
      const os = operators.filter(o => teamOf(o) === k);
      return { key: k, label: D.REVIEW_TEAMS[k].label, count: os.length, revAtRisk: sum(os.map(o => o.revAtRisk)) };
    });
  }

  return { categoryRollup, categoryStack, productMix, teamRollup, holdings, windowSum };
});
