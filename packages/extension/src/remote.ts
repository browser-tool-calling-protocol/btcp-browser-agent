/**
 * @btcp/extension - Remote Control via BTCP Protocol
 *
 * Enables remote AI agents to control the browser via the Browser Tool Calling Protocol.
 * Uses SSE for receiving commands and HTTP POST for sending results.
 *
 * @example
 * ```typescript
 * import { createRemoteAgent } from '@btcp/browser-agent/extension';
 *
 * const remote = createRemoteAgent({
 *   serverUrl: 'http://localhost:8080',
 *   sessionId: 'my-session',
 * });
 *
 * await remote.connect();
 * // Browser is now controllable by the BTCP server
 * ```
 */

import type { Command, Response } from './types.js';
import { getBackgroundAgent, type BackgroundAgent } from './background.js';

// ============================================================================
// BTCP Protocol Types (from btcp-client)
// ============================================================================

/**
 * BTCP tool definition schema
 */
export interface BTCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * BTCP content types for tool responses
 */
export type BTCPContent =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'resource'; uri: string; mimeType?: string; text?: string };

/**
 * BTCP client configuration
 */
export interface RemoteAgentConfig {
  /** BTCP server URL */
  serverUrl: string;

  /** Session ID for this browser instance */
  sessionId?: string;

  /** Enable auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;

  /** Reconnect delay in ms (default: 1000) */
  reconnectDelay?: number;

  /** Max reconnect attempts (default: 10) */
  maxReconnectAttempts?: number;

  /** Connection timeout in ms (default: 30000) */
  connectionTimeout?: number;

  /** Enable debug logging (default: false) */
  debug?: boolean;
}

/**
 * BTCP client events
 */
export interface RemoteAgentEvents {
  connect: () => void;
  disconnect: (code?: number, reason?: string) => void;
  error: (error: Error) => void;
  toolCall: (name: string, args: Record<string, unknown>) => void;
}

// ============================================================================
// Browser Tool Definitions
// ============================================================================

/**
 * Get all browser tool definitions for BTCP registration
 */
