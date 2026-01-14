/**
 * Background Service Worker
 *
 * Handles chrome.* APIs and coordinates between AI and content scripts.
 * This is where you'd connect to your AI backend (e.g., Claude API).
 */

// Store active sessions
const sessions = new Map();

// Message handler for content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Received:', message.type, message);

  switch (message.type) {
    case 'screenshot':
      handleScreenshot(sender.tab?.windowId).then(sendResponse);
      return true; // Keep channel open for async

    case 'navigate':
      handleNavigate(sender.tab?.id, message.url).then(sendResponse);
      return true;

    case 'getTabs':
      handleGetTabs().then(sendResponse);
      return true;

    case 'newTab':
      handleNewTab(message.url).then(sendResponse);
      return true;

    case 'switchTab':
      handleSwitchTab(message.tabId).then(sendResponse);
      return true;

    case 'closeTab':
      handleCloseTab(message.tabId || sender.tab?.id).then(sendResponse);
      return true;

    case 'executeInTab':
      handleExecuteInTab(message.tabId, message.command).then(sendResponse);
      return true;

    case 'agentReady':
      // Content script agent is ready
      sessions.set(sender.tab?.id, { ready: true, timestamp: Date.now() });
      sendResponse({ success: true });
      return false;

    case 'agentResult':
      // Forward result to popup or AI backend
      handleAgentResult(message.result);
      sendResponse({ success: true });
      return false;

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
      return false;
  }
});

// Screenshot using chrome.tabs.captureVisibleTab
async function handleScreenshot(windowId) {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId || null, {
      format: 'png',
    });
    const base64 = dataUrl.split(',')[1];
    return { success: true, data: { screenshot: base64, format: 'png' } };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Navigate tab to URL
async function handleNavigate(tabId, url) {
  try {
    const tab = await chrome.tabs.update(tabId, { url });
    return { success: true, data: { url: tab.url, title: tab.title } };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get all tabs
async function handleGetTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    return {
      success: true,
      data: {
        tabs: tabs.map((t) => ({
          id: t.id,
          url: t.url,
          title: t.title,
          active: t.active,
        })),
      },
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Create new tab
async function handleNewTab(url) {
  try {
    const tab = await chrome.tabs.create({ url: url || 'about:blank' });
    return { success: true, data: { tabId: tab.id, url: tab.url } };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Switch to tab
async function handleSwitchTab(tabId) {
  try {
    const tab = await chrome.tabs.update(tabId, { active: true });
    return { success: true, data: { tabId: tab.id, url: tab.url } };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Close tab
async function handleCloseTab(tabId) {
  try {
    await chrome.tabs.remove(tabId);
    return { success: true, data: { closed: true, tabId } };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Execute command in specific tab via content script
async function handleExecuteInTab(tabId, command) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'executeCommand',
      command,
    });
    return response;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Handle results from agent (forward to AI backend)
function handleAgentResult(result) {
  console.log('[Background] Agent result:', result);
  // Here you would send to your AI backend
  // Example: fetch('https://your-ai-backend.com/result', { method: 'POST', body: JSON.stringify(result) })
}

// ============================================================================
// AI Integration Example
// ============================================================================

/**
 * Example: Process AI command and execute in tab
 *
 * This is where you'd integrate with Claude API or other AI backend.
 * The AI would send commands, and this function executes them.
 */
async function processAICommand(aiCommand) {
  // Get active tab
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.id) {
    return { error: 'No active tab' };
  }

  // Send command to content script
  const result = await chrome.tabs.sendMessage(activeTab.id, {
    type: 'executeCommand',
    command: aiCommand,
  });

  return result;
}

// Example: AI workflow - snapshot then click
async function exampleAIWorkflow() {
  // 1. Get snapshot
  const snapshot = await processAICommand({
    id: '1',
    action: 'snapshot',
    interactive: true,
  });
  console.log('Snapshot:', snapshot);

  // 2. AI would analyze snapshot and decide what to click
  // For demo, just click first interactive element
  if (snapshot.success && snapshot.data?.refs) {
    const firstRef = Object.keys(snapshot.data.refs)[0];
    if (firstRef) {
      const clickResult = await processAICommand({
        id: '2',
        action: 'click',
        selector: `@${firstRef}`,
      });
      console.log('Click result:', clickResult);
    }
  }
}

// Make workflow available to popup
globalThis.exampleAIWorkflow = exampleAIWorkflow;
globalThis.processAICommand = processAICommand;
