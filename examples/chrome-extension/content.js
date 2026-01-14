/**
 * Content Script
 *
 * Runs in the context of web pages and executes BrowserAgent commands.
 * Communicates with background script for chrome.* API access.
 */

// Import BrowserAgent (bundled version would be injected)
// In production, you'd bundle btcp-browser-agent and include it

let agent = null;

// Initialize agent when script loads
async function initAgent() {
  try {
    // For production, import from bundled file:
    // const { BrowserAgent } = await import(chrome.runtime.getURL('btcp-browser-agent.js'));

    // For now, we'll create a minimal agent inline
    // This would be replaced with the actual BrowserAgent import
    agent = createMinimalAgent();

    // Notify background that agent is ready
    chrome.runtime.sendMessage({ type: 'agentReady' });
    console.log('[Content] BrowserAgent initialized');
  } catch (error) {
    console.error('[Content] Failed to initialize agent:', error);
  }
}

// Create minimal agent for demo (replace with actual BrowserAgent)
function createMinimalAgent() {
  return {
    async execute(command) {
      console.log('[Content] Executing:', command);

      try {
        switch (command.action) {
          case 'snapshot':
            return handleSnapshot(command);
          case 'click':
            return handleClick(command);
          case 'type':
            return handleType(command);
          case 'fill':
            return handleFill(command);
          case 'screenshot':
            return handleScreenshot(command);
          case 'evaluate':
            return handleEvaluate(command);
          case 'getText':
          case 'gettext':
            return handleGetText(command);
          case 'isVisible':
          case 'isvisible':
            return handleIsVisible(command);
          case 'wait':
            return handleWait(command);
          case 'scroll':
            return handleScroll(command);
          case 'hover':
            return handleHover(command);
          default:
            return { id: command.id, success: false, error: `Unknown action: ${command.action}` };
        }
      } catch (error) {
        return { id: command.id, success: false, error: error.message };
      }
    },
  };
}

// ============================================================================
// Command Handlers
// ============================================================================

// Element ref storage
const elementRefs = new Map();
let refCounter = 0;

function handleSnapshot(command) {
  elementRefs.clear();
  refCounter = 0;

  const snapshot = buildSnapshot(document.body, command.interactive);
  const refs = {};

  elementRefs.forEach((el, ref) => {
    refs[ref] = {
      role: getRole(el),
      name: getAccessibleName(el),
      selector: generateSelector(el),
    };
  });

  return {
    id: command.id,
    success: true,
    data: { snapshot, refs },
  };
}

function buildSnapshot(root, interactiveOnly = false) {
  const lines = [];

  function walk(el, depth = 0) {
    if (!isVisible(el)) return;

    const isInteractive = isInteractiveElement(el);
    if (interactiveOnly && !isInteractive) {
      // Still walk children
      for (const child of el.children) {
        walk(child, depth);
      }
      return;
    }

    const role = getRole(el);
    const name = getAccessibleName(el);

    if (role || isInteractive) {
      const ref = `e${++refCounter}`;
      elementRefs.set(ref, el);

      const indent = '  '.repeat(depth);
      const namePart = name ? ` '${name}'` : '';
      lines.push(`${indent}- ${role}${namePart} [ref=${ref}]`);
    }

    for (const child of el.children) {
      walk(child, depth + 1);
    }
  }

  walk(root);
  return lines.join('\n');
}

function handleClick(command) {
  const el = findElement(command.selector);
  if (!el) {
    return { id: command.id, success: false, error: `Element not found: ${command.selector}` };
  }

  el.click();
  return { id: command.id, success: true, data: {} };
}

function handleType(command) {
  const el = findElement(command.selector);
  if (!el) {
    return { id: command.id, success: false, error: `Element not found: ${command.selector}` };
  }

  el.focus();
  for (const char of command.text) {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: char }));
    el.dispatchEvent(new KeyboardEvent('keypress', { key: char }));
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.value += char;
    }
    el.dispatchEvent(new KeyboardEvent('keyup', { key: char }));
    el.dispatchEvent(new InputEvent('input', { data: char }));
  }

  return { id: command.id, success: true, data: {} };
}

function handleFill(command) {
  const el = findElement(command.selector);
  if (!el) {
    return { id: command.id, success: false, error: `Element not found: ${command.selector}` };
  }

  el.focus();
  el.value = command.value;
  el.dispatchEvent(new InputEvent('input', { data: command.value }));
  el.dispatchEvent(new Event('change', { bubbles: true }));

  return { id: command.id, success: true, data: {} };
}

async function handleScreenshot(command) {
  // Request screenshot from background script
  const response = await chrome.runtime.sendMessage({ type: 'screenshot' });
  return { id: command.id, ...response };
}

function handleEvaluate(command) {
  try {
    const result = eval(command.script);
    return { id: command.id, success: true, data: { result } };
  } catch (error) {
    return { id: command.id, success: false, error: error.message };
  }
}

function handleGetText(command) {
  const el = findElement(command.selector);
  if (!el) {
    return { id: command.id, success: false, error: `Element not found: ${command.selector}` };
  }

  return { id: command.id, success: true, data: { text: el.textContent } };
}

