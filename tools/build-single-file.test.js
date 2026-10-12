/**
 * Run with:  node --test   (from this folder)
 */
const test = require('node:test');
const assert = require('node:assert');
const { inlineScript, sri384 } = require('./build-single-file.js');

test('inlined code cannot close its own <script> element early', () => {
  const html = inlineScript('const s = "</script><script>alert(1)</script>";', 'x');
  assert.equal((html.match(/<\/script>/g) || []).length, 1, 'only the wrapper should close the element');
});

test('the integrity hash matches the format browsers use in SRI attributes', () => {
  // sha384 of the empty string, as published in the SRI spec examples.
  assert.equal(sri384(Buffer.from('')), 'sha384-OLBgp1GsljhM2TJ+sbHjaiH9txEUvgdDTAzHv2P24donTt6/529l+9Ua0vFImLlb');
});
