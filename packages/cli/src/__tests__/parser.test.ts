/**
 * Parser tests
 */

import { describe, it, expect } from 'vitest';
import {
  parseCommand,
  getFlagString,
  getFlagNumber,
  getFlagBool,
} from '../parser.js';
import { ParseError } from '../errors.js';

describe('parseCommand', () => {
  describe('basic parsing', () => {
    it('parses a simple command', () => {
      const result = parseCommand('goto');
      expect(result.name).toBe('goto');
      expect(result.args).toEqual([]);
      expect(result.flags).toEqual({});
    });

    it('parses command with one argument', () => {
      const result = parseCommand('goto https://example.com');
      expect(result.name).toBe('goto');
      expect(result.args).toEqual(['https://example.com']);
    });

    it('parses command with multiple arguments', () => {
      const result = parseCommand('type @ref:1 hello world');
      expect(result.name).toBe('type');
      expect(result.args).toEqual(['@ref:1', 'hello', 'world']);
    });

    it('converts command name to lowercase', () => {
      const result = parseCommand('GOTO https://example.com');
      expect(result.name).toBe('goto');
    });

    it('preserves original input in raw field', () => {
      const input = 'goto https://example.com';
      const result = parseCommand(input);
      expect(result.raw).toBe(input);
    });

    it('trims whitespace', () => {
      const result = parseCommand('  goto https://example.com  ');
      expect(result.name).toBe('goto');
      expect(result.args).toEqual(['https://example.com']);
    });
  });

  describe('quoted strings', () => {
    it('parses double-quoted strings', () => {
      const result = parseCommand('type @ref:1 "hello world"');
      expect(result.args).toEqual(['@ref:1', 'hello world']);
    });

    it('parses single-quoted strings', () => {
      const result = parseCommand("type @ref:1 'hello world'");
      expect(result.args).toEqual(['@ref:1', 'hello world']);
    });

    it('handles empty quoted strings (parsed but filtered as empty token)', () => {
      // Note: empty quoted strings result in empty tokens which are filtered
      const result = parseCommand('fill @ref:1 ""');
      expect(result.args).toEqual(['@ref:1']);
    });

    it('preserves spaces in quoted strings', () => {
      const result = parseCommand('type @ref:1 "hello   world"');
      expect(result.args).toEqual(['@ref:1', 'hello   world']);
    });

    it('handles quotes within different quotes', () => {
      const result = parseCommand('type @ref:1 "it\'s working"');
      expect(result.args).toEqual(['@ref:1', "it's working"]);
    });

    it('throws on unterminated double quote', () => {
      expect(() => parseCommand('type @ref:1 "hello')).toThrow(ParseError);
      expect(() => parseCommand('type @ref:1 "hello')).toThrow('Unterminated double quote');
    });

    it('throws on unterminated single quote', () => {
      expect(() => parseCommand("type @ref:1 'hello")).toThrow(ParseError);
      expect(() => parseCommand("type @ref:1 'hello")).toThrow('Unterminated single quote');
    });
  });

  describe('escape characters', () => {
    it('handles escaped quotes', () => {
      const result = parseCommand('type @ref:1 "hello \\"world\\""');
      expect(result.args).toEqual(['@ref:1', 'hello "world"']);
    });

    it('handles escaped backslash', () => {
      const result = parseCommand('type @ref:1 "path\\\\file"');
      expect(result.args).toEqual(['@ref:1', 'path\\file']);
    });
  });

  describe('flags', () => {
    it('parses long flag with value', () => {
      const result = parseCommand('wait @ref:1 --state visible');
      expect(result.flags).toEqual({ state: 'visible' });
    });

    it('parses long flag with equals syntax', () => {
      const result = parseCommand('wait @ref:1 --state=visible');
      expect(result.flags).toEqual({ state: 'visible' });
    });

    it('parses boolean long flag', () => {
      const result = parseCommand('reload --hard');
      expect(result.flags).toEqual({ hard: true });
    });

    it('parses short flag with value', () => {
      const result = parseCommand('screenshot -f png');
      expect(result.flags).toEqual({ f: 'png' });
    });

    it('parses boolean short flag', () => {
      const result = parseCommand('reload -h');
      expect(result.flags).toEqual({ h: true });
    });

    it('parses multiple flags', () => {
      const result = parseCommand('screenshot --format png --quality 80');
      expect(result.flags).toEqual({ format: 'png', quality: '80' });
    });

    it('separates args and flags correctly', () => {
      const result = parseCommand('click @ref:1 --button right');
      expect(result.args).toEqual(['@ref:1']);
      expect(result.flags).toEqual({ button: 'right' });
    });

    it('handles flag value with equals sign', () => {
      const result = parseCommand('eval --script=a=b');
      expect(result.flags).toEqual({ script: 'a=b' });
    });
  });

  describe('edge cases', () => {
    it('throws on empty input', () => {
      expect(() => parseCommand('')).toThrow(ParseError);
      expect(() => parseCommand('')).toThrow('Empty command');
    });

    it('throws on whitespace-only input', () => {
      expect(() => parseCommand('   ')).toThrow(ParseError);
    });

    it('handles tabs as whitespace', () => {
      const result = parseCommand('goto\thttps://example.com');
      expect(result.name).toBe('goto');
      expect(result.args).toEqual(['https://example.com']);
    });

    it('handles URLs with special characters', () => {
      const result = parseCommand('goto https://example.com/path?query=value&foo=bar');
      expect(result.args).toEqual(['https://example.com/path?query=value&foo=bar']);
    });

    it('handles @ref selectors', () => {
      const result = parseCommand('click @ref:123');
      expect(result.args).toEqual(['@ref:123']);
    });

    it('handles CSS selectors', () => {
      const result = parseCommand('click #submit-button');
      expect(result.args).toEqual(['#submit-button']);
    });

    it('handles class selectors', () => {
      const result = parseCommand('click .btn.primary');
      expect(result.args).toEqual(['.btn.primary']);
    });
  });
});

