/**
 * @btcp/core - Error handling tests
 *
 * Tests for the structured error types with machine-readable codes
 * and actionable suggestions.
 */

import { describe, it, expect } from 'vitest';
import {
  ErrorCode,
  DetailedError,
  createElementNotFoundError,
  createElementNotCompatibleError,
  createTimeoutError,
  createInvalidParametersError,
  createVerificationError,
} from './errors.js';

describe('ErrorCode', () => {
  it('should define all expected error codes', () => {
    expect(ErrorCode.ELEMENT_NOT_FOUND).toBe('ELEMENT_NOT_FOUND');
    expect(ErrorCode.ELEMENT_NOT_COMPATIBLE).toBe('ELEMENT_NOT_COMPATIBLE');
    expect(ErrorCode.REF_EXPIRED).toBe('REF_EXPIRED');
    expect(ErrorCode.INVALID_SELECTOR).toBe('INVALID_SELECTOR');
    expect(ErrorCode.TIMEOUT).toBe('TIMEOUT');
    expect(ErrorCode.ELEMENT_NOT_VISIBLE).toBe('ELEMENT_NOT_VISIBLE');
    expect(ErrorCode.ELEMENT_DISABLED).toBe('ELEMENT_DISABLED');
    expect(ErrorCode.INVALID_PARAMETERS).toBe('INVALID_PARAMETERS');
    expect(ErrorCode.INVALID_STATE).toBe('INVALID_STATE');
    expect(ErrorCode.NAVIGATION_ERROR).toBe('NAVIGATION_ERROR');
    expect(ErrorCode.VERIFICATION_FAILED).toBe('VERIFICATION_FAILED');
  });
});

