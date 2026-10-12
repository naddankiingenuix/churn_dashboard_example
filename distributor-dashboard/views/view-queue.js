/**
 * Operator Risk Queue — every operator that needs a review, biggest revenue
 * at risk first, each with one plain line saying what is happening and who
 * should look at it. Healthy operators are listed separately below.
 *
 * build(ctx) → template values.
 */
(function (root) {
  'use strict';
  const D = root.DistData, F = root.DistFormat, LG = root.DistLogic, T = root.DistNarrative;
  const { INK, TIER, SCOPE, TEAM, pill, riskPill, csv, onEnter, sortable } = root.DistViews.common;

  const chip = (label, active, pick) => ({ label, pick, bg: active ? INK.text : '#FBFAF8', color: active ? '#FFFFFF' : INK.text, border: active ? INK.text : '#D6D2CA' });

  function build(ctx) {
    const { list, info, state, set } = ctx;
    const s = state;
    const flagged = list.filter(o => info.get(o.id).flagged);
    const sorter = sortable([
      { label: '#', align: 'right' },
      { label: 'Operator', key: 'name', get: o => o.name },
      { label: 'What is happening', key: 'pattern', get: o => o.scope.label },
      { label: 'Risk', key: 'risk', get: o => o.prob },
      { label: 'Revenue at risk / qtr', align: 'right', key: 'rev', get: o => o.revAtRisk },
      { label: 'Last order', key: 'last', get: o => o.daysSince },
      { label: 'Who should review', key: 'team', get: o => info.get(o.id).team.label },
    ], s.qSort, next => set({ qSort: next }));
    const shown = sorter.order(flagged
      .filter(o => s.qTier === 'All' || info.get(o.id).tier.key === s.qTier)
      .filter(o => s.qScope === 'All' || o.scope.key === s.qScope)
      .filter(o => s.qTeam === 'All' || info.get(o.id).teamKey === s.qTeam)
      .sort((a, b) => b.revAtRisk - a.revAtRisk));
    const healthy = list.filter(o => !info.get(o.id).flagged).sort((a, b) => a.name.localeCompare(b.name));
    const open = id => () => set({ view: 'operator', opId: id, catIdx: 0 });
    const filtered = s.qTier !== 'All' || s.qScope !== 'All' || s.qTeam !== 'All';

    return {
      qTierChips: [['All', 'All'], ['high', 'High risk'], ['medium', 'Medium risk']].map(([k, l]) => chip(l, s.qTier === k, () => set({ qTier: k }))),
      qScopeChips: [['All', 'Anything'], ...Object.entries(LG.SCOPE)].map(([k, l]) => chip(l, s.qScope === k, () => set({ qScope: k }))),
      qTeamChips: [['All', 'Any team'], ...Object.entries(D.REVIEW_TEAMS).filter(([k]) => k !== 'none').map(([k, t]) => [k, t.label])].map(([k, l]) => chip(l, s.qTeam === k, () => set({ qTeam: k }))),
      qFiltered: filtered, qClear: () => set({ qTier: 'All', qScope: 'All', qTeam: 'All' }),
      qCount: shown.length, qTotal: flagged.length,
      qRev: F.fmtRev(shown.reduce((a, o) => a + o.revAtRisk, 0)),
      qHead: sorter.head,
      qSorted: !!s.qSort, qResetSort: () => set({ qSort: null }),
      qRows: shown.map((o, i) => {
        const inf = info.get(o.id);
        return {
          n: i + 1, name: o.name, place: `${o.type} · ${o.city} · ${o.branch} branch`,
          headline: inf.headline, scope: pill(SCOPE[o.scope.key], o.scope.label),
          risk: riskPill(o, inf.tier), revFmt: F.fmtRev(o.revAtRisk),
          last: `${o.daysSince} days ago`, usual: `usually every ${o.interval}`,
          lastColor: o.recency.state === 'overdue' ? TIER.high.text : o.recency.state === 'late' ? TIER.medium.text : INK.text,
          team: pill(TEAM[inf.teamKey], inf.team.label), focus: inf.team.focus,
          open: open(o.id), key: onEnter(open(o.id)),
        };
      }),
      qEmpty: shown.length === 0,
      healthyCount: healthy.length, showHealthy: !!s.showHealthy,
      toggleHealthy: () => set({ showHealthy: !s.showHealthy }),
      healthyLabel: s.showHealthy ? 'Hide' : 'Show',
      healthyRows: healthy.map(o => ({ name: o.name, place: `${o.type} · ${o.city}`, risk: riskPill(o, info.get(o.id).tier), spend: F.fmtRev(o.rev90), last: `${o.daysSince} days ago`, open: open(o.id), key: onEnter(open(o.id)) })),
      exportQueue: () => csv('operator-risk-queue-sep-2026.csv', [
        ['Rank', 'Operator ID', 'Operator', 'Type', 'City', 'Branch', 'Risk level', 'Risk score', 'Revenue at risk per quarter', 'What is happening', 'Pattern', 'Review team', 'Review focus', 'Days since last order', 'Usual days between orders', 'Summary'],
        ...shown.map((o, i) => {
          const inf = info.get(o.id);
          return [i + 1, o.id, o.name, o.type, o.city, o.branch, inf.tier.label, Math.round(o.prob * 100) + '%', Math.round(o.revAtRisk), inf.headline, o.scope.label, inf.team.label, inf.team.focus, o.daysSince, o.interval, T.summary(o, inf.tier.key, inf.teamKey)];
        }),
      ]),
    };
  }

  root.DistViews.queue = { build };
})(typeof globalThis !== 'undefined' ? globalThis : this);