describe('getFlagString', () => {
  it('returns string value for string flag', () => {
    const flags = { format: 'png' };
    expect(getFlagString(flags, 'format')).toBe('png');
  });

  it('returns undefined for missing flag', () => {
    const flags = {};
    expect(getFlagString(flags, 'format')).toBeUndefined();
  });

  it('returns default for missing flag', () => {
    const flags = {};
    expect(getFlagString(flags, 'format', 'jpeg')).toBe('jpeg');
  });

  it('returns default for boolean flag', () => {
    const flags = { format: true };
    expect(getFlagString(flags, 'format', 'jpeg')).toBe('jpeg');
  });
});

describe('getFlagNumber', () => {
  it('returns number for numeric string flag', () => {
    const flags = { quality: '80' };
    expect(getFlagNumber(flags, 'quality')).toBe(80);
  });

  it('returns undefined for missing flag', () => {
    const flags = {};
    expect(getFlagNumber(flags, 'quality')).toBeUndefined();
  });

  it('returns default for missing flag', () => {
    const flags = {};
    expect(getFlagNumber(flags, 'quality', 100)).toBe(100);
  });

  it('returns default for non-numeric string', () => {
    const flags = { quality: 'high' };
    expect(getFlagNumber(flags, 'quality', 100)).toBe(100);
  });

  it('returns default for boolean flag', () => {
    const flags = { quality: true };
    expect(getFlagNumber(flags, 'quality', 100)).toBe(100);
  });

  it('handles zero correctly', () => {
    const flags = { offset: '0' };
    expect(getFlagNumber(flags, 'offset')).toBe(0);
  });

  it('handles negative numbers', () => {
    const flags = { offset: '-10' };
    expect(getFlagNumber(flags, 'offset')).toBe(-10);
  });

  it('handles floating point', () => {
    const flags = { scale: '1.5' };
    expect(getFlagNumber(flags, 'scale')).toBe(1.5);
  });
});

describe('getFlagBool', () => {
  it('returns true for boolean true flag', () => {
    const flags = { hard: true };
    expect(getFlagBool(flags, 'hard')).toBe(true);
  });

  it('returns false for boolean false flag', () => {
    const flags = { hard: false };
    expect(getFlagBool(flags, 'hard')).toBe(false);
  });

  it('returns false for missing flag by default', () => {
    const flags = {};
    expect(getFlagBool(flags, 'hard')).toBe(false);
  });

  it('returns default for missing flag', () => {
    const flags = {};
    expect(getFlagBool(flags, 'hard', true)).toBe(true);
  });

  it('returns true for string "true"', () => {
    const flags = { hard: 'true' };
    expect(getFlagBool(flags, 'hard')).toBe(true);
  });

  it('returns true for string "1"', () => {
    const flags = { hard: '1' };
    expect(getFlagBool(flags, 'hard')).toBe(true);
  });

  it('returns false for other strings', () => {
    const flags = { hard: 'yes' };
    expect(getFlagBool(flags, 'hard')).toBe(false);
  });

  it('is case insensitive for "true"', () => {
    const flags = { hard: 'TRUE' };
    expect(getFlagBool(flags, 'hard')).toBe(true);
  });
});
