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
import { createSnapshot } from './snapshot.js';
import {
  DetailedError,
  createElementNotFoundError,
  createElementNotCompatibleError,
  createTimeoutError,
  createInvalidParametersError,
} from './errors.js';

/**
 * DOM Actions executor
 */
export class DOMActions {
  private document: Document;
  private window: Window;
  private refMap: RefMap;

  constructor(doc: Document, win: Window, refMap: RefMap) {
    this.document = doc;
    this.window = win;
    this.refMap = refMap;
  }

  /**
   * Execute a command and return a response
   */
  async execute(command: Command): Promise<Response> {
    try {
      const data = await this.dispatch(command);
      return { id: command.id, success: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Include structured error data if available
      if (error instanceof DetailedError) {
        return {
          id: command.id,
          success: false,
          error: message,
          errorCode: error.code,
          errorContext: error.context,
          suggestions: error.suggestions,
        };
      }

      return { id: command.id, success: false, error: message };
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
          interactive: command.interactive,
          compact: command.compact,
          all: command.all,
          grep: command.grep,
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
        if (el instanceof HTMLElement) {
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
      element instanceof HTMLButtonElement ||
      element instanceof HTMLAnchorElement ||
      element.getAttribute('role') === 'button' ||
      element.getAttribute('role') === 'link' ||
      element.hasAttribute('onclick')
    ) {
      actions.push('click', 'dblclick', 'hover');
    }

    // Input elements
    if (element instanceof HTMLInputElement) {
      actions.push('fill', 'clear', 'focus', 'blur', 'isEnabled');

      if (element.type === 'checkbox' || element.type === 'radio') {
        actions.push('check', 'uncheck', 'isChecked');
      } else {
        actions.push('type');
      }
    }

    // Textarea elements
    if (element instanceof HTMLTextAreaElement) {
      actions.push('type', 'fill', 'clear', 'focus', 'blur');
    }

    // Select elements
    if (element instanceof HTMLSelectElement) {
      actions.push('select', 'focus', 'blur');
    }

    // Focusable elements
    if (element instanceof HTMLElement) {
      actions.push('focus', 'blur', 'scroll', 'scrollIntoView', 'press');
    }

    return actions;
  }

  private queryElement(selector: string): Element | null {
    // Check if it's a ref
    if (selector.startsWith('@ref:')) {
      return this.refMap.get(selector);
    }

    // CSS selector
    return this.document.querySelector(selector);
  }

  private queryElements(selector: string): Element[] {
    if (selector.startsWith('@ref:')) {
      const el = this.refMap.get(selector);
      return el ? [el] : [];
    }
    return Array.from(this.document.querySelectorAll(selector));
  }

  // --- Actions ---

  private async click(
    selector: string,
    options: { button?: 'left' | 'right' | 'middle'; clickCount?: number; modifiers?: Modifier[] } = {}
  ): Promise<{ clicked: true }> {
    const element = this.getElement(selector);
    const { button = 'left', clickCount = 1, modifiers = [] } = options;

    if (element instanceof HTMLElement) {
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

    return { clicked: true };
  }

  private async dblclick(selector: string): Promise<{ clicked: true }> {
    const element = this.getElement(selector);
    element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    return { clicked: true };
  }

  private async type(
    selector: string,
    text: string,
    options: { delay?: number; clear?: boolean } = {}
  ): Promise<{ typed: true }> {
    const element = this.getElement(selector);

    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
      const actualType = element.tagName.toLowerCase();
      const availableActions = this.getAvailableActionsForElement(element);

      throw createElementNotCompatibleError(
        selector,
        'type',
        actualType,
        ['input', 'textarea'],
        availableActions
      );
    }

    element.focus();

    if (options.clear) {
      element.value = '';
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }

    for (const char of text) {
      element.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
      element.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
      element.value += char;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));

      if (options.delay) {
        await this.sleep(options.delay);
      }
    }

    element.dispatchEvent(new Event('change', { bubbles: true }));
    return { typed: true };
  }

