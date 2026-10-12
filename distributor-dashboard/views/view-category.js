/**
 * Category Risk view — which product categories are slipping across the
 * book, which operators are behind it, and which products are replacing
 * which.
 *
 * build(ctx) → template values.
 */
(function (root) {
  'use strict';
  const F = root.DistFormat, RU = root.DistRollups;
  const { INK, TIER, STATUS, STATUS_WORD, riskPill, trendColor, change, H, stacked, spark, onEnter, sortable } = root.DistViews.common;

  /** What happened to one operator in this category, in a few words. */
  function whatHappened(x) {
    if (x.status === 'Stopped') return `Stopped after ${F.monthYr(x.lastIdx)}`;
    if (x.shift) return `Switching to ${x.shift.to}`;
    return `Buying ${F.pctU(Math.abs(x.trend))} less`;
  }

  function insight(r, mix) {
    const gainer = [...mix].sort((a, b) => b.delta - a.delta)[0];
    const loser = [...mix].sort((a, b) => a.delta - b.delta)[0];
    const parts = [];
    if (r.stopped) parts.push(`${r.stopped} operator${r.stopped === 1 ? ' has' : 's have'} stopped buying ${r.name.toLowerCase()}`);
    if (r.declining) parts.push(`${r.declining} ${r.declining === 1 ? 'is' : 'are'} buying less`);
    if (r.switches) parts.push(`${r.switches} ${r.switches === 1 ? 'is' : 'are'} switching products`);
    const first = parts.length ? `${parts.join(', ')}.` : `No operator is cutting back on ${r.name.toLowerCase()}.`;
    const swap = gainer && gainer.delta > 0.03
      ? ` The biggest gain is ${gainer.name} (${F.pct(gainer.delta, 0).replace('%', ' points')} of the category), mostly at the expense of ${loser.name}.`
      : ' The products being bought are about the same as before.';
    return first + swap;
  }

  function build(ctx) {
    const { list, info, state, set } = ctx;
    const rows = RU.categoryRollup(list).sort((a, b) => b.riskRev - a.riskRev);
    if (!rows.length) return { catCardsAll: [], hasCatSel: false, noCats: true };
    const sel = rows.find(r => r.name === state.catName) || rows[0];
    const mix = RU.productMix(list, sel.name);
    const stack = RU.categoryStack(list, sel.name);
    const whoSort = sortable([
      { label: 'Operator', key: 'name', get: h => h.o.name },
      { label: 'What happened in this category', key: 'what', get: h => whatHappened(h.x) },
      { label: 'Spend 12 mo', align: 'right', key: 'spend', get: h => h.x.rev12 },
      { label: 'Overall risk', key: 'risk', get: h => h.o.prob },
    ], state.cSort, next => set({ cSort: next }));
    const affected = whoSort.order([...sel.eroding, ...sel.switching.filter(h => !sel.eroding.includes(h))]
      .sort((a, b) => b.x.rev12 - a.x.rev12));

    return {
      noCats: false, hasCatSel: true,
      catCardsAll: rows.map(r => ({
        name: r.name, color: r.color, revFmt: F.fmtRev(r.riskRev),
        trend: `${change(r.trend)} volume vs last qtr`, trendColor: trendColor(r.trend),
        stopped: r.stopped, declining: r.declining, switches: r.switches, buyers: r.buyers,
        spark: spark(r.qty, r.trend < -0.1 ? TIER.high.color : TIER.low.color),
        border: r.name === sel.name ? INK.text : '#E2DFD8', pick: () => set({ catName: r.name, cSort: null }),
      })),
      catSel: {
        name: sel.name, color: sel.color, insight: insight(sel, mix),
        stack: stacked(stack.map(s => s.map(x => ({ key: x.name, value: x.units, color: F.mfrColor(x.mfr) })))),
        legend: mix.map(m => ({ name: m.name, color: F.mfrColor(m.mfr) })),
        mixHead: [H('Product'), H('Share before (Oct–Mar)', 'right'), H('Share now (Jul–Sep)', 'right'), H('Change', 'right'), H('Our margin', 'right')],
        mixRows: mix.map(m => ({
          name: m.name, color: F.mfrColor(m.mfr), prior: F.pctU(m.priorShare), recent: F.pctU(m.recentShare),
          delta: Math.abs(m.delta) < 0.02 ? 'steady' : `${m.delta > 0 ? '+' : '−'}${Math.round(Math.abs(m.delta) * 100)} points`,
          deltaColor: m.delta > 0.02 ? TIER.low.text : m.delta < -0.02 ? TIER.high.text : INK.muted,
          gm: F.pctU(m.gm, 1),
        })),
        whoHead: whoSort.head,
        who: affected.map(({ o, x }) => ({
          name: o.name, place: `${o.type} · ${o.city}`, what: whatHappened(x),
          status: pill(x), spend: F.fmtRev(x.rev12), risk: riskPill(o, info.get(o.id).tier),
          open: () => set({ view: 'operator', opId: o.id, catIdx: o.categories.findIndex(c => c.name === sel.name) }),
          key: onEnter(() => set({ view: 'operator', opId: o.id, catIdx: o.categories.findIndex(c => c.name === sel.name) })),
        })),
        hasWho: affected.length > 0, noWho: affected.length === 0,
      },
    };
  }

  function pill(x) {
    const k = x.status === 'Stopped' ? 'Stopped' : x.shift ? 'New' : 'Declining';
    return { label: x.shift && x.status !== 'Stopped' ? 'Switching' : STATUS_WORD[k], bg: STATUS[k][0], ink: STATUS[k][1] };
  }

  root.DistViews.category = { build };
})(typeof globalThis !== 'undefined' ? globalThis : this);
