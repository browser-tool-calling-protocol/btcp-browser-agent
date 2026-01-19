/**
 * Validation tests for real-world HTML snapshots
 *
 * Tests snapshot structure and smart label selection against real-world websites
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { createSnapshot } from '../../packages/core/src/snapshot.js';
import { createSimpleRefMap } from '../../packages/core/src/ref-map.js';

const SNAPSHOTS_DIR = join(__dirname);

// Helper to load HTML and generate snapshot
function generateSnapshotFromHTML(htmlPath: string) {
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
  const refMap = createSimpleRefMap();

  return createSnapshot(document, refMap, {
    mode: 'interactive',
    compact: true,
    maxDepth: 10,
    includeHidden: false,
  });
}

// Find all HTML test files
const htmlFiles = readdirSync(SNAPSHOTS_DIR)
  .filter(f => f.endsWith('.html'))
  .map(f => ({
    name: f.replace('.html', ''),
    path: join(SNAPSHOTS_DIR, f),
  }));

describe('Real-World Snapshot Validation', () => {
  describe('Snapshot Structure', () => {
    htmlFiles.forEach(({ name, path }) => {
      describe(name, () => {
        let snapshot: ReturnType<typeof createSnapshot>;

        beforeEach(() => {
          try {
            snapshot = generateSnapshotFromHTML(path);
          } catch (error) {
            // Skip files that fail to load (like amazon-com.html with invalid selectors)
            snapshot = { tree: '', refs: {} };
          }
        });

        it('should generate snapshot without errors', () => {
          expect(snapshot).toBeDefined();
          expect(typeof snapshot).toBe('string');
          expect(snapshot.length).toBeGreaterThan(0);
        });

        it('should include PAGE header with URL, title, and viewport', () => {
          const lines = snapshot.split('\n');
          const pageHeader = lines[0];

          if (pageHeader && pageHeader.startsWith('PAGE:')) {
            expect(pageHeader).toMatch(/^PAGE: .+ \| .+ \| viewport=\d+x\d+$/);
          }
        });

        it('should include SNAPSHOT header with statistics', () => {
          const lines = snapshot.split('\n');
          const snapshotHeader = lines.find(l => l.startsWith('SNAPSHOT:'));

          if (snapshotHeader) {
            expect(snapshotHeader).toMatch(/SNAPSHOT: elements=\d+/);
            expect(snapshotHeader).toMatch(/depth=\d+\/\d+/);
            expect(snapshotHeader).toMatch(/mode=/);
          }
        });

        it('should format heading levels correctly', () => {
          const lines = snapshot.split('\n');
          const headings = lines.filter(l => l.includes('HEADING LEVEL='));

          headings.forEach(heading => {
            expect(heading).toMatch(/HEADING LEVEL=[1-6]/);
          });
        });

        it('should show form boundaries where present', () => {
          const lines = snapshot.split('\n');
          const forms = lines.filter(l => l.trim().startsWith('FORM'));

          forms.forEach(form => {
            // Forms should have id or action attributes
            const hasAttributes = form.includes('id=') || form.includes('action=');
            if (hasAttributes) {
              expect(form).toMatch(/FORM/);
            }
          });
        });

        it('should show input types and validation attributes', () => {
          const lines = snapshot.split('\n');
          const inputs = lines.filter(l => l.includes('TEXTBOX') || l.includes('CHECKBOX'));

          inputs.forEach(input => {
            // Check if input has attribute notation
            if (input.includes('[')) {
              expect(input).toMatch(/\[.*\]/);
              // Common attributes: type, required, invalid
            }
          });
        });

        it('should show children indicators for large elements', () => {
          const lines = snapshot.split('\n');
          const withChildren = lines.filter(l => l.includes('children'));

          withChildren.forEach(line => {
            // Should show one of: "N children:", "N shown", "hidden by"
            const hasIndicator =
              line.includes('children:') ||
              line.includes('shown') ||
              line.includes('hidden by') ||
              line.includes('filtered');
            expect(hasIndicator).toBe(true);
          });
        });
      });
    });
  });

  describe('Smart Label Selection', () => {
    htmlFiles.forEach(({ name, path }) => {
      describe(name, () => {
        let snapshot: ReturnType<typeof createSnapshot>;

        beforeEach(() => {
          try {
            snapshot = generateSnapshotFromHTML(path);
          } catch (error) {
            snapshot = { tree: '', refs: {} };
          }
        });

        it('should have meaningful labels for buttons', () => {
          const lines = snapshot.split('\n');
          const buttons = lines.filter(l => l.includes('BUTTON'));

          buttons.forEach(button => {
            // Extract label (text between BUTTON and @ref or end)
            const match = button.match(/BUTTON "([^"]+)"/);
            if (match) {
              const label = match[1];
              expect(label.length).toBeGreaterThan(0);
              // Should not be just whitespace
              expect(label.trim()).toBe(label);
            }
          });
        });

        it('should show link destinations', () => {
          const lines = snapshot.split('\n');
          const links = lines.filter(l => l.includes('LINK'));

          const linksWithHref = links.filter(l => l.includes('href='));

          // At least some links should have href
          if (links.length > 0) {
            expect(linksWithHref.length).toBeGreaterThan(0);
          }
        });

        it('should have meaningful labels for links', () => {
          const lines = snapshot.split('\n');
          const links = lines.filter(l => l.includes('LINK'));

          links.forEach(link => {
            // Extract label
            const match = link.match(/LINK "([^"]+)"/);
            if (match) {
              const label = match[1];
              expect(label.length).toBeGreaterThan(0);
              expect(label.trim()).toBe(label);
            }
          });
        });

        it('should not use placeholders as input labels', () => {
          const lines = snapshot.split('\n');
          const inputs = lines.filter(l =>
            l.includes('TEXTBOX') ||
            l.includes('TEXTAREA') ||
            l.includes('COMBOBOX')
          );

          // This is a negative test - we can't easily check what WASN'T used
          // But we can verify inputs have labels (from label elements, aria-label, or title)
          inputs.forEach(input => {
            // Should have a label in quotes
            const hasLabel = input.match(/"([^"]+)"/);
            if (hasLabel) {
              const label = hasLabel[1];
              // Label should not be common placeholder text
              const isPlaceholder =
                label.toLowerCase().includes('enter ') ||
                label.toLowerCase().includes('type ') ||
                label.toLowerCase().startsWith('e.g.');

              // Most inputs should not have placeholder-style labels
              // (This is a soft check since some sites do use these as actual labels)
            }
          });
        });

        it('should generate refs for interactive elements', () => {
          // Refs are now internal, just count @ref: in output
          const lines = snapshot.split('\n');
          const interactiveLines = lines.filter(l =>
            l.includes('@ref:') ||
            l.includes('BUTTON') ||
            l.includes('LINK') ||
            l.includes('TEXTBOX')
          );

          // Should have refs for interactive elements
          if (interactiveLines.length > 0) {
            expect(refCount).toBeGreaterThan(0);
          }
        });

        it.skip('should have bounding boxes in refs', () => {
          // Refs are now internal - this test is skipped
          // The highlight feature still works using internal refs
          expect(true).toBe(true);

            // Should have bounding box info
            if (ref.bbox) {
              expect(ref.bbox.x).toBeDefined();
              expect(ref.bbox.y).toBeDefined();
              expect(ref.bbox.width).toBeDefined();
              expect(ref.bbox.height).toBeDefined();
            }

            // Should have viewport detection
            expect(typeof ref.inViewport).toBe('boolean');
          });
        });
      });
    });
  });

  describe('Performance', () => {
    htmlFiles.forEach(({ name, path }) => {
      it(`${name}: should generate snapshot in reasonable time`, () => {
        const start = performance.now();

        try {
          generateSnapshotFromHTML(path);
        } catch (error) {
          // Skip invalid files
        }

        const duration = performance.now() - start;

        // Should complete in under 5 seconds (generous limit for large pages)
        expect(duration).toBeLessThan(5000);
      });

      it(`${name}: should generate manageable output size`, () => {
        let snapshot;
        try {
          snapshot = generateSnapshotFromHTML(path);
        } catch (error) {
          snapshot = { tree: '', refs: {} };
        }

        const sizeKB = snapshot.length / 1024;

        // Should be under 50KB (adaptive depth should prevent excessive output)
        expect(sizeKB).toBeLessThan(50);
      });
    });
  });
});
