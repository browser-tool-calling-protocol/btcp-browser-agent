#!/usr/bin/env npx tsx
/**
 * Snapshot conversion script for all modes
 *
 * Generates snapshots in all three modes (interactive, outline, content)
 * from HTML files in the snapshots directory.
 *
 * Usage:
 *   npx tsx convert-all-modes.ts
 *   npx tsx convert-all-modes.ts --file npr-org-templates.html
 *   npx tsx convert-all-modes.ts --mode outline
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { createSnapshot } from '../../packages/core/src/snapshot.js';
import { createSimpleRefMap } from '../../packages/core/src/ref-map.js';
import type { SnapshotMode, SnapshotFormat } from '../../packages/core/src/types.js';

// Support running from repo root or snapshots directory
const SNAPSHOTS_DIR = process.cwd().endsWith('snapshots')
  ? process.cwd()
  : join(process.cwd(), 'examples', 'snapshots');

// Parse command line args
const args = process.argv.slice(2);
const fileArg = args.find((_, i) => args[i - 1] === '--file');
const modeArg = args.find((_, i) => args[i - 1] === '--mode') as SnapshotMode | undefined;
const formatArg = args.find((_, i) => args[i - 1] === '--format') as SnapshotFormat | undefined;

// Mode configurations
interface ModeConfig {
  mode: SnapshotMode;
  format: SnapshotFormat;
  suffix: string;
  description: string;
}

const MODES: ModeConfig[] = [
  { mode: 'interactive', format: 'tree', suffix: 'interactive', description: 'Interactive elements with refs' },
  { mode: 'outline', format: 'tree', suffix: 'outline', description: 'Page structure with xpaths' },
  { mode: 'content', format: 'tree', suffix: 'content', description: 'Text content extraction (tree)' },
  { mode: 'content', format: 'markdown', suffix: 'content-markdown', description: 'Text content extraction (markdown)' },
];

// Create a JSDOM instance from HTML content
function createDom(html: string, url?: string) {
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('error', () => {});
  virtualConsole.on('warn', () => {});

  return new JSDOM(html, {
    url: url || 'http://localhost',
    contentType: 'text/html',
    pretendToBeVisual: true,
    virtualConsole,
  });
}

// Process a single HTML file for a specific mode
function processFileMode(htmlPath: string, modeConfig: ModeConfig) {
  const filename = basename(htmlPath, '.html');
  const outputFile = `${filename}.${modeConfig.suffix}.txt`;

  const html = readFileSync(htmlPath, 'utf-8');
  const dom = createDom(html);
  const { document } = dom.window;
  const refMap = createSimpleRefMap();

  const start = performance.now();
  const snapshotData = createSnapshot(document, refMap, {
    mode: modeConfig.mode,
    format: modeConfig.format,
    maxDepth: 50,
    includeHidden: false,
    includeLinks: true,
    includeImages: true,
  });
  const duration = performance.now() - start;

  // Get output (tree string from SnapshotData)
  const output = snapshotData.tree;

  // Save snapshot
  writeFileSync(join(SNAPSHOTS_DIR, outputFile), output, 'utf-8');

  return {
    filename,
    outputFile,
    mode: modeConfig.mode,
    format: modeConfig.format,
    stats: {
      outputSize: output.length,
      lineCount: output.split('\n').length,
      refCount: (output.match(/@ref:\d+/g) || []).length,
      wordCount: countWords(output),
      generationTime: Math.round(duration),
    },
  };
}

// Count words in output
function countWords(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

// Format bytes for display
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

// Process a single HTML file for all modes
function processFile(htmlPath: string, modesToRun: ModeConfig[]) {
  const filename = basename(htmlPath, '.html');
  console.log(`\n  Processing: ${filename}.html`);

  const results = [];
  for (const modeConfig of modesToRun) {
    try {
      const result = processFileMode(htmlPath, modeConfig);
      results.push(result);
      console.log(
        `    -> ${result.outputFile} ` +
        `(${formatSize(result.stats.outputSize)}, ${result.stats.lineCount} lines, ${result.stats.generationTime}ms)`
      );
    } catch (error) {
      console.error(`    Error [${modeConfig.suffix}]: ${error}`);
    }
  }

  return results;
}

// Main
function main() {
  // Determine which modes to run
  let modesToRun = MODES;
  if (modeArg) {
    modesToRun = MODES.filter(m => m.mode === modeArg);
    if (formatArg) {
      modesToRun = modesToRun.filter(m => m.format === formatArg);
    }
  }

  // Determine which files to process
  let files: string[];
  if (fileArg) {
    files = [join(SNAPSHOTS_DIR, fileArg)];
  } else {
    files = readdirSync(SNAPSHOTS_DIR)
      .filter(f => f.endsWith('.html'))
      .map(f => join(SNAPSHOTS_DIR, f));
  }

  console.log(`Converting ${files.length} HTML file(s) in ${modesToRun.length} mode(s)...`);
  console.log(`Modes: ${modesToRun.map(m => m.suffix).join(', ')}`);

  const allResults: any[] = [];

  for (const file of files) {
    try {
      const results = processFile(file, modesToRun);
      allResults.push(...results);
    } catch (error) {
      console.error(`  Error: ${basename(file)} - ${error}`);
    }
  }

  // Save metadata
  const metadataFile = 'metadata-all-modes.json';
  const metadata = {
    generatedAt: new Date().toISOString(),
    modes: modesToRun.map(m => ({ mode: m.mode, format: m.format, suffix: m.suffix })),
    files: allResults,
  };
  writeFileSync(join(SNAPSHOTS_DIR, metadataFile), JSON.stringify(metadata, null, 2), 'utf-8');

  // Print summary
  console.log('\n--- Summary ---');
  console.log(`Total files generated: ${allResults.length}`);

  // Group by mode
  const byMode = new Map<string, typeof allResults>();
  for (const result of allResults) {
    const key = `${result.mode}/${result.format}`;
    if (!byMode.has(key)) byMode.set(key, []);
    byMode.get(key)!.push(result);
  }

  for (const [mode, results] of byMode) {
    const totalSize = results.reduce((sum, r) => sum + r.stats.outputSize, 0);
    const avgTime = results.reduce((sum, r) => sum + r.stats.generationTime, 0) / results.length;
    console.log(`  ${mode}: ${results.length} files, ${formatSize(totalSize)} total, ${Math.round(avgTime)}ms avg`);
  }

  console.log(`\nMetadata saved to ${metadataFile}`);
}

main();
