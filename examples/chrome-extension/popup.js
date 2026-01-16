/**
 * Popup Script
 *
 * UI for controlling the Aspect Browser Agent.
 * Sends commands to background script which routes them appropriately.
 */

let commandId = 0;

const output = document.getElementById('output');
const commandJson = document.getElementById('commandJson');

function log(message) {
  const timestamp = new Date().toLocaleTimeString();
  const text = typeof message === 'object' ? JSON.stringify(message, null, 2) : message;
  output.textContent = `[${timestamp}]\n${text}`;
}

// Send command to background script
async function sendCommand(command) {
  try {
    command.id = `cmd_${++commandId}`;
    log(`Executing: ${command.action}...`);

    const response = await chrome.runtime.sendMessage({
      type: 'aspect:command',
      command,
    });

    if (response?.type === 'aspect:response') {
      log(response.response);
      return response.response;
    } else {
      log(response);
      return response;
    }
  } catch (error) {
    log(`Error: ${error.message}`);
    return null;
  }
}

// Setup event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Snapshot
  document.getElementById('btnSnapshot').addEventListener('click', () => {
    sendCommand({ action: 'snapshot' });
  });

  // Screenshot
  document.getElementById('btnScreenshot').addEventListener('click', () => {
    sendCommand({ action: 'screenshot' });
  });

  // List Tabs
  document.getElementById('btnGetTabs').addEventListener('click', () => {
    sendCommand({ action: 'tabList' });
  });

  // New Tab
  document.getElementById('btnNewTab').addEventListener('click', () => {
    sendCommand({ action: 'tabNew', url: 'https://example.com' });
  });

  // Navigate
  document.getElementById('btnNavigate').addEventListener('click', () => {
    const url = document.getElementById('navigateUrl').value.trim();
    if (url) {
      sendCommand({ action: 'navigate', url });
    } else {
      log('Enter a URL');
    }
  });

  // Click
  document.getElementById('btnClick').addEventListener('click', () => {
    const selector = document.getElementById('clickSelector').value.trim();
    if (selector) {
      sendCommand({ action: 'click', selector });
    } else {
      log('Enter a selector (e.g., @ref:0)');
    }
  });

  // Fill
  document.getElementById('btnFill').addEventListener('click', () => {
    const selector = document.getElementById('fillSelector').value.trim();
    const value = document.getElementById('fillValue').value;
    if (selector) {
      sendCommand({ action: 'fill', selector, value });
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
      sendCommand(command);
    } catch (error) {
      log(`Invalid JSON: ${error.message}`);
    }
  });

  // Enter key handlers
  document.getElementById('navigateUrl').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('btnNavigate').click();
  });

  document.getElementById('clickSelector').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('btnClick').click();
  });

  document.getElementById('fillValue').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('btnFill').click();
  });
});
