/**
 * Compare real-world snapshots with and without 'all' flag
 * Uses actual saved HTML files from the snapshots directory
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { createSnapshot } from '../../packages/core/src/snapshot.js';
import { createSimpleRefMap } from '../../packages/core/src/ref-map.js';

const SNAPSHOTS_DIR = join(process.cwd(), 'examples', 'snapshots');

// Find all HTML files
const htmlFiles = readdirSync(SNAPSHOTS_DIR)
  .filter(f => f.endsWith('.html') && !f.includes('test-all-mode'))
  .slice(0, 2); // Process first 2 files

console.log('🌐 Comparing real-world snapshots\n');

for (const htmlFile of htmlFiles) {
  const htmlPath = join(SNAPSHOTS_DIR, htmlFile);
  const baseName = htmlFile.replace('.html', '');

  console.log('━'.repeat(80));
  console.log(`📄 Processing: ${htmlFile}`);
  console.log('━'.repeat(80));

  // Load HTML
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

  // Generate interactive-only snapshot
  const refMap1 = createSimpleRefMap();
  const snapshot1 = createSnapshot(document, refMap1, {
    interactive: true,
    compact: true,
    all: false,
  });

  // Generate all-content snapshot
  const refMap2 = createSimpleRefMap();
  const snapshot2 = createSnapshot(document, refMap2, {
    interactive: false,
    compact: true,
    all: true,
  });

  // Save outputs
  const interactiveFile = `${baseName}-interactive-only.snapshot.txt`;
  const allFile = `${baseName}-all-content.snapshot.txt`;

  writeFileSync(join(SNAPSHOTS_DIR, interactiveFile), snapshot1.tree);
  writeFileSync(join(SNAPSHOTS_DIR, allFile), snapshot2.tree);

  // Statistics
  const interactiveRefs = Object.keys(snapshot1.refs).length;
  const allRefs = Object.keys(snapshot2.refs).length;
  const sizeIncrease = ((snapshot2.tree.length / snapshot1.tree.length - 1) * 100).toFixed(0);

  console.log(`\n📊 Statistics:`);
  console.log(`   Interactive mode: ${interactiveRefs} refs, ${snapshot1.tree.length} bytes`);
  console.log(`   All mode:         ${allRefs} refs, ${snapshot2.tree.length} bytes`);
  console.log(`   Size increase:    ${sizeIncrease}%`);

  // Content analysis
  const hasImages = snapshot2.tree.includes('IMAGE');
  const hasHeadings = snapshot2.tree.includes('HEADING_');
  const hasText = snapshot2.tree.match(/\nTEXT /g)?.length || 0;

  console.log(`\n📋 Content captured in 'all' mode:`);
  console.log(`   Images:   ${hasImages ? '✓' : '✗'}`);
  console.log(`   Headings: ${hasHeadings ? '✓' : '✗'}`);
  console.log(`   Text blocks: ${hasText} paragraphs`);

  console.log(`\n💾 Saved to:`);
  console.log(`   - ${interactiveFile}`);
  console.log(`   - ${allFile}\n`);
}

console.log('━'.repeat(80));
console.log('✅ Comparison complete!');
console.log('━'.repeat(80));