describe('DetailedError', () => {
  it('should create an error with basic properties', () => {
    const error = new DetailedError(
      ErrorCode.ELEMENT_NOT_FOUND,
      'Element not found: #btn'
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('DetailedError');
    expect(error.code).toBe(ErrorCode.ELEMENT_NOT_FOUND);
    expect(error.message).toContain('Element not found: #btn');
    expect(error.context).toEqual({});
    expect(error.suggestions).toEqual([]);
  });

  it('should include context', () => {
    const error = new DetailedError(
      ErrorCode.ELEMENT_NOT_FOUND,
      'Element not found',
      { selector: '#btn', expectedType: 'button' }
    );

    expect(error.context.selector).toBe('#btn');
    expect(error.context.expectedType).toBe('button');
  });

  it('should include suggestions in message', () => {
    const error = new DetailedError(
      ErrorCode.ELEMENT_NOT_FOUND,
      'Element not found',
      {},
      ['Try using a different selector', 'Run snapshot() first']
    );

    expect(error.message).toContain('Suggestions:');
    expect(error.message).toContain('Try using a different selector');
    expect(error.message).toContain('Run snapshot() first');
    expect(error.suggestions).toHaveLength(2);
  });

  describe('toJSON', () => {
    it('should convert error to structured object', () => {
      const error = new DetailedError(
        ErrorCode.ELEMENT_NOT_FOUND,
        'Element not found: #btn',
        { selector: '#btn' },
        ['Try another selector']
      );

      const json = error.toJSON();

      expect(json.name).toBe('DetailedError');
      expect(json.code).toBe(ErrorCode.ELEMENT_NOT_FOUND);
      expect(json.message).toContain('Element not found: #btn');
      expect(json.context).toEqual({ selector: '#btn' });
      expect(json.suggestions).toEqual(['Try another selector']);
    });
  });
});

describe('createElementNotFoundError', () => {
  it('should create basic element not found error', () => {
    const error = createElementNotFoundError('#btn');

    expect(error.code).toBe(ErrorCode.ELEMENT_NOT_FOUND);
    expect(error.message).toContain('Element not found: #btn');
    expect(error.context.selector).toBe('#btn');
  });

  it('should use REF_EXPIRED code for refs', () => {
    const error = createElementNotFoundError('@ref:5', { isRef: true });

    expect(error.code).toBe(ErrorCode.REF_EXPIRED);
    expect(error.suggestions).toContain('Ref may have expired. Refs are cleared on snapshot() calls and page navigation.');
    expect(error.suggestions).toContain('Call snapshot() again to get fresh refs.');
  });

  it('should include similar selectors suggestion', () => {
    const error = createElementNotFoundError('#submit-btn', {
      similarSelectors: [
        { selector: '#submit-button', role: 'button', name: 'Submit' },
        { selector: '#submitBtn', role: 'button', name: 'Submit' },
      ],
    });

    expect(error.context.similarSelectors).toHaveLength(2);
    expect(error.suggestions.some(s => s.includes('#submit-button'))).toBe(true);
  });

  it('should include nearby elements suggestion', () => {
    const error = createElementNotFoundError('#btn', {
      nearbyElements: [
        { ref: '@ref:1', role: 'button', name: 'Close' },
      ],
    });

    expect(error.context.nearbyElements).toHaveLength(1);
    expect(error.suggestions).toContain('Run snapshot({ interactive: true }) to see all clickable elements');
  });
});

describe('createElementNotCompatibleError', () => {
  it('should create element not compatible error', () => {
    const error = createElementNotCompatibleError(
      '#text',
      'check',
      'textbox',
      ['checkbox', 'radio']
    );

    expect(error.code).toBe(ErrorCode.ELEMENT_NOT_COMPATIBLE);
    expect(error.message).toContain('textbox');
    expect(error.message).toContain('cannot perform action: check');
    expect(error.context.selector).toBe('#text');
    expect(error.context.actualType).toBe('textbox');
    expect(error.context.expectedType).toBe('checkbox or radio');
  });

  it('should include available actions', () => {
    const error = createElementNotCompatibleError(
      '#text',
      'check',
      'textbox',
      ['checkbox'],
      ['fill', 'type', 'clear']
    );

    expect(error.context.availableActions).toEqual(['fill', 'type', 'clear']);
    expect(error.suggestions.some(s => s.includes('fill, type, clear'))).toBe(true);
  });

  it('should suggest using snapshot()', () => {
    const error = createElementNotCompatibleError('#el', 'click', 'static', ['button']);

    expect(error.suggestions).toContain('Use snapshot() to verify element type before attempting action');
  });
});

describe('createTimeoutError', () => {
  it('should create timeout error for element', () => {
    const error = createTimeoutError('#btn', 'visible');

    expect(error.code).toBe(ErrorCode.TIMEOUT);
    expect(error.message).toContain('Timeout waiting for #btn to be visible');
    expect(error.context.selector).toBe('#btn');
    expect(error.context.expectedType).toBe('visible');
  });

  it('should create timeout error without selector', () => {
    const error = createTimeoutError(undefined, 'idle');

    expect(error.message).toContain('Timeout waiting for page to be idle');
    expect(error.context.selector).toBeUndefined();
  });

  it('should suggest CSS check for attached but not visible', () => {
    const error = createTimeoutError('#btn', 'visible', {
      attached: true,
      visible: false,
      enabled: true,
    });

    expect(error.context.elementState).toEqual({
      attached: true,
      visible: false,
      enabled: true,
    });
    expect(error.suggestions.some(s => s.includes('CSS display/visibility'))).toBe(true);
    expect(error.suggestions.some(s => s.includes('state="attached"'))).toBe(true);
  });

  it('should suggest checking disabled attribute for visible but disabled', () => {
    const error = createTimeoutError('#btn', 'enabled', {
      attached: true,
      visible: true,
      enabled: false,
    });

    expect(error.suggestions.some(s => s.includes('disabled attribute'))).toBe(true);
    expect(error.suggestions.some(s => s.includes('force option'))).toBe(true);
  });

  it('should always suggest increasing timeout', () => {
    const error = createTimeoutError('#btn', 'visible');

    expect(error.suggestions).toContain('Increase timeout value if element appears slowly.');
  });
});

describe('createInvalidParametersError', () => {
  it('should create invalid parameters error', () => {
    const error = createInvalidParametersError(
      'Cannot use both selector and ref',
      ['selector', 'ref'],
      'Use only one of selector or ref'
    );

    expect(error.code).toBe(ErrorCode.INVALID_PARAMETERS);
    expect(error.message).toContain('Cannot use both selector and ref');
    expect(error.context.conflictingParams).toEqual(['selector', 'ref']);
    expect(error.suggestions).toContain('Use only one of selector or ref');
  });
});

describe('createVerificationError', () => {
  it('should create verification error for value check', () => {
    const error = createVerificationError('fill', {
      success: false,
      elapsed: 2000,
      attempts: 5,
      result: {
        success: false,
        expected: 'test value',
        actual: 'test val',
        description: 'Expected value "test value" but got "test val"',
      },
    }, '#input');

    expect(error.code).toBe(ErrorCode.VERIFICATION_FAILED);
    expect(error.message).toContain('fill verification failed for #input');
    expect(error.context.selector).toBe('#input');
    expect(error.context.expected).toBe('test value');
    expect(error.context.actual).toBe('test val');
    expect(error.context.elapsed).toBe(2000);
    expect(error.context.attempts).toBe(5);
    expect(error.suggestions.some(s => s.includes('event handlers'))).toBe(true);
    expect(error.suggestions.some(s => s.includes('2000ms'))).toBe(true);
  });

  it('should create verification error without selector', () => {
    const error = createVerificationError('navigate', {
      success: false,
      elapsed: 5000,
      attempts: 3,
      result: {
        success: false,
        expected: 'example.com',
        actual: 'login.example.com',
        description: 'Expected origin example.com but got login.example.com',
      },
    });

    expect(error.message).toContain('navigate verification failed');
    expect(error.message).not.toContain('for undefined');
    // When description includes 'origin', suggestions are about redirects
    expect(error.suggestions.some(s => s.includes('redirected'))).toBe(true);
    expect(error.suggestions.some(s => s.includes('domain'))).toBe(true);
  });

  it('should add checkbox suggestions for checked assertion', () => {
    const error = createVerificationError('check', {
      success: false,
      elapsed: 1000,
      attempts: 2,
      result: {
        success: false,
        expected: true,
        actual: false,
        description: 'Expected checked to be true but was false',
      },
    }, '#checkbox');

    expect(error.suggestions.some(s => s.includes('checkbox/radio'))).toBe(true);
    expect(error.suggestions.some(s => s.includes('disabled or read-only'))).toBe(true);
  });

  it('should add select suggestions for selected assertion', () => {
    const error = createVerificationError('select', {
      success: false,
      elapsed: 1000,
      attempts: 2,
      result: {
        success: false,
        expected: 'option-2',
        actual: 'option-1',
        description: 'Expected selected option "option-2" but was "option-1"',
      },
    }, '#select');

    expect(error.suggestions.some(s => s.includes('options may not exist'))).toBe(true);
    expect(error.suggestions.some(s => s.includes('snapshot()'))).toBe(true);
  });

  it('should include elapsed time and attempts in suggestions', () => {
    const error = createVerificationError('type', {
      success: false,
      elapsed: 3500,
      attempts: 7,
      result: {
        success: false,
        expected: 'hello',
        actual: 'helo',
        description: 'Expected value "hello" but got "helo"',
      },
    }, '#input');

    expect(error.suggestions.some(s => s.includes('3500ms') && s.includes('7 attempts'))).toBe(true);
  });
});
