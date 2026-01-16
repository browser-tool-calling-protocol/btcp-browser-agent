/**
 * Test removal of non-value indicators from snapshots
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { createSnapshot } from '../../packages/core/src/snapshot.js';
import { createSimpleRefMap } from '../../packages/core/src/ref-map.js';

const SNAPSHOTS_DIR = join(process.cwd(), 'examples', 'snapshots');

console.log('🧪 Testing removal of non-value indicators\n');

// Test with stackoverflow (had many indicators)
const testFile = 'stackoverflow-com.html';
const htmlPath = join(SNAPSHOTS_DIR, testFile);
const html = readFileSync(htmlPath, 'utf-8');

const virtualConsole = new VirtualConsole();
virtualConsole.on('error', () => {});
virtualConsole.on('warn', () => {});

const dom = new JSDOM(html, {
  url: 'http://localhost',
  contentType: 'text/html',
  pretendToBeVisual: true,
  virtualConsole,
});

const { document } = dom.window;

// Generate snapshot without indicators
console.log('📊 Generating snapshot without indicators...');
const refMap = createSimpleRefMap();
const snapshot = createSnapshot(document, refMap, {
  interactive: true,
  compact: true,
});

// Save output
const outputFile = 'stackoverflow-com-no-indicators.snapshot.txt';
writeFileSync(join(SNAPSHOTS_DIR, outputFile), snapshot.tree);

console.log(`✅ Snapshot generated`);
console.log(`   Refs captured: ${Object.keys(snapshot.refs).length}`);
console.log(`   Output size: ${snapshot.tree.length} bytes\n`);

// Count removed indicators
const filteredPattern = /\(\d+ non-interactive children filtered\)/g;
const depthPattern = /\(\d+ children: \d+ shown, \d+ hidden by depth limit\)/g;
const skippedPattern = /\(\d+ empty containers skipped\)/g;
const contextPattern = /→ context:/g;

const hasFiltered = snapshot.tree.match(filteredPattern);
const hasDepth = snapshot.tree.match(depthPattern);
const hasSkipped = snapshot.tree.match(skippedPattern);
const hasContext = snapshot.tree.match(contextPattern);

console.log('📋 Indicator check:');
console.log(`   "filtered" indicators: ${hasFiltered ? hasFiltered.length : 0} ${hasFiltered ? '❌ SHOULD BE 0' : '✅'}`);
console.log(`   "depth limit" indicators: ${hasDepth ? hasDepth.length : 0} ${hasDepth ? '❌ SHOULD BE 0' : '✅'}`);
console.log(`   "skipped" indicators: ${hasSkipped ? hasSkipped.length : 0} ${hasSkipped ? '❌ SHOULD BE 0' : '✅'}`);
console.log(`   "context" indicators: ${hasContext ? hasContext.length : 0} ${hasContext ? '✅ KEPT' : '⚠️  NONE FOUND'}`);

// Compare with original
try {
  const original = readFileSync(join(SNAPSHOTS_DIR, 'stackoverflow-com.snapshot.txt'), 'utf-8');
  const originalFiltered = original.match(filteredPattern) || [];
  const originalDepth = original.match(depthPattern) || [];
  const originalSkipped = original.match(skippedPattern) || [];
  const totalOriginal = originalFiltered.length + originalDepth.length + originalSkipped.length;

  console.log(`\n📈 Comparison with original:`);
  console.log(`   Original indicators: ${totalOriginal}`);
  console.log(`   New indicators: 0`);
  console.log(`   Removed: ${totalOriginal} indicators`);
  console.log(`   Size reduction: ${original.length - snapshot.tree.length} bytes (${Math.round((1 - snapshot.tree.length / original.length) * 100)}%)`);
} catch (err) {
  console.log('\n⚠️  Could not compare with original');
}

console.log(`\n📝 Output saved to: ${outputFile}`);

// Display sample output
console.log('\n' + '='.repeat(80));
console.log('📄 Sample output (lines 10-30):');
console.log('='.repeat(80));
const lines = snapshot.tree.split('\n');
console.log(lines.slice(10, 30).join('\n'));

if (!hasFiltered && !hasDepth && !hasSkipped) {
  console.log('\n\n🎉 Success! All non-value indicators removed.');
  console.log('Link context indicators preserved:', hasContext ? '✅' : '(none in this file)');
} else {
  console.log('\n\n❌ Failed - some indicators still present');
  process.exit(1);
}
