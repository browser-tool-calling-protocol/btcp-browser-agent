/**
 * @btcp/core - DOM Actions
 *
 * Element interaction handlers using native browser APIs.
 */

import type {
  Command,
  Response,
  RefMap,
  BoundingBox,
  SnapshotData,
  Modifier,
  ValidateElementResponse,
  ValidateRefsResponse,
} from './types.js';
import { createSnapshot, extract } from './snapshot/index.js';
import {
  DetailedError,
  createElementNotFoundError,
  createElementNotCompatibleError,
  createTimeoutError,
  createInvalidParametersError,
  createVerificationError,
} from './errors.js';
import {
  assertConnected,
  assertValueContains,
  assertValueEquals,
  assertChecked,
  assertSelected,
  waitForAssertion,
  type ActionResult,
} from './assertions.js';

// Command ID counter for auto-generated IDs
let commandIdCounter = 0;

/**
 * Generate a unique command ID
 */
export function generateCommandId(): string {
  return `cmd_${Date.now()}_${commandIdCounter++}`;
}

/**
 * DOM Actions executor
 */
export class DOMActions {
  private document: Document;
  private window: Window;
  private refMap: RefMap;
  private lastSnapshotData: SnapshotData | null = null;
  private overlayContainer: HTMLElement | null = null;
  private scrollListener: (() => void) | null = null;
  private rafId: number | null = null;
  // Cached HTML element constructors for cross-context instanceof checks
  private _HTMLElement: typeof HTMLElement;
  private _HTMLInputElement: typeof HTMLInputElement;
  private _HTMLTextAreaElement: typeof HTMLTextAreaElement;
  private _HTMLSelectElement: typeof HTMLSelectElement;
  private _HTMLButtonElement: typeof HTMLButtonElement;
  private _HTMLAnchorElement: typeof HTMLAnchorElement;

  constructor(doc: Document, win: Window, refMap: RefMap) {
    this.document = doc;
    this.window = win;
    // Cache HTML element constructors from the window context
    // This ensures instanceof checks work correctly in JSDOM and cross-frame scenarios
    this._HTMLElement = (win as any).HTMLElement;
    this._HTMLInputElement = (win as any).HTMLInputElement;
    this._HTMLTextAreaElement = (win as any).HTMLTextAreaElement;
    this._HTMLSelectElement = (win as any).HTMLSelectElement;
    this._HTMLButtonElement = (win as any).HTMLButtonElement;
    this._HTMLAnchorElement = (win as any).HTMLAnchorElement;
    this.refMap = refMap;
  }

