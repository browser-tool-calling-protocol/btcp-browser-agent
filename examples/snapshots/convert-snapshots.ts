#!/usr/bin/env npx tsx
/**
 * Unified snapshot conversion script
 *
 * Usage:
 *   npx tsx convert-snapshots.ts              # Generate all snapshots
 *   npx tsx convert-snapshots.ts --validate   # Generate and validate
 *   npx tsx convert-snapshots.ts --compare    # Compare interactive vs all modes
 *   npx tsx convert-snapshots.ts --file <name> # Process specific HTML file
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { createSnapshot } from '../../packages/core/src/snapshot.js';
import { createSimpleRefMap } from '../../packages/core/src/ref-map.js';

const SNAPSHOTS_DIR = join(process.cwd(), 'examples', 'snapshots');

interface SnapshotMetadata {
  filename: string;
  htmlFile: string;
  snapshotFile: string;
  generatedAt: string;
  stats: {
    elementCount: number;
    refCount: number;
    outputSize: number;
    generationTime: number;
  };
  url?: string;
  title?: string;
}

interface ValidationCheck {
  name: string;
  passed: boolean;
  message?: string;
}

interface ValidationResult {
  file: string;
  passed: number;
  failed: number;
  checks: ValidationCheck[];
  stats: SnapshotMetadata['stats'];
}

// Parse command line arguments
function parseArgs(): { validate: boolean; compare: boolean; file?: string } {
  const args = process.argv.slice(2);
  return {
    validate: args.includes('--validate'),
    compare: args.includes('--compare'),
    file: args.includes('--file') ? args[args.indexOf('--file') + 1] : undefined,
  };
}

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

// Generate a snapshot from an HTML file
function generateSnapshot(
  htmlPath: string,
  options: { interactive?: boolean; all?: boolean } = {}
): { snapshot: ReturnType<typeof createSnapshot>; duration: number } {
  const html = readFileSync(htmlPath, 'utf-8');
  const dom = createDom(html);
  const { document } = dom.window;
  const refMap = createSimpleRefMap();

  const start = performance.now();
  const snapshot = createSnapshot(document, refMap, {
    interactive: options.interactive ?? true,
    compact: true,
    maxDepth: 10,
    includeHidden: false,
    all: options.all ?? false,
  });
  const duration = performance.now() - start;

  return { snapshot, duration };
}

// Process a single HTML file and save snapshot
function processFile(htmlPath: string): SnapshotMetadata {
  const filename = basename(htmlPath, '.html');
  const htmlFile = basename(htmlPath);
  const snapshotFile = `${filename}.snapshot.txt`;

  console.log(`\n  Processing: ${htmlFile}`);

  const { snapshot, duration } = generateSnapshot(htmlPath);

  const stats = {
    elementCount: snapshot.tree.split('\n').filter(line => line.trim()).length,
    refCount: Object.keys(snapshot.refs).length,
    outputSize: snapshot.tree.length,
    generationTime: Math.round(duration),
  };

  // Save snapshot
  const snapshotPath = join(SNAPSHOTS_DIR, snapshotFile);
  writeFileSync(snapshotPath, snapshot.tree, 'utf-8');

  console.log(`     Generated: ${snapshotFile}`);
  console.log(`     Elements: ${stats.elementCount} | Refs: ${stats.refCount}`);
  console.log(`     Size: ${(stats.outputSize / 1024).toFixed(1)} KB | Time: ${stats.generationTime}ms`);

  const dom = createDom(readFileSync(htmlPath, 'utf-8'));
  return {
    filename,
    htmlFile,
    snapshotFile,
    generatedAt: new Date().toISOString(),
    stats,
    url: dom.window.document.location?.href,
    title: dom.window.document.title,
  };
}

// Validate a snapshot against quality checks
function validateSnapshot(htmlPath: string): ValidationResult {
  const filename = basename(htmlPath);
  const checks: ValidationCheck[] = [];

  let snapshot;
  let duration = 0;

  try {
    const result = generateSnapshot(htmlPath);
    snapshot = result.snapshot;
    duration = result.duration;
  } catch (error) {
    return {
      file: filename,
      passed: 0,
      failed: 1,
      checks: [{ name: 'Generate snapshot', passed: false, message: (error as Error).message }],
      stats: { elementCount: 0, refCount: 0, outputSize: 0, generationTime: 0 },
    };
  }

  const lines = snapshot.tree.split('\n');
  const refs = Object.values(snapshot.refs);

  // Check 1: Page header
  const pageHeader = lines[0];
  checks.push({
    name: 'Page header',
    passed: pageHeader?.startsWith('PAGE:') && pageHeader.includes('|') && pageHeader.includes('viewport='),
  });

  // Check 2: Snapshot header
  const snapshotHeader = lines.find(l => l.startsWith('SNAPSHOT:'));
  checks.push({
    name: 'Snapshot header',
    passed: !!snapshotHeader && snapshotHeader.includes('elements=') && snapshotHeader.includes('depth='),
  });

  // Check 3: Heading levels
  const headings = lines.filter(l => l.includes('HEADING'));
  const correctHeadingFormat = headings.every(h => h.match(/HEADING LEVEL=[1-6]/));
  checks.push({
    name: 'Heading levels',
    passed: headings.length === 0 || correctHeadingFormat,
    message: `${headings.length} headings`,
  });

  // Check 4: Button labels
  const buttons = lines.filter(l => l.includes('BUTTON'));
  const buttonsWithLabels = buttons.filter(b => b.match(/BUTTON "([^"]+)"/));
  checks.push({
    name: 'Button labels',
    passed: buttons.length === 0 || buttonsWithLabels.length / buttons.length > 0.9,
    message: `${buttonsWithLabels.length}/${buttons.length}`,
  });

  // Check 5: Link destinations
  const links = lines.filter(l => l.includes('LINK'));
  const linksWithHref = links.filter(l => l.includes('href='));
  checks.push({
    name: 'Link destinations',
    passed: links.length === 0 || linksWithHref.length > 0,
    message: `${linksWithHref.length}/${links.length}`,
  });

  // Check 6: Refs have bounding boxes
  const refsWithBbox = refs.filter((r: any) => r.bbox);
  checks.push({
    name: 'Bounding boxes',
    passed: refs.length === 0 || refsWithBbox.length > 0,
    message: `${refsWithBbox.length}/${refs.length}`,
  });

  // Check 7: Performance
  checks.push({
    name: 'Performance (<5s)',
    passed: duration < 5000,
    message: `${Math.round(duration)}ms`,
  });

  // Check 8: Output size
  const sizeKB = snapshot.tree.length / 1024;
  checks.push({
    name: 'Size (<50KB)',
    passed: sizeKB < 50,
    message: `${sizeKB.toFixed(1)} KB`,
  });

  const passed = checks.filter(c => c.passed).length;
  const failed = checks.filter(c => !c.passed).length;

  return {
    file: filename,
    passed,
    failed,
    checks,
    stats: {
      elementCount: lines.filter(l => l.trim()).length,
      refCount: refs.length,
      outputSize: Math.round(sizeKB * 1024),
      generationTime: Math.round(duration),
    },
  };
}

// Compare interactive-only vs all-content snapshots
function compareSnapshots(htmlPath: string): void {
  const filename = basename(htmlPath, '.html');
  console.log(`\n  Comparing: ${basename(htmlPath)}`);

  // Generate interactive-only snapshot
  const { snapshot: interactive } = generateSnapshot(htmlPath, { interactive: true, all: false });

  // Generate all-content snapshot
  const { snapshot: all } = generateSnapshot(htmlPath, { interactive: false, all: true });

  // Save outputs
  writeFileSync(join(SNAPSHOTS_DIR, `${filename}-interactive-only.snapshot.txt`), interactive.tree);
  writeFileSync(join(SNAPSHOTS_DIR, `${filename}-all-content.snapshot.txt`), all.tree);

  const interactiveRefs = Object.keys(interactive.refs).length;
  const allRefs = Object.keys(all.refs).length;
  const sizeIncrease = ((all.tree.length / interactive.tree.length - 1) * 100).toFixed(0);

  console.log(`     Interactive: ${interactiveRefs} refs, ${interactive.tree.length} bytes`);
  console.log(`     All content: ${allRefs} refs, ${all.tree.length} bytes`);
  console.log(`     Size increase: ${sizeIncrease}%`);
}

// Get HTML files to process
function getHtmlFiles(specificFile?: string): string[] {
  if (specificFile) {
    const fullPath = specificFile.endsWith('.html')
      ? join(SNAPSHOTS_DIR, specificFile)
      : join(SNAPSHOTS_DIR, `${specificFile}.html`);
    return [fullPath];
  }

  return readdirSync(SNAPSHOTS_DIR)
    .filter(f => f.endsWith('.html'))
    .map(f => join(SNAPSHOTS_DIR, f));
}

// Main entry point
function main() {
  const args = parseArgs();
  const files = getHtmlFiles(args.file);

  console.log('Snapshot Converter');
  console.log('==================');
  console.log(`Directory: ${SNAPSHOTS_DIR}`);
  console.log(`Files: ${files.length}`);

  if (args.compare) {
    // Compare mode
    console.log('\nMode: Compare (interactive vs all)');
    for (const file of files) {
      compareSnapshots(file);
    }
    console.log('\nComparison complete!');
    return;
  }

  if (args.validate) {
    // Validate mode
    console.log('\nMode: Generate + Validate');
    const results: ValidationResult[] = [];

    for (const file of files) {
      const result = validateSnapshot(file);
      results.push(result);
      const status = result.failed === 0 ? 'PASS' : 'FAIL';
      console.log(`\n  ${basename(file)}: ${status} (${result.passed}/${result.passed + result.failed})`);
      result.checks.forEach(c => {
        const icon = c.passed ? '  ' : 'X ';
        console.log(`     ${icon} ${c.name}${c.message ? `: ${c.message}` : ''}`);
      });
    }

    const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
    console.log(`\nValidation complete: ${totalPassed}/${totalPassed + totalFailed} checks passed`);
    return;
  }

  // Default: Generate snapshots
  console.log('\nMode: Generate');
  const metadata: SnapshotMetadata[] = [];

  for (const file of files) {
    try {
      const meta = processFile(file);
      metadata.push(meta);
    } catch (error) {
      console.error(`  Error processing ${basename(file)}:`, error);
    }
  }

  // Save metadata
  writeFileSync(join(SNAPSHOTS_DIR, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf-8');

  // Summary
  console.log('\n==================');
  console.log('Summary');
  console.log('==================');
  console.log(`Files processed: ${metadata.length}`);
  console.log(`Total elements: ${metadata.reduce((sum, m) => sum + m.stats.elementCount, 0)}`);
  console.log(`Total refs: ${metadata.reduce((sum, m) => sum + m.stats.refCount, 0)}`);
  console.log(`Total output: ${(metadata.reduce((sum, m) => sum + m.stats.outputSize, 0) / 1024).toFixed(1)} KB`);
  console.log(`Avg time: ${Math.round(metadata.reduce((sum, m) => sum + m.stats.generationTime, 0) / metadata.length)}ms`);
}

main();
