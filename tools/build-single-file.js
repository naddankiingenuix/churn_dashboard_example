#!/usr/bin/env node
/**
 * Builds one self-contained HTML file per dashboard, for sharing by email or
 * chat: no folders, no server, and no internet needed to open it.
 *
 *   node tools/build-single-file.js
 *   → dist/distributor-dashboard.html
 *   → dist/manufacturer-dashboard.html
 *
 * What it does, per dashboard:
 *   1. Replaces every local <script src="…"> with the script's contents.
 *   2. Inlines React and ReactDOM before the runtime, so the runtime finds
 *      them already loaded and skips its CDN fetch (see loadReactUmd in
 *      shared/support.js). React is downloaded once into tools/.cache and
 *      checked against the same SRI hashes the runtime uses.
 * Only the Google web font stays external; offline, the page falls back to
 * the system font.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const CACHE = path.join(__dirname, '.cache');
const DIST = path.join(ROOT, 'dist');

const DASHBOARDS = [
  { page: 'distributor-dashboard/Distributor Churn Dashboard.dc.html', out: 'distributor-dashboard.html' },
  { page: 'manufacturer-dashboard/Churn Dashboard.dc.html', out: 'manufacturer-dashboard.html' },
];

// Same URLs and hashes as shared/support.js (src/cdn.ts).
const VENDOR = [
  { name: 'react.production.min.js', url: 'https://unpkg.com/react@18.3.1/umd/react.production.min.js', sri: 'sha384-DGyLxAyjq0f9SPpVevD6IgztCFlnMF6oW/XQGmfe+IsZ8TqEiDrcHkMLKI6fiB/Z' },
  { name: 'react-dom.production.min.js', url: 'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js', sri: 'sha384-gTGxhz21lVGYNMcdJOyq01Edg0jhn/c22nsx0kyqP0TxaV5WVdsSH1fSDUf5YJj1' },
];

function download(url, redirects = 3) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        res.resume();
        resolve(download(new URL(res.headers.location, url).href, redirects - 1));
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`GET ${url} → HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

const sri384 = buf => 'sha384-' + crypto.createHash('sha384').update(buf).digest('base64');

/** Cached, integrity-checked vendor script. Refuses to embed anything that does not match. */
async function vendor(v) {
  const file = path.join(CACHE, v.name);
  let buf = fs.existsSync(file) ? fs.readFileSync(file) : null;
  if (!buf || sri384(buf) !== v.sri) {
    console.log(`  downloading ${v.url}`);
    buf = await download(v.url);
    if (sri384(buf) !== v.sri) throw new Error(`Integrity check failed for ${v.url}`);
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(file, buf);
  }
  return buf.toString('utf8');
}

/** A script's text must not close the <script> element it is inlined into. */
/**
 * Inlining puts the runtime's own source into the document, which means any
 * markup sentinel it mentions becomes findable in the page text. Two have to
 * be neutralised:
 *
 *   </script  ends the element early.
 *   <x-dc>    is what parseDcText() scans for, and it takes the FIRST match.
 *             support.js carries the literal "has no <x-dc> block" in an error
 *             message, which sits ahead of the real template — so without this
 *             the runtime slices its own source in as the component's markup
 *             and renders JavaScript onto the page.
 *
 * `\x64` is `d` to both the string parser and the regex engine, so rewriting
 * `x-dc` this way leaves every runtime value and pattern identical while
 * removing the literal text a naive scanner would trip on.
 */
const inlineScript = (code, label) => `<script data-inlined="${label}">\n${
  code.replace(/<\/script/gi, '<\\/script').replace(/x-dc/g, 'x-\\x64c')
}\n</script>`;

function build(entry, react) {
  const pagePath = path.join(ROOT, entry.page);
  const dir = path.dirname(pagePath);
  let html = fs.readFileSync(pagePath, 'utf8');
  const srcTag = /<script src="([^"]+)"><\/script>/g;
  const local = [...html.matchAll(srcTag)].map(m => m[1]);
  if (!local.some(s => s.endsWith('support.js'))) throw new Error(`${entry.page}: no support.js script tag found`);
  html = html.replace(srcTag, (tag, src) => {
    if (/^https?:/i.test(src)) return tag;
    const file = path.resolve(dir, src);
    if (!file.startsWith(ROOT + path.sep)) throw new Error(`${entry.page}: script outside the repo: ${src}`);
    const code = fs.readFileSync(file, 'utf8');
    // React has to be on the page before the runtime boots.
    const prefix = src.endsWith('support.js') ? react.map(r => inlineScript(r.code, r.name)).join('\n') + '\n' : '';
    return prefix + inlineScript(code, path.relative(ROOT, file));
  });
  const left = [...html.matchAll(/<script[^>]+src="(?!https:\/\/fonts)[^"]+"/g)];
  if (left.length) throw new Error(`${entry.page}: script tags left un-inlined: ${left.map(m => m[0]).join(', ')}`);
  const out = path.join(DIST, entry.out);
  fs.mkdirSync(DIST, { recursive: true });
  fs.writeFileSync(out, html);
  return { out, kb: Math.round(Buffer.byteLength(html) / 1024), scripts: local.length };
}

async function main() {
  console.log('Fetching React (cached after the first run)…');
  const react = [];
  for (const v of VENDOR) react.push({ name: v.name, code: await vendor(v) });
  for (const d of DASHBOARDS) {
    const r = build(d, react);
    console.log(`  ${path.relative(ROOT, r.out)}  ${r.kb} KB  (${r.scripts} scripts + React inlined)`);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Build failed:', err.message);
    process.exit(1);
  });
}

module.exports = { inlineScript, sri384, build };
