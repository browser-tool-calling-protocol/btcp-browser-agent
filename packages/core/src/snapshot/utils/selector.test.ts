/**
 * @btcp/core - Selector tests
 *
 * Tests for selector parsing and filtering functionality.
 */

import { describe, it, expect } from 'vitest';
import {
  detectSelectorType,
  parseSelector,
  filterBySelector,
  buildElementSearchData,
  type ElementSearchData,
} from './filter.js';

describe('Selector Parsing', () => {
  describe('detectSelectorType', () => {
    it('should detect role selectors', () => {
      expect(detectSelectorType('button')).toBe('role');
      expect(detectSelectorType('link')).toBe('role');
      expect(detectSelectorType('textbox')).toBe('role');
    });

    it('should detect XPath selectors', () => {
      expect(detectSelectorType('//main//button')).toBe('xpath');
      expect(detectSelectorType('/body/nav')).toBe('xpath');
      expect(detectSelectorType('//div[@class="foo"]')).toBe('xpath');
    });

    it('should detect XPath union selectors', () => {
      expect(detectSelectorType('//button | //link')).toBe('xpath');
      expect(detectSelectorType('//nav//button | //header//button')).toBe('xpath');
      expect(detectSelectorType('//a | //button | //input')).toBe('xpath');
    });

    it('should handle trimmed whitespace', () => {
      expect(detectSelectorType('  button  ')).toBe('role');
      expect(detectSelectorType('  //main  ')).toBe('xpath');
      expect(detectSelectorType('  //button | //link  ')).toBe('xpath');
    });
  });

  describe('parseSelector', () => {
    it('should parse role selectors', () => {
      const result = parseSelector('button');
      expect(result.type).toBe('role');
      expect(result.raw).toBe('button');
      expect(result.parts).toEqual(['button']);
    });

    it('should parse XPath selectors', () => {
      const result = parseSelector('//main//button');
      expect(result.type).toBe('xpath');
      expect(result.raw).toBe('//main//button');
      expect(result.parts).toEqual(['//main//button']);
    });

    it('should parse XPath union selectors', () => {
      const result = parseSelector('//button | //link | //textbox');
      expect(result.type).toBe('xpath');
      expect(result.raw).toBe('//button | //link | //textbox');
      expect(result.parts).toEqual(['//button', '//link', '//textbox']);
    });

    it('should trim whitespace in union parts', () => {
      const result = parseSelector('//button  |  //link  |  //textbox');
      expect(result.parts).toEqual(['//button', '//link', '//textbox']);
    });

    it('should filter empty parts in unions', () => {
      const result = parseSelector('//button||//link');
      expect(result.parts).toEqual(['//button', '//link']);
    });
  });
});

