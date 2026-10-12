/**
 * Turns roster rows into fully-populated operators: 12 months of invoice
 * lines per product, order cadence, service events, and every derived metric
 * the dashboard shows.
 *
 * Generation is seeded from the operator id, so the same operator always
 * produces the same invoices. The roster's `signals` decide the shape:
 *
 *   erosion    volume falls across the board in the back half of the year
 *   switch     in one category the main product is replaced by another
 *              product at a similar price point
 *   tradedown  the top categories shift from premium items to cheaper ones
 *   price      sell price climbs faster than cost from April
 *   service    late deliveries and credits jump in the latest quarter
 *   (catsNow < catsPeak)  the smallest categories stop in Apr–Jun
 *
 * Loaded in the browser as `window.DistModel`.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./distributor-data.js'), require('./distributor-logic.js'));
  } else {
    if (!root.DistData || !root.DistLogic) throw new Error('distributor-model.js: load distributor-data.js and distributor-logic.js first.');
    root.DistModel = factory(root.DistData, root.DistLogic);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (D, LG) {
  'use strict';

  const { sum } = LG;
  const N = D.MONTHS.length;
  const range = n => Array.from({ length: n }, (_, i) => i);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const shuffle = (arr, rnd) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  /**
   * Within one category, a switch whose mix effect cuts the average price by
   * more than this is trading down rather than a like-for-like product switch.
   */
  const CHEAPER_MIX = -0.1;
  /** Smaller accounts switch suppliers more readily. */
  const SIZE_EFFECT = { S: 0.05, M: 0.015, L: -0.03 };
  /** Normal monthly demand for an operator type; flat when the type has no season. */
  const seasonOf = type => D.SEASONALITY[type] || Array(N).fill(1);
  /** Removes the normal seasonal pattern, so trends compare like with like. */
  const deseason = (arr, season) => arr.map((v, i) => v / season[i]);

  /** Linear ramp from 0 (month 5 and before) to 1 (month 9 onward). */
  const ramp = i => clamp((i - 5) / 4, 0, 1);

  // ------------------------------------------------------------- the basket

  /** Share of a category's units each SKU takes in month i. */
  function shareCurves(skus, plan) {
    const curves = new Map(skus.map(s => [s, Array(N).fill(0)]));
    const set = (s, f) => curves.set(s, range(N).map(f));
    if (plan.kind === 'switch') {
      // Brand switch or trade-down: `from` gives up most of its share to `to`.
      set(plan.from, i => plan.start - (plan.start - plan.end) * ramp(i));
      set(plan.to, i => 1 - (plan.start - (plan.start - plan.end) * ramp(i)));
    } else {
      set(plan.primary, () => plan.lead);
      if (plan.secondary) set(plan.secondary, () => 1 - plan.lead);
    }
    return curves;
  }

  /** Which SKUs a category is bought as, and how that changes over the year. */
  function basketPlan(skus, role, rnd) {
    if (role === 'switch') {
      // A like-for-like switch between the two closest price points, so the
      // move reads as product substitution rather than as buying cheaper.
      const [a, b] = closestPairs(skus)[0];
      const [from, to] = rnd() < 0.5 ? [a, b] : [b, a];
      return { kind: 'switch', from, to, start: 0.82, end: 0.14 };
    }
    if (role === 'tradedown') {
      const byPrice = [...skus].sort((a, b) => b.price - a.price);
      return { kind: 'switch', from: byPrice[0], to: byPrice[byPrice.length - 1], start: 0.86, end: 0.3 };
    }
    const order = shuffle(skus, rnd);
    return { kind: 'steady', primary: order[0], secondary: order[1], lead: 0.72 + rnd() * 0.18 };
  }

  /** SKU pairs from different makers, closest in price first. */
  function closestPairs(skus) {
    const pairs = [];
    skus.forEach((a, i) => skus.slice(i + 1).forEach(b => { if (a.mfr !== b.mfr) pairs.push([a, b]); }));
    return pairs.sort((x, y) => Math.abs(x[0].price - x[1].price) / x[0].price - Math.abs(y[0].price - y[1].price) / y[0].price);
  }
  const closeness = name => {
    const [a, b] = closestPairs(D.CATEGORIES[name])[0];
    return Math.abs(a.price - b.price) / Math.max(a.price, b.price);
  };
  const spread = name => {
    const p = D.CATEGORIES[name].map(s => s.price);
    return 1 - Math.min(...p) / Math.max(...p);
  };

  /**
   * Assigns a story role to each category the operator buys. A product switch
   * goes where two products sell at nearly the same price; buying cheaper goes
   * where premium and value items are furthest apart — otherwise neither
   * story would be distinguishable from the other in the numbers.
   */
  function categoryRoles(cats, row) {
    const has = s => row.signals.includes(s);
    const active = cats.filter((_, ci) => ci < row.catsNow && D.CATEGORIES[cats[ci]].length > 1);
    const roles = new Map();
    if (has('switch') && active.length) {
      const best = [...active].sort((a, b) => closeness(a) - closeness(b))[0];
      roles.set(best, 'switch');
    }
    if (has('tradedown')) {
      active.filter(c => !roles.has(c)).sort((a, b) => spread(b) - spread(a)).slice(0, 2).forEach(c => roles.set(c, 'tradedown'));
    }
    return roles;
  }

  // ------------------------------------------------------------- generation

  function generate(row) {
    const has = s => row.signals.includes(s);
    const season = seasonOf(row.type);
    const rnd = LG.seeded(LG.hashStr(row.id));
    const cats = shuffle(D.TYPE_CATEGORIES[row.type], rnd).slice(0, row.catsPeak);
    const sumW = sum(cats.map((_, ci) => row.catsPeak - ci));
    const roles = categoryRoles(cats, row);

    const severity = has('erosion') ? clamp((row.prob - 0.3) * 1.3, 0, 0.85) : row.prob > 0.55 ? (row.prob - 0.55) * 0.6 : 0;
    const opF = range(N).map(i => Math.max(0.12, 1 - Math.max(0, i - 6) / 5 * severity));
    const priceUp = has('price') ? 0.06 + row.prob * 0.06 : 0.015;
    const priceFactor = 0.92 + rnd() * 0.16; // this operator's negotiated position

    const raw = cats.map((name, ci) => {
      const stop = ci < row.catsNow ? 99 : 7 + ((ci - row.catsNow) % 3);
      const weight = (row.catsPeak - ci) / sumW;
      const skus = D.CATEGORIES[name];
      const curves = shareCurves(skus, basketPlan(skus, roles.get(name), rnd));
      const products = skus.filter(s => curves.get(s).some(v => v > 0)).map(s => {
        const share = curves.get(s);
        const p0 = s.price * priceFactor;
        const price = range(N).map(i => +(p0 * (1 + (i >= 6 ? priceUp * (i - 5) / 6 : 0) + (rnd() - 0.5) * 0.02)).toFixed(2));
        const cost = range(N).map(i => +(s.price * s.cost * (1 + 0.03 * i / (N - 1))).toFixed(2));
        // Units are first drawn in "revenue space" and scaled to the roster's
        // 90-day revenue afterwards, so price and quantity stay consistent.
        const qtyRaw = range(N).map(i => (i >= stop ? 0 : weight * share[i] * opF[i] * season[i] * (0.88 + rnd() * 0.24) * 1000 / price[i]));
        return { sku: s, mfr: s.mfr, name: s.name, tier: s.tier, list: s.price * D.LIST_MARKUP, price, cost, qtyRaw };
      });
      return { name, idx: ci, role: roles.get(name) || null, stop, products };
    });

    const rawRev90 = sum(raw.flatMap(c => c.products.map(p => sum(LG.RECENT_IDX.map(i => p.qtyRaw[i] * p.price[i])))));
    const k = rawRev90 ? row.rev90 / rawRev90 : 0;
    const categories = raw.map(c => ({
      ...c,
      products: c.products.map(({ qtyRaw, ...p }) => ({ ...p, qty: qtyRaw.map(q => Math.round(q * k)) })),
    }));

    const ordersBase = 30 / row.interval;
    const orders = opF.map((f, i) => Math.max(0, Math.round(ordersBase * Math.pow(f, 1.2) * season[i] * (0.9 + rnd() * 0.2))));
    const svc = has('service');
    const lateRate = range(N).map(i => (svc && i >= 9 ? 0.22 + rnd() * 0.08 : 0.03 + rnd() * 0.03));
    const creditRate = range(N).map(i => (svc && i >= 9 ? 0.028 + rnd() * 0.01 : 0.005 + rnd() * 0.004));
    const fill = range(N).map(i => (svc && i >= 9 ? 0.87 + rnd() * 0.03 : 0.965 + rnd() * 0.02));

    // Invoice dates place every recent order in its week.
    const gap = row.interval * (row.prob > 0.6 ? 1.6 : 1);
    const weeks = Array(13).fill(0);
    for (let d = row.daysSince; d < 91; d += Math.max(1, Math.round(gap * (0.8 + rnd() * 0.4)))) weeks[12 - Math.floor(d / 7)] += 1;

    return { categories, orders, lateRate, creditRate, fill, weeks, priceUp };
  }

  // ---------------------------------------------------------------- metrics

  const monthly = (products, f) => range(N).map(i => sum(products.map(p => f(p, i))));

  /**
   * Trends and statuses are measured on de-seasonalised volume (qtyAdj);
   * charts keep the real, seasonal numbers (qty).
   */
  function categoryMetrics(c, custRev12, season) {
    const qty = monthly(c.products, (p, i) => p.qty[i]);
    const qtyAdj = deseason(qty, season);
    const rev = monthly(c.products, (p, i) => p.qty[i] * p.price[i]);
    const cost = monthly(c.products, (p, i) => p.qty[i] * p.cost[i]);
    const rev12 = sum(rev);
    const prior = LG.shareByProduct(c.products, LG.PRIOR_IDX);
    const recent = LG.shareByProduct(c.products, LG.RECENT_IDX);
    const status = LG.categoryStatus(qtyAdj);
    const shift = status === 'Stopped' ? null : LG.productSwitch(c.products);
    const products = c.products.map(p => ({
      ...p,
      status: LG.productStatus(deseason(p.qty, season)),
      trend: LG.trend3(deseason(p.qty, season)),
      rev12: sum(p.qty.map((q, i) => q * p.price[i])),
      lastIdx: p.qty.reduce((a, v, i) => (v > 0 ? i : a), -1),
      replacedBy: shift && shift.from === p.name ? shift.to : null,
      replaces: shift && shift.to === p.name ? shift.from : null,
    }));
    return {
      ...c, products, qty, rev, cost, rev12, status, shift,
      color: D.CATEGORY_C[D.CATEGORY_NAMES.indexOf(c.name)],
      revPrior: LG.windowSum(rev, LG.PRIOR_IDX),
      share: custRev12 ? rev12 / custRev12 : 0,
      qtyAdj,
      trend: LG.trend3(qtyAdj),
      gm: LG.marginRate(rev12, sum(cost)),
      leaderPrior: prior[0] ? prior[0].name : null,
      leaderNow: status === 'Stopped' ? null : recent[0] ? recent[0].name : null,
      mixPrior: prior, mixRecent: recent,
      asp: LG.aspDecomposition(c.products, LG.PRIOR_IDX, LG.RECENT_IDX),
      lastIdx: qty.reduce((a, v, i) => (v > 0 ? i : a), -1),
    };
  }

  /**
   * Price and mix effects measured inside each category, then weighted by
   * the category's earlier revenue. Decomposing the whole basket at once
   * would count "more cups, fewer plates" as trading down; buying cheaper
   * alternatives is a within-category question.
   */
  function withinCategoryAsp(categories) {
    const parts = categories.filter(c => c.asp && c.status !== 'Stopped');
    const w = sum(parts.map(c => c.revPrior));
    if (!w) return null;
    const mean = f => sum(parts.map(c => f(c.asp) * c.revPrior)) / w;
    const priceEffect = mean(a => a.priceEffect);
    const mixEffect = mean(a => a.mixEffect);
    return { priceEffect, mixEffect, change: priceEffect + mixEffect };
  }

  /**
   * Raw driver effects in probability space, before attribution rescales
   * them to the model score. Positive raises risk, negative lowers it.
   */
  function driverInputs(m, row) {
    return [
      { key: 'revTrend', raw: clamp(-m.revTrend, -0.15, 0.6) * 0.9 },
      { key: 'frequency', raw: clamp(-m.freqChange, -0.2, 0.6) * 0.5 },
      { key: 'recency', raw: clamp(m.recency.ratio - 1.25, -0.2, 2) * 0.12 },
      { key: 'catsLost', raw: m.catsLost.length / row.catsPeak * 0.6 },
      { key: 'switch', raw: Math.max(0, ...m.shifts.filter(s => !s.cheaper).map(s => s.shift.shiftPts)) * 0.3 },
      { key: 'tradeDown', raw: m.asp ? clamp(-m.asp.mixEffect, 0, 0.5) * 1.2 : 0 },
      // Normal list-price drift (~1.5% a year) is not a warning sign.
      { key: 'price', raw: m.asp ? clamp(m.asp.priceEffect - 0.02, 0, 0.2) * 2 : 0 },
      { key: 'service', raw: clamp((m.service.lateRecent - m.service.latePrior) * 1.2 + (m.service.creditRecent - m.service.creditPrior) * 6, -0.1, 0.5) },
      { key: 'tenure', raw: -Math.min(row.tenure, 12) / 12 * 0.1 },
      { key: 'breadth', raw: m.activeCats >= 5 ? -0.06 : 0 },
      { key: 'size', raw: SIZE_EFFECT[row.size] || 0 },
    ];
  }

  /** Share of list price given away, over the given months. */
  function discount(products, idxs) {
    const list = sum(products.map(p => sum(idxs.map(i => p.qty[i] * p.list))));
    const sell = sum(products.map(p => sum(idxs.map(i => p.qty[i] * p.price[i]))));
    return list ? 1 - sell / list : null;
  }

  /** One fully-derived operator. `baseRate` anchors the driver attribution. */
  function buildOperator(row, baseRate) {
    const g = generate(row);
    const all = g.categories.flatMap(c => c.products);
    const rev = monthly(all, (p, i) => p.qty[i] * p.price[i]);
    const cost = monthly(all, (p, i) => p.qty[i] * p.cost[i]);
    const rev12 = sum(rev);
    const season = seasonOf(row.type);
    const categories = g.categories.map(c => categoryMetrics(c, rev12, season));
    const late = g.orders.map((o, i) => Math.round(o * g.lateRate[i]));
    const credits = rev.map((r, i) => r * g.creditRate[i]);
    const m = {
      revTrend: LG.trend3(deseason(rev, season)),
      freqChange: LG.trend3(deseason(g.orders, season)),
      // Unadjusted, for the "normal summer dip" note on seasonal operators.
      revTrendRaw: LG.trend3(rev),
      seasonal: !!D.SEASONALITY[row.type],
      recency: LG.recencyState(row.daysSince, row.interval),
      catsLost: categories.filter(c => c.status === 'Stopped'),
      activeCats: categories.filter(c => c.status !== 'Stopped').length,
      // A switch that also moved to a cheaper item is trade-down, and is
      // counted there — not twice.
      shifts: categories.filter(c => c.shift).map(c => ({ category: c.name, shift: c.shift, cheaper: !!(c.asp && c.asp.mixEffect <= CHEAPER_MIX) })),
      asp: withinCategoryAsp(categories),
      service: LG.serviceShift({ orders: g.orders, late, rev, credits }),
    };
    const scope = LG.riskScope({ categories, revTrend: m.revTrend, switches: m.shifts.filter(s => !s.cheaper).length, mixEffect: m.asp ? m.asp.mixEffect : 0 });
    const products = categories.flatMap(c => c.products.map(p => ({ ...p, category: c.name, categoryColor: c.color })));
    return {
      ...row, ...m,
      categories, products, scope,
      rev, cost, rev12, rev90: LG.windowSum(rev, LG.RECENT_IDX),
      revAtRisk: LG.revenueAtRisk(rev, row.prob),
      discountPrior: discount(all, LG.PRIOR_IDX), discountNow: discount(all, LG.RECENT_IDX),
      gm: rev.map((r, i) => LG.marginRate(r, cost[i])),
      gm12: LG.marginRate(rev12, sum(cost)),
      orders: g.orders, late, credits, fill: g.fill, weeks: g.weeks,
      attribution: LG.attribute(driverInputs(m, row), row.prob, baseRate),
    };
  }

  /** The whole sample book, largest revenue at risk first. */
  function buildBook(roster, baseRate) {
    return roster.map(r => buildOperator(r, baseRate)).sort((a, b) => b.revAtRisk - a.revAtRisk);
  }

  return { buildOperator, buildBook, generate };
});
