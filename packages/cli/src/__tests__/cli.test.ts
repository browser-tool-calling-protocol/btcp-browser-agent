/**
 * CLI integration tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCLI } from '../index.js';
import type { CommandClient, CommandResult } from '../types.js';

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

describe('createCLI', () => {
  let client: CommandClient;
  let cli: ReturnType<typeof createCLI>;

  beforeEach(() => {
    client = createMockClient();
    cli = createCLI(client);
  });

  describe('execute - single commands', () => {
    it('executes goto command', async () => {
      const result = await cli.execute('goto https://example.com');
      expect(result.success).toBe(true);
      expect(client.navigate).toHaveBeenCalledWith('https://example.com');
    });

    it('executes snapshot command', async () => {
      const result = await cli.execute('snapshot');
      expect(result.success).toBe(true);
      expect(client.snapshot).toHaveBeenCalled();
    });

    it('executes click command', async () => {
      const result = await cli.execute('click @ref:1');
      expect(result.success).toBe(true);
      expect(client.click).toHaveBeenCalledWith('@ref:1', { button: undefined });
    });

    it('executes type command', async () => {
      const result = await cli.execute('type @ref:1 "hello world"');
      expect(result.success).toBe(true);
      expect(client.type).toHaveBeenCalledWith('@ref:1', 'hello world', expect.any(Object));
    });

    it('executes help command', async () => {
      const result = await cli.execute('help');
      expect(result.success).toBe(true);
      expect(result.data).toContain('Commands');
    });

    it('returns empty result for empty input', async () => {
      const result = await cli.execute('');
      expect(result.success).toBe(true);
      expect(result.message).toBe('');
    });

    it('returns empty result for whitespace input', async () => {
      const result = await cli.execute('   ');
      expect(result.success).toBe(true);
    });

    it('handles unknown commands', async () => {
      const result = await cli.execute('unknowncommand');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown command');
    });

    it('includes suggestions for typos', async () => {
      const result = await cli.execute('clck @ref:1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('click');
    });
  });

  describe('execute - multi-line commands', () => {
    it('executes multiple commands', async () => {
      const result = await cli.execute(`
        goto https://example.com
        snapshot
      `);
      expect(result.success).toBe(true);
      expect(client.navigate).toHaveBeenCalled();
      expect(client.snapshot).toHaveBeenCalled();
    });

    it('stops on first error', async () => {
      client = createMockClient({
        navigate: vi.fn().mockResolvedValue({ id: '1', success: false, error: 'Failed' }),
      });
      cli = createCLI(client);

      const result = await cli.execute(`
        goto https://example.com
        snapshot
      `);
      expect(result.success).toBe(false);
      expect(client.snapshot).not.toHaveBeenCalled();
    });

    it('skips comment lines', async () => {
      const result = await cli.execute(`
        # Navigate first
        goto https://example.com
        # Then take snapshot
        snapshot
      `);
      expect(result.success).toBe(true);
      expect(client.navigate).toHaveBeenCalled();
      expect(client.snapshot).toHaveBeenCalled();
    });

    it('skips empty lines', async () => {
      const result = await cli.execute(`
        goto https://example.com

        snapshot
      `);
      expect(result.success).toBe(true);
    });

    it('returns last result data on success', async () => {
      const result = await cli.execute(`
        goto https://example.com
        snapshot
      `);
      expect(result.data).toContain('button');
    });

    it('includes failure index in error data', async () => {
      // Use click which properly handles error results, not snapshot
      client = createMockClient({
        click: vi.fn().mockResolvedValue({ id: '1', success: false, error: 'Element not found' }),
      });
      cli = createCLI(client);

      const result = await cli.execute(`
        goto https://example.com
        click @ref:1
      `);
      expect(result.success).toBe(false);
      expect(result.data).toHaveProperty('failedAt', 1);
    });
  });

  describe('executeAll', () => {
    it('returns batch result', async () => {
      const result = await cli.executeAll(`
        goto https://example.com
        snapshot
      `);
      expect(result.allSucceeded).toBe(true);
      expect(result.results.length).toBe(2);
      expect(result.executed).toBe(2);
      expect(result.firstFailedIndex).toBe(-1);
    });

    it('stops on error by default', async () => {
      client = createMockClient({
        navigate: vi.fn().mockResolvedValue({ id: '1', success: false, error: 'Failed' }),
      });
      cli = createCLI(client);

      const result = await cli.executeAll(`
        goto https://example.com
        snapshot
        click @ref:1
      `);
      expect(result.allSucceeded).toBe(false);
      expect(result.executed).toBe(1);
      expect(result.firstFailedIndex).toBe(0);
    });

    it('continues on error with flag', async () => {
      client = createMockClient({
        navigate: vi.fn().mockResolvedValue({ id: '1', success: false, error: 'Failed' }),
      });
      cli = createCLI(client);

      const result = await cli.executeAll(
        `
          goto https://example.com
          snapshot
          click @ref:1
        `,
        { continueOnError: true }
      );
      expect(result.allSucceeded).toBe(false);
      expect(result.executed).toBe(3);
      expect(result.firstFailedIndex).toBe(0);
    });

    it('returns empty result for empty input', async () => {
      const result = await cli.executeAll('');
      expect(result.allSucceeded).toBe(true);
      expect(result.results).toHaveLength(0);
      expect(result.executed).toBe(0);
    });
  });

  describe('getCommands', () => {
    it('returns all commands', () => {
      const commands = cli.getCommands();
      expect(commands.length).toBeGreaterThan(0);
      expect(commands.find((c) => c.name === 'goto')).toBeDefined();
      expect(commands.find((c) => c.name === 'click')).toBeDefined();
      expect(commands.find((c) => c.name === 'snapshot')).toBeDefined();
    });

    it('each command has required fields', () => {
      const commands = cli.getCommands();
      for (const cmd of commands) {
        expect(cmd.name).toBeDefined();
        expect(cmd.description).toBeDefined();
        expect(cmd.usage).toBeDefined();
        expect(cmd.execute).toBeInstanceOf(Function);
      }
    });
  });

  describe('getHelp', () => {
    it('returns general help', () => {
      const help = cli.getHelp();
      expect(help).toContain('Commands');
      expect(help).toContain('goto');
      expect(help).toContain('click');
    });

    it('returns command-specific help', () => {
      const help = cli.getHelp('goto');
      expect(help).toContain('goto');
      expect(help).toContain('Navigate');
    });

    it('returns error for unknown command', () => {
      const help = cli.getHelp('unknowncommand');
      expect(help).toContain('Unknown');
    });
  });
});

describe('command execution', () => {
  let client: CommandClient;
  let cli: ReturnType<typeof createCLI>;

  beforeEach(() => {
    client = createMockClient();
    cli = createCLI(client);
  });

  describe('navigation commands', () => {
    it('goto adds https if missing', async () => {
      await cli.execute('goto example.com');
      expect(client.navigate).toHaveBeenCalledWith('https://example.com');
    });

    it('goto preserves existing protocol', async () => {
      await cli.execute('goto http://example.com');
      expect(client.navigate).toHaveBeenCalledWith('http://example.com');
    });

    it('back calls client.back', async () => {
      await cli.execute('back');
      expect(client.back).toHaveBeenCalled();
    });

    it('forward calls client.forward', async () => {
      await cli.execute('forward');
      expect(client.forward).toHaveBeenCalled();
    });

    it('reload calls client.reload', async () => {
      await cli.execute('reload');
      expect(client.reload).toHaveBeenCalled();
    });

    it('reload --hard passes bypassCache', async () => {
      await cli.execute('reload --hard');
      expect(client.reload).toHaveBeenCalledWith({ bypassCache: true });
    });
  });

  describe('interaction commands', () => {
    it('click with right button', async () => {
      await cli.execute('click @ref:1 --button right');
      expect(client.click).toHaveBeenCalledWith('@ref:1', { button: 'right' });
    });

    it('type with delay', async () => {
      await cli.execute('type @ref:1 hello --delay 50');
      expect(client.type).toHaveBeenCalledWith('@ref:1', 'hello', expect.objectContaining({ delay: 50 }));
    });

    it('type with clear flag', async () => {
      await cli.execute('type @ref:1 hello --clear');
      expect(client.type).toHaveBeenCalledWith('@ref:1', 'hello', expect.objectContaining({ clear: true }));
    });

    it('fill sets value', async () => {
      await cli.execute('fill @ref:1 "test value"');
      expect(client.fill).toHaveBeenCalledWith('@ref:1', 'test value');
    });
  });

  describe('tab commands', () => {
    it('tabs lists tabs', async () => {
      const result = await cli.execute('tabs');
      expect(result.success).toBe(true);
      expect(client.tabList).toHaveBeenCalled();
    });

    it('newtab opens new tab', async () => {
      await cli.execute('newtab');
      expect(client.tabNew).toHaveBeenCalled();
    });

    it('newtab with URL', async () => {
      await cli.execute('newtab https://example.com');
      expect(client.tabNew).toHaveBeenCalledWith(expect.objectContaining({
        url: 'https://example.com',
      }));
    });

    it('newtab --background', async () => {
      await cli.execute('newtab --background');
      expect(client.tabNew).toHaveBeenCalledWith(expect.objectContaining({
        active: false,
      }));
    });

    it('tab switches to tab', async () => {
      await cli.execute('tab 123');
      expect(client.tabSwitch).toHaveBeenCalledWith(123);
    });

    it('closetab closes current tab', async () => {
      await cli.execute('closetab');
      expect(client.tabClose).toHaveBeenCalledWith(undefined);
    });

    it('closetab closes specific tab', async () => {
      await cli.execute('closetab 123');
      expect(client.tabClose).toHaveBeenCalledWith(123);
    });
  });

  describe('inspection commands', () => {
    it('snapshot returns tree', async () => {
      const result = await cli.execute('snapshot');
      expect(result.success).toBe(true);
      expect(result.data).toContain('button');
    });

    it('screenshot returns data URL', async () => {
      const result = await cli.execute('screenshot');
      expect(result.success).toBe(true);
      expect(result.data).toContain('data:image');
    });

    it('url returns current URL', async () => {
      const result = await cli.execute('url');
      expect(result.success).toBe(true);
      expect(result.data).toBe('https://example.com');
    });

    it('title returns page title', async () => {
      const result = await cli.execute('title');
      expect(result.success).toBe(true);
      expect(result.data).toBe('Example Page');
    });

    it('text returns element text', async () => {
      const result = await cli.execute('text @ref:1');
      expect(result.success).toBe(true);
      expect(result.data).toBe('Hello');
    });
  });
});

describe('error handling', () => {
  it('handles client errors gracefully', async () => {
    const client = createMockClient({
      navigate: vi.fn().mockRejectedValue(new Error('Network error')),
    });
    const cli = createCLI(client);

    const result = await cli.execute('goto https://example.com');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Network error');
  });

  it('handles missing arguments', async () => {
    const client = createMockClient();
    const cli = createCLI(client);

    const result = await cli.execute('goto');
    expect(result.success).toBe(false);
    expect(result.error).toContain('URL required');
  });

  it('handles invalid tab ID', async () => {
    const client = createMockClient();
    const cli = createCLI(client);

    const result = await cli.execute('tab notanumber');
    expect(result.success).toBe(false);
  });
});
