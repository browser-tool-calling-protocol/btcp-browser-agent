/**
 * @aspect/core - DOM Actions
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
} from './types.js';
import { createSnapshot } from './snapshot.js';

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

      default:
        throw new Error(`Unknown action: ${(command as Command).action}`);
    }
  }

  // --- Element Resolution ---

  private getElement(selector: string): Element {
    const element = this.queryElement(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }
    return element;
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
      throw new Error('Element is not an input or textarea');
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
      throw new Error('Element is not an input or textarea');
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
      throw new Error('Element is not a checkbox or radio');
    }

    if (!element.checked) {
      element.click();
    }

    return { checked: true };
  }

  private async uncheck(selector: string): Promise<{ unchecked: true }> {
    const element = this.getElement(selector);

    if (!(element instanceof HTMLInputElement)) {
      throw new Error('Element is not a checkbox');
    }

    if (element.checked) {
      element.click();
    }

    return { unchecked: true };
  }

  private async select(selector: string, values: string | string[]): Promise<{ selected: string[] }> {
    const element = this.getElement(selector);

    if (!(element instanceof HTMLSelectElement)) {
      throw new Error('Element is not a select');
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
  }): Promise<SnapshotData> {
    const root = options.selector
      ? this.getElement(options.selector)
      : this.document.body;

    return createSnapshot(this.document, this.refMap, {
      root,
      maxDepth: options.maxDepth,
      includeHidden: options.includeHidden,
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
    return { value: (element as Record<string, unknown>)[property] };
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

    while (Date.now() - startTime < timeout) {
      const element = this.queryElement(selector);

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
      }

      if (conditionMet) {
        return { waited: true };
      }

      await this.sleep(100);
    }

    throw new Error(`Timeout waiting for ${selector} to be ${state}`);
  }

  private async evaluate(script: string, args?: unknown[]): Promise<{ result: unknown }> {
    const fn = new Function(...(args?.map((_, i) => `arg${i}`) || []), `return (${script})`);
    const result = fn.call(this.window, ...(args || []));
    return { result };
  }

  // --- Utilities ---

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
