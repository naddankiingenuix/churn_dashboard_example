/**
 * Executive Overview — answers, in this order: how big is the problem, what
 * kind of decline is it, who has to act, and which operators come first.
 *
 * build(ctx) → template values. ctx = { book, list, info, state, set }.
 */
(function (root) {
  'use strict';
  const D = root.DistData, F = root.DistFormat, LG = root.DistLogic, RU = root.DistRollups;
  const { TIER, SCOPE, SCOPE_HINT, TEAM, pill, riskPill } = root.DistViews.common;

  const SCOPE_ORDER = ['operator-wide', 'category-specific', 'product-switch', 'trade-down', 'stable'];

  function bookKpis(seg) {
    const B = D.BOOK;
    const segShare = seg === 'All' ? 1 : ['high', 'medium', 'low'].reduce((a, t) => a + B.tiers[t][seg], 0) / B.operators.cur;
    const rs = seg === 'All' ? 1 : B.segRevShare[seg];
    const cur = Math.round(B.operators.cur * segShare / 10) * 10;
    const last = Math.round(B.operators.last * segShare / 10) * 10;
    const rev90 = B.revenue.cur[1] * rs, rev90Last = B.revenue.last[1] * rs;
    const t = B.trend;
    const mx = Math.max(...t.revAtRisk);
    return {
      operators: F.fmtK(cur), operatorsNote: `${F.fmtK(last - cur)} fewer than last month`,
      rev90: F.fmtM(rev90), rev90Note: `${F.pct(rev90 / rev90Last - 1, 1)} vs the same 90 days last year`,
      tiers: ['high', 'medium', 'low'].map(k => {
        const n = seg === 'All' ? B.tiers[k].S + B.tiers[k].M + B.tiers[k].L : B.tiers[k][seg];
        return { label: TIER[k].label, color: TIER[k].color, count: F.fmtK(n), share: Math.round(n / cur * 100) + '%', meaning: TIER[k].meaning };
      }),
      trend: t.months.map((m, i) => ({ m, h: t.revAtRisk[i] / mx * 100 + '%', v: '$' + t.revAtRisk[i].toFixed(1) + 'M', bg: i === t.months.length - 1 ? TIER.high.color : '#E3B5A9' })),
      trendNote: `Up from $${t.revAtRisk[0].toFixed(1)}M in ${t.months[0]} to $${t.revAtRisk[t.revAtRisk.length - 1].toFixed(1)}M in ${t.months[t.months.length - 1]}`,
    };
  }

  function build(ctx) {
    const { list, info, state, set } = ctx;
    const flagged = list.filter(o => info.get(o.id).flagged);
    const atRisk = flagged.reduce((a, o) => a + o.revAtRisk, 0);
    const scopes = SCOPE_ORDER.map(k => {
      const os = flagged.filter(o => o.scope.key === k);
      return { key: k, label: LG.SCOPE[k], hint: SCOPE_HINT[k], count: os.length, revFmt: F.fmtRev(os.reduce((a, o) => a + o.revAtRisk, 0)), bg: SCOPE[k][0], ink: SCOPE[k][1], go: () => set({ view: 'queue', qScope: k, qTeam: 'All', qTier: 'All' }) };
    }).filter(s => s.count);
    const teams = RU.teamRollup(flagged, o => info.get(o.id).teamKey).filter(t => t.count).map(t => ({
      label: t.label, count: t.count, revFmt: F.fmtRev(t.revAtRisk), focus: D.REVIEW_TEAMS[t.key].focus,
      bg: TEAM[t.key][0], ink: TEAM[t.key][1], go: () => set({ view: 'queue', qTeam: t.key, qScope: 'All', qTier: 'All' }),
    }));
    const topScope = [...scopes].sort((a, b) => b.count - a.count)[0];
    const cats = RU.categoryRollup(list).sort((a, b) => b.riskRev - a.riskRev);
    const top = [...flagged].sort((a, b) => b.revAtRisk - a.revAtRisk).slice(0, 5);

    return {
      book: bookKpis(state.seg),
      banner: {
        count: flagged.length, total: list.length, revFmt: F.fmtRev(atRisk),
        scope: topScope ? `${topScope.count} of them are ${topScope.label.toLowerCase()}` : 'none of them share one pattern',
        category: cats[0] ? cats[0].name.toLowerCase() : '—',
        hasFlagged: flagged.length > 0,
      },
      scopeCards: scopes,
      teamCards: teams,
      topList: top.map((o, i) => {
        const inf = info.get(o.id);
        return {
          n: String(i + 1), name: o.name, place: `${o.type} · ${o.city}`, headline: inf.headline,
          risk: riskPill(o, inf.tier), revFmt: F.fmtRev(o.revAtRisk), team: pill(TEAM[inf.teamKey], inf.team.label),
          open: () => set({ view: 'operator', opId: o.id, catIdx: 0 }),
        };
      }),
      catTop: cats.slice(0, 4).map(c => ({
        name: c.name, color: c.color, revFmt: F.fmtRev(c.riskRev),
        note: [c.stopped && `${c.stopped} stopped`, c.declining && `${c.declining} buying less`, c.switches && `${c.switches} switching products`].filter(Boolean).join(' · ') || 'no change',
        go: () => set({ view: 'categories', catName: c.name }),
      })),
      goQueue: () => set({ view: 'queue', qScope: 'All', qTeam: 'All', qTier: 'All' }),
    };
  }

  root.DistViews.overview = { build };
})(typeof globalThis !== 'undefined' ? globalThis : this);