export function getBrowserToolDefinitions(): BTCPToolDefinition[] {
  return [
    // Navigation tools
    {
      name: 'browser_navigate',
      description: 'Navigate to a URL in the current tab',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to navigate to' },
          waitUntil: {
            type: 'string',
            enum: ['load', 'domcontentloaded'],
            description: 'Wait until page load event (default: load)',
          },
        },
        required: ['url'],
      },
    },
    {
      name: 'browser_back',
      description: 'Go back in browser history',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'browser_forward',
      description: 'Go forward in browser history',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'browser_reload',
      description: 'Reload the current page',
      inputSchema: {
        type: 'object',
        properties: {
          bypassCache: { type: 'boolean', description: 'Bypass browser cache' },
        },
      },
    },

    // DOM interaction tools
    {
      name: 'browser_snapshot',
      description:
        'Get accessibility tree snapshot of the page. Returns a text representation with element refs (@ref:N) that can be used in other commands.',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector to scope the snapshot' },
          maxDepth: { type: 'number', description: 'Maximum tree depth to traverse' },
          mode: {
            type: 'string',
            enum: ['interactive', 'outline', 'content'],
            description: 'Snapshot mode: interactive (actionable elements), outline (structure), content (text)',
          },
        },
      },
    },
    {
      name: 'browser_click',
      description: 'Click an element by CSS selector or element ref (@ref:N from snapshot)',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector or @ref:N' },
        },
        required: ['selector'],
      },
    },
    {
      name: 'browser_type',
      description: 'Type text into an input element (appends to existing value)',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector or @ref:N' },
          text: { type: 'string', description: 'Text to type' },
          clear: { type: 'boolean', description: 'Clear existing value before typing' },
        },
        required: ['selector', 'text'],
      },
    },
    {
      name: 'browser_fill',
      description: 'Fill an input element (replaces existing value)',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector or @ref:N' },
          value: { type: 'string', description: 'Value to fill' },
        },
        required: ['selector', 'value'],
      },
    },
    {
      name: 'browser_select',
      description: 'Select an option from a dropdown',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector or @ref:N of the select element' },
          value: { type: 'string', description: 'Option value to select' },
        },
        required: ['selector', 'value'],
      },
    },
    {
      name: 'browser_check',
      description: 'Check a checkbox or radio button',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector or @ref:N' },
        },
        required: ['selector'],
      },
    },
    {
      name: 'browser_uncheck',
      description: 'Uncheck a checkbox',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector or @ref:N' },
        },
        required: ['selector'],
      },
    },
    {
      name: 'browser_hover',
      description: 'Hover over an element',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector or @ref:N' },
        },
        required: ['selector'],
      },
    },
    {
      name: 'browser_scroll',
      description: 'Scroll the page or an element',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector or @ref:N (optional, scrolls window if omitted)' },
          x: { type: 'number', description: 'Horizontal scroll amount in pixels' },
          y: { type: 'number', description: 'Vertical scroll amount in pixels' },
        },
      },
    },
    {
      name: 'browser_getText',
      description: 'Get text content of an element',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector or @ref:N' },
        },
        required: ['selector'],
      },
    },
    {
      name: 'browser_getAttribute',
      description: 'Get an attribute value from an element',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector or @ref:N' },
          attribute: { type: 'string', description: 'Attribute name to get' },
        },
        required: ['selector', 'attribute'],
      },
    },
    {
      name: 'browser_isVisible',
      description: 'Check if an element is visible',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector or @ref:N' },
        },
        required: ['selector'],
      },
    },

    // Screenshot tool
    {
      name: 'browser_screenshot',
      description: 'Capture a screenshot of the visible tab',
      inputSchema: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: ['png', 'jpeg'], description: 'Image format' },
          quality: { type: 'number', description: 'JPEG quality (0-100)' },
        },
      },
    },

    // Tab management tools
    {
      name: 'browser_tab_new',
      description: 'Open a new tab',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to open (optional)' },
          active: { type: 'boolean', description: 'Make the new tab active (default: true)' },
        },
      },
    },
    {
      name: 'browser_tab_close',
      description: 'Close a tab',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: { type: 'number', description: 'Tab ID to close (optional, closes active tab if omitted)' },
        },
      },
    },
    {
      name: 'browser_tab_switch',
      description: 'Switch to a different tab',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: { type: 'number', description: 'Tab ID to switch to' },
        },
        required: ['tabId'],
      },
    },
    {
      name: 'browser_tab_list',
      description: 'List all tabs in the current session',
      inputSchema: { type: 'object', properties: {} },
    },

    // Keyboard tools
    {
      name: 'browser_press',
      description: 'Press a keyboard key (e.g., Enter, Tab, Escape)',
      inputSchema: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Key to press (e.g., "Enter", "Tab", "Escape", "ArrowDown")' },
          selector: { type: 'string', description: 'Optional element to focus before pressing' },
        },
        required: ['key'],
      },
    },

    // Script injection tools
    {
      name: 'browser_script_inject',
      description:
        "Inject JavaScript code into the page's main world. The script can listen for commands via btcp:script-command messages and respond with btcp:script-ack.",
      inputSchema: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'JavaScript code to inject' },
          scriptId: {
            type: 'string',
            description: 'Unique identifier for this script (default: "default"). Used to target with script_send.',
          },
        },
        required: ['code'],
      },
    },
    {
      name: 'browser_script_send',
      description:
        'Send a command to an injected script and wait for acknowledgment. The injected script should listen for btcp:script-command and respond with btcp:script-ack.',
      inputSchema: {
        type: 'object',
        properties: {
          payload: {
            type: 'object',
            description: 'Payload to send to the script. Typically includes an "action" field.',
          },
          scriptId: { type: 'string', description: 'Target script ID (default: "default")' },
          timeout: { type: 'number', description: 'Timeout in milliseconds (default: 30000)' },
        },
        required: ['payload'],
      },
    },

    // Wait tools
    {
      name: 'browser_wait',
      description: 'Wait for a specified duration or condition',
      inputSchema: {
        type: 'object',
        properties: {
          ms: { type: 'number', description: 'Milliseconds to wait' },
          selector: { type: 'string', description: 'Wait for this selector to appear' },
          timeout: { type: 'number', description: 'Max wait time for selector (default: 30000)' },
        },
      },
    },

    // Evaluate tool
    {
      name: 'browser_evaluate',
      description: 'Evaluate JavaScript expression in the page context and return the result',
      inputSchema: {
        type: 'object',
        properties: {
          expression: { type: 'string', description: 'JavaScript expression to evaluate' },
        },
        required: ['expression'],
      },
    },
  ];
}

// ============================================================================
// Tool Name to Command Mapping
// ============================================================================

/**
 * Map BTCP tool name and arguments to browser-agent Command
 */
