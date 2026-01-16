/**
 * Popup Script - UI for controlling the browser agent
 */
import { createClient } from 'btcp-browser-agent/extension';

const client = createClient();

// DOM elements
const output = document.getElementById('output') as HTMLDivElement;
const commandJson = document.getElementById('commandJson') as HTMLTextAreaElement;
const sessionStatus = document.getElementById('sessionStatus') as HTMLDivElement;
const sessionName = document.getElementById('sessionName') as HTMLSpanElement;
const sessionCount = document.getElementById('sessionCount') as HTMLSpanElement;
const btnStartSession = document.getElementById('btnStartSession') as HTMLButtonElement;
const btnCloseSession = document.getElementById('btnCloseSession') as HTMLButtonElement;

function log(message: unknown) {
  const timestamp = new Date().toLocaleTimeString();
  const text = typeof message === 'object' ? JSON.stringify(message, null, 2) : String(message);
  output.textContent = `[${timestamp}]\n${text}`;
}

// Session management
async function updateSessionUI() {
  try {
    const { session } = await client.sessionGetCurrent();
    if (session) {
      sessionStatus.classList.remove('inactive');
      sessionName.classList.remove('inactive');
      sessionName.textContent = session.title;
      sessionCount.textContent = `${session.tabCount} tab${session.tabCount !== 1 ? 's' : ''}`;
      btnStartSession.style.display = 'none';
      btnCloseSession.style.display = 'block';

      // Enable all action buttons when session is active
      document.querySelectorAll('button:not(#btnStartSession)').forEach(btn => {
        (btn as HTMLButtonElement).disabled = false;
      });
    } else {
      sessionStatus.classList.add('inactive');
      sessionName.classList.add('inactive');
      sessionName.textContent = 'No active session';
      sessionCount.textContent = '';
      btnStartSession.style.display = 'block';
      btnCloseSession.style.display = 'none';

      // Disable action buttons when no session (except Start Session)
      document.querySelectorAll('button:not(#btnStartSession)').forEach(btn => {
        (btn as HTMLButtonElement).disabled = true;
      });
    }
  } catch (e) {
    console.error('Failed to update session UI:', e);
  }
}

// Session controls
btnStartSession.addEventListener('click', async () => {
  log('Starting new session...');
  try {
    const { group } = await client.groupCreate();
    log({ created: group.title, groupId: group.id });
    await updateSessionUI();
  } catch (e) {
    log(`Error: ${e}`);
  }
});

btnCloseSession.addEventListener('click', async () => {
  log('Closing session...');
  try {
    const { session } = await client.sessionGetCurrent();
    if (session) {
      await client.groupDelete(session.groupId);
      log({ closed: session.title });
      await updateSessionUI();
    }
  } catch (e) {
    log(`Error: ${e}`);
  }
});

// Update session UI on load
updateSessionUI();

// Quick actions
document.getElementById('btnSnapshot')?.addEventListener('click', async () => {
  log('Taking snapshot...');
  try {
    const data = await client.snapshot();
    log(data);
  } catch (e) {
    log(`Error: ${e}`);
  }
});

document.getElementById('btnScreenshot')?.addEventListener('click', async () => {
  log('Taking screenshot...');
  try {
    const data = await client.screenshot();
    log({ screenshot: data.slice(0, 50) + '...' });
  } catch (e) {
    log(`Error: ${e}`);
  }
});

document.getElementById('btnGetTabs')?.addEventListener('click', async () => {
  log('Listing tabs...');
  try {
    const tabs = await client.tabList();
    log(tabs);
  } catch (e) {
    log(`Error: ${e}`);
  }
});

document.getElementById('btnNewTab')?.addEventListener('click', async () => {
  log('Opening new tab...');
  try {
    const result = await client.tabNew({ url: 'https://example.com' });
    log(result);
  } catch (e) {
    log(`Error: ${e}`);
  }
});

// Navigate
document.getElementById('btnNavigate')?.addEventListener('click', async () => {
  const urlInput = document.getElementById('navigateUrl') as HTMLInputElement;
  const url = urlInput.value.trim();
  if (!url) {
    log('Enter a URL');
    return;
  }
  log(`Navigating to ${url}...`);
  try {
    await client.navigate(url);
    log({ navigated: url });
  } catch (e) {
    log(`Error: ${e}`);
  }
});

// Click
document.getElementById('btnClick')?.addEventListener('click', async () => {
  const selectorInput = document.getElementById('clickSelector') as HTMLInputElement;
  const selector = selectorInput.value.trim();
  if (!selector) {
    log('Enter a selector (e.g., @ref:0)');
    return;
  }
  log(`Clicking ${selector}...`);
  try {
    await client.click(selector);
    log({ clicked: selector });
  } catch (e) {
    log(`Error: ${e}`);
  }
});

// Fill
document.getElementById('btnFill')?.addEventListener('click', async () => {
  const selectorInput = document.getElementById('fillSelector') as HTMLInputElement;
  const valueInput = document.getElementById('fillValue') as HTMLInputElement;
  const selector = selectorInput.value.trim();
  const value = valueInput.value;
  if (!selector) {
    log('Enter a selector');
    return;
  }
  log(`Filling ${selector}...`);
  try {
    await client.fill(selector, value);
    log({ filled: selector, value });
  } catch (e) {
    log(`Error: ${e}`);
  }
});

// Custom command
document.getElementById('btnExecute')?.addEventListener('click', async () => {
  const json = commandJson.value.trim();
  if (!json) {
    log('Enter a command');
    return;
  }
  try {
    const command = JSON.parse(json);
    log(`Executing: ${command.action}...`);
    const result = await client.execute(command);
    log(result);
  } catch (e) {
    log(`Error: ${e}`);
  }
});

// Enter key handlers
document.getElementById('navigateUrl')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') document.getElementById('btnNavigate')?.click();
});

document.getElementById('clickSelector')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') document.getElementById('btnClick')?.click();
});

document.getElementById('fillValue')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') document.getElementById('btnFill')?.click();
});

log('Ready');
