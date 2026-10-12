/**
 * Business-language explanations — the stand-in for the LLM layer.
 *
 * Every sentence is filled from computed metrics, so it can never contradict
 * the charts. Written for a salesperson skimming a list, not an analyst:
 * short sentences, plain words, no model jargon.
 *
 * One rule from the business case is enforced here (and by a test):
 * insight, not negotiation. Nothing in this file proposes a price, a
 * discount or an offer. The salesperson cannot see competitor quotes, and
 * neither can we, so negotiation stays a human decision.
 *
 * Loaded in the browser as `window.DistNarrative`.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./distributor-data.js'), require('./distributor-logic.js'), require('./distributor-format.js'));
  } else {
    root.DistNarrative = factory(root.DistData, root.DistLogic, root.DistFormat);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (D, LG, F) {
  'use strict';

  const { pctU, fmtRev, monthYr, listJoin } = F;
  const avg = (arr, idxs) => LG.windowSum(arr, idxs) / idxs.length;
  /** Unsigned whole-number percentage of a change: −0.6 → "60%". */
  const by = v => Math.round(Math.abs(v) * 100) + '%';
  const lower = s => s.toLowerCase();

  const GUARDRAIL = 'These are facts from our own invoices. No price is suggested — we cannot see competitor offers or the operator’s other options, so the conversation and any terms stay with the salesperson.';

  /** The like-for-like product switch with the biggest share move, if any. */
  const topSwitch = o => o.shifts.filter(s => !s.cheaper).sort((a, b) => b.shift.shiftPts - a.shift.shiftPts)[0] || null;
  const decliningCats = o => o.categories.filter(x => x.status === 'Declining');
  const cheaperCats = o => o.categories.filter(x => x.status !== 'Stopped' && x.asp && x.asp.mixEffect <= -0.05);
  const topRiskDriver = o => (o.attribution.find(d => d.pts > 0 && !['other', 'size'].includes(d.key)) || {}).key || null;

  // ------------------------------------------------------------- drivers

  /** One plain label per model driver — used in the "what raised / lowered risk" lists. */
  function driverText(key, o) {
    const s = topSwitch(o);
    switch (key) {
      case 'revTrend': return o.revTrend < 0 ? `Spending ${by(o.revTrend)} less than last quarter` : `Spending ${by(o.revTrend)} more than last quarter`;
      case 'frequency': return `Ordering ${avg(o.orders, LG.RECENT_IDX).toFixed(0)} times a month, down from ${avg(o.orders, LG.PREV_Q_IDX).toFixed(0)}`;
      case 'recency': return o.recency.ratio > 1.25
        ? `Last order ${o.daysSince} days ago — usually every ${o.interval} days`
        : `Still ordering on schedule (every ${o.interval} days)`;
      case 'catsLost': return `Stopped buying ${listJoin(o.catsLost.map(x => lower(x.name)))}`;
      case 'switch': return s ? `Replaced ${s.shift.from} with ${s.shift.to}` : 'Switching products';
      case 'tradeDown': return cheaperCats(o).length ? `Moving to cheaper products in ${listJoin(cheaperCats(o).map(x => lower(x.name)))}` : 'Choosing slightly cheaper products';
      case 'price': return `Prices they pay are up ${by(o.asp.priceEffect)} since spring`;
      case 'service': return `Late deliveries rose from ${pctU(o.service.latePrior)} to ${pctU(o.service.lateRecent)} of orders`;
      case 'tenure': return `Loyal operator for ${o.tenure} years`;
      case 'breadth': return `Still buys across ${o.activeCats} categories`;
      case 'size': return o.size === 'L' ? 'Large operator — less likely to switch' : 'Smaller operator — switches more easily';
      default: return 'Other smaller signals';
    }
  }

  /** The same drivers as clauses that read inside a sentence ("…because it is …"). */
  function driverClause(key, o) {
    const s = topSwitch(o);
    switch (key) {
      // A wobble under 10% is not a reason worth a salesperson's time.
      case 'revTrend': return o.revTrend <= -0.1 ? `it is spending ${by(o.revTrend)} less than last quarter` : null;
      case 'frequency': return `it orders ${avg(o.orders, LG.RECENT_IDX).toFixed(0)} times a month instead of ${avg(o.orders, LG.PREV_Q_IDX).toFixed(0)}`;
      case 'recency': return `its last order was ${o.daysSince} days ago when it usually orders every ${o.interval}`;
      case 'catsLost': return `it stopped buying ${listJoin(o.catsLost.map(x => lower(x.name)))}`;
      case 'switch': return s ? `it replaced ${s.shift.from} with ${s.shift.to}` : 'it is switching products';
      case 'tradeDown': return cheaperCats(o).length ? `it is moving to cheaper products in ${listJoin(cheaperCats(o).map(x => lower(x.name)))}` : null;
      case 'price': return `the prices it pays are up ${by(o.asp.priceEffect)} since spring`;
      case 'service': return `late deliveries rose to ${pctU(o.service.lateRecent)} of its orders`;
      default: return null;
    }
  }

  // --------------------------------------------------- one-line headline

  /** The single line shown next to an operator in every list. */
  function headline(o, tier) {
    if (tier === 'low') return 'Buying normally';
    const s = topSwitch(o);
    switch (o.scope.key) {
      case 'operator-wide': return `Spending ${by(o.revTrend)} less across most categories`;
      case 'category-specific': {
        const stopped = o.catsLost.map(x => lower(x.name));
        const less = decliningCats(o).map(x => lower(x.name));
        return stopped.length ? `Stopped buying ${listJoin(stopped.slice(0, 2))}` : `Buying less ${listJoin(less.slice(0, 2))}`;
      }
      case 'product-switch': return s ? `Switching ${lower(s.category)} to a different product` : 'Switching products';
      case 'trade-down': return `Moving to cheaper ${listJoin(cheaperCats(o).map(x => lower(x.name)).slice(0, 2))}`;
      default: {
        const k = topRiskDriver(o);
        if (k === 'service') return `Delivery problems — ${pctU(o.service.lateRecent)} of orders late`;
        if (k === 'price') return `Prices up ${by(o.asp.priceEffect)} since spring`;
        if (k === 'recency') return `No order in ${o.daysSince} days`;
        return 'Small changes worth watching';
      }
    }
  }

  // -------------------------------------------------- what-changed cards

  /**
   * Up to four plain cards for the top of the operator page:
   * `{ title, detail, tone }`, tone 'bad' | 'good'.
   */
  function whatChanged(o) {
    const s = topSwitch(o);
    const card = (title, detail, tone) => ({ title, detail, tone });
    const cards = [];
    for (const d of o.attribution.filter(x => x.pts > 0)) {
      if (cards.length >= 3) break;
      if (d.key === 'revTrend') cards.push(card(`Spending ${by(o.revTrend)} less`, `${fmtRev(o.rev90)} in the last 3 months vs ${fmtRev(LG.windowSum(o.rev, LG.PREV_Q_IDX))} the 3 months before.`, 'bad'));
      if (d.key === 'frequency') cards.push(card('Ordering less often', `${avg(o.orders, LG.RECENT_IDX).toFixed(0)} orders a month now, down from ${avg(o.orders, LG.PREV_Q_IDX).toFixed(0)}.`, 'bad'));
      if (d.key === 'recency') cards.push(card(`No order in ${o.daysSince} days`, `They normally order every ${o.interval} days.`, 'bad'));
      if (d.key === 'catsLost') cards.push(card(`Stopped ${o.catsLost.length} ${o.catsLost.length === 1 ? 'category' : 'categories'}`, `${listJoin(o.catsLost.map(x => `${x.name} (last bought ${monthYr(x.lastIdx)})`))}.`, 'bad'));
      if (d.key === 'switch' && s) cards.push(card(`Switching products in ${lower(s.category)}`, `${s.shift.from} is being replaced by ${s.shift.to}.`, 'bad'));
      if (d.key === 'tradeDown' && cheaperCats(o).length) cards.push(card('Buying cheaper products', `In ${listJoin(cheaperCats(o).map(x => lower(x.name)))} they are moving to lower-priced items.`, 'bad'));
      if (d.key === 'price') cards.push(card(`Prices up ${by(o.asp.priceEffect)}`, `Same products, higher prices since spring. Their discount off list went from ${pctU(o.discountPrior)} to ${pctU(o.discountNow)}.`, 'bad'));
      if (d.key === 'service') cards.push(card('Delivery problems', `${pctU(o.service.lateRecent)} of orders arrived late this quarter, up from ${pctU(o.service.latePrior)}.`, 'bad'));
    }
    const good = o.attribution.find(x => x.pts < 0 && ['tenure', 'breadth', 'recency', 'size'].includes(x.key));
    if (good) cards.push(card('Working in our favour', driverText(good.key, o) + '.', 'good'));
    if (o.seasonal && o.revTrendRaw < -0.1) cards.push(card('Summer dip is normal', `Schools buy less in Jun–Aug. Spend is ${by(o.revTrendRaw)} lower than last quarter before allowing for that.`, 'good'));
    if (!cards.length) cards.push(card('Nothing unusual', 'Spending, ordering and the product basket are all in line with the last six months.', 'good'));
    return cards;
  }

  // ------------------------------------------------------------- levels

  /**
   * Where the decline sits, at the three levels from the business case:
   * whole operator, category, product. Each `{ level, verdict, detail, hit }`.
   */
  function levels(o) {
    const s = topSwitch(o);
    const falling = [...o.catsLost, ...decliningCats(o)];
    const replaced = o.products.filter(p => p.replacedBy);
    const stoppedItems = o.products.filter(p => p.status === 'Stopped' && !o.catsLost.some(c => c.name === p.category));
    return [
      {
        level: 'Whole operator', hit: o.scope.key === 'operator-wide',
        verdict: o.scope.key === 'operator-wide' ? 'Declining' : o.revTrend < -0.1 ? 'Softening' : 'Holding',
        detail: `Total spend ${o.revTrend < 0 ? 'down' : 'up'} ${by(o.revTrend)} vs last quarter.`,
      },
      {
        level: 'Categories', hit: falling.length > 0,
        verdict: falling.length ? `${falling.length} of ${o.categories.length} falling` : 'All steady',
        detail: falling.length ? `${listJoin(falling.map(x => x.name))}.` : `Still buying all ${o.categories.length} categories at normal levels.`,
      },
      {
        level: 'Products', hit: replaced.length + stoppedItems.length > 0 || cheaperCats(o).length > 0,
        verdict: replaced.length ? `${replaced.length} being replaced` : cheaperCats(o).length ? 'Moving to cheaper items' : stoppedItems.length ? `${stoppedItems.length} stopped` : 'Same basket',
        detail: s ? `${s.shift.from} → ${s.shift.to}.` : cheaperCats(o).length ? `Cheaper items gaining in ${listJoin(cheaperCats(o).map(x => lower(x.name)))}.` : 'Buying the same products as before.',
      },
    ];
  }

  /** Schools buy less every summer; say so, so the dip is not mistaken for churn. */
  function seasonText(o) {
    return `Schools buy less in Jun–Aug every year. Raw spend is ${o.revTrendRaw < 0 ? 'down' : 'up'} ${by(o.revTrendRaw)} on last quarter; allowing for the normal summer break it is ${Math.abs(o.revTrend) < 0.02 ? 'steady' : `${o.revTrend < 0 ? 'down' : 'up'} ${by(o.revTrend)}`}. Trends on this page already allow for the break.`;
  }

  // ------------------------------------------------------------- summary

  function scopeSentence(o) {
    switch (o.scope.key) {
      case 'operator-wide': return 'The decline is across the whole relationship, not just one category.';
      case 'category-specific': return 'The decline appears category-specific rather than a full relationship loss.';
      case 'product-switch': return 'Total spend is holding; what changed is which products they buy.';
      case 'trade-down': return 'Volume is holding, but they are choosing cheaper products, so revenue per order is falling.';
      default: return 'Their buying pattern itself has not changed much.';
    }
  }

  /** The paragraph under "Why this operator needs attention". tier: 'high' | 'medium' | 'low'. */
  function summary(o, tier, team) {
    if (tier === 'low') {
      return `${o.name} looks healthy. It is ordering on its usual schedule, spending ${o.revTrend < 0 ? 'about the same as' : 'a little more than'} last quarter, and still buys across ${o.activeCats} categories. No review needed.`;
    }
    const reasons = o.attribution.filter(d => d.pts > 0).map(d => driverClause(d.key, o)).filter(Boolean).slice(0, 3);
    const level = tier === 'high' ? 'elevated' : 'some';
    const why = reasons.length ? ` because ${listJoin(reasons)}` : '';
    return `${o.name} shows ${level} churn risk${why}. ${scopeSentence(o)} ${D.REVIEW_TEAMS[team].label} should review it — ${lower(D.REVIEW_TEAMS[team].focus)}.`;
  }

  // --------------------------------------------------------------- facts

  /** Facts the team should review before talking to the operator. `{ topic, text }`. */
  function facts(o) {
    const out = [];
    const add = (topic, text) => out.push({ topic, text });
    add('Spend', `${fmtRev(o.rev90)} in the last 3 months (${o.revTrend < 0 ? 'down' : 'up'} ${by(o.revTrend)} on the 3 months before). ${fmtRev(o.rev12)} over 12 months.`);
    if (o.seasonal) add('Season', seasonText(o));
    add('Orders', `${avg(o.orders, LG.RECENT_IDX).toFixed(0)} orders a month now vs ${avg(o.orders, LG.PREV_Q_IDX).toFixed(0)} before. Last order ${o.daysSince} days ago; usually every ${o.interval} days.`);
    o.catsLost.forEach(x => add('Category', `Stopped buying ${lower(x.name)} after ${monthYr(x.lastIdx)} — it was ${fmtRev(x.rev12)} over the year.`));
    const less = decliningCats(o);
    if (less.length) add('Category', `Buying less than last quarter: ${listJoin(less.map(x => `${lower(x.name)} (−${by(x.trend)})`))}.`);
    o.shifts.forEach(({ category, shift }) => add('Product', `${category}: ${shift.from} went from ${pctU(shift.fromPrior)} to ${pctU(shift.fromRecent)} of what they buy; ${shift.to} went from ${pctU(shift.toPrior)} to ${pctU(shift.toRecent)}.`));
    // Only worth a line when price or product choice actually moved.
    if (o.asp && (Math.abs(o.asp.priceEffect) >= 0.02 || Math.abs(o.asp.mixEffect) >= 0.03)) add('Price', `On the same products, prices are ${o.asp.priceEffect >= 0 ? 'up' : 'down'} ${by(o.asp.priceEffect)} since spring. Choosing ${o.asp.mixEffect < 0 ? 'cheaper' : 'dearer'} products moved the average ${by(o.asp.mixEffect)}. Discount off list: ${pctU(o.discountPrior)} → ${pctU(o.discountNow)}.`);
    const gmPrior = LG.marginRate(LG.windowSum(o.rev, LG.PRIOR_IDX), LG.windowSum(o.cost, LG.PRIOR_IDX));
    const gmRecent = LG.marginRate(LG.windowSum(o.rev, LG.RECENT_IDX), LG.windowSum(o.cost, LG.RECENT_IDX));
    add('Margin', `Our gross margin on this operator went from ${pctU(gmPrior, 1)} to ${pctU(gmRecent, 1)}.`);
    if (o.service.lateRecent - o.service.latePrior > 0.05) {
      add('Service', `${pctU(o.service.lateRecent)} of orders were late this quarter (was ${pctU(o.service.latePrior)}). Credits were ${pctU(o.service.creditRecent, 1)} of spend; fill rate ${pctU(o.fill[11])} in September.`);
    }
    return out;
  }

  /** Questions to understand what changed. Questions, never offers. */
  function questions(o) {
    const out = [];
    o.shifts.filter(s => !s.cheaper).forEach(({ category, shift }) =>
      out.push(`Why did they move from ${shift.from} to ${shift.to} in ${lower(category)}?`));
    o.catsLost.forEach(x => out.push(`Who supplies their ${lower(x.name)} now?`));
    if (cheaperCats(o).length) out.push('Is the move to cheaper products a budget decision or a change in what they need?');
    if (o.service.lateRecent - o.service.latePrior > 0.05) out.push('Have the late deliveries since July affected how they see us?');
    if (o.recency.state !== 'on-schedule') out.push('Is the gap since the last order planned (closure, season) or are they buying elsewhere?');
    if (!out.length) out.push('Has anything changed in their business that we should plan for?');
    return out.slice(0, 5);
  }

  /** Plain-text review brief for the clipboard. */
  function briefText(o, tier, team) {
    return [
      `OPERATOR REVIEW BRIEF — ${o.name} (${o.id})`,
      `${o.branch} branch · risk ${Math.round(o.prob * 100)}% · ${fmtRev(o.revAtRisk)} revenue at risk per quarter · review: ${D.REVIEW_TEAMS[team].label}`,
      '',
      summary(o, tier, team),
      '',
      'Facts to review:',
      ...facts(o).map(f => `- [${f.topic}] ${f.text}`),
      '',
      'Questions to ask:',
      ...questions(o).map((q, i) => `${i + 1}. ${q}`),
      '',
      GUARDRAIL,
    ].join('\n');
  }

  return { GUARDRAIL, seasonText, driverText, driverClause, headline, whatChanged, levels, summary, scopeSentence, facts, questions, briefText, topSwitch, topRiskDriver };
});
