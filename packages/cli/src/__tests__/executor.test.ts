/**
 * Executor tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeCommand, executeCommandString } from '../executor.js';
import { parseCommand } from '../parser.js';
import { CommandNotFoundError, ExecutionError, CLIError } from '../errors.js';
import type { CommandClient, ParsedCommand } from '../types.js';

/**
 * Create a mock client for testing
 */
function createMockClient(overrides: Partial<CommandClient> = {}): CommandClient {
  return {
    execute: vi.fn().mockResolvedValue({ id: '1', success: true }),
    navigate: vi.fn().mockResolvedValue({ id: '1', success: true }),
    back: vi.fn().mockResolvedValue({ id: '1', success: true }),
    forward: vi.fn().mockResolvedValue({ id: '1', success: true }),
    reload: vi.fn().mockResolvedValue({ id: '1', success: true }),
    getUrl: vi.fn().mockResolvedValue('https://example.com'),
    getTitle: vi.fn().mockResolvedValue('Example Page'),
    snapshot: vi.fn().mockResolvedValue({
      tree: '- button "Submit" [@ref:1]',
      refs: { '@ref:1': { selector: '#submit', role: 'button', name: 'Submit' } },
    }),
    click: vi.fn().mockResolvedValue({ id: '1', success: true }),
    type: vi.fn().mockResolvedValue({ id: '1', success: true }),
    fill: vi.fn().mockResolvedValue({ id: '1', success: true }),
    getText: vi.fn().mockResolvedValue('Hello'),
    isVisible: vi.fn().mockResolvedValue(true),
    screenshot: vi.fn().mockResolvedValue('data:image/png;base64,ABC123'),
    tabNew: vi.fn().mockResolvedValue({ tabId: 123, url: 'about:blank' }),
    tabClose: vi.fn().mockResolvedValue({ id: '1', success: true }),
    tabSwitch: vi.fn().mockResolvedValue({ id: '1', success: true }),
    tabList: vi.fn().mockResolvedValue([
      { id: 1, url: 'https://example.com', title: 'Example', active: true, index: 0 },
    ]),
    ...overrides,
  };
}

