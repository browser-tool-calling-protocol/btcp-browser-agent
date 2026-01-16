/**
 * Error classes tests
 */

import { describe, it, expect } from 'vitest';
import {
  CLIError,
  CommandNotFoundError,
  InvalidArgumentsError,
  ParseError,
  ExecutionError,
  ElementNotFoundError,
  NavigationError,
  TimeoutError,
} from '../errors.js';

describe('CLIError', () => {
  it('creates basic error', () => {
    const error = new CLIError('Something went wrong');
    expect(error.message).toBe('Something went wrong');
    expect(error.name).toBe('CLIError');
    expect(error).toBeInstanceOf(Error);
  });

  it('creates error with suggestions', () => {
    const error = new CLIError('Error', {
      suggestions: ['Try this', 'Or that'],
    });
    expect(error.suggestions).toEqual(['Try this', 'Or that']);
  });

  it('creates error with usage', () => {
    const error = new CLIError('Error', { usage: 'command <arg>' });
    expect(error.usage).toBe('command <arg>');
  });

  it('creates error with command', () => {
    const error = new CLIError('Error', { command: 'click' });
    expect(error.command).toBe('click');
  });

  describe('toFormattedString', () => {
    it('formats basic error', () => {
      const error = new CLIError('Something failed');
      expect(error.toFormattedString()).toBe('Something failed');
    });

    it('includes usage in formatted output', () => {
      const error = new CLIError('Missing argument', {
        usage: 'click <selector>',
      });
      const formatted = error.toFormattedString();
      expect(formatted).toContain('Missing argument');
      expect(formatted).toContain('Usage: click <selector>');
    });

    it('includes suggestions in formatted output', () => {
      const error = new CLIError('Error', {
        suggestions: ['Try running snapshot first', 'Check the selector'],
      });
      const formatted = error.toFormattedString();
      expect(formatted).toContain('Suggestions:');
      expect(formatted).toContain('Try running snapshot first');
      expect(formatted).toContain('Check the selector');
    });

    it('includes both usage and suggestions', () => {
      const error = new CLIError('Error', {
        usage: 'click <selector>',
        suggestions: ['Use @ref:N format'],
      });
      const formatted = error.toFormattedString();
      expect(formatted).toContain('Usage:');
      expect(formatted).toContain('Suggestions:');
    });
  });
});

describe('CommandNotFoundError', () => {
  it('creates error with command name', () => {
    const error = new CommandNotFoundError('clck');
    expect(error.message).toBe('Unknown command: clck');
    expect(error.commandName).toBe('clck');
    expect(error.name).toBe('CommandNotFoundError');
  });

  it('includes similar commands in suggestions', () => {
    const error = new CommandNotFoundError('clck', ['click']);
    expect(error.suggestions).toContain("Did you mean 'click'?");
  });

  it('includes multiple similar commands', () => {
    const error = new CommandNotFoundError('chck', ['check', 'click']);
    expect(error.suggestions?.length).toBe(2);
  });

  it('provides default suggestion when no similar commands', () => {
    const error = new CommandNotFoundError('xyz');
    expect(error.suggestions).toContain('Type "help" to see available commands');
  });

  it('provides default suggestion for empty similar commands', () => {
    const error = new CommandNotFoundError('xyz', []);
    expect(error.suggestions).toContain('Type "help" to see available commands');
  });
});

describe('InvalidArgumentsError', () => {
  it('creates error with message', () => {
    const error = new InvalidArgumentsError('Missing selector');
    expect(error.message).toBe('Missing selector');
    expect(error.name).toBe('InvalidArgumentsError');
  });

  it('includes usage', () => {
    const error = new InvalidArgumentsError('Missing selector', 'click <selector>');
    expect(error.usage).toBe('click <selector>');
  });

  it('includes examples as suggestions', () => {
    const error = new InvalidArgumentsError(
      'Missing selector',
      'click <selector>',
      ['click @ref:5', 'click #submit']
    );
    expect(error.suggestions).toContain('Example: click @ref:5');
    expect(error.suggestions).toContain('Example: click #submit');
  });
});

describe('ParseError', () => {
  it('creates error with message', () => {
    const error = new ParseError('Unterminated quote');
    expect(error.message).toBe('Unterminated quote');
    expect(error.name).toBe('ParseError');
  });

  it('includes default suggestions', () => {
    const error = new ParseError('Syntax error');
    expect(error.suggestions?.length).toBeGreaterThan(0);
    expect(error.suggestions?.some((s) => s.includes('quotes'))).toBe(true);
  });

  it('uses custom hint when provided', () => {
    const error = new ParseError('Error', 'Custom hint');
    expect(error.suggestions).toEqual(['Custom hint']);
  });
});

describe('ExecutionError', () => {
  it('creates error with message', () => {
    const error = new ExecutionError('Execution failed');
    expect(error.message).toBe('Execution failed');
    expect(error.name).toBe('ExecutionError');
  });

  it('includes suggestions', () => {
    const error = new ExecutionError('Failed', {
      suggestions: ['Try again'],
    });
    expect(error.suggestions).toEqual(['Try again']);
  });

  it('includes command', () => {
    const error = new ExecutionError('Failed', {
      command: 'click',
    });
    expect(error.command).toBe('click');
  });
});

describe('ElementNotFoundError', () => {
  it('creates error with selector', () => {
    const error = new ElementNotFoundError('@ref:5');
    expect(error.message).toBe('Element not found: @ref:5');
    expect(error.name).toBe('ElementNotFoundError');
  });

  it('includes helpful suggestions', () => {
    const error = new ElementNotFoundError('@ref:5');
    expect(error.suggestions?.some((s) => s.includes('snapshot'))).toBe(true);
    expect(error.suggestions?.some((s) => s.includes('wait'))).toBe(true);
  });

  it('includes selector in wait suggestion', () => {
    const error = new ElementNotFoundError('#my-button');
    expect(error.suggestions?.some((s) => s.includes('#my-button'))).toBe(true);
  });
});

describe('NavigationError', () => {
  it('creates error with URL', () => {
    const error = new NavigationError('https://example.com');
    expect(error.message).toContain('example.com');
    expect(error.name).toBe('NavigationError');
  });

  it('creates error with reason', () => {
    const error = new NavigationError('https://example.com', 'Network error');
    expect(error.message).toContain('Network error');
  });

  it('includes protocol suggestion', () => {
    const error = new NavigationError('example.com');
    expect(error.suggestions?.some((s) => s.includes('https://'))).toBe(true);
  });
});

describe('TimeoutError', () => {
  it('creates error with operation', () => {
    const error = new TimeoutError('waiting for element');
    expect(error.message).toBe('Timeout: waiting for element');
    expect(error.name).toBe('TimeoutError');
  });

  it('includes general suggestions', () => {
    const error = new TimeoutError('operation');
    expect(error.suggestions?.some((s) => s.includes('wait'))).toBe(true);
    expect(error.suggestions?.some((s) => s.includes('snapshot'))).toBe(true);
  });

  it('includes selector-specific suggestion when provided', () => {
    const error = new TimeoutError('waiting', '@ref:5');
    expect(error.suggestions?.some((s) => s.includes('@ref:5'))).toBe(true);
  });
});
