/**
 * @aspect/extension - Background Script
 *
 * Runs as service worker, handles:
 * - Navigation (navigate, back, forward, reload)
 * - Tab management (new, close, switch, list)
 * - Screenshots
 * - Forwarding DOM commands to content scripts
 */

import type {
  Command,
  ExtensionCommand,
  ExtensionMessage,
  ExtensionResponse,
  Response,
  TabInfo,
} from './types.js';

/**
 * Check if a command is an extension command (handled by background)
 */
function isExtensionCommand(command: Command): command is ExtensionCommand {
  const extensionActions = [
    'navigate', 'back', 'forward', 'reload',
    'getUrl', 'getTitle', 'screenshot',
    'tabNew', 'tabClose', 'tabSwitch', 'tabList',
  ];
  return extensionActions.includes(command.action);
}

/**
 * Get the active tab
 */
function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0] || null);
    });
  });
}

/**
 * Send command to content script in a tab
 */
function sendToContentScript(tabId: number, command: Command): Promise<Response> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(
      tabId,
      { type: 'aspect:command', command } satisfies ExtensionMessage,
      (response) => {
        if (chrome.runtime.lastError) {
          resolve({
            id: command.id,
            success: false,
            error: chrome.runtime.lastError.message || 'Failed to send message to tab',
          });
        } else {
          const resp = response as ExtensionResponse;
          resolve(resp.response);
        }
      }
    );
  });
}

/**
 * Wait for tab to finish loading
 */
function waitForTabLoad(tabId: number, timeout = 30000): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkTab = () => {
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (tab.status === 'complete') {
          resolve();
          return;
        }

        if (Date.now() - startTime > timeout) {
          reject(new Error('Tab load timeout'));
          return;
        }

        setTimeout(checkTab, 100);
      });
    };

    checkTab();
  });
}

/**
 * Execute an extension command
 */
async function executeExtensionCommand(command: ExtensionCommand): Promise<Response> {
  try {
    switch (command.action) {
      case 'navigate': {
        const tab = await getActiveTab();
        if (!tab?.id) throw new Error('No active tab');

        await new Promise<void>((resolve) => {
          chrome.tabs.update(tab.id!, { url: command.url }, () => resolve());
        });

        if (command.waitUntil) {
          await waitForTabLoad(tab.id);
        }

        return {
          id: command.id,
          success: true,
          data: { url: command.url },
        };
      }

      case 'back': {
        const tab = await getActiveTab();
        if (!tab?.id) throw new Error('No active tab');

        await new Promise<void>((resolve) => {
          chrome.tabs.goBack(tab.id!, () => resolve());
        });

        return {
          id: command.id,
          success: true,
          data: { navigated: 'back' },
        };
      }

      case 'forward': {
        const tab = await getActiveTab();
        if (!tab?.id) throw new Error('No active tab');

        await new Promise<void>((resolve) => {
          chrome.tabs.goForward(tab.id!, () => resolve());
        });

        return {
          id: command.id,
          success: true,
          data: { navigated: 'forward' },
        };
      }

      case 'reload': {
        const tab = await getActiveTab();
        if (!tab?.id) throw new Error('No active tab');

        await new Promise<void>((resolve) => {
          chrome.tabs.reload(tab.id!, { bypassCache: command.bypassCache }, () => resolve());
        });

        await waitForTabLoad(tab.id);

        return {
          id: command.id,
          success: true,
          data: { reloaded: true },
        };
      }

      case 'getUrl': {
        const tab = await getActiveTab();
        return {
          id: command.id,
          success: true,
          data: { url: tab?.url || '' },
        };
      }

      case 'getTitle': {
        const tab = await getActiveTab();
        return {
          id: command.id,
          success: true,
          data: { title: tab?.title || '' },
        };
      }

      case 'screenshot': {
        const format = command.format || 'png';
        const quality = command.quality;

        const dataUrl = await new Promise<string>((resolve, reject) => {
          chrome.tabs.captureVisibleTab(
            null,
            { format, quality },
            (url) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(url);
              }
            }
          );
        });

        // Extract base64 data from data URL
        const base64 = dataUrl.split(',')[1];

        return {
          id: command.id,
          success: true,
          data: { screenshot: base64, format },
        };
      }

      case 'tabNew': {
        const tab = await new Promise<chrome.tabs.Tab>((resolve) => {
          chrome.tabs.create(
            { url: command.url, active: command.active ?? true },
            (t) => resolve(t)
          );
        });

        if (command.url) {
          await waitForTabLoad(tab.id!);
        }

        return {
          id: command.id,
          success: true,
          data: { tabId: tab.id, url: tab.url },
        };
      }

      case 'tabClose': {
        let tabId = command.tabId;
        if (!tabId) {
          const tab = await getActiveTab();
          tabId = tab?.id;
        }

        if (!tabId) throw new Error('No tab to close');

        await new Promise<void>((resolve) => {
          chrome.tabs.remove(tabId!, () => resolve());
        });

        return {
          id: command.id,
          success: true,
          data: { closed: tabId },
        };
      }

      case 'tabSwitch': {
        await new Promise<void>((resolve) => {
          chrome.tabs.update(command.tabId, { active: true }, () => resolve());
        });

        return {
          id: command.id,
          success: true,
          data: { switched: command.tabId },
        };
      }

      case 'tabList': {
        const tabs = await new Promise<chrome.tabs.Tab[]>((resolve) => {
          chrome.tabs.query({ currentWindow: true }, (t) => resolve(t));
        });

        const tabList: TabInfo[] = tabs.map((t) => ({
          id: t.id!,
          url: t.url,
          title: t.title,
          active: t.active,
          index: t.index,
        }));

        return {
          id: command.id,
          success: true,
          data: { tabs: tabList },
        };
      }

      default:
        throw new Error(`Unknown extension action: ${(command as ExtensionCommand).action}`);
    }
  } catch (error) {
    return {
      id: command.id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Handle incoming command
 */
async function handleCommand(command: Command, tabId?: number): Promise<Response> {
  // Extension commands are handled here
  if (isExtensionCommand(command)) {
    return executeExtensionCommand(command);
  }

  // DOM commands are forwarded to content script
  let targetTabId = tabId;
  if (!targetTabId) {
    const tab = await getActiveTab();
    targetTabId = tab?.id;
  }

  if (!targetTabId) {
    return {
      id: command.id,
      success: false,
      error: 'No active tab for DOM command',
    };
  }

  return sendToContentScript(targetTabId, command);
}

/**
 * Listen for messages from popup or external sources
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const msg = message as ExtensionMessage;

  if (msg.type !== 'aspect:command') {
    return false;
  }

  handleCommand(msg.command, msg.tabId || sender.tab?.id)
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

  return true;
});

// Export for programmatic use
export { handleCommand, executeExtensionCommand, sendToContentScript };