  private async fill(selector: string, value: string): Promise<{ filled: true }> {
    const element = this.getElement(selector);

    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
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

    return { filled: true };
  }

  private async clear(selector: string): Promise<{ cleared: true }> {
    const element = this.getElement(selector);

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      element.value = '';
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    return { cleared: true };
  }

  private async check(selector: string): Promise<{ checked: true }> {
    const element = this.getElement(selector);

    if (!(element instanceof HTMLInputElement)) {
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

    return { checked: true };
  }

  private async uncheck(selector: string): Promise<{ unchecked: true }> {
    const element = this.getElement(selector);

    if (!(element instanceof HTMLInputElement)) {
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

    return { unchecked: true };
  }

  private async select(selector: string, values: string | string[]): Promise<{ selected: string[] }> {
    const element = this.getElement(selector);

    if (!(element instanceof HTMLSelectElement)) {
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

    return { selected: valueArray };
  }

  private async focus(selector: string): Promise<{ focused: true }> {
    const element = this.getElement(selector);

    if (element instanceof HTMLElement) {
      element.focus();
    }

    return { focused: true };
  }

  private async blur(selector: string): Promise<{ blurred: true }> {
    const element = this.getElement(selector);

    if (element instanceof HTMLElement) {
      element.blur();
    }

    return { blurred: true };
  }

  private async hover(selector: string): Promise<{ hovered: true }> {
    const element = this.getElement(selector);

    element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

    return { hovered: true };
  }

  private async scroll(
    selector: string | undefined,
    options: { x?: number; y?: number; direction?: string; amount?: number }
  ): Promise<{ scrolled: true }> {
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

    return { scrolled: true };
  }

  private async scrollIntoView(
    selector: string,
    block: 'start' | 'center' | 'end' | 'nearest' = 'center'
  ): Promise<{ scrolled: true }> {
    const element = this.getElement(selector);
    element.scrollIntoView({ behavior: 'smooth', block });
    return { scrolled: true };
  }

  private async snapshot(options: {
    selector?: string;
    maxDepth?: number;
    includeHidden?: boolean;
    interactive?: boolean;
    compact?: boolean;
    all?: boolean;
    grep?: string | { pattern: string; ignoreCase?: boolean; invert?: boolean; fixedStrings?: boolean };
  }): Promise<SnapshotData> {
    const root = options.selector
      ? this.getElement(options.selector)
      : this.document.body;

    return createSnapshot(this.document, this.refMap, {
      root,
      maxDepth: options.maxDepth,
      includeHidden: options.includeHidden,
      interactive: options.interactive,
      compact: options.compact,
      all: options.all,
      grep: options.grep,
    });
  }

  private async querySelector(selector: string): Promise<{ found: boolean; ref?: string }> {
    const element = this.queryElement(selector);
    if (!element) {
      return { found: false };
    }

    const ref = this.refMap.generateRef(element);
    return { found: true, ref };
  }

  private async querySelectorAll(selector: string): Promise<{ count: number; refs: string[] }> {
    const elements = this.queryElements(selector);
    const refs = elements.map((el) => this.refMap.generateRef(el));
    return { count: elements.length, refs };
  }

  private async getText(selector: string): Promise<{ text: string | null }> {
    const element = this.getElement(selector);
    return { text: element.textContent };
  }

  private async getAttribute(selector: string, attribute: string): Promise<{ value: string | null }> {
    const element = this.getElement(selector);
    return { value: element.getAttribute(attribute) };
  }

  private async getProperty(selector: string, property: string): Promise<{ value: unknown }> {
    const element = this.getElement(selector);
    return { value: (element as unknown as Record<string, unknown>)[property] };
  }

  private async getBoundingBox(selector: string): Promise<{ box: BoundingBox }> {
    const element = this.getElement(selector);
    const rect = element.getBoundingClientRect();
    return {
      box: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
    };
  }

  private async isVisible(selector: string): Promise<{ visible: boolean }> {
    const element = this.queryElement(selector);
    if (!element || !(element instanceof HTMLElement)) {
      return { visible: false };
    }

    const style = this.window.getComputedStyle(element);
    const visible =
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0';

    return { visible };
  }

  private async isEnabled(selector: string): Promise<{ enabled: boolean }> {
    const element = this.getElement(selector);
    const enabled = !(element as HTMLInputElement).disabled;
    return { enabled };
  }

  private async isChecked(selector: string): Promise<{ checked: boolean }> {
    const element = this.getElement(selector);
    const checked = (element as HTMLInputElement).checked ?? false;
    return { checked };
  }

  private async press(
    key: string,
    selector?: string,
    modifiers: Modifier[] = []
  ): Promise<{ pressed: true }> {
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

    return { pressed: true };
  }

  private async keyDown(key: string): Promise<{ down: true }> {
    const target = this.document.activeElement || this.document.body;
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    return { down: true };
  }

  private async keyUp(key: string): Promise<{ up: true }> {
    const target = this.document.activeElement || this.document.body;
    target.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
    return { up: true };
  }

  private async wait(
    selector?: string,
    options: { state?: string; timeout?: number } = {}
  ): Promise<{ waited: true }> {
    const { state = 'visible', timeout = 5000 } = options;

    if (!selector) {
      await this.sleep(timeout);
      return { waited: true };
    }

    const startTime = Date.now();
    let lastState: { attached: boolean; visible: boolean; enabled: boolean } | undefined;

    while (Date.now() - startTime < timeout) {
      const element = this.queryElement(selector);

      // Track element state for error reporting
      if (element instanceof HTMLElement) {
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
          if (element instanceof HTMLElement) {
            const style = this.window.getComputedStyle(element);
            conditionMet =
              style.display !== 'none' &&
              style.visibility !== 'hidden';
          }
          break;
        case 'hidden':
          conditionMet =
            !element ||
            (element instanceof HTMLElement &&
              this.window.getComputedStyle(element).display === 'none');
          break;
        case 'enabled':
          conditionMet = element !== null && !(element as HTMLInputElement).disabled;
          break;
      }

      if (conditionMet) {
        return { waited: true };
      }

      await this.sleep(100);
    }

    // Provide detailed timeout error with current state
    throw createTimeoutError(selector, state, lastState);
  }

  private async evaluate(script: string, args?: unknown[]): Promise<{ result: unknown }> {
    const fn = new Function(...(args?.map((_, i) => `arg${i}`) || []), `return (${script})`);
    const result = fn.call(this.window, ...(args || []));
    return { result };
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
    const actualType = element instanceof HTMLInputElement ? element.type : undefined;

    // Get element capabilities
    const capabilities = this.getAvailableActionsForElement(element);

    // Get element state
    const style = element instanceof HTMLElement ? this.window.getComputedStyle(element) : null;
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
        (options.expectedType === 'input' && element instanceof HTMLInputElement) ||
        (options.expectedType === 'textarea' && element instanceof HTMLTextAreaElement) ||
        (options.expectedType === 'button' && element instanceof HTMLButtonElement) ||
        (options.expectedType === 'link' && element instanceof HTMLAnchorElement) ||
        (options.expectedType === 'select' && element instanceof HTMLSelectElement);

      if (!typeMatch) {
        compatible = false;
        suggestion = `Element is ${actualRole}, not ${options.expectedType}. Available actions: ${capabilities.slice(0, 5).join(', ')}`;
      }
    }

    // Check capability requirements
    if (options.capabilities && compatible) {
      const capabilityMap: Record<string, boolean> = {
        clickable:
          element instanceof HTMLButtonElement ||
          element instanceof HTMLAnchorElement ||
          element.getAttribute('role') === 'button' ||
          element.hasAttribute('onclick'),
        editable:
          element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement,
        checkable:
          element instanceof HTMLInputElement &&
          (element.type === 'checkbox' || element.type === 'radio'),
        hoverable: element instanceof HTMLElement,
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

  // --- Utilities ---

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
