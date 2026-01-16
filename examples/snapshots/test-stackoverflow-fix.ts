/**
 * Test the fix for empty anchor name tags in stackoverflow snapshot
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { createSnapshot } from '../../packages/core/src/snapshot.js';
import { createSimpleRefMap } from '../../packages/core/src/ref-map.js';

const SNAPSHOTS_DIR = join(process.cwd(), 'examples', 'snapshots');
const TEST_FILE = 'stackoverflow-com.html';

console.log('🧪 Testing fix for empty anchor name tags\n');

// Load HTML
const htmlPath = join(SNAPSHOTS_DIR, TEST_FILE);
const html = readFileSync(htmlPath, 'utf-8');

// Create virtual console
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

// Generate snapshot with fix
console.log('📊 Generating new snapshot...');
const refMap = createSimpleRefMap();
const snapshot = createSnapshot(document, refMap, {
  interactive: true,
  compact: true,
});

// Save output
const outputFile = 'stackoverflow-com-fixed.snapshot.txt';
writeFileSync(join(SNAPSHOTS_DIR, outputFile), snapshot.tree);

console.log(`✅ Snapshot generated`);
console.log(`   Refs captured: ${Object.keys(snapshot.refs).length}`);
console.log(`   Output size: ${snapshot.tree.length} bytes\n`);

// Check for empty links
const emptyLinkPattern = /^LINK @ref:\d+$/gm;
const emptyLinks = snapshot.tree.match(emptyLinkPattern);

if (emptyLinks) {
  console.log(`❌ Found ${emptyLinks.length} empty links (fix didn't work):`);
  emptyLinks.slice(0, 5).forEach(link => console.log(`   ${link}`));
} else {
  console.log(`✅ No empty links found! Fix is working.`);
}

// Compare with original
const originalFile = 'stackoverflow-com.snapshot.txt';
try {
  const original = readFileSync(join(SNAPSHOTS_DIR, originalFile), 'utf-8');
  const originalEmptyLinks = original.match(emptyLinkPattern);

  if (originalEmptyLinks) {
    console.log(`\n📈 Improvement:`);
    console.log(`   Original: ${originalEmptyLinks.length} empty links`);
    console.log(`   Fixed: ${emptyLinks ? emptyLinks.length : 0} empty links`);
    console.log(`   Removed: ${originalEmptyLinks.length - (emptyLinks ? emptyLinks.length : 0)} empty links`);
  }
} catch (err) {
  console.log('\n⚠️  Could not compare with original (file may not exist)');
}

console.log(`\n📝 Output saved to: ${outputFile}`);

// Display first 50 lines of new snapshot
console.log('\n' + '='.repeat(80));
console.log('📄 First 50 lines of fixed snapshot:');
console.log('='.repeat(80));
const lines = snapshot.tree.split('\n');
console.log(lines.slice(0, 50).join('\n'));
