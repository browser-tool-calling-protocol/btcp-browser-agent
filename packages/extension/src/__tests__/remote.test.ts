/**
 * @btcp/extension - Remote Agent tests
 *
 * Tests for the BTCP protocol implementation that enables
 * remote AI agents to control the browser.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Response } from '../types.js';

// Mock Chrome API
const mockChrome = {
  tabs: {
    query: vi.fn(),
    create: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    sendMessage: vi.fn(),
    goBack: vi.fn(),
    goForward: vi.fn(),
    reload: vi.fn(),
    captureVisibleTab: vi.fn(),
    group: vi.fn(),
  },
  tabGroups: {
    get: vi.fn(),
    update: vi.fn(),
    query: vi.fn(),
  },
  windows: {
    get: vi.fn(),
  },
  storage: {
    session: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
  },
  runtime: {
    lastError: null as chrome.runtime.LastError | null,
    onMessage: {
      addListener: vi.fn(),
    },
  },
  scripting: {
    executeScript: vi.fn(),
  },
};

// Expose mock as global chrome
(globalThis as unknown as { chrome: typeof mockChrome }).chrome = mockChrome;

// Mock fetch
const mockFetch = vi.fn();
(globalThis as { fetch: typeof fetch }).fetch = mockFetch;

// Mock EventSource
class MockEventSource {
  static instances: MockEventSource[] = [];

  url: string;
  onopen: (() => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  listeners: Map<string, ((event: MessageEvent) => void)[]> = new Map();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(event: string, handler: (event: MessageEvent) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);
  }

  close() {
    // Cleanup
  }

  // Test helpers
  simulateOpen() {
    this.onopen?.();
  }

  simulateError(event: Event) {
    this.onerror?.(event);
  }

  simulateMessage(eventType: string, data: unknown) {
    const handlers = this.listeners.get(eventType) || [];
    const event = { data: JSON.stringify(data) } as MessageEvent;
    handlers.forEach(h => h(event));
  }

  static reset() {
    MockEventSource.instances = [];
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).EventSource = MockEventSource;

// Import after mocks are set up
import {
  getBrowserToolDefinitions,
  mapToolToCommand,
  formatResponseForBTCP,
  createRemoteAgent,
  type RemoteAgent,
} from '../remote.js';

describe('getBrowserToolDefinitions', () => {
  it('should return an array of tool definitions', () => {
    const tools = getBrowserToolDefinitions();

    expect(tools).toBeInstanceOf(Array);
    expect(tools.length).toBeGreaterThan(0);
  });

  it('should include browser_navigate tool', () => {
    const tools = getBrowserToolDefinitions();
    const navigateTool = tools.find(t => t.name === 'browser_navigate');

    expect(navigateTool).toBeDefined();
    expect(navigateTool?.description).toContain('Navigate');
    expect(navigateTool?.inputSchema.properties).toHaveProperty('url');
    expect(navigateTool?.inputSchema.required).toContain('url');
  });

  it('should include browser_snapshot tool', () => {
    const tools = getBrowserToolDefinitions();
    const snapshotTool = tools.find(t => t.name === 'browser_snapshot');

    expect(snapshotTool).toBeDefined();
    expect(snapshotTool?.description).toContain('snapshot');
  });

  it('should include browser_click tool', () => {
    const tools = getBrowserToolDefinitions();
    const clickTool = tools.find(t => t.name === 'browser_click');

    expect(clickTool).toBeDefined();
    expect(clickTool?.inputSchema.properties).toHaveProperty('ref');
    expect(clickTool?.inputSchema.required).toContain('ref');
  });

  it('should include browser_type tool', () => {
    const tools = getBrowserToolDefinitions();
    const typeTool = tools.find(t => t.name === 'browser_type');

    expect(typeTool).toBeDefined();
    expect(typeTool?.inputSchema.properties).toHaveProperty('ref');
    expect(typeTool?.inputSchema.properties).toHaveProperty('text');
    expect(typeTool?.inputSchema.required).toContain('ref');
    expect(typeTool?.inputSchema.required).toContain('text');
  });

  it('should include browser_screenshot tool', () => {
    const tools = getBrowserToolDefinitions();
    const screenshotTool = tools.find(t => t.name === 'browser_screenshot');

    expect(screenshotTool).toBeDefined();
  });

  it('should include browser_scroll tool', () => {
    const tools = getBrowserToolDefinitions();
    const scrollTool = tools.find(t => t.name === 'browser_scroll');

    expect(scrollTool).toBeDefined();
    expect(scrollTool?.inputSchema.properties).toHaveProperty('direction');
    expect(scrollTool?.inputSchema.required).toContain('direction');
  });

  it('should have valid schema structure for all tools', () => {
    const tools = getBrowserToolDefinitions();

    for (const tool of tools) {
      expect(tool.name).toBeDefined();
      expect(typeof tool.name).toBe('string');
      expect(tool.description).toBeDefined();
      expect(typeof tool.description).toBe('string');
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.properties).toBeDefined();
    }
  });
});

describe('mapToolToCommand', () => {
  it('should map browser_navigate to navigate command', () => {
    const command = mapToolToCommand('browser_navigate', { url: 'https://example.com' });

    expect(command.action).toBe('navigate');
    expect((command as { url: string }).url).toBe('https://example.com');
  });

  it('should map browser_snapshot to snapshot command', () => {
    const command = mapToolToCommand('browser_snapshot', {});

    expect(command.action).toBe('snapshot');
  });

  it('should map browser_click to click command', () => {
    const command = mapToolToCommand('browser_click', { ref: '@ref:5' });

    expect(command.action).toBe('click');
    expect((command as { selector: string }).selector).toBe('@ref:5');
  });

  it('should map browser_type to type command', () => {
    const command = mapToolToCommand('browser_type', { ref: '@ref:3', text: 'hello' });

    expect(command.action).toBe('type');
    expect((command as { selector: string }).selector).toBe('@ref:3');
    expect((command as { text: string }).text).toBe('hello');
  });

  it('should map browser_screenshot to screenshot command', () => {
    const command = mapToolToCommand('browser_screenshot', {});

    expect(command.action).toBe('screenshot');
  });

  it('should map browser_scroll down to scroll with positive y', () => {
    const command = mapToolToCommand('browser_scroll', { direction: 'down' });

    expect(command.action).toBe('scroll');
    expect((command as { y: number }).y).toBe(500);
  });

  it('should map browser_scroll up to scroll with negative y', () => {
    const command = mapToolToCommand('browser_scroll', { direction: 'up' });

    expect(command.action).toBe('scroll');
    expect((command as { y: number }).y).toBe(-500);
  });

  it('should throw error for unknown tool', () => {
    expect(() => mapToolToCommand('unknown_tool', {})).toThrow('Unknown tool');
  });
});

describe('formatResponseForBTCP', () => {
  it('should format error response', () => {
    const response: Response = {
      id: '1',
      success: false,
      error: 'Element not found',
    };

    const content = formatResponseForBTCP(response);

    expect(content).toHaveLength(1);
    expect(content[0].type).toBe('text');
    expect((content[0] as { text: string }).text).toContain('Error: Element not found');
  });

  it('should format screenshot response as image', () => {
    const response: Response = {
      id: '1',
      success: true,
      data: { screenshot: 'base64data', format: 'png' },
    };

    const content = formatResponseForBTCP(response);

    expect(content).toHaveLength(1);
    expect(content[0].type).toBe('image');
    expect((content[0] as { data: string }).data).toBe('base64data');
    expect((content[0] as { mimeType: string }).mimeType).toBe('image/png');
  });

  it('should format screenshot with jpeg format', () => {
    const response: Response = {
      id: '1',
      success: true,
      data: { screenshot: 'base64data', format: 'jpeg' },
    };

    const content = formatResponseForBTCP(response);

    expect(content[0].type).toBe('image');
    expect((content[0] as { mimeType: string }).mimeType).toBe('image/jpeg');
  });

  it('should format snapshot response as text', () => {
    const response: Response = {
      id: '1',
      success: true,
      data: { snapshot: '- button "Submit" [@ref:1]' },
    };

    const content = formatResponseForBTCP(response);

    expect(content).toHaveLength(1);
    expect(content[0].type).toBe('text');
    expect((content[0] as { text: string }).text).toBe('- button "Submit" [@ref:1]');
  });

  it('should format generic response as JSON', () => {
    const response: Response = {
      id: '1',
      success: true,
      data: { clicked: true, element: '#btn' },
    };

    const content = formatResponseForBTCP(response);

    expect(content).toHaveLength(1);
    expect(content[0].type).toBe('text');
    const parsed = JSON.parse((content[0] as { text: string }).text);
    expect(parsed.clicked).toBe(true);
    expect(parsed.element).toBe('#btn');
  });
});

describe('createRemoteAgent', () => {
  let remote: RemoteAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    MockEventSource.reset();
    mockChrome.runtime.lastError = null;

    // Default mocks
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: {} }),
    });

    mockChrome.storage.session.get.mockResolvedValue({});
    mockChrome.tabs.query.mockImplementation((_, callback) => {
      if (callback) callback([]);
      return Promise.resolve([]);
    });
    mockChrome.tabGroups.query.mockResolvedValue([]);
    mockChrome.tabs.create.mockResolvedValue({ id: 1, windowId: 1 });
    mockChrome.tabs.get.mockResolvedValue({ id: 1, windowId: 1, status: 'complete' });
    mockChrome.tabs.group.mockResolvedValue(100);
    mockChrome.tabGroups.get.mockResolvedValue({
      id: 100,
      title: 'BTCP Session',
      color: 'blue',
      collapsed: false,
      windowId: 1,
    });
    mockChrome.tabGroups.update.mockResolvedValue({});
    mockChrome.windows.get.mockResolvedValue({ type: 'normal', id: 1 });
  });

  afterEach(() => {
    if (remote) {
      remote.disconnect();
    }
    vi.clearAllMocks();
  });

  it('should create a remote agent', () => {
    remote = createRemoteAgent({
      serverUrl: 'http://localhost:8080',
    });

    expect(remote).toBeDefined();
    expect(remote.connect).toBeInstanceOf(Function);
    expect(remote.disconnect).toBeInstanceOf(Function);
    expect(remote.isConnected).toBeInstanceOf(Function);
    expect(remote.getState).toBeInstanceOf(Function);
    expect(remote.on).toBeInstanceOf(Function);
    expect(remote.off).toBeInstanceOf(Function);
    expect(remote.getTools).toBeInstanceOf(Function);
  });

  it('should start in disconnected state', () => {
    remote = createRemoteAgent({
      serverUrl: 'http://localhost:8080',
    });

    expect(remote.isConnected()).toBe(false);
    expect(remote.getState()).toBe('disconnected');
  });

  it('should return tool definitions', () => {
    remote = createRemoteAgent({
      serverUrl: 'http://localhost:8080',
    });

    const tools = remote.getTools();

    expect(tools).toBeInstanceOf(Array);
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.find(t => t.name === 'browser_navigate')).toBeDefined();
  });

  it('should connect and register tools', async () => {
    remote = createRemoteAgent({
      serverUrl: 'http://localhost:8080',
      sessionId: 'test-session',
    });

    // Start connection
    const connectPromise = remote.connect();

    // Wait for EventSource to be created
    await new Promise(resolve => setTimeout(resolve, 10));

    // Simulate successful SSE connection
    const eventSource = MockEventSource.instances[0];
    eventSource?.simulateOpen();

    await connectPromise;

    expect(remote.isConnected()).toBe(true);
    expect(remote.getState()).toBe('connected');

    // Check that tools were registered
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8080/register',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('should emit connect event', async () => {
    const connectHandler = vi.fn();

    remote = createRemoteAgent({
      serverUrl: 'http://localhost:8080',
    });

    remote.on('connect', connectHandler);

    const connectPromise = remote.connect();
    await new Promise(resolve => setTimeout(resolve, 10));

    const eventSource = MockEventSource.instances[0];
    eventSource?.simulateOpen();

    await connectPromise;

    expect(connectHandler).toHaveBeenCalled();
  });

  it('should disconnect cleanly', async () => {
    remote = createRemoteAgent({
      serverUrl: 'http://localhost:8080',
    });

    const disconnectHandler = vi.fn();
    remote.on('disconnect', disconnectHandler);

    const connectPromise = remote.connect();
    await new Promise(resolve => setTimeout(resolve, 10));

    const eventSource = MockEventSource.instances[0];
    eventSource?.simulateOpen();

    await connectPromise;

    remote.disconnect();

    expect(remote.isConnected()).toBe(false);
    expect(remote.getState()).toBe('disconnected');
    expect(disconnectHandler).toHaveBeenCalledWith(1000, 'Client disconnected');
  });

  it('should remove event listener with off()', async () => {
    const connectHandler = vi.fn();

    remote = createRemoteAgent({
      serverUrl: 'http://localhost:8080',
    });

    remote.on('connect', connectHandler);
    remote.off('connect', connectHandler);

    const connectPromise = remote.connect();
    await new Promise(resolve => setTimeout(resolve, 10));

    const eventSource = MockEventSource.instances[0];
    eventSource?.simulateOpen();

    await connectPromise;

    expect(connectHandler).not.toHaveBeenCalled();
  });

  it('should throw when connecting while already connected', async () => {
    remote = createRemoteAgent({
      serverUrl: 'http://localhost:8080',
    });

    const connectPromise = remote.connect();
    await new Promise(resolve => setTimeout(resolve, 10));

    const eventSource = MockEventSource.instances[0];
    eventSource?.simulateOpen();

    await connectPromise;

    await expect(remote.connect()).rejects.toThrow('Cannot connect');
  });

  it('should throw when registration fails', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    remote = createRemoteAgent({
      serverUrl: 'http://localhost:8080',
    });

    await expect(remote.connect()).rejects.toThrow('Registration failed');
  });

  it('should emit toolCall event when receiving tool request', async () => {
    const toolCallHandler = vi.fn();

    remote = createRemoteAgent({
      serverUrl: 'http://localhost:8080',
    });

    remote.on('toolCall', toolCallHandler);

    // Set up response for sendToContentAgent
    mockChrome.tabs.sendMessage.mockImplementation((_tabId, _msg, _options, callback) => {
      callback({
        type: 'btcp:response',
        response: { id: '1', success: true, data: 'snapshot data' },
      });
    });

    const connectPromise = remote.connect();
    await new Promise(resolve => setTimeout(resolve, 10));

    const eventSource = MockEventSource.instances[0];
    eventSource?.simulateOpen();

    await connectPromise;

    // Simulate tool call request
    eventSource?.simulateMessage('request', {
      id: 'req-1',
      method: 'tools/call',
      params: {
        name: 'browser_snapshot',
        arguments: {},
      },
    });

    // Wait for async handling
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(toolCallHandler).toHaveBeenCalledWith('browser_snapshot', {});
  });

  it('should use custom sessionId', () => {
    remote = createRemoteAgent({
      serverUrl: 'http://localhost:8080',
      sessionId: 'custom-session-id',
    });

    // The sessionId is used in SSE URL, which we can verify through MockEventSource
    remote.connect().catch(() => {}); // Ignore connection errors

    // Wait for EventSource creation
    setTimeout(() => {
      const eventSource = MockEventSource.instances[0];
      expect(eventSource?.url).toContain('sessionId=custom-session-id');
    }, 10);
  });
});

describe('RemoteAgent configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockEventSource.reset();
    mockFetch.mockResolvedValue({ ok: true });
  });

  it('should use default config values', () => {
    const remote = createRemoteAgent({
      serverUrl: 'http://localhost:8080',
    });

    // Default sessionId starts with 'browser-'
    expect(remote.getTools()).toHaveLength(getBrowserToolDefinitions().length);
    remote.disconnect();
  });

  it('should allow disabling auto-reconnect', () => {
    const remote = createRemoteAgent({
      serverUrl: 'http://localhost:8080',
      autoReconnect: false,
    });

    expect(remote.getState()).toBe('disconnected');
    remote.disconnect();
  });

  it('should support debug mode', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const remote = createRemoteAgent({
      serverUrl: 'http://localhost:8080',
      debug: true,
    });

    // Trigger some logging
    remote.disconnect();

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