describe('executeCommand', () => {
  let client: CommandClient;

  beforeEach(() => {
    client = createMockClient();
  });

  describe('command lookup', () => {
    it('executes valid command', async () => {
      const command: ParsedCommand = {
        name: 'snapshot',
        args: [],
        flags: {},
        raw: 'snapshot',
      };
      const result = await executeCommand(client, command);
      expect(result.success).toBe(true);
      expect(client.snapshot).toHaveBeenCalled();
    });

    it('throws CommandNotFoundError for unknown command', async () => {
      const command: ParsedCommand = {
        name: 'unknowncommand',
        args: [],
        flags: {},
        raw: 'unknowncommand',
      };
      await expect(executeCommand(client, command)).rejects.toThrow(CommandNotFoundError);
    });

    it('includes similar commands in CommandNotFoundError', async () => {
      const command: ParsedCommand = {
        name: 'clck',
        args: [],
        flags: {},
        raw: 'clck',
      };
      try {
        await executeCommand(client, command);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CommandNotFoundError);
        const cmdError = error as CommandNotFoundError;
        expect(cmdError.suggestions).toBeDefined();
        expect(cmdError.suggestions?.some((s) => s.includes('click'))).toBe(true);
      }
    });
  });

  describe('command execution', () => {
    it('passes args to command handler', async () => {
      const command: ParsedCommand = {
        name: 'goto',
        args: ['https://example.com'],
        flags: {},
        raw: 'goto https://example.com',
      };
      await executeCommand(client, command);
      expect(client.navigate).toHaveBeenCalledWith('https://example.com');
    });

    it('passes flags to command handler', async () => {
      const command: ParsedCommand = {
        name: 'reload',
        args: [],
        flags: { hard: true },
        raw: 'reload --hard',
      };
      await executeCommand(client, command);
      expect(client.reload).toHaveBeenCalledWith({ bypassCache: true });
    });

    it('returns command result', async () => {
      const command: ParsedCommand = {
        name: 'url',
        args: [],
        flags: {},
        raw: 'url',
      };
      const result = await executeCommand(client, command);
      expect(result.success).toBe(true);
      expect(result.data).toBe('https://example.com');
    });
  });

  describe('error handling', () => {
    it('adds contextual suggestion on error result', async () => {
      client = createMockClient({
        click: vi.fn().mockResolvedValue({
          id: '1',
          success: false,
          error: 'Element not found',
        }),
      });
      const command: ParsedCommand = {
        name: 'click',
        args: ['@ref:5'],
        flags: {},
        raw: 'click @ref:5',
      };
      const result = await executeCommand(client, command);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Element not found');
      // Should include contextual suggestion
      expect(result.error).toContain('snapshot');
    });

    it('re-throws CLIError as-is', async () => {
      const cliError = new CLIError('Custom CLI error');
      client = createMockClient({
        click: vi.fn().mockRejectedValue(cliError),
      });
      const command: ParsedCommand = {
        name: 'click',
        args: ['@ref:1'],
        flags: {},
        raw: 'click @ref:1',
      };
      await expect(executeCommand(client, command)).rejects.toBe(cliError);
    });

    it('wraps unexpected errors in ExecutionError', async () => {
      const genericError = new Error('Network failure');
      client = createMockClient({
        navigate: vi.fn().mockRejectedValue(genericError),
      });
      const command: ParsedCommand = {
        name: 'goto',
        args: ['https://example.com'],
        flags: {},
        raw: 'goto https://example.com',
      };
      try {
        await executeCommand(client, command);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ExecutionError);
        const execError = error as ExecutionError;
        expect(execError.message).toContain('Network failure');
        expect(execError.command).toBe('goto');
      }
    });

    it('includes contextual suggestion in wrapped error', async () => {
      const genericError = new Error('Failed to navigate');
      client = createMockClient({
        navigate: vi.fn().mockRejectedValue(genericError),
      });
      const command: ParsedCommand = {
        name: 'goto',
        args: ['example.com'],
        flags: {},
        raw: 'goto example.com',
      };
      try {
        await executeCommand(client, command);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ExecutionError);
        const execError = error as ExecutionError;
        // Should include suggestion about URL format
        expect(execError.suggestions).toBeDefined();
      }
    });
  });

  describe('result passthrough', () => {
    it('returns success result unchanged when no error', async () => {
      const command: ParsedCommand = {
        name: 'snapshot',
        args: [],
        flags: {},
        raw: 'snapshot',
      };
      const result = await executeCommand(client, command);
      expect(result.success).toBe(true);
      expect(result.data).toContain('button');
    });

    it('returns error result from command handler', async () => {
      client = createMockClient({
        click: vi.fn().mockResolvedValue({
          id: '1',
          success: false,
          error: 'Failed',
        }),
      });
      const command: ParsedCommand = {
        name: 'click',
        args: ['@ref:1'],
        flags: {},
        raw: 'click @ref:1',
      };
      const result = await executeCommand(client, command);
      // Command handler transforms result, doesn't preserve raw data
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed');
    });
  });
});

describe('executeCommandString', () => {
  let client: CommandClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('parses and executes command string', async () => {
    const result = await executeCommandString(
      client,
      'goto https://example.com',
      parseCommand
    );
    expect(result.success).toBe(true);
    expect(client.navigate).toHaveBeenCalledWith('https://example.com');
  });

  it('handles parse errors', async () => {
    await expect(
      executeCommandString(client, '', parseCommand)
    ).rejects.toThrow('Empty command');
  });

  it('uses custom parser', async () => {
    const customParser = vi.fn().mockReturnValue({
      name: 'snapshot',
      args: [],
      flags: {},
      raw: 'custom',
    });
    await executeCommandString(client, 'custom', customParser);
    expect(customParser).toHaveBeenCalledWith('custom');
    expect(client.snapshot).toHaveBeenCalled();
  });
});
