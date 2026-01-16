/**
 * Content Script - Runs in web pages
 *
 * Uses ContentAgent pattern from @aspect/core for DOM operations.
 *
 * In production with bundler:
 *   import { createContentAgent } from '@aspect/core';
 *   const agent = createContentAgent();
 *
 * This standalone example implements the same API inline.
 */

// ============================================================================
// ContentAgent - DOM automation agent
// In production: import { createContentAgent } from '@aspect/core';
// ============================================================================

function createContentAgent(doc = document, win = window) {
  // Element reference map (using WeakRef pattern for memory efficiency)
  const refMap = new Map();
  let refCounter = 0;

  function getRef(ref) {
    const normalizedRef = ref.startsWith('@ref:') ? ref : `@ref:${ref}`;
    const element = refMap.get(normalizedRef);
    if (!element || !element.isConnected) {
      refMap.delete(normalizedRef);
      return null;
    }
    return element;
  }

  function generateRef(element) {
    for (const [ref, el] of refMap.entries()) {
      if (el === element) return ref;
    }
    const ref = `@ref:${refCounter++}`;
    refMap.set(ref, element);
    return ref;
  }

  function clearRefs() {
    refMap.clear();
    refCounter = 0;
  }

  function getElement(selector) {
    if (selector.startsWith('@ref:')) {
      return getRef(selector);
    }
    return doc.querySelector(selector);
  }

  // Snapshot generation
  const IMPLICIT_ROLES = {
    A: 'link', BUTTON: 'button', H1: 'heading', H2: 'heading',
    H3: 'heading', H4: 'heading', H5: 'heading', H6: 'heading',
    IMG: 'img', INPUT: 'textbox', NAV: 'navigation', SELECT: 'combobox',
    TEXTAREA: 'textbox', MAIN: 'main', FORM: 'form',
  };

  const INPUT_ROLES = {
    button: 'button', checkbox: 'checkbox', radio: 'radio',
    submit: 'button', text: 'textbox', email: 'textbox',
    password: 'textbox', search: 'searchbox',
  };

  function getRole(el) {
    const explicit = el.getAttribute('role');
    if (explicit) return explicit;
    if (el.tagName === 'INPUT') {
      return INPUT_ROLES[el.type] || 'textbox';
    }
    return IMPLICIT_ROLES[el.tagName] || null;
  }

  function getAccessibleName(el) {
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel.trim();

    if (el.tagName === 'IMG') {
      const alt = el.getAttribute('alt');
      if (alt) return alt.trim();
    }

    if (el.tagName === 'BUTTON' || el.tagName === 'A') {
      return el.textContent?.trim() || '';
    }

    if (el.tagName === 'INPUT' && ['submit', 'button'].includes(el.type)) {
      return el.value || el.type;
    }

    if (el.id) {
      const label = doc.querySelector(`label[for="${el.id}"]`);
      if (label) return label.textContent?.trim() || '';
    }

    return '';
  }

  function isInteractive(role) {
    return ['button', 'link', 'textbox', 'checkbox', 'radio', 'combobox',
      'listbox', 'menuitem', 'option', 'slider', 'searchbox', 'switch'].includes(role);
  }

  function createSnapshot(root = doc.body, maxDepth = 10) {
    clearRefs();
    const refs = {};
    const lines = [];

    function process(el, depth, indent) {
      if (depth > maxDepth) return;

      const style = win.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return;

      const role = getRole(el);
      const name = getAccessibleName(el);
      const interactive = role && isInteractive(role);

      if (role) {
        let line = indent;
        let ref;

        if (interactive) {
          ref = generateRef(el);
          refs[ref] = { role, name: name || undefined };
          line += `${ref} `;
        }

        line += role;
        if (name) {
          const truncated = name.length > 50 ? name.slice(0, 47) + '...' : name;
          line += ` "${truncated}"`;
        }

        const states = [];
        if (el.disabled) states.push('disabled');
        if (el.checked) states.push('checked');
        if (states.length) line += ` (${states.join(', ')})`;

        lines.push(line);
      }

      for (const child of el.children) {
        process(child, depth + 1, indent + '  ');
      }
    }

    process(root, 0, '');
    return { tree: lines.join('\n') || 'Empty page', refs };
  }

  // Command dispatcher
  async function dispatch(cmd) {
    switch (cmd.action) {
      case 'snapshot':
        return createSnapshot(
          cmd.selector ? getElement(cmd.selector) : doc.body,
          cmd.maxDepth || 10
        );

      case 'click': {
        const el = getElement(cmd.selector);
        if (!el) throw new Error(`Element not found: ${cmd.selector}`);
        el.focus?.();
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return { clicked: true };
      }

      case 'type': {
        const el = getElement(cmd.selector);
        if (!el) throw new Error(`Element not found: ${cmd.selector}`);
        if (cmd.clear) el.value = '';
        el.focus?.();
        for (const char of cmd.text) {
          el.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
          el.value += char;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
        }
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return { typed: true };
      }

      case 'fill': {
        const el = getElement(cmd.selector);
        if (!el) throw new Error(`Element not found: ${cmd.selector}`);
        el.focus?.();
        el.value = cmd.value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return { filled: true };
      }

      case 'check': {
        const el = getElement(cmd.selector);
        if (!el) throw new Error(`Element not found: ${cmd.selector}`);
        if (!el.checked) el.click();
        return { checked: true };
      }

      case 'uncheck': {
        const el = getElement(cmd.selector);
        if (!el) throw new Error(`Element not found: ${cmd.selector}`);
        if (el.checked) el.click();
        return { unchecked: true };
      }

      case 'select': {
        const el = getElement(cmd.selector);
        if (!el) throw new Error(`Element not found: ${cmd.selector}`);
        const values = Array.isArray(cmd.values) ? cmd.values : [cmd.values];
        for (const opt of el.options) {
          opt.selected = values.includes(opt.value);
        }
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return { selected: values };
      }

      case 'focus': {
        const el = getElement(cmd.selector);
        if (!el) throw new Error(`Element not found: ${cmd.selector}`);
        el.focus?.();
        return { focused: true };
      }

      case 'hover': {
        const el = getElement(cmd.selector);
        if (!el) throw new Error(`Element not found: ${cmd.selector}`);
        el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        return { hovered: true };
      }

      case 'scroll': {
        const x = cmd.x || 0;
        const y = cmd.y || 0;
        if (cmd.selector) {
          const el = getElement(cmd.selector);
          if (!el) throw new Error(`Element not found: ${cmd.selector}`);
          el.scrollBy(x, y);
        } else {
          win.scrollBy(x, y);
        }
        return { scrolled: true };
      }

      case 'scrollIntoView': {
        const el = getElement(cmd.selector);
        if (!el) throw new Error(`Element not found: ${cmd.selector}`);
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return { scrolled: true };
      }

      case 'getText': {
        const el = getElement(cmd.selector);
        if (!el) throw new Error(`Element not found: ${cmd.selector}`);
        return { text: el.textContent };
      }

      case 'getAttribute': {
        const el = getElement(cmd.selector);
        if (!el) throw new Error(`Element not found: ${cmd.selector}`);
        return { value: el.getAttribute(cmd.attribute) };
      }

      case 'isVisible': {
        const el = getElement(cmd.selector);
        if (!el) return { visible: false };
        const style = win.getComputedStyle(el);
        const visible = style.display !== 'none' && style.visibility !== 'hidden';
        return { visible };
      }

      case 'isEnabled': {
        const el = getElement(cmd.selector);
        if (!el) throw new Error(`Element not found: ${cmd.selector}`);
        return { enabled: !el.disabled };
      }

      case 'isChecked': {
        const el = getElement(cmd.selector);
        if (!el) throw new Error(`Element not found: ${cmd.selector}`);
        return { checked: !!el.checked };
      }

      case 'wait': {
        const timeout = cmd.timeout || 5000;
        const start = Date.now();
        while (Date.now() - start < timeout) {
          if (cmd.selector) {
            const el = getElement(cmd.selector);
            if (el) {
              const style = win.getComputedStyle(el);
              if (style.display !== 'none' && style.visibility !== 'hidden') {
                return { waited: true };
              }
            }
          }
          await new Promise(r => setTimeout(r, 100));
        }
        throw new Error(`Timeout waiting for ${cmd.selector}`);
      }

      case 'getUrl':
        return { url: win.location.href };

      case 'getTitle':
        return { title: doc.title };

      case 'evaluate': {
        const result = new Function(`return (${cmd.script})`)();
        return { result };
      }

      default:
        throw new Error(`Unknown action: ${cmd.action}`);
    }
  }

  // Return ContentAgent interface
  return {
    async execute(command) {
      try {
        const data = await dispatch(command);
        return { id: command.id, success: true, data };
      } catch (error) {
        return { id: command.id, success: false, error: error.message };
      }
    },

    async executeJson(json) {
      try {
        const command = JSON.parse(json);
        const response = await this.execute(command);
        return JSON.stringify(response);
      } catch (error) {
        return JSON.stringify({
          id: 'unknown',
          success: false,
          error: `Failed to parse command: ${error.message}`,
        });
      }
    },

    getRefMap() {
      return refMap;
    },

    clearRefs() {
      clearRefs();
    },
  };
}

// ============================================================================
// Initialize ContentAgent and set up message listener
// ============================================================================

const contentAgent = createContentAgent();

// Listen for commands from background script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'aspect:command') return false;

  contentAgent.execute(message.command)
    .then(response => {
      sendResponse({ type: 'aspect:response', response });
    })
    .catch(error => {
      sendResponse({
        type: 'aspect:response',
        response: {
          id: message.command.id,
          success: false,
          error: error.message
        }
      });
    });

  return true; // Keep channel open for async response
});

console.log('[Aspect] ContentAgent loaded in content script');
