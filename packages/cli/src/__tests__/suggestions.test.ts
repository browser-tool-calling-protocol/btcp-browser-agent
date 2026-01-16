/**
 * Suggestions tests
 */

import { describe, it, expect } from 'vitest';
import {
  findSimilarCommands,
  getContextualSuggestion,
  commandCategories,
  getCommandCategory,
  getNextStepSuggestions,
} from '../suggestions.js';

describe('findSimilarCommands', () => {
  describe('exact prefix matching', () => {
    it('finds commands starting with input', () => {
      const results = findSimilarCommands('go');
      expect(results).toContain('goto');
    });

    it('finds commands starting with input (tabs)', () => {
      const results = findSimilarCommands('tab');
      expect(results).toContain('tabs');
      expect(results).toContain('tab');
    });

    it('prioritizes prefix matches', () => {
      const results = findSimilarCommands('scr');
      expect(results[0]).toBe('scroll');
    });
  });

  describe('typo correction', () => {
    it('suggests click for clck', () => {
      const results = findSimilarCommands('clck');
      expect(results).toContain('click');
    });

    it('suggests goto for gto', () => {
      const results = findSimilarCommands('gto');
      expect(results).toContain('goto');
    });

    it('suggests snapshot for snapshto', () => {
      const results = findSimilarCommands('snapshto');
      expect(results).toContain('snapshot');
    });

    it('suggests type for typ', () => {
      const results = findSimilarCommands('typ');
      expect(results).toContain('type');
    });

    it('suggests fill for fil', () => {
      const results = findSimilarCommands('fil');
      expect(results).toContain('fill');
    });

    it('suggests reload for relod', () => {
      const results = findSimilarCommands('relod');
      expect(results).toContain('reload');
    });
  });

  describe('substring matching', () => {
    it('finds commands containing input', () => {
      const results = findSimilarCommands('shot');
      expect(results).toContain('screenshot');
    });

    it('finds check in commands', () => {
      const results = findSimilarCommands('check');
      expect(results).toContain('check');
      expect(results).toContain('uncheck');
    });
  });

  describe('limits', () => {
    it('returns at most maxSuggestions results', () => {
      const results = findSimilarCommands('t', 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('returns empty for completely unrelated input', () => {
      const results = findSimilarCommands('xyzabc123');
      expect(results).toHaveLength(0);
    });
  });

  describe('case insensitivity', () => {
    it('matches regardless of case', () => {
      const results = findSimilarCommands('GOTO');
      expect(results).toContain('goto');
    });

    it('matches mixed case', () => {
      const results = findSimilarCommands('GoTo');
      expect(results).toContain('goto');
    });
  });
});

describe('getContextualSuggestion', () => {
  describe('element not found', () => {
    it('provides suggestion for "not found" error', () => {
      const suggestion = getContextualSuggestion('click', 'Element not found', ['@ref:5']);
      expect(suggestion).toContain('snapshot');
      expect(suggestion).toContain('@ref:5');
    });

    it('provides suggestion for "no element" error', () => {
      const suggestion = getContextualSuggestion('click', 'No element matches selector', ['#btn']);
      expect(suggestion).toContain('snapshot');
    });
  });

  describe('invalid selector', () => {
    it('provides suggestion for selector errors', () => {
      const suggestion = getContextualSuggestion('click', 'Invalid selector', ['>>>']);
      expect(suggestion).toContain('@ref:5');
      expect(suggestion).toContain('#id');
    });
  });

  describe('navigation errors', () => {
    it('provides suggestion for navigation failures', () => {
      const suggestion = getContextualSuggestion('goto', 'Failed to navigate', ['example.com']);
      expect(suggestion).toContain('https://');
    });

    it('provides suggestion for URL errors', () => {
      // Note: 'invalid' pattern matches first, giving selector advice
      // Use 'navigate' or 'url' pattern for navigation-specific advice
      const suggestion = getContextualSuggestion('goto', 'Failed to navigate to URL', ['not-a-url']);
      expect(suggestion).toContain('https://');
    });
  });

  describe('timeout errors', () => {
    it('provides suggestion for timeout', () => {
      const suggestion = getContextualSuggestion('wait', 'Timeout waiting for element', ['@ref:5']);
      expect(suggestion).toContain('wait');
      expect(suggestion).toContain('@ref:5');
    });
  });

  describe('permission errors', () => {
    it('provides suggestion for permission denied', () => {
      const suggestion = getContextualSuggestion('click', 'Permission denied', ['#btn']);
      expect(suggestion).toContain('Cross-origin');
    });

    it('provides suggestion for blocked actions', () => {
      const suggestion = getContextualSuggestion('type', 'Action blocked by security policy', ['#input']);
      expect(suggestion).toContain('iframe');
    });
  });

  describe('no suggestion', () => {
    it('returns null for unknown errors', () => {
      const suggestion = getContextualSuggestion('click', 'Some random error', ['@ref:1']);
      expect(suggestion).toBeNull();
    });
  });
});

describe('commandCategories', () => {
  it('has navigation category', () => {
    expect(commandCategories.navigation).toBeDefined();
    expect(commandCategories.navigation.commands).toContain('goto');
    expect(commandCategories.navigation.commands).toContain('back');
  });

  it('has inspection category', () => {
    expect(commandCategories.inspection).toBeDefined();
    expect(commandCategories.inspection.commands).toContain('snapshot');
    expect(commandCategories.inspection.commands).toContain('screenshot');
  });

  it('has interaction category', () => {
    expect(commandCategories.interaction).toBeDefined();
    expect(commandCategories.interaction.commands).toContain('click');
    expect(commandCategories.interaction.commands).toContain('type');
  });

  it('has forms category', () => {
    expect(commandCategories.forms).toBeDefined();
    expect(commandCategories.forms.commands).toContain('check');
    expect(commandCategories.forms.commands).toContain('select');
  });

  it('has tabs category', () => {
    expect(commandCategories.tabs).toBeDefined();
    expect(commandCategories.tabs.commands).toContain('tabs');
    expect(commandCategories.tabs.commands).toContain('newtab');
  });

  it('has utility category', () => {
    expect(commandCategories.utility).toBeDefined();
    expect(commandCategories.utility.commands).toContain('wait');
    expect(commandCategories.utility.commands).toContain('help');
  });

  it('each category has name and description', () => {
    for (const category of Object.values(commandCategories)) {
      expect(category.name).toBeDefined();
      expect(category.description).toBeDefined();
      expect(category.commands.length).toBeGreaterThan(0);
    }
  });
});

describe('getCommandCategory', () => {
  it('returns correct category for navigation commands', () => {
    expect(getCommandCategory('goto')).toBe('navigation');
    expect(getCommandCategory('back')).toBe('navigation');
    expect(getCommandCategory('reload')).toBe('navigation');
  });

  it('returns correct category for interaction commands', () => {
    expect(getCommandCategory('click')).toBe('interaction');
    expect(getCommandCategory('type')).toBe('interaction');
  });

  it('returns correct category for inspection commands', () => {
    expect(getCommandCategory('snapshot')).toBe('inspection');
    expect(getCommandCategory('screenshot')).toBe('inspection');
  });

  it('returns null for unknown commands', () => {
    expect(getCommandCategory('unknown')).toBeNull();
  });
});

describe('getNextStepSuggestions', () => {
  it('suggests snapshot after navigation', () => {
    const suggestions = getNextStepSuggestions('goto');
    expect(suggestions).toContain('snapshot     # See page structure and get element refs');
  });

  it('suggests actions after snapshot', () => {
    const suggestions = getNextStepSuggestions('snapshot');
    expect(suggestions.some((s) => s.includes('click'))).toBe(true);
  });

  it('suggests snapshot after click', () => {
    const suggestions = getNextStepSuggestions('click');
    expect(suggestions.some((s) => s.includes('snapshot'))).toBe(true);
  });

  it('returns empty for unknown commands', () => {
    const suggestions = getNextStepSuggestions('unknown');
    expect(suggestions).toHaveLength(0);
  });
});
