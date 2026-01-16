/**
 * Test the 'all' flag functionality
 * Compares snapshots with and without the 'all' flag
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { createSnapshot } from '../../packages/core/src/snapshot.js';
import { createSimpleRefMap } from '../../packages/core/src/ref-map.js';

const SNAPSHOTS_DIR = join(process.cwd(), 'examples', 'snapshots');
const TEST_FILE = 'test-all-mode.html';

console.log('🧪 Testing "all" flag functionality\n');

// Load HTML
const htmlPath = join(SNAPSHOTS_DIR, TEST_FILE);
const html = readFileSync(htmlPath, 'utf-8');

// Create virtual console that suppresses warnings
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

// Test 1: Default mode (interactive only)
console.log('📊 Test 1: Default mode (interactive: true, all: false)');
const refMap1 = createSimpleRefMap();
const snapshot1 = createSnapshot(document, refMap1, {
  interactive: true,
  compact: true,
  all: false,
});
console.log(`   Refs captured: ${Object.keys(snapshot1.refs).length}`);
console.log(`   Output size: ${snapshot1.tree.length} bytes\n`);

// Save output
writeFileSync(
  join(SNAPSHOTS_DIR, 'test-all-mode-interactive.snapshot.txt'),
  snapshot1.tree
);

// Test 2: All mode enabled
console.log('📊 Test 2: All mode (interactive: false, all: true)');
const refMap2 = createSimpleRefMap();
const snapshot2 = createSnapshot(document, refMap2, {
  interactive: false,
  compact: true,
  all: true,
});
console.log(`   Refs captured: ${Object.keys(snapshot2.refs).length}`);
console.log(`   Output size: ${snapshot2.tree.length} bytes\n`);

// Save output
writeFileSync(
  join(SNAPSHOTS_DIR, 'test-all-mode-all.snapshot.txt'),
  snapshot2.tree
);

// Display comparison
console.log('📈 Comparison:');
console.log(`   Size increase: ${snapshot2.tree.length - snapshot1.tree.length} bytes (${Math.round((snapshot2.tree.length / snapshot1.tree.length - 1) * 100)}%)`);

// Check for expected content in all mode
const hasImages = snapshot2.tree.includes('IMAGE');
const hasHeadings = snapshot2.tree.includes('HEADING_');
const hasText = snapshot2.tree.includes('TEXT');

console.log('\n✅ Content verification:');
console.log(`   Contains images: ${hasImages ? '✓' : '✗'}`);
console.log(`   Contains headings: ${hasHeadings ? '✓' : '✗'}`);
console.log(`   Contains text: ${hasText ? '✓' : '✗'}`);

if (hasImages && hasHeadings && hasText) {
  console.log('\n🎉 All tests passed! The "all" flag is working correctly.');
} else {
  console.log('\n❌ Test failed! Some content types are missing.');
  process.exit(1);
}

console.log('\n📝 Output files:');
console.log('   - test-all-mode-interactive.snapshot.txt (interactive mode)');
console.log('   - test-all-mode-all.snapshot.txt (all mode)');

// Display full snapshots
console.log('\n' + '='.repeat(80));
console.log('📄 FULL SNAPSHOT - Interactive Mode (all: false)');
console.log('='.repeat(80));
console.log(snapshot1.tree);

console.log('\n' + '='.repeat(80));
console.log('📄 FULL SNAPSHOT - All Mode (all: true)');
console.log('='.repeat(80));
console.log(snapshot2.tree);