export function mapToolToCommand(
  toolName: string,
  args: Record<string, unknown>
): Command {
  // Remove 'browser_' prefix and convert to action
  const actionMap: Record<string, string> = {
    browser_navigate: 'navigate',
    browser_back: 'back',
    browser_forward: 'forward',
    browser_reload: 'reload',
    browser_snapshot: 'snapshot',
    browser_click: 'click',
    browser_type: 'type',
    browser_fill: 'fill',
    browser_select: 'select',
    browser_check: 'check',
    browser_uncheck: 'uncheck',
    browser_hover: 'hover',
    browser_scroll: 'scroll',
    browser_getText: 'getText',
    browser_getAttribute: 'getAttribute',
    browser_isVisible: 'isVisible',
    browser_screenshot: 'screenshot',
    browser_tab_new: 'tabNew',
    browser_tab_close: 'tabClose',
    browser_tab_switch: 'tabSwitch',
    browser_tab_list: 'tabList',
    browser_press: 'press',
    browser_script_inject: 'scriptInject',
    browser_script_send: 'scriptSend',
    browser_wait: 'wait',
    browser_evaluate: 'evaluate',
  };

  const action = actionMap[toolName];
  if (!action) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  return { action, ...args } as Command;
}

/**
 * Format response for BTCP protocol
 */
export function formatResponseForBTCP(response: Response): BTCPContent[] {
  if (!response.success) {
    return [{ type: 'text', text: `Error: ${response.error}` }];
  }

  const data = response.data;

  // Handle screenshot - return as image
  if (data && typeof data === 'object' && 'screenshot' in data) {
    const format = (data as { format?: string }).format || 'png';
    return [
      {
        type: 'image',
        data: (data as { screenshot: string }).screenshot,
        mimeType: `image/${format}`,
      },
    ];
  }

  // Handle snapshot - return as text (accessibility tree)
  if (data && typeof data === 'object' && 'snapshot' in data) {
    return [{ type: 'text', text: (data as { snapshot: string }).snapshot }];
  }

  // Default: JSON stringify the data
  return [{ type: 'text', text: JSON.stringify(data, null, 2) }];
}

// ============================================================================
// Remote Agent Implementation
// ============================================================================

/**
 * Remote agent state
 */
type ConnectionState = 'disconnected' | 'connecting' | 'connected';

/**
 * Remote agent for BTCP protocol control
 */
export interface RemoteAgent {
  /** Connect to the BTCP server */
  connect(): Promise<void>;

  /** Disconnect from the BTCP server */
  disconnect(): void;

  /** Check if connected */
  isConnected(): boolean;

  /** Get current connection state */
  getState(): ConnectionState;

  /** Add event listener */
  on<K extends keyof RemoteAgentEvents>(event: K, handler: RemoteAgentEvents[K]): void;

  /** Remove event listener */
  off<K extends keyof RemoteAgentEvents>(event: K, handler: RemoteAgentEvents[K]): void;

  /** Get the underlying BackgroundAgent */
  getAgent(): BackgroundAgent;

  /** Get registered tool definitions */
  getTools(): BTCPToolDefinition[];
}

/**
 * Create a remote agent that connects to a BTCP server
 *
 * @example
 * ```typescript
 * const remote = createRemoteAgent({
 *   serverUrl: 'http://localhost:8080',
 *   sessionId: 'browser-1',
 * });
 *
 * remote.on('connect', () => console.log('Connected!'));
 * remote.on('toolCall', (name, args) => console.log('Tool called:', name, args));
 *
 * await remote.connect();
 * ```
 */