function handleIsVisible(command) {
  const el = findElement(command.selector);
  if (!el) {
    return { id: command.id, success: true, data: { visible: false } };
  }

  return { id: command.id, success: true, data: { visible: isVisible(el) } };
}

async function handleWait(command) {
  const timeout = command.timeout || 5000;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const el = findElement(command.selector);
    if (el && isVisible(el)) {
      return { id: command.id, success: true, data: {} };
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  return { id: command.id, success: false, error: `Timeout waiting for: ${command.selector}` };
}

function handleScroll(command) {
  if (command.selector) {
    const el = findElement(command.selector);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  } else {
    const amount = command.amount || 300;
    const dir = command.direction || 'down';
    const x = dir === 'left' ? -amount : dir === 'right' ? amount : 0;
    const y = dir === 'up' ? -amount : dir === 'down' ? amount : 0;
    window.scrollBy({ left: x, top: y, behavior: 'smooth' });
  }
  return { id: command.id, success: true, data: {} };
}

function handleHover(command) {
  const el = findElement(command.selector);
  if (!el) {
    return { id: command.id, success: false, error: `Element not found: ${command.selector}` };
  }

  const rect = el.getBoundingClientRect();
  el.dispatchEvent(
    new MouseEvent('mouseover', {
      bubbles: true,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    })
  );

  return { id: command.id, success: true, data: {} };
}

// ============================================================================
// Helper Functions
// ============================================================================

function findElement(selector) {
  if (!selector) return null;

  // Handle ref selectors (@e1, ref=e1, e1)
  const refMatch = selector.match(/^(?:@|ref=)?e(\d+)$/);
  if (refMatch) {
    return elementRefs.get(`e${refMatch[1]}`);
  }

  // Handle ref in brackets [ref=e1]
  const bracketMatch = selector.match(/^\[ref=e(\d+)\]$/);
  if (bracketMatch) {
    return elementRefs.get(`e${bracketMatch[1]}`);
  }

  // CSS selector
  return document.querySelector(selector);
}

function isVisible(el) {
  if (!el || el.nodeType !== 1) return false;
  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function isInteractiveElement(el) {
  const interactiveTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];
  if (interactiveTags.includes(el.tagName)) return true;
  if (el.getAttribute('role') === 'button') return true;
  if (el.getAttribute('tabindex') !== null) return true;
  if (el.onclick || el.getAttribute('onclick')) return true;
  return false;
}

function getRole(el) {
  const explicit = el.getAttribute('role');
  if (explicit) return explicit;

  const tagRoles = {
    A: 'link',
    BUTTON: 'button',
    INPUT: el.type === 'checkbox' ? 'checkbox' : el.type === 'radio' ? 'radio' : 'textbox',
    SELECT: 'combobox',
    TEXTAREA: 'textbox',
    IMG: 'img',
    H1: 'heading',
    H2: 'heading',
    H3: 'heading',
    H4: 'heading',
    H5: 'heading',
    H6: 'heading',
    NAV: 'navigation',
    MAIN: 'main',
    HEADER: 'banner',
    FOOTER: 'contentinfo',
    FORM: 'form',
    TABLE: 'table',
    UL: 'list',
    OL: 'list',
    LI: 'listitem',
  };

  return tagRoles[el.tagName] || '';
}

function getAccessibleName(el) {
  // aria-label
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.trim();

  // aria-labelledby
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelEl = document.getElementById(labelledBy);
    if (labelEl) return labelEl.textContent?.trim() || '';
  }

  // Input labels
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
    const id = el.id;
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) return label.textContent?.trim() || '';
    }
    const placeholder = el.getAttribute('placeholder');
    if (placeholder) return placeholder.trim();
  }

  // Button/link text
  if (el.tagName === 'BUTTON' || el.tagName === 'A') {
    return el.textContent?.trim() || '';
  }

  // Image alt
  if (el.tagName === 'IMG') {
    return el.getAttribute('alt') || '';
  }

  // Title
  const title = el.getAttribute('title');
  if (title) return title.trim();

  return '';
}

function generateSelector(el) {
  if (el.id) return `#${CSS.escape(el.id)}`;

  const testId = el.getAttribute('data-testid');
  if (testId) return `[data-testid="${CSS.escape(testId)}"]`;

  // Build path
  const path = [];
  let current = el;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    const classes = Array.from(current.classList)
      .filter((c) => !c.match(/^[a-z0-9]{8,}$/i))
      .slice(0, 2);
    if (classes.length) {
      selector += '.' + classes.map((c) => CSS.escape(c)).join('.');
    }

    path.unshift(selector);
    current = current.parentElement;
  }

  return path.join(' > ');
}

// ============================================================================
// Message Handling
// ============================================================================

// Listen for commands from background/popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Content] Received:', message.type, message);

  if (message.type === 'executeCommand' && agent) {
    agent.execute(message.command).then(sendResponse);
    return true; // Keep channel open for async
  }

  if (message.type === 'ping') {
    sendResponse({ success: true, ready: !!agent });
    return false;
  }

  return false;
});

// Initialize on load
initAgent();
