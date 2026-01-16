/**
 * @aspect/extension - Content Script
 *
 * Runs in web pages, handles DOM commands from the background script.
 * Uses ContentAgent from @aspect/core for DOM operations.
 */

import { createContentAgent, type ContentAgent, type Command as CoreCommand, type Response } from '@aspect/core';
import type { ExtensionMessage, ExtensionResponse, Command } from './types.js';

let agent: ContentAgent | null = null;

/**
 * Get or create the ContentAgent instance for this page
 */
function getContentAgent(): ContentAgent {
  if (!agent) {
    agent = createContentAgent(document, window);
  }
  return agent;
}

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

  if (msg.type !== 'aspect:command') {
    return false;
  }

  handleCommand(msg.command)
    .then((response) => {
      sendResponse({ type: 'aspect:response', response } satisfies ExtensionResponse);
    })
    .catch((error) => {
      sendResponse({
        type: 'aspect:response',
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
  if (msg?.type !== 'aspect:command') return;

  const response = await handleCommand(msg.command);

  window.postMessage({
    type: 'aspect:response',
    response,
  } satisfies ExtensionResponse, '*');
});

// Export for programmatic use
export { getContentAgent, handleCommand };
