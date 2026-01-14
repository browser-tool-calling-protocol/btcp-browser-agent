/**
 * Tests for protocol.ts - Command parsing and response handling
 */

import { describe, it, expect } from 'vitest';
import {
  parseCommand,
  successResponse,
  errorResponse,
  serializeResponse,
  generateCommandId,
} from './protocol.js';

describe('protocol', () => {
  describe('parseCommand', () => {
    it('should parse valid click command', () => {
      const cmd = parseCommand({
        id: 'cmd1',
        action: 'click',
        selector: 'button',
      });

      expect('error' in cmd).toBe(false);
      if (!('error' in cmd)) {
        expect(cmd.action).toBe('click');
        expect(cmd.id).toBe('cmd1');
      }
    });

    it('should parse valid navigate command', () => {
      const cmd = parseCommand({
        id: 'cmd2',
        action: 'navigate',
        url: 'https://example.com',
      });

      expect('error' in cmd).toBe(false);
      if (!('error' in cmd)) {
        expect(cmd.action).toBe('navigate');
      }
    });

    it('should parse valid type command', () => {
      const cmd = parseCommand({
        id: 'cmd3',
        action: 'type',
        selector: 'input',
        text: 'Hello',
        delay: 50,
        clear: true,
      });

      expect('error' in cmd).toBe(false);
      if (!('error' in cmd)) {
        expect(cmd.action).toBe('type');
      }
    });

    it('should parse valid fill command', () => {
      const cmd = parseCommand({
        id: 'cmd4',
        action: 'fill',
        selector: 'input',
        value: 'test value',
      });

      expect('error' in cmd).toBe(false);
      if (!('error' in cmd)) {
        expect(cmd.action).toBe('fill');
      }
    });

    it('should parse valid snapshot command', () => {
      const cmd = parseCommand({
        id: 'cmd5',
        action: 'snapshot',
        interactive: true,
        maxDepth: 5,
        compact: true,
      });

      expect('error' in cmd).toBe(false);
      if (!('error' in cmd)) {
        expect(cmd.action).toBe('snapshot');
      }
    });

    it('should parse valid evaluate command', () => {
      const cmd = parseCommand({
        id: 'cmd6',
        action: 'evaluate',
        script: 'document.title',
      });

      expect('error' in cmd).toBe(false);
      if (!('error' in cmd)) {
        expect(cmd.action).toBe('evaluate');
      }
    });

    it('should parse valid wait command', () => {
      const cmd = parseCommand({
        id: 'cmd7',
        action: 'wait',
        selector: '.loading',
        state: 'hidden',
        timeout: 5000,
      });

      expect('error' in cmd).toBe(false);
      if (!('error' in cmd)) {
        expect(cmd.action).toBe('wait');
      }
    });

    it('should parse valid scroll command', () => {
      const cmd = parseCommand({
        id: 'cmd8',
        action: 'scroll',
        direction: 'down',
        amount: 500,
      });

      expect('error' in cmd).toBe(false);
      if (!('error' in cmd)) {
        expect(cmd.action).toBe('scroll');
      }
    });

    it('should parse valid storage commands', () => {
      const getCmd = parseCommand({
        id: 'cmd9',
        action: 'storage_get',
        type: 'local',
        key: 'myKey',
      });

      const setCmd = parseCommand({
        id: 'cmd10',
        action: 'storage_set',
        type: 'session',
        key: 'myKey',
        value: 'myValue',
      });

      expect('error' in getCmd).toBe(false);
      expect('error' in setCmd).toBe(false);
    });

    it('should parse valid semantic locator commands', () => {
      const byRole = parseCommand({
        id: 'cmd11',
        action: 'getbyrole',
        role: 'button',
        name: 'Submit',
        subaction: 'click',
      });

      const byText = parseCommand({
        id: 'cmd12',
        action: 'getbytext',
        text: 'Click here',
        exact: true,
        subaction: 'click',
      });

      const byLabel = parseCommand({
        id: 'cmd13',
        action: 'getbylabel',
        label: 'Email',
        subaction: 'fill',
        value: 'test@example.com',
      });

      expect('error' in byRole).toBe(false);
      expect('error' in byText).toBe(false);
      expect('error' in byLabel).toBe(false);
    });

    it('should parse valid input injection commands', () => {
      const mouseCmd = parseCommand({
        id: 'cmd14',
        action: 'input_mouse',
        type: 'mousePressed',
        x: 100,
        y: 200,
        button: 'left',
      });

      const keyboardCmd = parseCommand({
        id: 'cmd15',
        action: 'input_keyboard',
        type: 'keyDown',
        key: 'Enter',
      });

      const touchCmd = parseCommand({
        id: 'cmd16',
        action: 'input_touch',
        type: 'touchStart',
        touchPoints: [{ x: 100, y: 200 }],
      });

      expect('error' in mouseCmd).toBe(false);
      expect('error' in keyboardCmd).toBe(false);
      expect('error' in touchCmd).toBe(false);
    });

    it('should parse JSON string input', () => {
      const cmd = parseCommand(
        JSON.stringify({
          id: 'cmd17',
          action: 'click',
          selector: 'button',
        })
      );

      expect('error' in cmd).toBe(false);
      if (!('error' in cmd)) {
        expect(cmd.action).toBe('click');
      }
    });

    it('should return error for invalid JSON', () => {
      const cmd = parseCommand('not valid json');

      expect('error' in cmd).toBe(true);
      if ('error' in cmd) {
        expect(cmd.error).toBe('Invalid JSON');
      }
    });

    it('should return error for unknown action', () => {
      const cmd = parseCommand({
        id: 'cmd18',
        action: 'unknown_action',
      });

      expect('error' in cmd).toBe(true);
    });

    it('should return error for missing required fields', () => {
      const cmd = parseCommand({
        id: 'cmd19',
        action: 'click',
        // missing selector
      });

      expect('error' in cmd).toBe(true);
    });

    it('should include command id in error response', () => {
      const cmd = parseCommand({
        id: 'error-cmd',
        action: 'click',
        // missing selector
      });

      expect('error' in cmd).toBe(true);
      if ('error' in cmd) {
        expect(cmd.id).toBe('error-cmd');
      }
    });

    it('should parse simple action commands', () => {
      const actions = ['back', 'forward', 'reload', 'url', 'title'];

      for (const action of actions) {
        const cmd = parseCommand({ id: `cmd-${action}`, action });
        expect('error' in cmd).toBe(false);
      }
    });
  });

  describe('successResponse', () => {
    it('should create success response with data', () => {
      const response = successResponse('cmd1', { clicked: true });

      expect(response.id).toBe('cmd1');
      expect(response.success).toBe(true);
      expect(response.data).toEqual({ clicked: true });
    });

    it('should handle complex data', () => {
      const response = successResponse('cmd2', {
        snapshot: '- button "Click"',
        refs: { e1: { role: 'button', name: 'Click' } },
      });

      expect(response.success).toBe(true);
      expect(response.data.snapshot).toContain('button');
    });
  });

  describe('errorResponse', () => {
    it('should create error response', () => {
      const response = errorResponse('cmd1', 'Element not found');

      expect(response.id).toBe('cmd1');
      expect(response.success).toBe(false);
      expect(response.error).toBe('Element not found');
    });
  });

  describe('serializeResponse', () => {
    it('should serialize success response to JSON', () => {
      const response = successResponse('cmd1', { clicked: true });
      const json = serializeResponse(response);

      expect(json).toBe('{"id":"cmd1","success":true,"data":{"clicked":true}}');
    });

    it('should serialize error response to JSON', () => {
      const response = errorResponse('cmd1', 'Error message');
      const json = serializeResponse(response);

      expect(json).toBe('{"id":"cmd1","success":false,"error":"Error message"}');
    });

    it('should be parseable back to object', () => {
      const original = successResponse('cmd1', { value: 42 });
      const json = serializeResponse(original);
      const parsed = JSON.parse(json);

      expect(parsed).toEqual(original);
    });
  });

  describe('generateCommandId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateCommandId();
      const id2 = generateCommandId();

      expect(id1).not.toBe(id2);
    });

    it('should start with cmd_ prefix', () => {
      const id = generateCommandId();

      expect(id.startsWith('cmd_')).toBe(true);
    });

    it('should include timestamp', () => {
      const before = Date.now();
      const id = generateCommandId();
      const after = Date.now();

      // Extract timestamp from ID
      const parts = id.split('_');
      const timestamp = parseInt(parts[1], 10);

      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });
});
