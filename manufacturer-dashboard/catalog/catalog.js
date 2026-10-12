/**
 * Loads the metric, visual and filter catalog and applies a manufacturer's
 * configuration to it.
 *
 * The one rule this file enforces: an Enhanced metric or filter whose data
 * the manufacturer cannot supply is hidden, not shown empty, and a section
 * left with nothing in it disappears. Backend and frontend both resolve
 * screens through here, so they always agree on what a screen contains.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DIR = __dirname;
const readJson = file => JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));

/** The whole catalog as plain data. A fresh copy each call, so callers can never mutate a shared one. */
function load() {
  const marts = readJson('marts.json');
  const metrics = readJson('metrics.json');
  return {
    levels: metrics.levels,
    capabilities: marts.capabilities,
    marts: marts.marts,
    metrics: metrics.metrics,
    visuals: readJson('visuals.json').visuals,
    filters: readJson('filters.json').filters,
    screens: readJson('screens.json').screens,
  };
}

function loadConfig(file) {
  return readJson(file);
}

/** Is this metric or filter available for a manufacturer with these capabilities and filter flags? */
function isAvailable(item, config) {
  const caps = config.capabilities || {};
  if ((item.requires || []).some(r => caps[r] !== true)) return false;
  if (item.configFlag) {
    const key = item.configFlag.replace(/^filters\./, '');
    return (config.filters || {})[key] === true;
  }
  return true;
}

/**
 * One screen as a given manufacturer will see it: unavailable metrics and
 * filters removed, empty sections dropped. Returns new objects only.
 */
function resolveScreen(screenId, config, catalog = load()) {
  const screen = catalog.screens.find(s => s.id === screenId);
  if (!screen) throw new Error(`Unknown screen: ${screenId}`);
  const metrics = new Map(catalog.metrics.map(m => [m.id, m]));
  const filters = new Map(catalog.filters.map(f => [f.id, f]));
  const keep = id => isAvailable(metrics.get(id), config);
  const keepFilter = id => isAvailable(filters.get(id), config);
  return {
    ...screen,
    headline: screen.headline.filter(keep),
    sections: screen.sections
      .map(s => ({
        ...s,
        metrics: s.metrics.filter(keep),
        ...(s.filters ? { filters: s.filters.filter(keepFilter) } : {}),
        // A hidden column can no longer be a sort column.
        ...(s.table ? { table: { ...s.table, sortable: s.table.sortable.filter(keep) } } : {}),
      }))
      .filter(s => s.metrics.length > 0),
    actions: (screen.actions || []).map(a => ({ ...a, metrics: a.metrics.filter(keep) })),
    filters: screen.filters.filter(keepFilter),
  };
}

module.exports = { load, loadConfig, isAvailable, resolveScreen };