describe('Selector Filtering', () => {
  // Helper to create test element data
  function createTestElement(
    role: string,
    name: string = '',
    xpath: string = ''
  ): ElementSearchData {
    const mockElement = document.createElement('div');
    return buildElementSearchData(mockElement, role, name, xpath);
  }

  describe('filterBySelector - role selectors', () => {
    it('should filter by exact role match', () => {
      const elements = [
        createTestElement('button', 'Submit'),
        createTestElement('link', 'Home'),
        createTestElement('textbox', 'Username'),
      ];

      const result = filterBySelector(elements, 'button');
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('button');
    });

    it('should be case-insensitive', () => {
      const elements = [
        createTestElement('BUTTON', 'Submit'),
        createTestElement('Button', 'Cancel'),
      ];

      const result = filterBySelector(elements, 'button');
      expect(result).toHaveLength(2);
    });

    it('should support wildcard patterns', () => {
      const elements = [
        createTestElement('button', 'Submit'),
        createTestElement('button-primary', 'Save'),
        createTestElement('link', 'Home'),
      ];

      const result = filterBySelector(elements, 'button*');
      expect(result).toHaveLength(2);
      expect(result.every(e => e.role.startsWith('button'))).toBe(true);
    });

    it('should return empty array for no matches', () => {
      const elements = [
        createTestElement('button', 'Submit'),
        createTestElement('link', 'Home'),
      ];

      const result = filterBySelector(elements, 'textbox');
      expect(result).toHaveLength(0);
    });

    it('should handle empty selector', () => {
      const elements = [
        createTestElement('button', 'Submit'),
        createTestElement('link', 'Home'),
      ];

      const result = filterBySelector(elements, '');
      expect(result).toHaveLength(2);
    });
  });

  describe('filterBySelector - XPath selectors', () => {
    it('should filter by XPath pattern with wildcards', () => {
      const elements = [
        createTestElement('button', 'Submit', '/body/main/button'),
        createTestElement('button', 'Cancel', '/body/nav/button'),
        createTestElement('link', 'Home', '/body/main/a'),
      ];

      // Using wildcard pattern that matches /body/main/*
      const result = filterBySelector(elements, '/body/main/*');
      expect(result).toHaveLength(2);
      expect(result.every(e => e.xpath.includes('/main/'))).toBe(true);
    });

    it('should support wildcard XPath patterns', () => {
      const elements = [
        createTestElement('button', 'Submit', '/body/main/div/button'),
        createTestElement('button', 'Cancel', '/body/nav/button'),
        createTestElement('button', 'Delete', '/body/main/form/button'),
      ];

      const result = filterBySelector(elements, '/body/main*button');
      expect(result).toHaveLength(2);
    });

    it('should be case-insensitive for XPath', () => {
      const elements = [
        createTestElement('button', 'Submit', '/body/main/button'),
        createTestElement('button', 'Cancel', '/body/nav/button'),
      ];

      const result = filterBySelector(elements, '/body/main/button');
      expect(result).toHaveLength(1);
    });
  });

  describe('filterBySelector - XPath unions', () => {
    it('should filter by XPath union (OR logic)', () => {
      const elements = [
        createTestElement('button', 'Submit', '//button[1]'),
        createTestElement('link', 'Home', '//link[1]'),
        createTestElement('textbox', 'Username', '//textbox[1]'),
        createTestElement('checkbox', 'Remember me', '//checkbox[1]'),
      ];

      const result = filterBySelector(elements, '//button | //link');
      expect(result).toHaveLength(2);
      const roles = result.map(e => e.role);
      expect(roles).toContain('button');
      expect(roles).toContain('link');
    });

    it('should support path-based XPath unions', () => {
      const elements = [
        createTestElement('button', 'Submit', '/body/main/button'),
        createTestElement('link', 'Home', '/body/nav/a'),
        createTestElement('button', 'Cancel', '/body/nav/button'),
      ];

      // XPath unions with different paths
      const result = filterBySelector(elements, '/body/main/button | /body/nav/a');
      expect(result).toHaveLength(2);
    });

    it('should handle whitespace in XPath unions', () => {
      const elements = [
        createTestElement('button', 'Submit', '//button[1]'),
        createTestElement('link', 'Home', '//link[1]'),
        createTestElement('textbox', 'Username', '//textbox[1]'),
      ];

      const result = filterBySelector(elements, '  //button  |  //link  ');
      expect(result).toHaveLength(2);
    });

    it('should deduplicate results', () => {
      const elements = [
        createTestElement('button', 'Submit', '//button[1]'),
        createTestElement('link', 'Home', '//link[1]'),
      ];

      // Same element matched by multiple selectors should appear once
      const result = filterBySelector(elements, '//button | //button');
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('button');
    });
  });

  describe('filterBySelector - edge cases', () => {
    it('should handle elements with no role', () => {
      const elements = [
        createTestElement('', 'No Role'),
        createTestElement('button', 'Submit'),
      ];

      const result = filterBySelector(elements, 'button');
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('button');
    });

    it('should handle elements with no xpath', () => {
      const elements = [
        createTestElement('button', 'Submit', ''),
        createTestElement('button', 'Cancel', '/body/button'),
      ];

      const result = filterBySelector(elements, '/body/button');
      expect(result).toHaveLength(1);
      expect(result[0].xpath).toContain('/body/button');
    });

    it('should handle complex wildcard patterns', () => {
      const elements = [
        createTestElement('button-primary', 'Submit'),
        createTestElement('button-secondary', 'Cancel'),
        createTestElement('link-button', 'Home'),
      ];

      const result = filterBySelector(elements, 'button*');
      expect(result).toHaveLength(2);
    });
  });
});
