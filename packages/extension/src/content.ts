/**
 * @btcp/extension - Content Script
 *
 * Runs in web pages, handles DOM commands from the background script.
 * Uses ContentAgent from @btcp/core for DOM operations.
 */

import { createContentAgent, type ContentAgent, type Command as CoreCommand, type Response } from '../../core/dist/index.js';
import type {
  ExtensionMessage,
  ExtensionResponse,
  Command,
  ScriptInjectCommand,
  ScriptSendCommand,
  ScriptCommandMessage,
  ScriptAckMessage,
} from './types.js';

let agent: ContentAgent | null = null;
let isContentScriptReady = false;

// Track injected scripts by scriptId
const injectedScripts = new Map<string, { element: HTMLScriptElement; injectedAt: number }>();

// Track pending script commands waiting for ack
const pendingScriptCommands = new Map<string, {
  resolve: (response: Response) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}>();

// Counter for generating unique command IDs
let scriptCommandCounter = 0;

/**
 * Get or create the ContentAgent instance for this page
 */
function getContentAgent(): ContentAgent {
  if (!agent) {
    agent = createContentAgent(document, window);
    isContentScriptReady = true;
    console.log('[ContentScript] Agent initialized');
  }
  return agent;
}

// Initialize agent immediately
getContentAgent();

/**
 * Check if a command is a core DOM command
 */
function isCoreCommand(command: Command): command is CoreCommand {
  const extensionActions = [
    'navigate', 'back', 'forward', 'reload',
    'getUrl', 'getTitle', 'screenshot',
    'tabNew', 'tabClose', 'tabSwitch', 'tabList',
    'scriptInject', 'scriptSend',
  ];
  return !extensionActions.includes(command.action);
}

/**
 * Inject a script into the page's main world
 */
function handleScriptInject(command: ScriptInjectCommand): Response {
  const id = command.id || 'unknown';
  const scriptId = command.scriptId || 'default';

  try {
    // Remove existing script with same ID if present
    const existing = injectedScripts.get(scriptId);
    if (existing) {
      existing.element.remove();
      injectedScripts.delete(scriptId);
    }

    // Create script element
    const script = document.createElement('script');
    script.textContent = command.code;
    script.setAttribute('data-btcp-script-id', scriptId);

    // Inject into page's main world by appending to document
    (document.head || document.documentElement).appendChild(script);

    // Track the injected script
    injectedScripts.set(scriptId, {
      element: script,
      injectedAt: Date.now(),
    });

    console.log(`[ContentScript] Injected script: ${scriptId}`);

    return {
      id,
      success: true,
      data: { scriptId, injected: true },
    };
  } catch (error) {
    return {
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      errorCode: 'INJECTION_FAILED',
    };
  }
}

/**
 * Send a command to an injected script and wait for acknowledgment
 */
function handleScriptSend(command: ScriptSendCommand): Promise<Response> {
  const id = command.id || 'unknown';
  const scriptId = command.scriptId || 'default';
  const timeout = command.timeout ?? 30000;
  const commandId = `script_cmd_${Date.now()}_${scriptCommandCounter++}`;

  return new Promise((resolve) => {
    // Set up timeout
    const timeoutId = setTimeout(() => {
      pendingScriptCommands.delete(commandId);
      resolve({
        id,
        success: false,
        error: `Script command timed out after ${timeout}ms`,
        errorCode: 'SCRIPT_TIMEOUT',
      });
    }, timeout);

    // Track pending command
    pendingScriptCommands.set(commandId, { resolve, timeoutId });

    // Send command to page script via postMessage
    const message: ScriptCommandMessage = {
      type: 'btcp:script-command',
      commandId,
      scriptId,
      payload: command.payload,
    };

    window.postMessage(message, '*');
  });
}

/**
 * Listen for script acknowledgments from page scripts
 */
