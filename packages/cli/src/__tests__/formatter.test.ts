/**
 * Formatter tests
 */

import { describe, it, expect } from 'vitest';
import {
  formatResult,
  formatData,
  formatHelp,
  formatCommandHelp,
  formatScreenshot,
  formatErrorWithSuggestions,
  formatSuccessWithNextSteps,
} from '../formatter.js';

describe('formatResult', () => {
  describe('success results', () => {
    it('formats success with message', () => {
      const result = formatResult({ success: true, message: 'Navigated to example.com' });
      expect(result.type).toBe('success');
      expect(result.content).toBe('✓ Navigated to example.com');
    });

    it('formats success with data', () => {
      const result = formatResult({ success: true, data: 'Some data' });
      expect(result.type).toBe('data');
      expect(result.content).toBe('Some data');
    });

    it('formats success without message or data', () => {
      const result = formatResult({ success: true });
      expect(result.type).toBe('success');
      expect(result.content).toBe('✓ Done');
    });

    it('prefers message over data', () => {
      const result = formatResult({ success: true, message: 'Done!', data: 'ignored' });
      expect(result.content).toBe('✓ Done!');
    });
  });

  describe('error results', () => {
    it('formats error with message', () => {
      const result = formatResult({ success: false, error: 'Something went wrong' });
      expect(result.type).toBe('error');
      expect(result.content).toBe('✗ Error: Something went wrong');
    });

    it('formats error without message', () => {
      const result = formatResult({ success: false });
      expect(result.type).toBe('error');
      expect(result.content).toBe('✗ Error: Unknown error');
    });
  });
});

describe('formatData', () => {
  describe('primitive types', () => {
    it('formats null', () => {
      expect(formatData(null)).toBe('');
    });

    it('formats undefined', () => {
      expect(formatData(undefined)).toBe('');
    });

    it('formats string', () => {
      expect(formatData('hello')).toBe('hello');
    });

    it('formats number', () => {
      expect(formatData(42)).toBe('42');
    });

    it('formats boolean', () => {
      expect(formatData(true)).toBe('true');
      expect(formatData(false)).toBe('false');
    });
  });

  describe('arrays', () => {
    it('formats empty array', () => {
      expect(formatData([])).toBe('(empty)');
    });

    it('formats array of primitives', () => {
      expect(formatData(['a', 'b', 'c'])).toBe('a\nb\nc');
    });

    it('formats array of numbers', () => {
      expect(formatData([1, 2, 3])).toBe('1\n2\n3');
    });

    it('formats array of objects with indices', () => {
      const result = formatData([{ name: 'a' }, { name: 'b' }]);
      expect(result).toContain('[0]');
      expect(result).toContain('[1]');
    });
  });

  describe('objects', () => {
    it('formats empty object', () => {
      expect(formatData({})).toBe('{}');
    });

    it('formats simple object', () => {
      const result = formatData({ name: 'test', value: 42 });
      expect(result).toContain('name: test');
      expect(result).toContain('value: 42');
    });

    it('extracts tree from snapshot data', () => {
      const data = {
        tree: '- button "Submit"\n- input "Email"',
        refs: {},
      };
      expect(formatData(data)).toBe('- button "Submit"\n- input "Email"');
    });
  });
});

describe('formatHelp', () => {
  it('formats command list', () => {
    const commands = [
      { name: 'goto', description: 'Navigate to URL', usage: 'goto <url>' },
      { name: 'click', description: 'Click element', usage: 'click <selector>' },
    ];
    const result = formatHelp(commands);
    expect(result).toContain('goto');
    expect(result).toContain('Navigate to URL');
    expect(result).toContain('click');
    expect(result).toContain('Click element');
  });

  it('aligns descriptions', () => {
    const commands = [
      { name: 'a', description: 'Short', usage: 'a' },
      { name: 'longer', description: 'Longer name', usage: 'longer' },
    ];
    const result = formatHelp(commands);
    // Both descriptions should be aligned
    const lines = result.split('\n');
    expect(lines.length).toBe(2);
  });
});

describe('formatCommandHelp', () => {
  it('formats command with all fields', () => {
    const command = {
      name: 'click',
      description: 'Click an element',
      usage: 'click <selector>',
      examples: ['click @ref:5', 'click #submit'],
    };
    const result = formatCommandHelp(command);
    expect(result).toContain('click');
    expect(result).toContain('Click an element');
    expect(result).toContain('click <selector>');
    expect(result).toContain('click @ref:5');
    expect(result).toContain('click #submit');
  });

  it('formats command without examples', () => {
    const command = {
      name: 'back',
      description: 'Go back in history',
      usage: 'back',
    };
    const result = formatCommandHelp(command);
    expect(result).toContain('back');
    expect(result).toContain('Go back in history');
    expect(result).not.toContain('Examples');
  });

  it('includes selector help for interaction commands', () => {
    const command = {
      name: 'click',
      description: 'Click an element',
      usage: 'click <selector>',
    };
    const result = formatCommandHelp(command);
    expect(result).toContain('Selectors');
    expect(result).toContain('@ref:N');
    expect(result).toContain('#id');
  });

  it('excludes selector help for non-interaction commands', () => {
    const command = {
      name: 'goto',
      description: 'Navigate to URL',
      usage: 'goto <url>',
    };
    const result = formatCommandHelp(command);
    expect(result).not.toContain('Selectors');
  });
});

describe('formatScreenshot', () => {
  it('extracts format and size from PNG data URL', () => {
    // Create a small base64 string (~100 bytes)
    const base64 = 'A'.repeat(100);
    const dataUrl = `data:image/png;base64,${base64}`;
    const result = formatScreenshot(dataUrl);
    expect(result).toContain('png');
    expect(result).toContain('KB');
  });

  it('extracts format and size from JPEG data URL', () => {
    const base64 = 'A'.repeat(1000);
    const dataUrl = `data:image/jpeg;base64,${base64}`;
    const result = formatScreenshot(dataUrl);
    expect(result).toContain('jpeg');
    expect(result).toContain('KB');
  });

  it('handles invalid data URL', () => {
    const result = formatScreenshot('not-a-data-url');
    expect(result).toBe('Screenshot captured');
  });
});

describe('formatErrorWithSuggestions', () => {
  it('formats error without suggestions', () => {
    const result = formatErrorWithSuggestions('Something failed');
    expect(result).toBe('✗ Error: Something failed');
  });

  it('formats error with suggestions', () => {
    const result = formatErrorWithSuggestions('Element not found', [
      'Run snapshot first',
      'Check selector syntax',
    ]);
    expect(result).toContain('✗ Error: Element not found');
    expect(result).toContain('Suggestions:');
    expect(result).toContain('Run snapshot first');
    expect(result).toContain('Check selector syntax');
  });

  it('formats error with empty suggestions array', () => {
    const result = formatErrorWithSuggestions('Error', []);
    expect(result).toBe('✗ Error: Error');
  });
});

describe('formatSuccessWithNextSteps', () => {
  it('formats success without next steps', () => {
    const result = formatSuccessWithNextSteps('Operation completed');
    expect(result).toBe('✓ Operation completed');
  });

  it('formats success with next steps', () => {
    const result = formatSuccessWithNextSteps('Navigated successfully', [
      'snapshot  # See page elements',
      'click @ref:N  # Interact',
    ]);
    expect(result).toContain('✓ Navigated successfully');
    expect(result).toContain('Next steps:');
    expect(result).toContain('snapshot');
    expect(result).toContain('click');
  });

  it('formats success with empty next steps array', () => {
    const result = formatSuccessWithNextSteps('Done', []);
    expect(result).toBe('✓ Done');
  });
});
