/**
 * Background Service Worker
 *
 * Handles:
 * - Navigation (navigate, back, forward, reload)
 * - Tab management (new, close, switch, list)
 * - Screenshots
 * - Forwarding DOM commands to content scripts
 */

// ============================================================================
// Extension-level command handling
// ============================================================================

const EXTENSION_ACTIONS = [
  'navigate', 'back', 'forward', 'reload',
  'getUrl', 'getTitle', 'screenshot',
  'tabNew', 'tabClose', 'tabSwitch', 'tabList',
];

function isExtensionCommand(command) {
  return EXTENSION_ACTIONS.includes(command.action);
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

async function waitForTabLoad(tabId, timeout = 30000) {
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const checkTab = async () => {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.status === 'complete') {
          resolve();
          return;
        }
        if (Date.now() - startTime > timeout) {
          reject(new Error('Tab load timeout'));
          return;
        }
        setTimeout(checkTab, 100);
      } catch (error) {
        reject(error);
      }
    };
    checkTab();
  });
}

async function executeExtensionCommand(command) {
  try {
    switch (command.action) {
      case 'navigate': {
        const tab = await getActiveTab();
        if (!tab?.id) throw new Error('No active tab');
        await chrome.tabs.update(tab.id, { url: command.url });
        if (command.waitUntil) {
          await waitForTabLoad(tab.id);
        }
        return { id: command.id, success: true, data: { url: command.url } };
      }

      case 'back': {
        const tab = await getActiveTab();
        if (!tab?.id) throw new Error('No active tab');
        await chrome.tabs.goBack(tab.id);
        return { id: command.id, success: true, data: { navigated: 'back' } };
      }

      case 'forward': {
        const tab = await getActiveTab();
        if (!tab?.id) throw new Error('No active tab');
        await chrome.tabs.goForward(tab.id);
        return { id: command.id, success: true, data: { navigated: 'forward' } };
      }

      case 'reload': {
        const tab = await getActiveTab();
        if (!tab?.id) throw new Error('No active tab');
        await chrome.tabs.reload(tab.id, { bypassCache: command.bypassCache });
        await waitForTabLoad(tab.id);
        return { id: command.id, success: true, data: { reloaded: true } };
      }

      case 'getUrl': {
        const tab = await getActiveTab();
        return { id: command.id, success: true, data: { url: tab?.url || '' } };
      }

      case 'getTitle': {
        const tab = await getActiveTab();
        return { id: command.id, success: true, data: { title: tab?.title || '' } };
      }

      case 'screenshot': {
        const format = command.format || 'png';
        const quality = command.quality;
        const dataUrl = await chrome.tabs.captureVisibleTab(null, { format, quality });
        const base64 = dataUrl.split(',')[1];
        return { id: command.id, success: true, data: { screenshot: base64, format } };
      }

      case 'tabNew': {
        const tab = await chrome.tabs.create({
          url: command.url,
          active: command.active ?? true,
        });
        if (command.url) {
          await waitForTabLoad(tab.id);
        }
        return { id: command.id, success: true, data: { tabId: tab.id, url: tab.url } };
      }

      case 'tabClose': {
        let tabId = command.tabId;
        if (!tabId) {
          const tab = await getActiveTab();
          tabId = tab?.id;
        }
        if (!tabId) throw new Error('No tab to close');
        await chrome.tabs.remove(tabId);
        return { id: command.id, success: true, data: { closed: tabId } };
      }

      case 'tabSwitch': {
        await chrome.tabs.update(command.tabId, { active: true });
        return { id: command.id, success: true, data: { switched: command.tabId } };
      }

      case 'tabList': {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const tabList = tabs.map(t => ({
          id: t.id,
          url: t.url,
          title: t.title,
          active: t.active,
          index: t.index,
        }));
        return { id: command.id, success: true, data: { tabs: tabList } };
      }

      default:
        throw new Error(`Unknown extension action: ${command.action}`);
    }
  } catch (error) {
    return { id: command.id, success: false, error: error.message };
  }
}

// ============================================================================
// Command routing
// ============================================================================

async function sendToContentScript(tabId, command) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(
      tabId,
      { type: 'aspect:command', command },
      (response) => {
        if (chrome.runtime.lastError) {
          resolve({
            id: command.id,
            success: false,
            error: chrome.runtime.lastError.message || 'Failed to send to tab',
          });
        } else {
          resolve(response?.response || { id: command.id, success: false, error: 'No response' });
        }
      }
    );
  });
}

async function handleCommand(command, tabId) {
  // Extension commands handled here
  if (isExtensionCommand(command)) {
    return executeExtensionCommand(command);
  }

  // DOM commands forwarded to content script
  let targetTabId = tabId;
  if (!targetTabId) {
    const tab = await getActiveTab();
    targetTabId = tab?.id;
  }

  if (!targetTabId) {
    return { id: command.id, success: false, error: 'No active tab for DOM command' };
  }

  return sendToContentScript(targetTabId, command);
}

// ============================================================================
// Message listener
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Received:', message.type);

  if (message.type === 'aspect:command') {
    handleCommand(message.command, message.tabId || sender.tab?.id)
      .then(response => {
        sendResponse({ type: 'aspect:response', response });
      })
      .catch(error => {
        sendResponse({
          type: 'aspect:response',
          response: { id: message.command.id, success: false, error: error.message }
        });
      });
    return true; // Async response
  }

  return false;
});

// ============================================================================
// API for popup/external use
// ============================================================================

let commandIdCounter = 0;

function generateCommandId() {
  return `cmd_${Date.now()}_${commandIdCounter++}`;
}

// Make functions available globally for popup
globalThis.aspectAgent = {
  async execute(command) {
    return handleCommand({ id: generateCommandId(), ...command });
  },

  async navigate(url, options = {}) {
    return handleCommand({ id: generateCommandId(), action: 'navigate', url, ...options });
  },

  async snapshot(options = {}) {
    return handleCommand({ id: generateCommandId(), action: 'snapshot', ...options });
  },

  async click(selector) {
    return handleCommand({ id: generateCommandId(), action: 'click', selector });
  },

  async type(selector, text, options = {}) {
    return handleCommand({ id: generateCommandId(), action: 'type', selector, text, ...options });
  },

  async fill(selector, value) {
    return handleCommand({ id: generateCommandId(), action: 'fill', selector, value });
  },

  async screenshot(options = {}) {
    return handleCommand({ id: generateCommandId(), action: 'screenshot', ...options });
  },

  async tabList() {
    return handleCommand({ id: generateCommandId(), action: 'tabList' });
  },

  async tabNew(options = {}) {
    return handleCommand({ id: generateCommandId(), action: 'tabNew', ...options });
  },
};

console.log('[Aspect] Background script loaded');
