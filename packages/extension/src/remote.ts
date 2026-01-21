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
 *
 * Minimal toolset following Unix philosophy - each tool does one thing well.
 * Advanced operations can be done via browser_evaluate.
 */
export function getBrowserToolDefinitions(): BTCPToolDefinition[] {
  return [
    {
      name: 'browser_navigate',
      description: 'Navigate to a URL',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to navigate to' },
        },
        required: ['url'],
      },
    },
    {
      name: 'browser_snapshot',
      description: 'Get page snapshot as accessibility tree with element refs (@ref:N). Use refs in click/type commands.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'browser_click',
      description: 'Click an element using @ref:N from snapshot',
      inputSchema: {
        type: 'object',
        properties: {
          ref: { type: 'string', description: 'Element reference from snapshot (e.g., @ref:5)' },
        },
        required: ['ref'],
      },
    },
    {
      name: 'browser_type',
      description: 'Type text into an element',
      inputSchema: {
        type: 'object',
        properties: {
          ref: { type: 'string', description: 'Element reference from snapshot' },
          text: { type: 'string', description: 'Text to type' },
        },
        required: ['ref', 'text'],
      },
    },
    {
      name: 'browser_screenshot',
      description: 'Capture a screenshot of the page',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'browser_scroll',
      description: 'Scroll the page',
      inputSchema: {
        type: 'object',
        properties: {
          direction: { type: 'string', enum: ['up', 'down'], description: 'Scroll direction' },
        },
        required: ['direction'],
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
  switch (toolName) {
    case 'browser_navigate':
      return { action: 'navigate', url: args.url as string };

    case 'browser_snapshot':
      return { action: 'snapshot' };

    case 'browser_click':
      return { action: 'click', selector: args.ref as string };

    case 'browser_type':
      return { action: 'type', selector: args.ref as string, text: args.text as string };

    case 'browser_screenshot':
      return { action: 'screenshot' };

    case 'browser_scroll': {
      const direction = args.direction as string;
      const amount = direction === 'down' ? 500 : -500;
      return { action: 'scroll', y: amount };
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
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
   * Ensure a session exists, creating one if needed
   *
   * This checks in order:
   * 1. Current active session
   * 2. Persistent session from storage (reconnects if found)
   * 3. Existing BTCP tab groups (reconnects to first one found)
   * 4. Creates a new session if none found (respects maxSession limit)
   */
  async function ensureSession(): Promise<void> {
    // 1. Check if there's an active session
    const sessionResult = await backgroundAgent.execute({ action: 'sessionGetCurrent' });

    if (sessionResult.success && sessionResult.data) {
      const session = (sessionResult.data as { session?: { groupId?: number } }).session;
      if (session?.groupId) {
        log('Active session found:', session.groupId);
        return; // Session already exists
      }
    }

    // 2. Try to reconnect via popup initialize (handles persistent session check)
    log('No active session, trying to reconnect to existing session...');
    const initResult = await backgroundAgent.execute({ action: 'popupInitialize' });

    if (initResult.success && initResult.data) {
      const initData = initResult.data as { reconnected?: boolean };
      if (initData.reconnected) {
        log('Reconnected to existing session');
        return;
      }
    }

    // 3. Check for existing BTCP tab groups and try to use one
    const groupsResult = await backgroundAgent.execute({ action: 'groupList' });
    if (groupsResult.success && groupsResult.data) {
      const groups = groupsResult.data as Array<{ id: number; title?: string }>;
      const btcpGroup = groups.find(g => g.title?.startsWith('BTCP'));

      if (btcpGroup) {
        log('Found existing BTCP tab group, setting it as active session:', btcpGroup.id);
        const useResult = await backgroundAgent.execute({
          action: 'sessionUseGroup',
          groupId: btcpGroup.id,
        });
        if (useResult.success) {
          log('Successfully using existing BTCP group as session');
          return;
        }
        log('Failed to use existing BTCP group:', useResult.error);
      }
    }

    // 4. Create a new session (will fail if maxSession limit reached)
    log('No existing session found, creating one automatically...');
    const groupResult = await backgroundAgent.execute({
      action: 'groupCreate',
      // Don't specify title - let SessionManager generate proper numbered title
      color: 'blue',
    });

    if (!groupResult.success) {
      throw new Error(`Failed to create session: ${groupResult.error}`);
    }

    log('Session created:', groupResult.data);
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
      // Auto-ensure session for all browser tools (session management is internal)
      await ensureSession();

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

