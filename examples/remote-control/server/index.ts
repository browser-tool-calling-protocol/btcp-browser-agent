/**
 * BTCP Server - Remote Browser Control
 *
 * A Node.js server that implements the BTCP protocol for remote browser control.
 * The Chrome extension connects to this server and executes browser commands.
 *
 * Usage:
 *   npm run server       # Start server and wait for connection
 *   npm run server:demo  # Start server and run demo scenario on connect
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { runGoogleGithubDemo } from './demo-scenario.js';

// ============================================================================
// Configuration
// ============================================================================

const PORT = parseInt(process.env.PORT || '8080', 10);
const RUN_DEMO = process.argv.includes('--demo');

// ============================================================================
// Types
// ============================================================================

interface BTCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface BTCPSession {
  sessionId: string;
  tools: BTCPToolDefinition[];
  response: ServerResponse | null;
  pendingRequests: Map<string, {
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>;
}

// ============================================================================
// Server State
// ============================================================================

const sessions = new Map<string, BTCPSession>();
let requestIdCounter = 0;

// ============================================================================
// Logging
// ============================================================================

function log(message: string, ...args: unknown[]) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`[${timestamp}] ${message}`, ...args);
}

function logSuccess(message: string, ...args: unknown[]) {
  log(`\x1b[32m${message}\x1b[0m`, ...args);
}

function logError(message: string, ...args: unknown[]) {
  log(`\x1b[31m${message}\x1b[0m`, ...args);
}

function logInfo(message: string, ...args: unknown[]) {
  log(`\x1b[36m${message}\x1b[0m`, ...args);
}

// ============================================================================
// BTCP Protocol Implementation
// ============================================================================

/**
 * Call a browser tool and wait for the result
 */
export async function callTool(
  sessionId: string,
  toolName: string,
  args: Record<string, unknown> = {},
  timeout = 60000
): Promise<unknown> {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const response = session.response;
  if (!response) {
    throw new Error('No active SSE connection');
  }

  const requestId = `req_${++requestIdCounter}`;

  return new Promise((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      session.pendingRequests.delete(requestId);
      reject(new Error(`Tool call timeout: ${toolName}`));
    }, timeout);

    session.pendingRequests.set(requestId, {
      resolve,
      reject,
      timeout: timeoutHandle,
    });

    // Send tool call via SSE
    const event = {
      id: requestId,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    };

    response.write(`event: request\n`);
    response.write(`data: ${JSON.stringify(event)}\n\n`);
  });
}

/**
 * Handle tool registration from browser extension
 */
function handleRegister(body: {
  params: { sessionId: string; tools: BTCPToolDefinition[] };
}): { result: { success: boolean } } {
  const { sessionId, tools } = body.params;

  log(`Registering session: ${sessionId} with ${tools.length} tools`);

  const session: BTCPSession = {
    sessionId,
    tools,
    response: null,
    pendingRequests: new Map(),
  };

  sessions.set(sessionId, session);

  return { result: { success: true } };
}

/**
 * Handle tool response from browser extension
 */
function handleResponse(body: {
  id: string;
  result?: { content: Array<{ type: string; text?: string; data?: string }> };
  error?: { code: number; message: string };
}): void {
  const { id, result, error } = body;

  // Find the session with this pending request
  for (const session of sessions.values()) {
    const pending = session.pendingRequests.get(id);
    if (pending) {
      clearTimeout(pending.timeout);
      session.pendingRequests.delete(id);

      if (error) {
        pending.reject(new Error(error.message));
      } else if (result) {
        // Extract text content if available
        const textContent = result.content.find(c => c.type === 'text');
        if (textContent && 'text' in textContent) {
          pending.resolve(textContent.text);
        } else {
          pending.resolve(result);
        }
      }
      return;
    }
  }

  log(`Warning: Response for unknown request: ${id}`);
}

// ============================================================================
// HTTP Request Handlers
// ============================================================================

