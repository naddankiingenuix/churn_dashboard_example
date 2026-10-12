/**
 * Turns dist/<name>.html into a page that can be published as an Artifact.
 *
 * Two differences from the single-file build:
 *   1. The document wrapper is stripped. The Artifact host supplies its own
 *      <!doctype>/<html>/<head>/<body>, so the page must be body content only.
 *   2. The Google Fonts <link> is replaced by @font-face rules carrying the
 *      woff2 files as data URIs. A published Artifact runs under a CSP that
 *      blocks every external host, so a linked webfont would fail silently and
 *      drop the page onto system fonts.
 *
 * Usage:  node tools/build-artifact.js <fonts-dir> [manufacturer|distributor]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FACES = [
  ['IBM Plex Sans', 400, 'ibm-plex-sans-latin-400-normal.woff2'],
  ['IBM Plex Sans', 500, 'ibm-plex-sans-latin-500-normal.woff2'],
  ['IBM Plex Sans', 600, 'ibm-plex-sans-latin-600-normal.woff2'],
  ['IBM Plex Sans', 700, 'ibm-plex-sans-latin-700-normal.woff2'],
  ['IBM Plex Mono', 400, 'ibm-plex-mono-latin-400-normal.woff2'],
  ['IBM Plex Mono', 500, 'ibm-plex-mono-latin-500-normal.woff2'],
  ['IBM Plex Mono', 600, 'ibm-plex-mono-latin-600-normal.woff2'],
];

function fontCss(fontsDir) {
  return FACES.map(([family, weight, file]) => {
    const b64 = fs.readFileSync(path.join(fontsDir, file)).toString('base64');
    return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};`
      + `font-display:swap;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
  }).join('\n');
}

function build(name, fontsDir) {
  const src = path.join(ROOT, 'dist', `${name}-dashboard.html`);
  if (!fs.existsSync(src)) throw new Error(`missing ${src} — run tools/build-single-file.js first`);
  let html = fs.readFileSync(src, 'utf8');

  // Drop the links the CSP would block, then the document wrapper.
  const before = html.length;
  html = html.replace(/<link rel="preconnect"[^>]*>\s*/gi, '');
  html = html.replace(/<link[^>]*fonts\.googleapis\.com[^>]*>\s*/gi, '');
  if (html.length === before) throw new Error('expected to strip font links but found none');

  for (const tag of [/<!DOCTYPE html>\s*/i, /<html>\s*/i, /<head>\s*/i, /<\/head>\s*/i,
    /<body>\s*/i, /<\/body>\s*/i, /<\/html>\s*/i]) {
    if (!tag.test(html)) throw new Error(`expected ${tag} in the built page`);
    html = html.replace(tag, '');
  }
  if (/<\/?(html|head|body)[\s>]/i.test(html)) throw new Error('document wrapper still present');

  const out = path.join(ROOT, 'dist', `${name}-artifact.html`);
  fs.writeFileSync(out, `<style>\n${fontCss(fontsDir)}\n</style>\n${html}`);
  const kb = Math.round(fs.statSync(out).size / 1024);
  console.log(`  ${path.relative(ROOT, out)}  ${kb} KB  (wrapper stripped, ${FACES.length} faces inlined)`);
}

const fontsDir = process.argv[2];
if (!fontsDir) throw new Error('usage: node tools/build-artifact.js <fonts-dir> [name]');
build(process.argv[3] || 'manufacturer', fontsDir);
