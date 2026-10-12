#!/usr/bin/env node
/**
 * Renders the catalog as the Markdown tables used in the design doc's
 * "Metric, visual and filter catalog" tab, so the doc is always generated
 * from the JSON and never edited by hand.
 *
 *   node catalog/render-markdown.js            # every section
 *   node catalog/render-markdown.js metrics:op # one section
 */
'use strict';

const C = require('./catalog.js');

const cat = C.load();
const metricById = new Map(cat.metrics.map(m => [m.id, m]));
const screenById = new Map(cat.screens.map(s => [s.id, s]));
const filterById = new Map(cat.filters.map(f => [f.id, f]));
const visualById = new Map(cat.visuals.map(v => [v.id, v]));

const cell = s => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const row = cols => `| ${cols.map(cell).join(' | ')} |`;
const table = (head, rows) => [row(head), row(head.map(() => '---')), ...rows.map(row)].join('\n');
const label = id => (metricById.get(id) || { label: id }).label;
const tier = x => (x.tier === 'core' ? 'Core' : `Enhanced: ${x.requires.join(', ').replace(/_/g, ' ')}`);
const values = v => (Array.isArray(v) ? v.join(', ') : v);

function screensSection() {
  const fl = list => list.map(f => filterById.get(f).label).join(', ');
  return table(['Tab', 'Answers', 'Headline metrics', 'Sections, top to bottom', 'Tab filters'], cat.screens.map(s => [
    s.role === 'analyst' ? `${s.label} (Analyst role only)` : s.label,
    s.question,
    s.headline.length ? s.headline.map(label).join(' · ') : 'None',
    [
      ...s.sections.map(x => (x.filters ? `${x.title} (own filters: ${fl(x.filters)})` : x.title)),
      ...(s.actions || []).map(a => `${a.label} (opens as a printable view)`),
    ].join('; '),
    s.filters.length ? fl(s.filters) : 'None',
  ]));
}

function metricsSection(prefix) {
  const rows = cat.metrics.filter(m => m.id.startsWith(prefix + '_')).map(m => [
    `**${m.label}** \`${m.id}\``,
    m.empty ? `${m.definition} Empty: ${m.empty}` : m.definition,
    tier(m),
    visualById.get(m.visual).name,
    `\`${m.source.mart}\`: ${m.source.columns.join(', ')}`,
  ]);
  return table(['Metric', 'Definition', 'Tier', 'Visual', 'Source'], rows);
}

function filtersSection() {
  return table(['Filter', 'Values', 'Default', 'API param', 'Availability'], cat.filters.map(f => [
    f.notes ? `**${f.label}** — ${f.notes}` : `**${f.label}**`,
    values(f.values),
    values(f.default) || '(empty)',
    `\`${f.param}\``,
    f.configFlag ? `Core, when \`${f.configFlag}\` is on` : tier(f),
  ]));
}

function visualsSection() {
  const usedBy = id => cat.metrics.filter(m => m.visual === id).length;
  return table(['Component', 'Used for', 'Rules', 'Metrics using it'], cat.visuals.map(v => [
    `**${v.name}** \`${v.id}\``, v.use, v.rules.join('; '), usedBy(v.id),
  ]));
}

function martsSection() {
  const serves = id => cat.metrics.filter(m => m.source.mart === id).map(m => m.id);
  return table(['Mart', 'One row per', 'Status', 'Metrics served'], cat.marts.map(m => [
    `\`${m.id}\``, m.grain, m.new ? 'New' : 'Extends existing pipeline', serves(m.id).length,
  ]));
}

const SECTIONS = {
  screens: screensSection,
  'metrics:pf': () => metricsSection('pf'),
  'metrics:op': () => metricsSection('op'),
  'metrics:ln': () => metricsSection('ln'),
  'metrics:pr': () => metricsSection('pr'),
  'metrics:bk': () => metricsSection('bk'),
  'metrics:an': () => metricsSection('an'),
  filters: filtersSection,
  visuals: visualsSection,
  marts: martsSection,
};

if (require.main === module) {
  const wanted = process.argv.slice(2);
  const keys = wanted.length ? wanted : Object.keys(SECTIONS);
  for (const k of keys) {
    if (!SECTIONS[k]) {
      console.error(`Unknown section "${k}". Choose from: ${Object.keys(SECTIONS).join(', ')}`);
      process.exit(1);
    }
    console.log(`<!-- ${k} -->\n${SECTIONS[k]()}\n`);
  }
}

module.exports = { SECTIONS };