  /**
   * Execute a command and return a response
   *
   * The command ID is auto-generated internally - users don't need to provide it.
   */
  async execute(command: Command): Promise<Response> {
    // Auto-generate ID if not provided
    const id = command.id || generateCommandId();

    try {
      const data = await this.dispatch(command);
      return { id, success: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Include structured error data if available
      if (error instanceof DetailedError) {
        return {
          id,
          success: false,
          error: message,
          errorCode: error.code,
          errorContext: error.context,
          suggestions: error.suggestions,
        };
      }

      return { id, success: false, error: message };
    }
  }

  private async dispatch(command: Command): Promise<unknown> {
    switch (command.action) {
      case 'click':
        return this.click(command.selector, {
          button: command.button,
          clickCount: command.clickCount,
          modifiers: command.modifiers,
        });

      case 'dblclick':
        return this.dblclick(command.selector);

      case 'type':
        return this.type(command.selector, command.text, {
          delay: command.delay,
          clear: command.clear,
        });

      case 'fill':
        return this.fill(command.selector, command.value);

      case 'clear':
        return this.clear(command.selector);

      case 'check':
        return this.check(command.selector);

      case 'uncheck':
        return this.uncheck(command.selector);

      case 'select':
        return this.select(command.selector, command.values);

      case 'focus':
        return this.focus(command.selector);

      case 'blur':
        return this.blur(command.selector);

      case 'hover':
        return this.hover(command.selector);

      case 'scroll':
        return this.scroll(command.selector, {
          x: command.x,
          y: command.y,
          direction: command.direction,
          amount: command.amount,
        });

      case 'scrollIntoView':
        return this.scrollIntoView(command.selector, command.block);

      case 'snapshot':
        return this.snapshot({
          selector: command.selector,
          maxDepth: command.maxDepth,
          includeHidden: command.includeHidden,
          compact: command.compact,
          mode: command.mode,
          format: command.format,
          grep: command.grep,
          maxLength: command.maxLength,
        });

      case 'extract':
        return this.extract({
          selector: command.selector,
          format: command.format,
          maxDepth: command.maxDepth,
          includeHidden: command.includeHidden,
          maxLength: command.maxLength,
          includeLinks: command.includeLinks,
          includeImages: command.includeImages,
        });

      case 'querySelector':
        return this.querySelector(command.selector);

      case 'querySelectorAll':
        return this.querySelectorAll(command.selector);

      case 'getText':
        return this.getText(command.selector);

      case 'getAttribute':
        return this.getAttribute(command.selector, command.attribute);

      case 'getProperty':
        return this.getProperty(command.selector, command.property);

      case 'getBoundingBox':
        return this.getBoundingBox(command.selector);

      case 'isVisible':
        return this.isVisible(command.selector);

      case 'isEnabled':
        return this.isEnabled(command.selector);

      case 'isChecked':
        return this.isChecked(command.selector);

      case 'press':
        return this.press(command.key, command.selector, command.modifiers);

      case 'keyDown':
        return this.keyDown(command.key);

      case 'keyUp':
        return this.keyUp(command.key);

      case 'wait':
        return this.wait(command.selector, {
          state: command.state,
          timeout: command.timeout,
        });

      case 'evaluate':
        return this.evaluate(command.script, command.args);

      case 'validateElement':
        return this.validateElement(command.selector, {
          expectedType: command.expectedType,
          capabilities: command.capabilities,
        });

      case 'validateRefs':
        return this.validateRefs(command.refs);

      case 'highlight':
        return this.highlight();

      case 'clearHighlight':
        return this.clearHighlight();

      default:
        throw new Error(`Unknown action: ${(command as Command).action}`);
    }
  }

  // --- Element Resolution ---

  private getElement(selector: string): Element {
    const element = this.queryElement(selector);
    if (!element) {
      const isRef = selector.startsWith('@ref:');
      const similarSelectors = isRef ? [] : this.findSimilarSelectors(selector);
      const nearbyElements = this.getNearbyInteractiveElements();

      throw createElementNotFoundError(selector, {
        similarSelectors,
        nearbyElements: nearbyElements.slice(0, 5),
        isRef,
      });
    }
    return element;
  }

  /**
   * Find selectors similar to the given selector
   */
  private findSimilarSelectors(selector: string): Array<{ selector: string; role: string; name: string }> {
    const results: Array<{ selector: string; role: string; name: string }> = [];

    try {
      // Try to extract ID or class from selector
      const idMatch = selector.match(/#([a-zA-Z0-9_-]+)/);
      const classMatch = selector.match(/\.([a-zA-Z0-9_-]+)/);

      if (idMatch) {
        // Look for similar IDs
        const targetId = idMatch[1].toLowerCase();
        const allElements = this.document.querySelectorAll('[id]');
        allElements.forEach(el => {
          const elId = el.id.toLowerCase();
          if (elId !== targetId && (elId.includes(targetId) || targetId.includes(elId))) {
            const role = el.getAttribute('role') || el.tagName.toLowerCase();
            const name = el.textContent?.trim().substring(0, 30) || el.getAttribute('aria-label') || '';
            results.push({
              selector: `#${el.id}`,
              role,
              name,
            });
          }
        });
      }

      if (classMatch && results.length < 3) {
        // Look for similar classes
        const targetClass = classMatch[1].toLowerCase();
        const allElements = this.document.querySelectorAll('[class]');
        allElements.forEach(el => {
          const classes = Array.from(el.classList).map(c => c.toLowerCase());
          const similarClass = classes.find(c => c !== targetClass && (c.includes(targetClass) || targetClass.includes(c)));
          if (similarClass) {
            const role = el.getAttribute('role') || el.tagName.toLowerCase();
            const name = el.textContent?.trim().substring(0, 30) || el.getAttribute('aria-label') || '';
            results.push({
              selector: `.${similarClass}`,
              role,
              name,
            });
          }
        });
      }
    } catch (e) {
      // Ignore errors in similarity search
    }

    return results.slice(0, 3);
  }

  /**
   * Get nearby interactive elements
   */
  private getNearbyInteractiveElements(): Array<{ ref: string; role: string; name: string }> {
    const results: Array<{ ref: string; role: string; name: string }> = [];

    try {
      const interactiveSelectors = [
        'button',
        'a[href]',
        'input',
        'textarea',
        'select',
        '[role="button"]',
        '[role="link"]',
        '[tabindex]'
      ];

      const elements = this.document.querySelectorAll(interactiveSelectors.join(','));

      elements.forEach(el => {
        if (el instanceof this._HTMLElement) {
          const style = this.window.getComputedStyle(el);
          const isVisible = style.display !== 'none' && style.visibility !== 'hidden';

          if (isVisible) {
            const ref = this.refMap.generateRef(el);
            const role = el.getAttribute('role') || el.tagName.toLowerCase();
            const name = el.textContent?.trim().substring(0, 30) ||
                        el.getAttribute('aria-label') ||
                        (el as HTMLInputElement).value?.substring(0, 30) ||
                        (el as HTMLInputElement).placeholder ||
                        '';

            results.push({ ref, role, name });
          }
        }
      });
    } catch (e) {
      // Ignore errors in nearby element search
    }

    return results.slice(0, 10);
  }

  /**
   * Get available actions for an element based on its type
   */
  private getAvailableActionsForElement(element: Element): string[] {
    const actions: string[] = [];

    // All elements can be queried and inspected
    actions.push('querySelector', 'getText', 'getAttribute', 'getProperty', 'getBoundingBox', 'isVisible');

    // Clickable elements
    if (
      element instanceof this._HTMLButtonElement ||
      element instanceof this._HTMLAnchorElement ||
      element.getAttribute('role') === 'button' ||
      element.getAttribute('role') === 'link' ||
      element.hasAttribute('onclick')
    ) {
      actions.push('click', 'dblclick', 'hover');
    }

    // Input elements
    if (element instanceof this._HTMLInputElement) {
      actions.push('fill', 'clear', 'focus', 'blur', 'isEnabled');

      if (element.type === 'checkbox' || element.type === 'radio') {
        actions.push('check', 'uncheck', 'isChecked');
      } else {
        actions.push('type');
      }
    }

    // Textarea elements
    if (element instanceof this._HTMLTextAreaElement) {
      actions.push('type', 'fill', 'clear', 'focus', 'blur');
    }

    // Select elements
    if (element instanceof this._HTMLSelectElement) {
      actions.push('select', 'focus', 'blur');
    }

    // Focusable elements
    if (element instanceof this._HTMLElement) {
      actions.push('focus', 'blur', 'scroll', 'scrollIntoView', 'press');
    }

    return actions;
  }

  private queryElement(selector: string): Element | null {
    // Check if it's a ref
    if (selector.startsWith('@ref:')) {
      return this.refMap.get(selector);
    }

    // Check if it's an XPath selector
    if (selector.startsWith('/')) {
      return this.evaluateXPath(selector);
    }

    // CSS selector
    return this.document.querySelector(selector);
  }

  /**
   * Evaluate XPath expression and return first matching element
   * Supports union operators (|) for multiple paths
   */
  private evaluateXPath(xpath: string): Element | null {
    try {
      // Handle union operators by splitting and trying each path
      if (xpath.includes('|')) {
        const paths = xpath.split('|').map(p => p.trim());
        for (const path of paths) {
          const result = this.evaluateXPath(path);
          if (result) {
            return result;
          }
        }
        return null;
      }

      // Evaluate single XPath expression
      const result = this.document.evaluate(
        xpath,
        this.document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );

      return result.singleNodeValue as Element | null;
    } catch (error) {
      // Invalid XPath syntax - return null like querySelector would
      return null;
    }
  }

  private queryElements(selector: string): Element[] {
    if (selector.startsWith('@ref:')) {
      const el = this.refMap.get(selector);
      return el ? [el] : [];
    }

    // Check if it's an XPath selector
    if (selector.startsWith('/')) {
      return this.evaluateXPathAll(selector);
    }

    return Array.from(this.document.querySelectorAll(selector));
  }

  /**
   * Evaluate XPath expression and return all matching elements
   * Supports union operators (|) for multiple paths
   */
  private evaluateXPathAll(xpath: string): Element[] {
    try {
      const elements: Element[] = [];

      // Handle union operators by splitting and evaluating each path
      if (xpath.includes('|')) {
        const paths = xpath.split('|').map(p => p.trim());
        for (const path of paths) {
          elements.push(...this.evaluateXPathAll(path));
        }
        return elements;
      }

      // Evaluate single XPath expression
      const result = this.document.evaluate(
        xpath,
        this.document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );

      for (let i = 0; i < result.snapshotLength; i++) {
        const node = result.snapshotItem(i);
        if (node && node.nodeType === Node.ELEMENT_NODE) {
          elements.push(node as Element);
        }
      }

      return elements;
    } catch (error) {
      // Invalid XPath syntax - return empty array like querySelectorAll would
      return [];
    }
  }

  // --- Actions ---

  private async click(
    selector: string,
    options: { button?: 'left' | 'right' | 'middle'; clickCount?: number; modifiers?: Modifier[] } = {}
  ): Promise<ActionResult & { connected: boolean }> {
    const element = this.getElement(selector);
    const { button = 'left', clickCount = 1, modifiers = [] } = options;

    if (element instanceof this._HTMLElement) {
      element.focus();
    }

    const buttonCode = button === 'right' ? 2 : button === 'middle' ? 1 : 0;
    const eventInit: MouseEventInit = {
      bubbles: true,
      cancelable: true,
      button: buttonCode,
      altKey: modifiers.includes('Alt'),
      ctrlKey: modifiers.includes('Control'),
      metaKey: modifiers.includes('Meta'),
      shiftKey: modifiers.includes('Shift'),
    };

    for (let i = 0; i < clickCount; i++) {
      element.dispatchEvent(new MouseEvent('mousedown', eventInit));
      element.dispatchEvent(new MouseEvent('mouseup', eventInit));
      element.dispatchEvent(new MouseEvent('click', eventInit));
    }

    // Check if element is still connected (graceful - doesn't throw)
    // Element may be intentionally removed by click handlers (e.g., modal close, navigation)
    const connectionResult = assertConnected(element);

    return { success: true, error: null, connected: connectionResult.success };
  }

  private async dblclick(selector: string): Promise<ActionResult> {
    const element = this.getElement(selector);
    element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    return { success: true, error: null };
  }

  private async type(
    selector: string,
    text: string,
    options: { delay?: number; clear?: boolean } = {}
  ): Promise<ActionResult> {
    const element = this.getElement(selector);

    // Check if element is contenteditable
    const isContentEditable = element.getAttribute('contenteditable') === 'true' ||
                              element.getAttribute('contenteditable') === '';

    if (!(element instanceof this._HTMLInputElement || element instanceof this._HTMLTextAreaElement || isContentEditable)) {
      const actualType = element.tagName.toLowerCase();
      const availableActions = this.getAvailableActionsForElement(element);

      throw createElementNotCompatibleError(
        selector,
        'type',
        actualType,
        ['input', 'textarea', 'contenteditable'],
        availableActions
      );
    }

    // Focus the element (cast to HTMLElement for contenteditable)
    if (element instanceof this._HTMLElement) {
      element.focus();
    }

    // Handle contenteditable elements differently
    if (isContentEditable) {
      const htmlElement = element as HTMLElement;

      if (options.clear) {
        // Use execCommand for better undo/redo support (when available)
        const hasExec = typeof this.document.execCommand === 'function';
        if (hasExec) {
          try {
            this.document.execCommand('selectAll', false);
            this.document.execCommand('delete', false);
          } catch {
            // Ignore execCommand errors
          }
        }
        // Fallback/ensure cleared
        if (htmlElement.textContent) {
          htmlElement.textContent = '';
        }
        htmlElement.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // Check if execCommand is available (not in JSDOM)
      const hasExecCommand = typeof this.document.execCommand === 'function';

      // Try fast path: execCommand('insertText') for entire text at once
      // This works with most rich text editors (Gmail, Slack, etc.) and supports undo/redo
      let inserted = false;
      if (!options.delay && hasExecCommand) {
        // Ensure cursor is positioned in the element for execCommand
        const selection = this.window.getSelection();
        if (selection) {
          const range = this.document.createRange();
          range.selectNodeContents(htmlElement);
          range.collapse(false); // collapse to end
          selection.removeAllRanges();
          selection.addRange(range);
        }

        try {
          inserted = this.document.execCommand('insertText', false, text);
          if (inserted) {
            htmlElement.dispatchEvent(new Event('input', { bubbles: true }));
          }
        } catch {
          inserted = false;
        }
      }

      // Fallback: char-by-char for delay mode or if execCommand failed/unavailable
      if (!inserted) {
        for (const char of text) {
          htmlElement.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
          htmlElement.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));

          // Try execCommand first (works with undo/redo in real browsers)
          let charInserted = false;
          if (hasExecCommand) {
            try {
              charInserted = this.document.execCommand('insertText', false, char);
            } catch {
              charInserted = false;
            }
          }

          // Fallback: append to textContent (works in JSDOM and as last resort)
          if (!charInserted) {
            // For plain contenteditable, direct append works reliably
            htmlElement.textContent = (htmlElement.textContent || '') + char;
          }

          htmlElement.dispatchEvent(new Event('input', { bubbles: true }));
          htmlElement.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));

          if (options.delay) {
            await this.sleep(options.delay);
          }
        }
      }

      htmlElement.dispatchEvent(new Event('change', { bubbles: true }));

      // Wait for verification that textContent contains typed text
      const result = await waitForAssertion(
        () => {
          const content = htmlElement.textContent || '';
          const expected = text;
          const actual = content;
          if (!content.includes(text)) {
            return {
              success: false,
              error: `Expected textContent to contain "${text}"`,
              description: 'textContent check',
              expected,
              actual
            };
          }
          return {
            success: true,
            error: null,
            description: 'textContent check',
            expected,
            actual
          };
        },
        { timeout: 1000, interval: 50 }
      );

      if (!result.success) {
        throw createVerificationError('type', result, selector);
      }
    } else {
      // Handle regular input/textarea elements
      const inputElement = element as HTMLInputElement | HTMLTextAreaElement;

      if (options.clear) {
        inputElement.value = '';
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
      }

      for (const char of text) {
        inputElement.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
        inputElement.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
        inputElement.value += char;
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        inputElement.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));

