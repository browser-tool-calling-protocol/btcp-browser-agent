/**
 * Tests for snapshot.ts - DOM accessibility snapshot generation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getEnhancedSnapshot,
  parseRef,
  getSnapshotStats,
  findElementByRef,
} from './snapshot.js';

describe('snapshot', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('getEnhancedSnapshot', () => {
    it('should generate snapshot for simple button', () => {
      document.body.innerHTML = '<button>Click me</button>';

      const { tree, refs } = getEnhancedSnapshot(document);

      expect(tree).toContain('button');
      expect(tree).toContain('Click me');
      expect(tree).toContain('[ref=e1]');
      expect(refs.e1).toBeDefined();
      expect(refs.e1.role).toBe('button');
      expect(refs.e1.name).toBe('Click me');
    });

    it('should generate refs for interactive elements', () => {
      document.body.innerHTML = `
        <button>Submit</button>
        <a href="/home">Home</a>
        <input type="text" placeholder="Name">
        <input type="checkbox" aria-label="Accept terms">
      `;

      const { refs } = getEnhancedSnapshot(document);

      // Should have refs for all interactive elements
      const refValues = Object.values(refs);
      expect(refValues.some((r) => r.role === 'button')).toBe(true);
      expect(refValues.some((r) => r.role === 'link')).toBe(true);
      expect(refValues.some((r) => r.role === 'textbox')).toBe(true);
      expect(refValues.some((r) => r.role === 'checkbox')).toBe(true);
    });

    it('should generate refs for headings with names', () => {
      document.body.innerHTML = `
        <h1>Main Title</h1>
        <h2>Section Header</h2>
      `;

      const { tree, refs } = getEnhancedSnapshot(document);

      expect(tree).toContain('heading');
      expect(tree).toContain('Main Title');
      expect(tree).toContain('[level=1]');
      expect(tree).toContain('[level=2]');

      const refValues = Object.values(refs);
      expect(refValues.filter((r) => r.role === 'heading')).toHaveLength(2);
    });

    it('should use aria-label for accessible name', () => {
      document.body.innerHTML = '<button aria-label="Close dialog">X</button>';

      const { refs } = getEnhancedSnapshot(document);

      expect(refs.e1.name).toBe('Close dialog');
    });

    it('should use aria-labelledby for accessible name', () => {
      document.body.innerHTML = `
        <span id="label">Custom Label</span>
        <button aria-labelledby="label">X</button>
      `;

      const { refs } = getEnhancedSnapshot(document);

      const buttonRef = Object.values(refs).find((r) => r.role === 'button');
      expect(buttonRef?.name).toBe('Custom Label');
    });

    it('should handle explicit roles', () => {
      document.body.innerHTML = '<div role="button">Custom Button</div>';

      const { tree, refs } = getEnhancedSnapshot(document);

      expect(tree).toContain('button');
      expect(tree).toContain('Custom Button');
      expect(refs.e1.role).toBe('button');
    });

    it('should support interactive-only mode', () => {
      document.body.innerHTML = `
        <h1>Title</h1>
        <p>Some text</p>
        <button>Click</button>
      `;

      const { tree } = getEnhancedSnapshot(document, { interactive: true });

      expect(tree).toContain('button');
      // In interactive-only mode, non-interactive elements like headings are skipped
      expect(tree).not.toContain('heading');
    });

    it('should respect maxDepth option', () => {
      document.body.innerHTML = `
        <div>
          <div>
            <div>
              <button>Deep Button</button>
            </div>
          </div>
        </div>
      `;

      const { tree: shallowTree } = getEnhancedSnapshot(document, { maxDepth: 1 });
      const { tree: deepTree } = getEnhancedSnapshot(document, { maxDepth: 10 });

      // Deep tree should have the button
      expect(deepTree).toContain('button');
    });

    it('should support selector option', () => {
      document.body.innerHTML = `
        <div id="section1">
          <button>Button 1</button>
        </div>
        <div id="section2">
          <button>Button 2</button>
        </div>
      `;

      const { tree } = getEnhancedSnapshot(document, { selector: '#section1' });

      expect(tree).toContain('Button 1');
      expect(tree).not.toContain('Button 2');
    });

    it('should handle empty page', () => {
      document.body.innerHTML = '';

      const { tree } = getEnhancedSnapshot(document);

      expect(tree).toBe('Empty page');
    });

    it('should skip hidden elements', () => {
      document.body.innerHTML = `
        <button>Visible</button>
        <button style="display: none">Hidden</button>
      `;

      const { tree } = getEnhancedSnapshot(document);

      expect(tree).toContain('Visible');
      expect(tree).not.toContain('Hidden');
    });

    it('should show checkbox state', () => {
      document.body.innerHTML = `
        <input type="checkbox" aria-label="Option 1" checked>
        <input type="checkbox" aria-label="Option 2">
      `;

      const { tree } = getEnhancedSnapshot(document);

      expect(tree).toContain('[checked]');
      expect(tree).toContain('[unchecked]');
    });

    it('should show input value', () => {
      document.body.innerHTML = '<input type="text" value="Hello World">';

      const { tree } = getEnhancedSnapshot(document);

      expect(tree).toContain('[value="Hello World"]');
    });

    it('should show link href', () => {
      document.body.innerHTML = '<a href="/about">About Us</a>';

      const { tree } = getEnhancedSnapshot(document);

      expect(tree).toContain('[href="/about"]');
    });

    it('should generate CSS selector for elements', () => {
      document.body.innerHTML = `
        <button id="submit-btn">Submit</button>
        <button data-testid="cancel">Cancel</button>
        <button class="primary">Primary</button>
      `;

      const { refs } = getEnhancedSnapshot(document);

      // Check selectors are generated
      const refValues = Object.values(refs);
      expect(refValues.some((r) => r.selector.includes('#submit-btn'))).toBe(true);
      expect(refValues.some((r) => r.selector.includes('[data-testid="cancel"]'))).toBe(true);
    });
  });

  describe('parseRef', () => {
    it('should parse direct ref format', () => {
      expect(parseRef('e1')).toBe('e1');
      expect(parseRef('e123')).toBe('e123');
    });

    it('should parse @ prefix format', () => {
      expect(parseRef('@e1')).toBe('e1');
      expect(parseRef('@e42')).toBe('e42');
    });

    it('should parse ref= format', () => {
      expect(parseRef('ref=e1')).toBe('e1');
      expect(parseRef('ref=e99')).toBe('e99');
    });

    it('should parse bracketed format', () => {
      expect(parseRef('[ref=e1]')).toBe('e1');
      expect(parseRef('[ref=e10]')).toBe('e10');
    });

    it('should return null for invalid refs', () => {
      expect(parseRef('button')).toBeNull();
      expect(parseRef('#id')).toBeNull();
      expect(parseRef('.class')).toBeNull();
      expect(parseRef('')).toBeNull();
    });

    it('should handle whitespace', () => {
      expect(parseRef('  e1  ')).toBe('e1');
      expect(parseRef('  @e2  ')).toBe('e2');
    });
  });

  describe('getSnapshotStats', () => {
    it('should return correct stats', () => {
      document.body.innerHTML = `
        <button>Button 1</button>
        <button>Button 2</button>
        <a href="#">Link</a>
        <input type="text">
      `;

      const { refs } = getEnhancedSnapshot(document);
      const stats = getSnapshotStats(refs);

      expect(stats.total).toBe(4);
      expect(stats.byRole.button).toBe(2);
      expect(stats.byRole.link).toBe(1);
      expect(stats.byRole.textbox).toBe(1);
    });

    it('should handle empty refs', () => {
      const stats = getSnapshotStats({});

      expect(stats.total).toBe(0);
      expect(stats.byRole).toEqual({});
    });
  });

  describe('findElementByRef', () => {
    it('should find element by ref', () => {
      document.body.innerHTML = '<button id="my-button">Click</button>';

      const { refs } = getEnhancedSnapshot(document);
      const element = findElementByRef('e1', refs, document);

      expect(element).not.toBeNull();
      expect(element?.tagName).toBe('BUTTON');
    });

    it('should return null for unknown ref', () => {
      document.body.innerHTML = '<button>Click</button>';

      const { refs } = getEnhancedSnapshot(document);
      const element = findElementByRef('e999', refs, document);

      expect(element).toBeNull();
    });
  });
});