function handleCors(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function handlePost(req: IncomingMessage, res: ServerResponse, path: string) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const body = JSON.parse(Buffer.concat(chunks).toString());

  handleCors(res);
  res.setHeader('Content-Type', 'application/json');

  if (path === '/register') {
    const result = handleRegister(body);
    res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, ...result }));
    return;
  }

  if (path === '/response') {
    handleResponse(body);
    res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { success: true } }));
    return;
  }

  if (path === '/start-demo') {
    // Find an active session to run demo on
    let activeSession: string | null = null;
    for (const [sessionId, session] of sessions) {
      if (session.response) {
        activeSession = sessionId;
        break;
      }
    }

    if (!activeSession) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'No active browser session' }));
      return;
    }

    // Start demo asynchronously
    runGoogleGithubDemo(activeSession).catch(err => {
      logError('Demo failed:', err.message);
    });

    res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { success: true, sessionId: activeSession } }));
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'Not found' }));
}

function handleSSE(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || '', `http://localhost:${PORT}`);
  const sessionId = url.searchParams.get('sessionId');

  if (!sessionId) {
    res.statusCode = 400;
    res.end('Missing sessionId');
    return;
  }

  const session = sessions.get(sessionId);
  if (!session) {
    res.statusCode = 404;
    res.end('Session not found');
    return;
  }

  // Set up SSE connection
  handleCors(res);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  session.response = res;

  logSuccess(`Browser connected! Session: ${sessionId}`);

  // Send initial connected event
  res.write(`event: connected\n`);
  res.write(`data: {"sessionId": "${sessionId}"}\n\n`);

  // Ping every 30 seconds to keep connection alive
  const pingInterval = setInterval(() => {
    res.write(`event: ping\n`);
    res.write(`data: {}\n\n`);
  }, 30000);

  // Handle disconnect
  req.on('close', () => {
    clearInterval(pingInterval);
    session.response = null;
    logInfo(`Browser disconnected: ${sessionId}`);
  });

  // Run demo if enabled
  if (RUN_DEMO) {
    setTimeout(() => {
      runGoogleGithubDemo(sessionId).catch(err => {
        logError('Demo failed:', err.message);
      });
    }, 1000);
  }
}

// ============================================================================
// Main Server
// ============================================================================

const server = createServer((req, res) => {
  const url = new URL(req.url || '', `http://localhost:${PORT}`);
  const path = url.pathname;

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    handleCors(res);
    res.end();
    return;
  }

  // Route requests
  if (req.method === 'POST') {
    handlePost(req, res, path).catch(err => {
      logError('POST error:', err);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }

  if (req.method === 'GET' && path === '/events') {
    handleSSE(req, res);
    return;
  }

  if (req.method === 'GET' && path === '/') {
    handleCors(res);
    res.setHeader('Content-Type', 'text/html');
    res.end(`
      <!DOCTYPE html>
      <html>
      <head><title>BTCP Server</title></head>
      <body style="font-family: system-ui; padding: 20px;">
        <h1>BTCP Remote Control Server</h1>
        <p>Status: <strong style="color: green;">Running</strong></p>
        <p>Port: ${PORT}</p>
        <p>Sessions: ${sessions.size}</p>
        <h2>Instructions</h2>
        <ol>
          <li>Load the Chrome extension from <code>examples/remote-control/dist</code></li>
          <li>Click the extension icon and press "Connect"</li>
          <li>The browser is now remotely controllable from this server</li>
        </ol>
        ${RUN_DEMO ? '<p><em>Demo mode: Will run Google→GitHub scenario on connect</em></p>' : ''}
      </body>
      </html>
    `);
    return;
  }

  res.statusCode = 404;
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           BTCP Remote Control Server                       ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Server running at: http://localhost:${PORT}                   ║`);
  console.log('║                                                            ║');
  console.log('║  Waiting for browser extension to connect...               ║');
  if (RUN_DEMO) {
    console.log('║                                                            ║');
    console.log('║  Demo mode: Will run scenario on connect                   ║');
  }
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
});

// Export for demo scenario
export { sessions, log, logSuccess, logError, logInfo };