        if (options.delay) {
          await this.sleep(options.delay);
        }
      }

      inputElement.dispatchEvent(new Event('change', { bubbles: true }));

      // Wait for verification that value contains typed text
      const result = await waitForAssertion(
        () => assertValueContains(inputElement, text),
        { timeout: 1000, interval: 50 }
      );

      if (!result.success) {
        throw createVerificationError('type', result, selector);
      }
    }

    return { success: true, error: null };
  }

  private async fill(selector: string, value: string): Promise<ActionResult> {
    const element = this.getElement(selector);

    if (!(element instanceof this._HTMLInputElement || element instanceof this._HTMLTextAreaElement)) {
      const actualType = element.tagName.toLowerCase();
      const availableActions = this.getAvailableActionsForElement(element);

      throw createElementNotCompatibleError(
        selector,
        'fill',
        actualType,
        ['input', 'textarea'],
        availableActions
      );
    }

    element.focus();
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));

    // Wait for verification that value equals expected
    const result = await waitForAssertion(
      () => assertValueEquals(element, value),
      { timeout: 1000, interval: 50 }
    );

    if (!result.success) {
      throw createVerificationError('fill', result, selector);
    }

    return { success: true, error: null };
  }

  private async clear(selector: string): Promise<ActionResult> {
    const element = this.getElement(selector);

    if (element instanceof this._HTMLInputElement || element instanceof this._HTMLTextAreaElement) {
      element.value = '';
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    return { success: true, error: null };
  }

  private async check(selector: string): Promise<ActionResult> {
    const element = this.getElement(selector);

    if (!(element instanceof this._HTMLInputElement)) {
      const actualType = element.tagName.toLowerCase();
      const availableActions = this.getAvailableActionsForElement(element);

      throw createElementNotCompatibleError(
        selector,
        'check',
        actualType,
        ['input[type=checkbox]', 'input[type=radio]'],
        availableActions
      );
    }

    if (!element.checked) {
      element.click();
    }

    // Wait for verification that element is checked
    const result = await waitForAssertion(
      () => assertChecked(element, true),
      { timeout: 1000, interval: 50 }
    );

    if (!result.success) {
      throw createVerificationError('check', result, selector);
    }

    return { success: true, error: null };
  }

  private async uncheck(selector: string): Promise<ActionResult> {
    const element = this.getElement(selector);

    if (!(element instanceof this._HTMLInputElement)) {
      const actualType = element.tagName.toLowerCase();
      const availableActions = this.getAvailableActionsForElement(element);

      throw createElementNotCompatibleError(
        selector,
        'uncheck',
        actualType,
        ['input[type=checkbox]'],
        availableActions
      );
    }

    if (element.checked) {
      element.click();
    }

    // Wait for verification that element is unchecked
    const result = await waitForAssertion(
      () => assertChecked(element, false),
      { timeout: 1000, interval: 50 }
    );

    if (!result.success) {
      throw createVerificationError('uncheck', result, selector);
    }

    return { success: true, error: null };
  }

  private async select(selector: string, values: string | string[]): Promise<ActionResult & { values: string[] }> {
    const element = this.getElement(selector);

    if (!(element instanceof this._HTMLSelectElement)) {
      const actualType = element.tagName.toLowerCase();
      const availableActions = this.getAvailableActionsForElement(element);

      throw createElementNotCompatibleError(
        selector,
        'select',
        actualType,
        ['select'],
        availableActions
      );
    }

    const valueArray = Array.isArray(values) ? values : [values];

    for (const option of element.options) {
      option.selected = valueArray.includes(option.value);
    }

    element.dispatchEvent(new Event('change', { bubbles: true }));

    // Wait for verification that expected options are selected
    const result = await waitForAssertion(
      () => assertSelected(element, valueArray),
      { timeout: 1000, interval: 50 }
    );

    if (!result.success) {
      throw createVerificationError('select', result, selector);
    }

    return { success: true, error: null, values: valueArray };
  }

  private async focus(selector: string): Promise<ActionResult> {
    const element = this.getElement(selector);

    if (element instanceof this._HTMLElement) {
      element.focus();
    }

    return { success: true, error: null };
  }

  private async blur(selector: string): Promise<ActionResult> {
    const element = this.getElement(selector);

    if (element instanceof this._HTMLElement) {
      element.blur();
    }

    return { success: true, error: null };
  }

  private async hover(selector: string): Promise<ActionResult> {
    const element = this.getElement(selector);

    element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

    return { success: true, error: null };
  }

  private async scroll(
    selector: string | undefined,
    options: { x?: number; y?: number; direction?: string; amount?: number }
  ): Promise<ActionResult> {
    // Validate parameter combinations
    const hasXY = options.x !== undefined || options.y !== undefined;
    const hasDirection = options.direction !== undefined;

    if (hasXY && hasDirection) {
      throw createInvalidParametersError(
        'Scroll command has conflicting parameters',
        ['x/y', 'direction'],
        'Use either { x, y } for absolute scrolling OR { direction, amount } for relative scrolling, not both'
      );
    }

    let deltaX = options.x ?? 0;
    let deltaY = options.y ?? 0;

    if (options.direction) {
      const amount = options.amount ?? 100;
      switch (options.direction) {
        case 'up': deltaY = -amount; break;
        case 'down': deltaY = amount; break;
        case 'left': deltaX = -amount; break;
        case 'right': deltaX = amount; break;
      }
    }

    if (selector) {
      const element = this.getElement(selector);
      element.scrollBy(deltaX, deltaY);
    } else {
      this.window.scrollBy(deltaX, deltaY);
    }

    return { success: true, error: null };
  }

  private async scrollIntoView(
    selector: string,
    block: 'start' | 'center' | 'end' | 'nearest' = 'center'
  ): Promise<ActionResult> {
    const element = this.getElement(selector);
    element.scrollIntoView({ behavior: 'smooth', block });
    return { success: true, error: null };
  }

  private async snapshot(options: {
    selector?: string;
    maxDepth?: number;
    includeHidden?: boolean;
    compact?: boolean;
    mode?: 'interactive' | 'outline' | 'content' | 'head' | 'all' | 'structure';
    format?: 'tree' | 'html' | 'markdown';
    grep?: string | { pattern: string; ignoreCase?: boolean; invert?: boolean; fixedStrings?: boolean };
    maxLength?: number;
  }): Promise<string> {
    const root = options.selector
      ? this.getElement(options.selector)
      : this.document.body;

    const snapshotData = createSnapshot(this.document, this.refMap, {
      root,
      maxDepth: options.maxDepth,
      includeHidden: options.includeHidden,
      compact: options.compact,
      mode: options.mode,
      format: options.format,
      grep: options.grep,
      maxLength: options.maxLength,
    });

    // Store snapshot data for highlight command (preserve refs internally)
    this.lastSnapshotData = snapshotData;

    // Return only the tree string
    return snapshotData.tree;
  }

  /**
   * Extract content as HTML or Markdown
   */
  private async extract(options: {
    selector?: string;
    format?: 'html' | 'markdown';
    maxDepth?: number;
    includeHidden?: boolean;
    maxLength?: number;
    includeLinks?: boolean;
    includeImages?: boolean;
  }): Promise<string> {
    const root = options.selector
      ? this.getElement(options.selector)
      : undefined;

    return extract(this.document, {
      root,
      format: options.format,
      maxDepth: options.maxDepth,
      includeHidden: options.includeHidden,
      maxLength: options.maxLength,
      includeLinks: options.includeLinks,
      includeImages: options.includeImages,
    });
  }

  private async querySelector(selector: string): Promise<ActionResult & { ref?: string }> {
    const element = this.queryElement(selector);
    if (!element) {
      return { success: false, error: `Element not found: ${selector}` };
    }

    const ref = this.refMap.generateRef(element);
    return { success: true, error: null, ref };
  }

  private async querySelectorAll(selector: string): Promise<ActionResult & { count: number; refs: string[] }> {
    const elements = this.queryElements(selector);
    const refs = elements.map((el) => this.refMap.generateRef(el));
    return { success: true, error: null, count: elements.length, refs };
  }

  private async getText(selector: string): Promise<ActionResult & { text: string | null }> {
    const element = this.getElement(selector);
    return { success: true, error: null, text: element.textContent };
  }

  private async getAttribute(selector: string, attribute: string): Promise<ActionResult & { value: string | null }> {
    const element = this.getElement(selector);
    return { success: true, error: null, value: element.getAttribute(attribute) };
  }

  private async getProperty(selector: string, property: string): Promise<ActionResult & { value: unknown }> {
    const element = this.getElement(selector);
    return { success: true, error: null, value: (element as unknown as Record<string, unknown>)[property] };
  }

  private async getBoundingBox(selector: string): Promise<ActionResult & { box: BoundingBox }> {
    const element = this.getElement(selector);
    const rect = element.getBoundingClientRect();
    return {
      success: true,
      error: null,
      box: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
    };
  }

  private async isVisible(selector: string): Promise<ActionResult & { visible: boolean }> {
    const element = this.queryElement(selector);
    if (!element || !(element instanceof this._HTMLElement)) {
      return { success: true, error: null, visible: false };
    }

    const style = this.window.getComputedStyle(element);
    const visible =
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0';

    return { success: true, error: null, visible };
  }

  private async isEnabled(selector: string): Promise<ActionResult & { enabled: boolean }> {
    const element = this.getElement(selector);
    const enabled = !(element as HTMLInputElement).disabled;
    return { success: true, error: null, enabled };
  }

  private async isChecked(selector: string): Promise<ActionResult & { checked: boolean }> {
    const element = this.getElement(selector);
    const checked = (element as HTMLInputElement).checked ?? false;
    return { success: true, error: null, checked };
  }

  private async press(
    key: string,
    selector?: string,
    modifiers: Modifier[] = []
  ): Promise<ActionResult> {
    const target = selector
      ? this.getElement(selector)
      : this.document.activeElement || this.document.body;

    const eventInit: KeyboardEventInit = {
      key,
      code: key,
      bubbles: true,
      cancelable: true,
      altKey: modifiers.includes('Alt'),
      ctrlKey: modifiers.includes('Control'),
      metaKey: modifiers.includes('Meta'),
      shiftKey: modifiers.includes('Shift'),
    };

    target.dispatchEvent(new KeyboardEvent('keydown', eventInit));
    target.dispatchEvent(new KeyboardEvent('keypress', eventInit));
    target.dispatchEvent(new KeyboardEvent('keyup', eventInit));

    return { success: true, error: null };
  }

  private async keyDown(key: string): Promise<ActionResult> {
    const target = this.document.activeElement || this.document.body;
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    return { success: true, error: null };
  }

  private async keyUp(key: string): Promise<ActionResult> {
    const target = this.document.activeElement || this.document.body;
    target.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
    return { success: true, error: null };
  }

  private async wait(
    selector?: string,
    options: { state?: string; timeout?: number } = {}
  ): Promise<ActionResult> {
    const { state = 'visible', timeout = 5000 } = options;

    if (!selector) {
      await this.sleep(timeout);
      return { success: true, error: null };
    }

    const startTime = Date.now();
    let lastState: { attached: boolean; visible: boolean; enabled: boolean } | undefined;

    while (Date.now() - startTime < timeout) {
      const element = this.queryElement(selector);

      // Track element state for error reporting
      if (element instanceof this._HTMLElement) {
        const style = this.window.getComputedStyle(element);
        lastState = {
          attached: true,
          visible: style.display !== 'none' && style.visibility !== 'hidden',
          enabled: !(element as HTMLInputElement).disabled,
        };
      } else if (element) {
        lastState = {
          attached: true,
          visible: false,
          enabled: true,
        };
      }

      let conditionMet = false;
      switch (state) {
        case 'attached':
          conditionMet = element !== null;
          break;
        case 'detached':
          conditionMet = element === null;
          break;
        case 'visible':
          if (element instanceof this._HTMLElement) {
            const style = this.window.getComputedStyle(element);
            conditionMet =
              style.display !== 'none' &&
              style.visibility !== 'hidden';
          }
          break;
        case 'hidden':
          conditionMet =
            !element ||
            (element instanceof this._HTMLElement &&
              this.window.getComputedStyle(element).display === 'none');
          break;
        case 'enabled':
          conditionMet = element !== null && !(element as HTMLInputElement).disabled;
          break;
      }

      if (conditionMet) {
        return { success: true, error: null };
      }

      await this.sleep(100);
    }

    // Provide detailed timeout error with current state
    throw createTimeoutError(selector, state, lastState);
  }

  private async evaluate(script: string, args?: unknown[]): Promise<ActionResult & { result: unknown }> {
    const fn = new Function(...(args?.map((_, i) => `arg${i}`) || []), `return (${script})`);
    const result = fn.call(this.window, ...(args || []));
    return { success: true, error: null, result };
  }

  /**
   * Validate element capabilities before attempting an action
   */
  private async validateElement(
    selector: string,
    options: {
      expectedType?: 'input' | 'textarea' | 'button' | 'link' | 'select';
      capabilities?: Array<'clickable' | 'editable' | 'checkable' | 'hoverable'>;
    } = {}
  ): Promise<ValidateElementResponse> {
    const element = this.getElement(selector);
    const actualRole = element.getAttribute('role') || element.tagName.toLowerCase();
    const actualType = element instanceof this._HTMLInputElement ? element.type : undefined;

    // Get element capabilities
    const capabilities = this.getAvailableActionsForElement(element);

    // Get element state
    const style = element instanceof this._HTMLElement ? this.window.getComputedStyle(element) : null;
    const state = {
      attached: true,
      visible: style ? style.display !== 'none' && style.visibility !== 'hidden' : false,
      enabled: !(element as HTMLInputElement).disabled,
    };

    // Check type compatibility
    let compatible = true;
    let suggestion: string | undefined;

    if (options.expectedType) {
      const typeMatch =
        options.expectedType === actualRole ||
        (options.expectedType === 'input' && element instanceof this._HTMLInputElement) ||
        (options.expectedType === 'textarea' && element instanceof this._HTMLTextAreaElement) ||
        (options.expectedType === 'button' && element instanceof this._HTMLButtonElement) ||
        (options.expectedType === 'link' && element instanceof this._HTMLAnchorElement) ||
        (options.expectedType === 'select' && element instanceof this._HTMLSelectElement);

      if (!typeMatch) {
        compatible = false;
        suggestion = `Element is ${actualRole}, not ${options.expectedType}. Available actions: ${capabilities.slice(0, 5).join(', ')}`;
      }
    }

    // Check capability requirements
    if (options.capabilities && compatible) {
      const capabilityMap: Record<string, boolean> = {
        clickable:
          element instanceof this._HTMLButtonElement ||
          element instanceof this._HTMLAnchorElement ||
          element.getAttribute('role') === 'button' ||
          element.hasAttribute('onclick'),
        editable:
          element instanceof this._HTMLInputElement ||
          element instanceof this._HTMLTextAreaElement,
        checkable:
          element instanceof this._HTMLInputElement &&
          (element.type === 'checkbox' || element.type === 'radio'),
        hoverable: element instanceof this._HTMLElement,
      };

      for (const cap of options.capabilities) {
        if (!capabilityMap[cap]) {
          compatible = false;
          suggestion = `Element does not support capability: ${cap}. Available actions: ${capabilities.slice(0, 5).join(', ')}`;
          break;
        }
      }
    }

    return {
      compatible,
      actualRole,
      actualType,
      capabilities,
      state,
      suggestion,
    };
  }

  /**
   * Validate that refs are still valid
   */
  private async validateRefs(refs: string[]): Promise<ValidateRefsResponse> {
    const valid: string[] = [];
    const invalid: string[] = [];
    const reasons: Record<string, string> = {};

    for (const ref of refs) {
      const element = this.refMap.get(ref);

      if (element) {
        // Check if element is still in the DOM
        if (this.document.contains(element)) {
          valid.push(ref);
        } else {
          invalid.push(ref);
          reasons[ref] = 'Element has been removed from the DOM';
        }
      } else {
        invalid.push(ref);
        reasons[ref] = 'Ref not found. Refs are cleared on each snapshot() call.';
      }
    }

    return {
      valid,
      invalid,
      reasons,
    };
  }

  /**
   * Display visual overlay labels for interactive elements
   */
  private async highlight(): Promise<ActionResult & { count: number }> {
    // Verify snapshot exists
    if (!this.lastSnapshotData || !this.lastSnapshotData.refs) {
      throw new Error('No snapshot data available. Please run snapshot() command first.');
    }

    // Clear any existing highlights
    this.clearExistingOverlay();

    // Create overlay container with absolute positioning covering entire document
    this.overlayContainer = this.document.createElement('div');
    this.overlayContainer.id = 'btcp-highlight-overlay';
    this.overlayContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: ${this.document.documentElement.scrollWidth}px;
      height: ${this.document.documentElement.scrollHeight}px;
      pointer-events: none;
      z-index: 999999;
      contain: layout style paint;
    `;

    let highlightedCount = 0;

    // Create border overlays and labels for each ref
    for (const [ref, _refData] of Object.entries(this.lastSnapshotData.refs)) {
      const element = this.refMap.get(ref);

      // Skip if element no longer exists or is disconnected
      if (!element || !element.isConnected) {
        continue;
      }

      try {
        // Get current bounding box (element might have moved)
        const bbox = element.getBoundingClientRect();

        // Skip elements with no dimensions
        if (bbox.width === 0 && bbox.height === 0) {
          continue;
        }

        // Create border overlay
        const border = this.document.createElement('div');
        border.className = 'btcp-ref-border';
        border.dataset.ref = ref;
        border.style.cssText = `
          position: absolute;
          width: ${bbox.width}px;
          height: ${bbox.height}px;
          transform: translate3d(${bbox.left + this.window.scrollX}px, ${bbox.top + this.window.scrollY}px, 0);
          border: 2px solid rgba(59, 130, 246, 0.8);
          border-radius: 2px;
          box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.2);
          pointer-events: none;
          will-change: transform;
          contain: layout style paint;
        `;

        // Create label
        const label = this.document.createElement('div');
        label.className = 'btcp-ref-label';
        label.dataset.ref = ref;
        // Extract number from ref (e.g., "@ref:5" -> "5")
        label.textContent = ref.replace('@ref:', '');
        label.style.cssText = `
          position: absolute;
          transform: translate3d(${bbox.left + this.window.scrollX}px, ${bbox.top + this.window.scrollY}px, 0);
          background: rgba(59, 130, 246, 0.9);
          color: white;
          padding: 2px 6px;
          border-radius: 3px;
          font-family: monospace;
          font-size: 11px;
          font-weight: bold;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          pointer-events: none;
          white-space: nowrap;
          will-change: transform;
          contain: layout style paint;
        `;

        this.overlayContainer.appendChild(border);
        this.overlayContainer.appendChild(label);
        highlightedCount++;
      } catch (error) {
        // Skip elements that throw errors
        continue;
      }
    }

    // Inject overlay into page
    this.document.body.appendChild(this.overlayContainer);

    // Set up scroll listener with rAF throttling
    let ticking = false;
    this.scrollListener = () => {
      if (!ticking) {
        this.rafId = this.window.requestAnimationFrame(() => {
          this.updateHighlightPositions();
          ticking = false;
        });
        ticking = true;
      }
    };

    // Use passive listener for better scroll performance
    this.window.addEventListener('scroll', this.scrollListener, { passive: true });

    return { success: true, error: null, count: highlightedCount };
  }

  /**
   * Invalidate snapshot data (called on navigation or manual clear)
   */
  public invalidateSnapshot(): void {
    this.lastSnapshotData = null;
    this.clearHighlight();
  }

  /**
   * Update highlight positions on scroll (GPU-accelerated)
   */
  private updateHighlightPositions(): void {
    if (!this.overlayContainer || !this.lastSnapshotData) {
      return;
    }

    // Batch DOM reads
    const updates: Array<{ element: HTMLElement; x: number; y: number; width?: number; height?: number }> = [];

    // Read phase - get all bounding boxes first
    const borders = this.overlayContainer.querySelectorAll('.btcp-ref-border');
    const labels = this.overlayContainer.querySelectorAll('.btcp-ref-label');

    borders.forEach((borderEl) => {
      const ref = (borderEl as HTMLElement).dataset.ref;
      if (!ref) return;

      const element = this.refMap.get(ref);
      if (!element || !element.isConnected) return;

      const bbox = element.getBoundingClientRect();
      if (bbox.width === 0 && bbox.height === 0) return;

      updates.push({
        element: borderEl as HTMLElement,
        x: bbox.left + this.window.scrollX,
        y: bbox.top + this.window.scrollY,
        width: bbox.width,
        height: bbox.height,
      });
    });

    labels.forEach((labelEl) => {
      const ref = (labelEl as HTMLElement).dataset.ref;
      if (!ref) return;

      const element = this.refMap.get(ref);
      if (!element || !element.isConnected) return;

      const bbox = element.getBoundingClientRect();
      if (bbox.width === 0 && bbox.height === 0) return;

      updates.push({
        element: labelEl as HTMLElement,
        x: bbox.left + this.window.scrollX,
        y: bbox.top + this.window.scrollY,
      });
    });

    // Write phase - update transforms
    updates.forEach(({ element, x, y, width, height }) => {
      element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      if (width !== undefined && height !== undefined) {
        element.style.width = `${width}px`;
        element.style.height = `${height}px`;
      }
    });
  }

  /**
   * Remove visual overlay labels
   */
  private async clearHighlight(): Promise<ActionResult> {
    this.clearExistingOverlay();
    return { success: true, error: null };
  }

  /**
   * Remove existing overlay if it exists
   */
  private clearExistingOverlay(): void {
    // Remove scroll listener
    if (this.scrollListener) {
      this.window.removeEventListener('scroll', this.scrollListener);
      this.scrollListener = null;
    }

    // Cancel any pending animation frame
    if (this.rafId !== null) {
      this.window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    // Remove overlay container
    if (this.overlayContainer && this.overlayContainer.parentNode) {
      this.overlayContainer.parentNode.removeChild(this.overlayContainer);
    }
    this.overlayContainer = null;

    // Also remove any orphaned overlays
    const existingOverlay = this.document.getElementById('btcp-highlight-overlay');
    if (existingOverlay && existingOverlay.parentNode) {
      existingOverlay.parentNode.removeChild(existingOverlay);
    }
  }

  // --- Utilities ---

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