export function createRemoteAgent(config: RemoteAgentConfig): RemoteAgent {
  const {
    serverUrl,
    sessionId = `browser-${Date.now()}`,
    autoReconnect = true,
    reconnectDelay = 1000,
    maxReconnectAttempts = 10,
    connectionTimeout = 30000,
    debug = false,
  } = config;

  // State
  let state: ConnectionState = 'disconnected';
  let eventSource: EventSource | null = null;
  let reconnectAttempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  const backgroundAgent = getBackgroundAgent();
  const tools = getBrowserToolDefinitions();

  // Event handlers
  const eventHandlers = new Map<keyof RemoteAgentEvents, Set<(...args: unknown[]) => void>>();

  function log(...args: unknown[]) {
    if (debug) {
      console.log('[RemoteAgent]', ...args);
    }
  }

  function emit<K extends keyof RemoteAgentEvents>(event: K, ...args: Parameters<RemoteAgentEvents[K]>) {
    const handlers = eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          (handler as (...args: unknown[]) => void)(...args);
        } catch (error) {
          console.error(`[RemoteAgent] Error in ${event} handler:`, error);
        }
      });
    }
  }

  /**
   * Handle incoming tool call request
   */
  async function handleToolCall(request: {
    id: string;
    method: string;
    params: { name: string; arguments: Record<string, unknown> };
  }) {
    const { name, arguments: args } = request.params;

    log('Tool call:', name, args);
    emit('toolCall', name, args);

    try {
      // Map tool to command and execute
      const command = mapToolToCommand(name, args);
      const response = await backgroundAgent.execute(command);

      // Send response back to server
      await sendResponse(request.id, formatResponseForBTCP(response));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('Tool call error:', errorMessage);
      await sendResponse(request.id, [{ type: 'text', text: `Error: ${errorMessage}` }], true);
    }
  }

  /**
   * Send response back to BTCP server
   */
  async function sendResponse(requestId: string, content: BTCPContent[], isError = false) {
    const responseUrl = `${serverUrl}/response`;
    const body = {
      jsonrpc: '2.0',
      id: requestId,
      ...(isError
        ? { error: { code: -32000, message: content[0]?.type === 'text' ? (content[0] as { text: string }).text : 'Unknown error' } }
        : { result: { content } }),
    };

    try {
      await fetch(responseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (error) {
      log('Failed to send response:', error);
    }
  }

  /**
   * Register tools with the server
   */
  async function registerTools() {
    const registerUrl = `${serverUrl}/register`;
    const body = {
      jsonrpc: '2.0',
      id: `register-${Date.now()}`,
      method: 'tools/register',
      params: {
        sessionId,
        tools,
      },
    };

    try {
      const response = await fetch(registerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Registration failed: ${response.status}`);
      }

      log('Tools registered successfully');
    } catch (error) {
      log('Failed to register tools:', error);
      throw error;
    }
  }

  /**
   * Connect to SSE endpoint
   */
  function connectSSE(): Promise<void> {
    return new Promise((resolve, reject) => {
      const sseUrl = `${serverUrl}/events?sessionId=${encodeURIComponent(sessionId)}`;
      log('Connecting to SSE:', sseUrl);

      state = 'connecting';
      eventSource = new EventSource(sseUrl);

      const timeout = setTimeout(() => {
        if (state === 'connecting') {
          eventSource?.close();
          reject(new Error('Connection timeout'));
        }
      }, connectionTimeout);

      eventSource.onopen = () => {
        clearTimeout(timeout);
        state = 'connected';
        reconnectAttempts = 0;
        log('SSE connected');
        emit('connect');
        resolve();
      };

      eventSource.onerror = (event) => {
        clearTimeout(timeout);
        log('SSE error:', event);

        if (state === 'connecting') {
          reject(new Error('Connection failed'));
          return;
        }

        // Handle disconnect
        state = 'disconnected';
        eventSource?.close();
        eventSource = null;

        emit('disconnect', undefined, 'Connection lost');
        emit('error', new Error('SSE connection error'));

        // Attempt reconnect if enabled
        if (autoReconnect && reconnectAttempts < maxReconnectAttempts) {
          const delay = reconnectDelay * Math.pow(2, reconnectAttempts);
          reconnectAttempts++;
          log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);

          reconnectTimer = setTimeout(() => {
            connectSSE().catch((error) => {
              log('Reconnect failed:', error);
            });
          }, delay);
        }
      };

      eventSource.addEventListener('request', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.method === 'tools/call') {
            handleToolCall(data);
          }
        } catch (error) {
          log('Failed to parse SSE message:', error);
        }
      });

      // Handle ping/pong for keepalive
      eventSource.addEventListener('ping', () => {
        log('Received ping');
      });
    });
  }

  return {
    async connect() {
      if (state !== 'disconnected') {
        throw new Error(`Cannot connect: current state is ${state}`);
      }

      // First register tools
      await registerTools();

      // Then connect to SSE
      await connectSSE();
    },

    disconnect() {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      reconnectAttempts = maxReconnectAttempts; // Prevent auto-reconnect

      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }

      if (state !== 'disconnected') {
        state = 'disconnected';
        emit('disconnect', 1000, 'Client disconnected');
      }

      log('Disconnected');
    },

    isConnected() {
      return state === 'connected';
    },

    getState() {
      return state;
    },

    on(event, handler) {
      if (!eventHandlers.has(event)) {
        eventHandlers.set(event, new Set());
      }
      eventHandlers.get(event)!.add(handler as (...args: unknown[]) => void);
    },

    off(event, handler) {
      eventHandlers.get(event)?.delete(handler as (...args: unknown[]) => void);
    },

    getAgent() {
      return backgroundAgent;
    },

    getTools() {
      return tools;
    },
  };
}

