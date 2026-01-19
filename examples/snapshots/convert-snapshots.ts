#!/usr/bin/env npx tsx
/**
 * Snapshot conversion script
 *
 * Generates snapshots from all HTML files in the snapshots directory.
 *
 * Usage:
 *   npx tsx convert-snapshots.ts
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { createSnapshot } from '../../packages/core/src/snapshot.js';
import { createSimpleRefMap } from '../../packages/core/src/ref-map.js';

// Support running from repo root or snapshots directory
const SNAPSHOTS_DIR = process.cwd().endsWith('snapshots')
  ? process.cwd()
  : join(process.cwd(), 'examples', 'snapshots');

// Create a JSDOM instance from HTML content
function createDom(html: string) {
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('error', () => {});
  virtualConsole.on('warn', () => {});

  return new JSDOM(html, {
    url: 'http://localhost',
    contentType: 'text/html',
    pretendToBeVisual: true,
    virtualConsole,
  });
}

// Process a single HTML file and save snapshot
function processFile(htmlPath: string) {
  const filename = basename(htmlPath, '.html');
  const htmlFile = basename(htmlPath);
  const snapshotFile = `${filename}.snapshot.txt`;

  console.log(`  Processing: ${htmlFile}`);

  const html = readFileSync(htmlPath, 'utf-8');
  const dom = createDom(html);
  const { document } = dom.window;
  const refMap = createSimpleRefMap();

  const start = performance.now();
  const snapshotData = createSnapshot(document, refMap, {
    mode: 'interactive',
    compact: true,
    maxDepth: 50,
    includeHidden: true,
  });
  const duration = performance.now() - start;

  // Get tree string from snapshot data
  const snapshotTree = snapshotData.tree;
  const elementCount = snapshotTree.split('\n').filter(line => line.trim()).length;
  // Extract ref count from @ref: markers in the tree
  const refCount = (snapshotTree.match(/@ref:\d+/g) || []).length;

  // Save snapshot
  writeFileSync(join(SNAPSHOTS_DIR, snapshotFile), snapshotTree, 'utf-8');

  console.log(`    -> ${snapshotFile} (${elementCount} elements, ${refCount} refs, ${Math.round(duration)}ms)`);

  return {
    filename,
    htmlFile,
    snapshotFile,
    generatedAt: new Date().toISOString(),
    stats: { elementCount, refCount, outputSize: snapshotTree.length, generationTime: Math.round(duration) },
  };
}

// Main
function main() {
  const files = readdirSync(SNAPSHOTS_DIR)
    .filter(f => f.endsWith('.html'))
    .map(f => join(SNAPSHOTS_DIR, f));

  console.log(`Converting ${files.length} HTML files...\n`);

  const metadata = [];
  for (const file of files) {
    try {
      metadata.push(processFile(file));
    } catch (error) {
      console.error(`  Error: ${basename(file)} - ${error}`);
    }
  }

  writeFileSync(join(SNAPSHOTS_DIR, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf-8');
  console.log(`\nDone! Generated ${metadata.length} snapshots.`);
}

main();
