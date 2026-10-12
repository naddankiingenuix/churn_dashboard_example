/**
 * Operator Explorer — one operator, read top to bottom like a story:
 * verdict → what changed → where (operator / category / product) → why the
 * score → the evidence → what to ask. Also supplies the review brief modal.
 *
 * build(ctx) → template values.
 */
(function (root) {
  'use strict';
  const D = root.DistData, F = root.DistFormat, LG = root.DistLogic, T = root.DistNarrative;
  const { INK, TIER, STATUS, STATUS_WORD, SCOPE, TEAM, pill, riskPill, trendColor, change, H, bars, spark, stacked, productColor, csv } = root.DistViews.common;
  const { windowSum, PRIOR_IDX, PREV_Q_IDX, RECENT_IDX } = LG;

  /** Risk-raising and risk-lowering drivers as two plain lists with a strength word. */
  function drivers(o) {
    const named = o.attribution.filter(d => d.key !== 'other' && Math.abs(d.pts) >= 0.01);
    const max = Math.max(0.01, ...named.map(d => Math.abs(d.pts)));
    const row = d => ({ text: T.driverText(d.key, o), word: LG.strength(d.pts), w: Math.abs(d.pts) / max * 100 + '%', title: `${F.pts(d.pts)} on the risk score` });
    return {
      up: named.filter(d => d.pts > 0).slice(0, 5).map(row),
      down: named.filter(d => d.pts < 0).slice(0, 4).map(row),
      note: `The score starts from the book average of ${F.pctU(D.BOOK.baseRate)}. The items on the left push this operator up, the items on the right pull it down, ending at ${F.pctU(o.prob)}.`,
    };
  }

  function categoryCards(o, sel, set) {
    return o.categories.map((c, i) => ({
      name: c.name, color: c.color, status: pill(STATUS[c.status], STATUS_WORD[c.status]),
      spend: F.fmtRev(c.rev12), change: c.status === 'Stopped' ? `last bought ${F.monthYr(c.lastIdx)}` : `${change(c.trend)} vs last qtr`,
      changeColor: c.status === 'Stopped' ? TIER.high.text : trendColor(c.trend),
      flag: c.shift ? 'Product switch' : '', hasFlag: !!c.shift,
      spark: spark(c.qty, c.status === 'Active' ? TIER.low.color : TIER.high.color),
      border: i === sel ? INK.text : '#E2DFD8', pick: () => set({ catIdx: i }),
    }));
  }

  function categoryDetail(o, c) {
    const stack = D.MONTHS.map((m, i) => c.products.map(p => ({ key: p.name, value: p.qty[i], color: productColor(p) })).filter(x => x.value > 0));
    const s = c.shift;
    const note = c.status === 'Stopped'
      ? `${o.name} last bought ${c.name.toLowerCase()} in ${F.monthYr(c.lastIdx)}. It was ${F.fmtRev(c.rev12)} over the year — ${Math.round(c.share * 100)}% of everything they buy from us.`
      : s ? `${s.from} used to be ${F.pctU(s.fromPrior)} of what they bought here; now it is ${F.pctU(s.fromRecent)}. ${s.to} took its place. ${c.asp && c.asp.mixEffect <= -0.1 ? 'The new product is cheaper, so revenue drops even at the same volume.' : 'The two are similarly priced, so this is a product choice, not a cost cut.'}`
        : c.status === 'Declining' ? `They are buying ${F.pctU(Math.abs(c.trend))} less ${c.name.toLowerCase()} than last quarter, but the same products as before.`
          : `Steady: same products, ${change(c.trend)} vs last quarter.`;
    return {
      name: c.name, color: c.color, note,
      stack: stacked(stack),
      legend: c.products.map(p => ({ name: p.name, color: productColor(p) })),
      head: [H('Product'), H('Status'), H('Spend 12 mo', 'right'), H('vs last qtr', 'right'), H('Last bought'), H('Note')],
      rows: c.products.map(p => ({
        name: p.name, color: productColor(p), status: pill(STATUS[p.status] || STATUS.Active, STATUS_WORD[p.status] || p.status),
        spend: F.fmtRev(p.rev12), change: p.status === 'Stopped' ? '—' : p.status === 'New' ? 'new' : change(p.trend),
        changeColor: trendColor(p.trend),
        last: p.lastIdx === 11 ? 'this month' : F.monthYr(p.lastIdx),
        note: p.replacedBy ? `Being replaced by ${p.replacedBy}` : p.replaces ? `Replacing ${p.replaces}` : '',
      })),
    };
  }

  function money(o) {
    const gm = idxs => LG.marginRate(windowSum(o.rev, idxs), windowSum(o.cost, idxs));
    const asp = o.asp || { priceEffect: 0, mixEffect: 0 };
    return [
      { label: 'Price on the same products', v: F.pct(asp.priceEffect, 1), sub: 'since spring', color: asp.priceEffect > 0.04 ? TIER.high.text : INK.text },
      { label: 'Effect of cheaper / dearer choices', v: F.pct(asp.mixEffect, 1), sub: 'on the average price', color: asp.mixEffect < -0.05 ? TIER.high.text : INK.text },
      { label: 'Discount off list', v: `${F.pctU(o.discountPrior)} → ${F.pctU(o.discountNow)}`, sub: 'before → now', color: o.discountNow < o.discountPrior - 0.02 ? TIER.high.text : INK.text },
      { label: 'Our gross margin', v: `${F.pctU(gm(PRIOR_IDX), 1)} → ${F.pctU(gm(RECENT_IDX), 1)}`, sub: 'before → now', color: INK.text },
    ];
  }

  function service(o) {
    const bad = o.service.lateRecent - o.service.latePrior > 0.05;
    return [
      { label: 'Late deliveries', v: `${F.pctU(o.service.latePrior)} → ${F.pctU(o.service.lateRecent)}`, sub: 'of orders, last qtr → this qtr', color: bad ? TIER.high.text : INK.text },
      { label: 'Credits issued', v: F.pctU(o.service.creditRecent, 1), sub: 'of their spend this quarter', color: o.service.creditRecent > 0.02 ? TIER.high.text : INK.text },
      { label: 'Fill rate', v: F.pctU(o.fill[11]), sub: 'of ordered lines delivered, Sep', color: o.fill[11] < 0.93 ? TIER.high.text : INK.text },
    ];
  }

  function build(ctx) {
    const { book, info, state, set, props } = ctx;
    const o = book.find(x => x.id === state.opId) || book[0];
    const inf = info.get(o.id);
    const sel = Math.min(state.catIdx, o.categories.length - 1);
    const fb = state.fb[o.id];
    const setFb = v => set({ fb: { ...state.fb, [o.id]: fb === v ? undefined : v } });
    const prev3 = windowSum(o.rev, PREV_Q_IDX);

    return {
      opOpts: [...book].sort((a, b) => a.name.localeCompare(b.name)).map(x => ({ id: x.id, name: x.name })),
      onPickOp: e => set({ opId: e.target.value, catIdx: 0 }),
      backToQueue: () => set({ view: 'queue' }),
      op: {
        id: o.id, name: o.name, place: `${o.type} · ${o.size === 'L' ? 'Large' : o.size === 'M' ? 'Mid-size' : 'Small'} · ${o.city} · ${o.branch} branch · with us ${o.tenure} years`,
        risk: riskPill(o, inf.tier), tierColor: inf.tier.color, tierMeaning: inf.tier.meaning,
        headline: inf.headline, scope: pill(SCOPE[o.scope.key], o.scope.label),
        revAtRisk: F.fmtRev(o.revAtRisk),
        spend3: F.fmtRev(o.rev90), spendChange: `${change(o.revTrend)} vs the 3 months before (${F.fmtRev(prev3)})`, spendColor: trendColor(o.revTrend),
        last: `${o.daysSince} days ago`, lastSub: `usually every ${o.interval} days`,
        lastColor: o.recency.state === 'overdue' ? TIER.high.text : o.recency.state === 'late' ? TIER.medium.text : INK.text,
        team: pill(TEAM[inf.teamKey], inf.team.label), focus: inf.team.focus,
        summary: T.summary(o, inf.tier.key, inf.teamKey), guardrail: T.GUARDRAIL,
        vol: bars(o.rev, inf.tier.color, F.fmtRev),
        volNote: o.seasonal ? 'Jun–Aug is lower every year for schools (summer break) — trends allow for it.' : 'Last 3 months highlighted · number of orders under each month',
        orders: o.orders.map(String),
        weeks: o.weeks.map((n, i) => ({ bg: n ? INK.text : '#EEEBE5', title: n ? `${n} order${n > 1 ? 's' : ''}, ${12 - i} weeks ago` : `no order, ${12 - i} weeks ago` })),
        weeksNote: o.recency.state === 'on-schedule' ? 'Ordering every week as usual.' : `The last ${Math.floor(o.daysSince / 7)} week${Math.floor(o.daysSince / 7) === 1 ? '' : 's'} had no order.`,
      },
      changed: T.whatChanged(o).map(c => ({ ...c, border: c.tone === 'bad' ? TIER.high.color : TIER.low.color })),
      levels: T.levels(o).map((l, i) => ({ ...l, n: String(i + 1), bg: l.hit ? TIER.high.bg : '#F6F4EF', ink: l.hit ? TIER.high.ink : INK.muted, border: l.hit ? TIER.high.color : '#E2DFD8' })),
      drivers: drivers(o),
      catCards: categoryCards(o, sel, set),
      catDetail: categoryDetail(o, o.categories[sel]),
      money: money(o), service: service(o),
      facts: T.facts(o), questions: T.questions(o).map((q, i) => ({ n: String(i + 1), q })),
      showFeedback: props.showFeedback !== false,
      fbLabel: fb === 'up' ? 'Thanks — noted' : fb === 'down' ? 'Thanks — flagged for the analytics team' : 'Was this helpful?',
      fbUp: () => setFb('up'), fbDown: () => setFb('down'),
      fbUpBg: fb === 'up' ? TIER.low.bg : '#FFFFFF', fbDownBg: fb === 'down' ? TIER.high.bg : '#FFFFFF',
      exportOp: () => csv(`${o.id}-products.csv`, [
        ['Operator', 'Category', 'Product', 'Status', 'Spend 12 months', 'Change vs last quarter', 'Last bought', 'Note'],
        ...o.products.map(p => [o.name, p.category, p.name, STATUS_WORD[p.status] || p.status, Math.round(p.rev12), p.status === 'Stopped' ? '' : change(p.trend), p.lastIdx >= 0 ? F.monthYr(p.lastIdx) : '', p.replacedBy ? `Being replaced by ${p.replacedBy}` : p.replaces ? `Replacing ${p.replaces}` : '']),
      ]),
      briefOpen: !!state.brief,
      openBrief: () => set({ brief: true, copied: false }),
      closeBrief: () => set({ brief: false }),
      stop: e => e.stopPropagation(),
      printBrief: () => window.print(),
      copyLabel: state.copied ? 'Copied' : 'Copy as text',
      copyBrief: () => {
        if (!navigator.clipboard) return;
        navigator.clipboard.writeText(T.briefText(o, inf.tier.key, inf.teamKey)).then(() => set({ copied: true }), () => set({ copied: false }));
      },
      briefDate: F.fmtDate(D.SNAPSHOT_AS_OF),
    };
  }

  root.DistViews.operator = { build };
})(typeof globalThis !== 'undefined' ? globalThis : this);
