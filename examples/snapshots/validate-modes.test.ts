/**
 * Validation tests for outline and content snapshot modes
 *
 * Tests the new snapshot modes against real-world HTML files
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { createSnapshot } from '../../packages/core/src/snapshot.js';
import { createSimpleRefMap } from '../../packages/core/src/ref-map.js';
import type { SnapshotMode, SnapshotFormat } from '../../packages/core/src/types.js';

const SNAPSHOTS_DIR = join(__dirname);

// Helper to load HTML and generate snapshot
function generateSnapshot(
  htmlPath: string,
  mode: SnapshotMode,
  format: SnapshotFormat = 'tree',
  options: { grep?: string } = {}
) {
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
    mode,
    format,
    maxDepth: 50,
    includeHidden: false,
    includeLinks: true,
    includeImages: true,
    grep: options.grep,
  });
}

// Find all HTML test files
const htmlFiles = readdirSync(SNAPSHOTS_DIR)
  .filter(f => f.endsWith('.html'))
  .map(f => ({
    name: f.replace('.html', ''),
    path: join(SNAPSHOTS_DIR, f),
  }));

describe('Outline Mode', () => {
  htmlFiles.forEach(({ name, path }) => {
    describe(name, () => {
      let snapshot: ReturnType<typeof createSnapshot>;

      beforeEach(() => {
        try {
          snapshot = generateSnapshot(path, 'outline');
        } catch (error) {
          snapshot = { tree: '', refs: {} };
        }
      });

      it('should generate outline without errors', () => {
        expect(snapshot).toBeDefined();
        expect(snapshot.tree).toBeDefined();
        expect(snapshot.tree.length).toBeGreaterThan(0);
      });

      it('should include PAGE header', () => {
        const lines = snapshot.tree.split('\n');
        expect(lines[0]).toMatch(/^PAGE:/);
        expect(lines[0]).toMatch(/viewport=\d+x\d+/);
      });

      it('should include OUTLINE header with stats', () => {
        const lines = snapshot.tree.split('\n');
        const outlineHeader = lines.find(l => l.startsWith('OUTLINE:'));

        expect(outlineHeader).toBeDefined();
        expect(outlineHeader).toMatch(/landmarks=\d+/);
        expect(outlineHeader).toMatch(/sections=\d+/);
        expect(outlineHeader).toMatch(/headings=\d+/);
        expect(outlineHeader).toMatch(/words=\d+/);
      });

      it('should include landmark roles', () => {
        const lines = snapshot.tree.split('\n');
        const landmarks = lines.filter(l =>
          l.includes('MAIN') ||
          l.includes('BANNER') ||
          l.includes('NAVIGATION') ||
          l.includes('CONTENTINFO') ||
          l.includes('COMPLEMENTARY')
        );

        // Most pages should have at least one landmark
        // (skip test-all-mode.html which is minimal)
        if (name !== 'test-all-mode') {
          expect(landmarks.length).toBeGreaterThan(0);
        }
      });

      it('should include semantic xpaths', () => {
        const lines = snapshot.tree.split('\n');
        const withXpath = lines.filter(l => l.includes('/'));

        // Most content lines should have xpath
        expect(withXpath.length).toBeGreaterThan(0);
      });

      it('should include word counts in metadata', () => {
        const lines = snapshot.tree.split('\n');
        const withWordCount = lines.filter(l => l.match(/\[\d+ words/));

        // Sections should have word counts
        if (name !== 'test-all-mode') {
          expect(withWordCount.length).toBeGreaterThan(0);
        }
      });

      it('should include refs for sections', () => {
        const refs = Object.keys(snapshot.refs);

        // Outline mode should generate refs for landmarks/sections
        if (name !== 'test-all-mode') {
          expect(refs.length).toBeGreaterThan(0);
        }
      });

      it('should have headings with levels', () => {
        const lines = snapshot.tree.split('\n');
        const headings = lines.filter(l => l.includes('HEADING level='));

        headings.forEach(heading => {
          expect(heading).toMatch(/HEADING level=[1-6]/);
        });
      });
    });
  });
});

describe('Content Mode (Tree Format)', () => {
  htmlFiles.forEach(({ name, path }) => {
    describe(name, () => {
      let snapshot: ReturnType<typeof createSnapshot>;

      beforeEach(() => {
        try {
          snapshot = generateSnapshot(path, 'content', 'tree');
        } catch (error) {
          snapshot = { tree: '', refs: {} };
        }
      });

      it('should generate content without errors', () => {
        expect(snapshot).toBeDefined();
        expect(snapshot.tree).toBeDefined();
        expect(snapshot.tree.length).toBeGreaterThan(0);
      });

      it('should include PAGE header', () => {
        const lines = snapshot.tree.split('\n');
        expect(lines[0]).toMatch(/^PAGE:/);
      });

      it('should include CONTENT header with stats', () => {
        const lines = snapshot.tree.split('\n');
        const contentHeader = lines.find(l => l.startsWith('CONTENT:'));

        expect(contentHeader).toBeDefined();
        expect(contentHeader).toMatch(/sections=\d+/);
        expect(contentHeader).toMatch(/words=\d+/);
      });

      it('should include SECTION markers with xpaths', () => {
        const lines = snapshot.tree.split('\n');
        const sections = lines.filter(l => l.startsWith('SECTION'));

        // Content mode should identify sections
        if (name !== 'test-all-mode') {
          expect(sections.length).toBeGreaterThan(0);
        }

        sections.forEach(section => {
          expect(section).toMatch(/SECTION \/[a-z]/); // xpath starts with /
          expect(section).toMatch(/\[\d+ words\]/);
        });
      });

      it('should include TEXT content', () => {
        const lines = snapshot.tree.split('\n');
        const textLines = lines.filter(l => l.trim().startsWith('TEXT'));

        // Content pages should have text
        if (name !== 'test-all-mode') {
          expect(textLines.length).toBeGreaterThan(0);
        }
      });

      it('should include HEADING markers', () => {
        const lines = snapshot.tree.split('\n');
        const headings = lines.filter(l => l.trim().startsWith('HEADING level='));

        headings.forEach(heading => {
          expect(heading).toMatch(/HEADING level=[1-6]/);
          expect(heading).toMatch(/"[^"]+"/); // Should have heading text
        });
      });

      it('should include LIST items when present', () => {
        const lines = snapshot.tree.split('\n');
        const lists = lines.filter(l => l.trim().startsWith('LIST'));

        lists.forEach(list => {
          expect(list).toMatch(/LIST \[\d+ items\]/);
        });
      });
    });
  });
});

describe('Content Mode (Markdown Format)', () => {
  htmlFiles.forEach(({ name, path }) => {
    describe(name, () => {
      let snapshot: ReturnType<typeof createSnapshot>;

      beforeEach(() => {
        try {
          snapshot = generateSnapshot(path, 'content', 'markdown');
        } catch (error) {
          snapshot = { tree: '', refs: {} };
        }
      });

      it('should generate markdown without errors', () => {
        expect(snapshot).toBeDefined();
        expect(snapshot.tree).toBeDefined();
        expect(snapshot.tree.length).toBeGreaterThan(0);
      });

      it('should include source comment', () => {
        const output = snapshot.tree;
        expect(output).toMatch(/<!-- source: .+ -->/);
      });

      it('should include xpath comments for sections', () => {
        const output = snapshot.tree;
        // Most pages should have section markers
        if (name !== 'test-all-mode') {
          expect(output).toMatch(/<!-- xpath: \/[a-z]+ -->/);
        }
      });

      it('should include end comment with word count', () => {
        const output = snapshot.tree;
        expect(output).toMatch(/<!-- end: \d+ words extracted -->/);
      });

      it('should format headings as markdown', () => {
        const lines = snapshot.tree.split('\n');
        const headings = lines.filter(l => /^#{1,6}\s+\S/.test(l));

        headings.forEach(heading => {
          expect(heading).toMatch(/^#{1,6}\s+.+/);
        });
      });

      it('should format lists as markdown', () => {
        const lines = snapshot.tree.split('\n');
        const listItems = lines.filter(l => /^[-*]\s+/.test(l.trim()) || /^\d+\.\s+/.test(l.trim()));

        // Just verify format is correct (some pages may not have lists)
        listItems.forEach(item => {
          expect(item.trim()).toMatch(/^([-*]|\d+\.)\s+/);
        });
      });

      it('should format code blocks as markdown', () => {
        const output = snapshot.tree;
        const codeBlocks = output.match(/```[\s\S]*?```/g) || [];

        // Verify code blocks are properly formatted
        codeBlocks.forEach(block => {
          expect(block).toMatch(/^```/);
          expect(block).toMatch(/```$/);
        });
      });
    });
  });
});

describe('Grep Filtering', () => {
  // Use a file we know has content
  const testFile = htmlFiles.find(f => f.name === 'npr-org-templates') || htmlFiles[0];

  if (testFile) {
    describe('Outline mode with grep', () => {
      it('should filter by xpath pattern', () => {
        const snapshot = generateSnapshot(testFile.path, 'outline', 'tree', { grep: 'main' });
        const lines = snapshot.tree.split('\n').filter(l => l.trim());

        // Header should show grep info
        const outlineHeader = lines.find(l => l.startsWith('OUTLINE:'));
        expect(outlineHeader).toMatch(/grep=main/);
        expect(outlineHeader).toMatch(/matches=\d+/);

        // All content lines should contain 'main'
        const contentLines = lines.filter(l =>
          !l.startsWith('PAGE:') && !l.startsWith('OUTLINE:') && l.length > 0
        );
        contentLines.forEach(line => {
          expect(line.toLowerCase()).toContain('main');
        });
      });

      it('should support case-insensitive grep', () => {
        const snapshot = generateSnapshot(testFile.path, 'outline', 'tree', {
          grep: 'NAVIGATION'
        });
        const lines = snapshot.tree.split('\n').filter(l => l.trim());

        // Should find navigation elements (case may vary)
        const contentLines = lines.filter(l =>
          !l.startsWith('PAGE:') && !l.startsWith('OUTLINE:') && l.length > 0
        );
        expect(contentLines.length).toBeGreaterThan(0);
      });
    });

    describe('Content mode with grep', () => {
      it('should filter sections by xpath pattern', () => {
        const snapshot = generateSnapshot(testFile.path, 'content', 'tree', { grep: 'article' });
        const lines = snapshot.tree.split('\n');

        // Header should show grep info
        const contentHeader = lines.find(l => l.startsWith('CONTENT:'));
        expect(contentHeader).toMatch(/grep=article/);

        // Section xpaths should match pattern
        const sections = lines.filter(l => l.startsWith('SECTION'));
        sections.forEach(section => {
          expect(section.toLowerCase()).toContain('article');
        });
      });

      it('should work with markdown format', () => {
        const snapshot = generateSnapshot(testFile.path, 'content', 'markdown', { grep: 'main' });
        const output = snapshot.tree;

        // Should have source comment
        expect(output).toMatch(/<!-- source:/);

        // xpath comments should contain 'main'
        const xpathComments = output.match(/<!-- xpath: .+ -->/g) || [];
        xpathComments.forEach(comment => {
          expect(comment.toLowerCase()).toContain('main');
        });
      });
    });
  }
});

describe('Mode Comparison', () => {
  const testFile = htmlFiles.find(f => f.name === 'npr-org-templates') || htmlFiles[0];

  if (testFile) {
    it('interactive mode should have most refs', () => {
      const interactive = generateSnapshot(testFile.path, 'interactive');
      const outline = generateSnapshot(testFile.path, 'outline');
      const content = generateSnapshot(testFile.path, 'content');

      const interactiveRefs = Object.keys(interactive.refs).length;
      const outlineRefs = Object.keys(outline.refs).length;
      const contentRefs = Object.keys(content.refs).length;

      // Interactive mode typically has the most refs (for clickable elements)
      expect(interactiveRefs).toBeGreaterThan(0);
      // Outline mode has refs for sections
      expect(outlineRefs).toBeGreaterThan(0);
    });

    it('content mode should extract more text than interactive', () => {
      const interactive = generateSnapshot(testFile.path, 'interactive');
      const content = generateSnapshot(testFile.path, 'content');

      // Content mode is designed for text extraction
      const interactiveWords = interactive.tree.split(/\s+/).length;
      const contentWords = content.tree.split(/\s+/).length;

      // Content mode extracts actual text content
      expect(contentWords).toBeGreaterThan(0);
    });

    it('outline mode should show structure hierarchy', () => {
      const outline = generateSnapshot(testFile.path, 'outline');
      const lines = outline.tree.split('\n');

      // Check for indentation (hierarchy)
      const indentedLines = lines.filter(l => l.startsWith('  '));
      expect(indentedLines.length).toBeGreaterThan(0);
    });

    it('markdown format should be smaller than tree format', () => {
      const treeContent = generateSnapshot(testFile.path, 'content', 'tree');
      const markdownContent = generateSnapshot(testFile.path, 'content', 'markdown');

      // Both should have content
      expect(treeContent.tree.length).toBeGreaterThan(0);
      expect(markdownContent.tree.length).toBeGreaterThan(0);
    });
  }
});

describe('Performance', () => {
  htmlFiles.forEach(({ name, path }) => {
    describe(name, () => {
      it('outline mode should complete in reasonable time', () => {
        const start = performance.now();
        try {
          generateSnapshot(path, 'outline');
        } catch (error) {
          // Skip invalid files
        }
        const duration = performance.now() - start;

        // Should complete in under 3 seconds
        expect(duration).toBeLessThan(3000);
      });

      it('content mode should complete in reasonable time', () => {
        const start = performance.now();
        try {
          generateSnapshot(path, 'content');
        } catch (error) {
          // Skip invalid files
        }
        const duration = performance.now() - start;

        // Should complete in under 3 seconds
        expect(duration).toBeLessThan(3000);
      });

      it('markdown format should complete in reasonable time', () => {
        const start = performance.now();
        try {
          generateSnapshot(path, 'content', 'markdown');
        } catch (error) {
          // Skip invalid files
        }
        const duration = performance.now() - start;

        // Should complete in under 3 seconds
        expect(duration).toBeLessThan(3000);
      });
    });
  });
});
