import { describe, it, expect } from 'vitest';
import { grep } from './index.js';

const sampleText = `line one
line two
another line
Line Three
UPPERCASE LINE
the end`;

describe('grep', () => {
  describe('basic matching', () => {
    it('should match lines containing the pattern', () => {
      const result = grep('line', sampleText);
      expect(result).toBe('line one\nline two\nanother line');
    });

    it('should return empty string when no matches', () => {
      const result = grep('nonexistent', sampleText);
      expect(result).toBe('');
    });

    it('should handle empty text', () => {
      const result = grep('pattern', '');
      expect(result).toBe('');
    });

    it('should handle empty pattern (matches all lines)', () => {
      const result = grep('', sampleText);
      expect(result).toBe(sampleText);
    });

    it('should be case-sensitive by default', () => {
      const result = grep('LINE', sampleText);
      expect(result).toBe('UPPERCASE LINE');
    });

    it('should match partial strings', () => {
      const result = grep('end', sampleText);
      expect(result).toBe('the end');
    });

    it('should handle single line text', () => {
      const result = grep('test', 'this is a test');
      expect(result).toBe('this is a test');
    });

    it('should handle multiple matches', () => {
      const text = 'error: something\nwarning: else\nerror: another';
      const result = grep('error', text);
      expect(result).toBe('error: something\nerror: another');
    });
  });

  describe('regex patterns', () => {
    it('should support OR patterns with |', () => {
      const result = grep('one|two', sampleText);
      expect(result).toBe('line one\nline two');
    });

    it('should support start of line anchor ^', () => {
      const result = grep('^line', sampleText);
      expect(result).toBe('line one\nline two');
    });

    it('should support end of line anchor $', () => {
      const result = grep('end$', sampleText);
      expect(result).toBe('the end');
    });

    it('should support character classes', () => {
      const text = 'user1\nuser2\nuser10\nadmin';
      const result = grep('user\\d', text);
      expect(result).toBe('user1\nuser2\nuser10');
    });

    it('should support groups', () => {
      const text = 'foo bar\nfoo baz\nqux bar';
      const result = grep('foo (bar|baz)', text);
      expect(result).toBe('foo bar\nfoo baz');
    });

    it('should support word boundaries', () => {
      const text = 'test\ntesting\nretest\ntest case';
      const result = grep('\\btest\\b', text);
      expect(result).toBe('test\ntest case');
    });

    it('should support dot wildcard', () => {
      const text = 'cat\ncut\ncot\ncar';
      const result = grep('c.t', text);
      expect(result).toBe('cat\ncut\ncot');
    });

    it('should support quantifiers', () => {
      const text = 'a\naa\naaa\naaaa';
      const result = grep('a{2,3}', text);
      expect(result).toBe('aa\naaa\naaaa');
    });

    it('should fall back to string match for invalid regex', () => {
      const text = 'test [bracket\nother line';
      const result = grep('[bracket', text);
      expect(result).toBe('test [bracket');
    });
  });
});
