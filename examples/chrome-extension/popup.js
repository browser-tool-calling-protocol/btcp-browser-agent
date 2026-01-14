/**
 * Popup Script
 *
 * UI for controlling the AI Browser Agent.
 * Communicates with background and content scripts.
 */

let commandId = 0;

// Elements
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const output = document.getElementById('output');
const commandJson = document.getElementById('commandJson');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await checkStatus();
  setupEventListeners();
});

// Check if content script is ready
async function checkStatus() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      setStatus(false, 'No active tab');
      return;
    }

    const response = await chrome.tabs.sendMessage(tab.id, { type: 'ping' });
    if (response?.ready) {
      setStatus(true, `Ready on: ${new URL(tab.url).hostname}`);
    } else {
      setStatus(false, 'Agent not ready');
    }
  } catch (error) {
    setStatus(false, 'Content script not loaded');
  }
}

function setStatus(ready, text) {
  statusDot.classList.toggle('ready', ready);
  statusText.textContent = text;
}

function log(message) {
  const timestamp = new Date().toLocaleTimeString();
  const text = typeof message === 'object' ? JSON.stringify(message, null, 2) : message;
  output.textContent = `[${timestamp}]\n${text}`;
  console.log('[Popup]', message);
}

// Execute command in active tab
async function executeCommand(command) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      log('Error: No active tab');
      return null;
    }

    // Add command ID
    command.id = `cmd${++commandId}`;

    log(`Executing: ${command.action}...`);

    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'executeCommand',
      command,
    });

    log(response);
    return response;
  } catch (error) {
    log(`Error: ${error.message}`);
    return null;
  }
}

// Execute via background script
async function executeViaBackground(type, data = {}) {
  try {
    log(`${type}...`);
    const response = await chrome.runtime.sendMessage({ type, ...data });
    log(response);
    return response;
  } catch (error) {
    log(`Error: ${error.message}`);
    return null;
  }
}

// Setup event listeners
function setupEventListeners() {
  // Snapshot
  document.getElementById('btnSnapshot').addEventListener('click', () => {
    executeCommand({ action: 'snapshot', interactive: true });
  });

  // Screenshot
  document.getElementById('btnScreenshot').addEventListener('click', () => {
    executeViaBackground('screenshot');
  });

  // Get Tabs
  document.getElementById('btnGetTabs').addEventListener('click', () => {
    executeViaBackground('getTabs');
  });

  // New Tab
  document.getElementById('btnNewTab').addEventListener('click', () => {
    executeViaBackground('newTab', { url: 'https://example.com' });
  });

  // Click
  document.getElementById('btnClick').addEventListener('click', () => {
    const selector = document.getElementById('clickSelector').value.trim();
    if (selector) {
      executeCommand({ action: 'click', selector });
    } else {
      log('Enter a selector');
    }
  });

  // Fill
  document.getElementById('btnFill').addEventListener('click', () => {
    const selector = document.getElementById('fillSelector').value.trim();
    const value = document.getElementById('fillValue').value;
    if (selector) {
      executeCommand({ action: 'fill', selector, value });
    } else {
      log('Enter a selector');
    }
  });

  // Execute custom command
  document.getElementById('btnExecute').addEventListener('click', () => {
    try {
      const json = commandJson.value.trim();
      if (!json) {
        log('Enter a command');
        return;
      }
      const command = JSON.parse(json);
      executeCommand(command);
    } catch (error) {
      log(`Invalid JSON: ${error.message}`);
    }
  });

  // Enter key in inputs
  document.getElementById('clickSelector').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('btnClick').click();
  });

  document.getElementById('fillValue').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('btnFill').click();
  });
}
