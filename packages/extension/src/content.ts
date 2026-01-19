/**
 * @btcp/extension - Content Script
 *
 * Runs in web pages, handles DOM commands from the background script.
 * Uses ContentAgent from @btcp/core for DOM operations.
 */

import { createContentAgent, type ContentAgent, type Command as CoreCommand, type Response } from '../../core/dist/index.js';
import type { ExtensionMessage, ExtensionResponse, Command } from './types.js';

let agent: ContentAgent | null = null;
let isContentScriptReady = false;

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
  ];
  return !extensionActions.includes(command.action);
}

/**
 * Handle a command from the background script
 */
async function handleCommand(command: Command): Promise<Response> {
  // Core DOM commands are handled by ContentAgent
  if (isCoreCommand(command)) {
    return getContentAgent().execute(command);
  }

  // Extension commands that need content script execution
  switch (command.action) {
    case 'getUrl':
      return {
        id: command.id,
        success: true,
        data: { url: window.location.href },
      };

    case 'getTitle':
      return {
        id: command.id,
        success: true,
        data: { title: document.title },
      };

    default:
      // Forward to background script
      return {
        id: command.id,
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
          id: msg.command.id,
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