window.addEventListener('message', (event) => {
  if (event.source !== window) return;

  const msg = event.data as ScriptAckMessage;
  if (msg?.type !== 'btcp:script-ack') return;

  const pending = pendingScriptCommands.get(msg.commandId);
  if (!pending) return;

  // Clear timeout and remove from pending
  clearTimeout(pending.timeoutId);
  pendingScriptCommands.delete(msg.commandId);

  // Resolve with response
  if (msg.error) {
    pending.resolve({
      id: msg.commandId,
      success: false,
      error: msg.error,
      errorCode: 'SCRIPT_ERROR',
    });
  } else {
    pending.resolve({
      id: msg.commandId,
      success: true,
      data: { result: msg.result },
    });
  }
});

/**
 * Handle a command from the background script
 */
async function handleCommand(command: Command): Promise<Response> {
  // Core DOM commands are handled by ContentAgent
  if (isCoreCommand(command)) {
    return getContentAgent().execute(command);
  }

  // Extension commands that need content script execution
  const id = command.id || 'unknown';
  switch (command.action) {
    case 'getUrl':
      return {
        id,
        success: true,
        data: { url: window.location.href },
      };

    case 'getTitle':
      return {
        id,
        success: true,
        data: { title: document.title },
      };

    case 'scriptInject':
      return handleScriptInject(command as ScriptInjectCommand);

    case 'scriptSend':
      return handleScriptSend(command as ScriptSendCommand);

    default:
      // Forward to background script
      return {
        id,
        success: false,
        error: `Command ${command.action} must be handled by background script`,
      };
  }
}

/**
 * Listen for messages from background script
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const msg = message as ExtensionMessage;

  // Handle ping messages for heartbeat
  if (msg.type === 'btcp:ping') {
    sendResponse({ type: 'btcp:pong', ready: isContentScriptReady } satisfies ExtensionResponse);
    return true;
  }

  if (msg.type !== 'btcp:command') {
    return false;
  }

  handleCommand(msg.command)
    .then((response) => {
      sendResponse({ type: 'btcp:response', response } satisfies ExtensionResponse);
    })
    .catch((error) => {
      sendResponse({
        type: 'btcp:response',
        response: {
          id: msg.command.id || 'unknown',
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
      } satisfies ExtensionResponse);
    });

  // Return true to indicate async response
  return true;
});

/**
 * Also listen for postMessage from page scripts
 * This allows scripts injected into the page to use the agent
 */
window.addEventListener('message', async (event) => {
  if (event.source !== window) return;

  const msg = event.data as ExtensionMessage;
  if (msg?.type !== 'btcp:command') return;

  const response = await handleCommand(msg.command);

  window.postMessage({
    type: 'btcp:response',
    response,
  } satisfies ExtensionResponse, '*');
});

/**
 * Lifecycle event listeners for session keep-alive
 */

// Detect page visibility changes
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    console.log('[ContentScript] Page became visible, checking connection...');
  }
});

// Detect freeze/resume events (Chrome 68+)
document.addEventListener('freeze', () => {
  console.log('[ContentScript] Page frozen');
});

document.addEventListener('resume', () => {
  console.log('[ContentScript] Page resumed, re-initializing agent...');
  // Re-initialize agent to ensure fresh state
  agent = null;
  getContentAgent();
});

// Clear refs on navigation (full page navigation)
window.addEventListener('beforeunload', () => {
  console.log('[ContentScript] Page navigating, clearing refs...');
  const currentAgent = getContentAgent();
  currentAgent.clearRefs();
});

// Detect SPA navigation (URL changes without full page reload)
let lastUrl = window.location.href;
setInterval(() => {
  const currentUrl = window.location.href;
  if (currentUrl !== lastUrl) {
    console.log('[ContentScript] URL changed, clearing refs...', { from: lastUrl, to: currentUrl });
    lastUrl = currentUrl;
    const currentAgent = getContentAgent();
    currentAgent.clearRefs();
  }
}, 1000);

// Export for programmatic use
export { getContentAgent, handleCommand };
