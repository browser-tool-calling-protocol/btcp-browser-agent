/**
 * Tests for actions.ts - Command execution handlers
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BrowserManager } from './browser.js';
import { executeCommand, toAIFriendlyError } from './actions.js';

describe('actions', () => {
  let browser: BrowserManager;

  beforeEach(async () => {
    document.body.innerHTML = '';
    browser = new BrowserManager(window, document);
    await browser.launch({ id: 'launch', action: 'launch' });
  });

  afterEach(async () => {
    await browser.close();
  });

  describe('toAIFriendlyError', () => {
    it('should convert not found error', () => {
      const error = new Error('Element was not found');
      const friendly = toAIFriendlyError(error, '#btn');

      expect(friendly.message).toContain('not found');
      expect(friendly.message).toContain('snapshot');
    });

    it('should convert visibility error', () => {
      const error = new Error('Element is not visible');
      const friendly = toAIFriendlyError(error, '#btn');

      expect(friendly.message).toContain('not visible');
    });

    it('should pass through unknown errors', () => {
      const error = new Error('Some random error');
      const friendly = toAIFriendlyError(error, '#btn');

      expect(friendly.message).toBe('Some random error');
    });
  });

  describe('click', () => {
    it('should click element', async () => {
      document.body.innerHTML = '<button id="btn">Click me</button>';
      const button = document.getElementById('btn')!;
      const handler = vi.fn();
      button.addEventListener('click', handler);

      const response = await executeCommand(
        { id: 'cmd1', action: 'click', selector: '#btn' },
        browser
      );

      expect(response.success).toBe(true);
      expect(handler).toHaveBeenCalled();
    });

    it('should click element by ref', async () => {
      document.body.innerHTML = '<button>Click me</button>';
      await browser.getSnapshot();
      const button = document.querySelector('button')!;
      const handler = vi.fn();
      button.addEventListener('click', handler);

      const response = await executeCommand(
        { id: 'cmd1', action: 'click', selector: '@e1' },
        browser
      );

      expect(response.success).toBe(true);
      expect(handler).toHaveBeenCalled();
    });

    it('should return error for non-existent element', async () => {
      const response = await executeCommand(
        { id: 'cmd1', action: 'click', selector: '#non-existent' },
        browser
      );

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error).toContain('not found');
      }
    });
  });

  describe('type', () => {
    it('should type text into input', async () => {
      document.body.innerHTML = '<input id="input" type="text">';
      const input = document.getElementById('input') as HTMLInputElement;

      const response = await executeCommand(
        { id: 'cmd1', action: 'type', selector: '#input', text: 'Hello' },
        browser
      );

      expect(response.success).toBe(true);
      expect(input.value).toBe('Hello');
    });

    it('should clear input before typing when clear is true', async () => {
      document.body.innerHTML = '<input id="input" type="text" value="Existing">';
      const input = document.getElementById('input') as HTMLInputElement;

      const response = await executeCommand(
        { id: 'cmd1', action: 'type', selector: '#input', text: 'New', clear: true },
        browser
      );

      expect(response.success).toBe(true);
      expect(input.value).toBe('New');
    });
  });

  describe('fill', () => {
    it('should fill input value instantly', async () => {
      document.body.innerHTML = '<input id="input" type="text">';
      const input = document.getElementById('input') as HTMLInputElement;

      const response = await executeCommand(
        { id: 'cmd1', action: 'fill', selector: '#input', value: 'Test Value' },
        browser
      );

      expect(response.success).toBe(true);
      expect(input.value).toBe('Test Value');
    });

    it('should trigger input and change events', async () => {
      document.body.innerHTML = '<input id="input" type="text">';
      const input = document.getElementById('input') as HTMLInputElement;
      const inputHandler = vi.fn();
      const changeHandler = vi.fn();
      input.addEventListener('input', inputHandler);
      input.addEventListener('change', changeHandler);

      await executeCommand(
        { id: 'cmd1', action: 'fill', selector: '#input', value: 'Test' },
        browser
      );

      expect(inputHandler).toHaveBeenCalled();
      expect(changeHandler).toHaveBeenCalled();
    });
  });

  describe('check and uncheck', () => {
    it('should check checkbox', async () => {
      document.body.innerHTML = '<input id="cb" type="checkbox">';
      const checkbox = document.getElementById('cb') as HTMLInputElement;

      const response = await executeCommand(
        { id: 'cmd1', action: 'check', selector: '#cb' },
        browser
      );

      expect(response.success).toBe(true);
      expect(checkbox.checked).toBe(true);
    });

    it('should uncheck checkbox', async () => {
      document.body.innerHTML = '<input id="cb" type="checkbox" checked>';
      const checkbox = document.getElementById('cb') as HTMLInputElement;

      const response = await executeCommand(
        { id: 'cmd1', action: 'uncheck', selector: '#cb' },
        browser
      );

      expect(response.success).toBe(true);
      expect(checkbox.checked).toBe(false);
    });
  });

  describe('focus', () => {
    it('should focus element', async () => {
      document.body.innerHTML = '<input id="input">';
      const input = document.getElementById('input')!;
      const handler = vi.fn();
      input.addEventListener('focus', handler);

      const response = await executeCommand(
        { id: 'cmd1', action: 'focus', selector: '#input' },
        browser
      );

      expect(response.success).toBe(true);
      expect(document.activeElement).toBe(input);
    });
  });

  describe('hover', () => {
    it('should trigger hover events', async () => {
      document.body.innerHTML = '<button id="btn">Hover</button>';
      const button = document.getElementById('btn')!;
      const enterHandler = vi.fn();
      const overHandler = vi.fn();
      button.addEventListener('mouseenter', enterHandler);
      button.addEventListener('mouseover', overHandler);

      const response = await executeCommand(
        { id: 'cmd1', action: 'hover', selector: '#btn' },
        browser
      );

      expect(response.success).toBe(true);
      expect(enterHandler).toHaveBeenCalled();
      expect(overHandler).toHaveBeenCalled();
    });
  });

  describe('select', () => {
    it('should select option', async () => {
      document.body.innerHTML = `
        <select id="sel">
          <option value="a">A</option>
          <option value="b">B</option>
        </select>
      `;
      const select = document.getElementById('sel') as HTMLSelectElement;

      const response = await executeCommand(
        { id: 'cmd1', action: 'select', selector: '#sel', values: 'b' },
        browser
      );

      expect(response.success).toBe(true);
      expect(select.value).toBe('b');
    });

    it('should select multiple options', async () => {
      document.body.innerHTML = `
        <select id="sel" multiple>
          <option value="a">A</option>
          <option value="b">B</option>
          <option value="c">C</option>
        </select>
      `;
      const select = document.getElementById('sel') as HTMLSelectElement;

      const response = await executeCommand(
        { id: 'cmd1', action: 'select', selector: '#sel', values: ['a', 'c'] },
        browser
      );

      expect(response.success).toBe(true);
      expect(select.options[0].selected).toBe(true);
      expect(select.options[1].selected).toBe(false);
      expect(select.options[2].selected).toBe(true);
    });
  });

  describe('snapshot', () => {
    it('should return DOM snapshot', async () => {
      document.body.innerHTML = '<button>Click me</button>';

      const response = await executeCommand(
        { id: 'cmd1', action: 'snapshot' },
        browser
      );

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.snapshot).toContain('button');
        expect(response.data.refs).toBeDefined();
      }
    });

    it('should support interactive mode', async () => {
      document.body.innerHTML = `
        <h1>Title</h1>
        <button>Click</button>
      `;

      const response = await executeCommand(
        { id: 'cmd1', action: 'snapshot', interactive: true },
        browser
      );

      expect(response.success).toBe(true);
    });
  });

  describe('evaluate', () => {
    it('should evaluate JavaScript', async () => {
      document.title = 'Test Page';

      const response = await executeCommand(
        { id: 'cmd1', action: 'evaluate', script: 'document.title' },
        browser
      );

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.result).toBe('Test Page');
      }
    });

    it('should evaluate complex expressions', async () => {
      document.body.innerHTML = '<div>Hello</div>';

      const response = await executeCommand(
        { id: 'cmd1', action: 'evaluate', script: 'document.querySelector("div").textContent' },
        browser
      );

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.result).toBe('Hello');
      }
    });
  });

  describe('scroll', () => {
    it('should scroll by direction', async () => {
      const response = await executeCommand(
        { id: 'cmd1', action: 'scroll', direction: 'down', amount: 100 },
        browser
      );

      expect(response.success).toBe(true);
    });

    it('should scroll element into view', async () => {
      document.body.innerHTML = '<div id="target" style="margin-top: 2000px">Target</div>';
      const element = document.getElementById('target')!;
      // Mock scrollIntoView since jsdom doesn't implement it
      element.scrollIntoView = vi.fn();
      const scrollIntoView = vi.spyOn(element, 'scrollIntoView');

      const response = await executeCommand(
        { id: 'cmd1', action: 'scroll', selector: '#target' },
        browser
      );

      expect(response.success).toBe(true);
      expect(scrollIntoView).toHaveBeenCalled();
    });
  });

  describe('storage', () => {
    it('should get storage value', async () => {
      localStorage.setItem('testKey', 'testValue');

      const response = await executeCommand(
        { id: 'cmd1', action: 'storage_get', type: 'local', key: 'testKey' },
        browser
      );

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.value).toBe('testValue');
      }

      localStorage.removeItem('testKey');
    });

    it('should set storage value', async () => {
      const response = await executeCommand(
        { id: 'cmd1', action: 'storage_set', type: 'local', key: 'newKey', value: 'newValue' },
        browser
      );

      expect(response.success).toBe(true);
      expect(localStorage.getItem('newKey')).toBe('newValue');

      localStorage.removeItem('newKey');
    });

    it('should clear storage', async () => {
      localStorage.setItem('key1', 'value1');

      const response = await executeCommand(
        { id: 'cmd1', action: 'storage_clear', type: 'local' },
        browser
      );

      expect(response.success).toBe(true);
      expect(localStorage.getItem('key1')).toBeNull();
    });
  });

  describe('element queries', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <button id="btn" disabled data-custom="value">Click</button>
        <input id="input" type="checkbox" checked>
      `;
    });

    it('should get attribute', async () => {
      const response = await executeCommand(
        { id: 'cmd1', action: 'getattribute', selector: '#btn', attribute: 'data-custom' },
        browser
      );

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.value).toBe('value');
      }
    });

    it('should get text', async () => {
      const response = await executeCommand(
        { id: 'cmd1', action: 'gettext', selector: '#btn' },
        browser
      );

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.text).toBe('Click');
      }
    });

    it('should check visibility', async () => {
      const response = await executeCommand(
        { id: 'cmd1', action: 'isvisible', selector: '#btn' },
        browser
      );

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.visible).toBe(true);
      }
    });

    it('should check enabled state', async () => {
      const response = await executeCommand(
        { id: 'cmd1', action: 'isenabled', selector: '#btn' },
        browser
      );

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.enabled).toBe(false);
      }
    });

    it('should check checked state', async () => {
      const response = await executeCommand(
        { id: 'cmd1', action: 'ischecked', selector: '#input' },
        browser
      );

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.checked).toBe(true);
      }
    });

    it('should count elements', async () => {
      document.body.innerHTML = '<button>1</button><button>2</button><button>3</button>';

      const response = await executeCommand(
        { id: 'cmd1', action: 'count', selector: 'button' },
        browser
      );

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.count).toBe(3);
      }
    });

    it('should get bounding box', async () => {
      const response = await executeCommand(
        { id: 'cmd1', action: 'boundingbox', selector: '#btn' },
        browser
      );

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.box).toBeDefined();
        expect(typeof response.data.box.x).toBe('number');
        expect(typeof response.data.box.y).toBe('number');
      }
    });
  });

  describe('semantic locators', () => {
    it('should find and click by role', async () => {
      document.body.innerHTML = '<button>Submit</button>';
      const button = document.querySelector('button')!;
      const handler = vi.fn();
      button.addEventListener('click', handler);

      const response = await executeCommand(
        { id: 'cmd1', action: 'getbyrole', role: 'button', name: 'Submit', subaction: 'click' },
        browser
      );

      expect(response.success).toBe(true);
      expect(handler).toHaveBeenCalled();
    });

    it('should find by label and fill', async () => {
      document.body.innerHTML = `
        <label for="email">Email Address</label>
        <input id="email" type="text">
      `;
      const input = document.getElementById('email') as HTMLInputElement;

      const response = await executeCommand(
        {
          id: 'cmd1',
          action: 'getbylabel',
          label: 'Email Address',
          subaction: 'fill',
          value: 'test@example.com',
        },
        browser
      );

      expect(response.success).toBe(true);
      expect(input.value).toBe('test@example.com');
    });

    it('should find by placeholder', async () => {
      document.body.innerHTML = '<input placeholder="Enter name">';
      const input = document.querySelector('input') as HTMLInputElement;

      const response = await executeCommand(
        {
          id: 'cmd1',
          action: 'getbyplaceholder',
          placeholder: 'Enter name',
          subaction: 'fill',
          value: 'John',
        },
        browser
      );

      expect(response.success).toBe(true);
      expect(input.value).toBe('John');
    });

    it('should find by test id', async () => {
      document.body.innerHTML = '<button data-testid="submit-btn">Submit</button>';
      const button = document.querySelector('button')!;
      const handler = vi.fn();
      button.addEventListener('click', handler);

      const response = await executeCommand(
        { id: 'cmd1', action: 'getbytestid', testId: 'submit-btn', subaction: 'click' },
        browser
      );

      expect(response.success).toBe(true);
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('console and errors', () => {
    it('should get console messages', async () => {
      console.log('Test message');

      const response = await executeCommand(
        { id: 'cmd1', action: 'console' },
        browser
      );

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.messages.some((m: { text: string }) => m.text.includes('Test'))).toBe(
          true
        );
      }
    });

    it('should clear console messages', async () => {
      console.log('Test');

      const response = await executeCommand(
        { id: 'cmd1', action: 'console', clear: true },
        browser
      );

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.cleared).toBe(true);
      }
    });
  });

  describe('navigation', () => {
    it('should get current URL', async () => {
      const response = await executeCommand(
        { id: 'cmd1', action: 'url' },
        browser
      );

      expect(response.success).toBe(true);
      if (response.success) {
        expect(typeof response.data.url).toBe('string');
      }
    });

    it('should get page title', async () => {
      document.title = 'Test Title';

      const response = await executeCommand(
        { id: 'cmd1', action: 'title' },
        browser
      );

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.title).toBe('Test Title');
      }
    });
  });

  describe('content', () => {
    it('should get page HTML', async () => {
      document.body.innerHTML = '<div>Content</div>';

      const response = await executeCommand(
        { id: 'cmd1', action: 'content' },
        browser
      );

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.html).toContain('Content');
      }
    });

    it('should get element HTML', async () => {
      document.body.innerHTML = '<div id="container"><span>Inner</span></div>';

      const response = await executeCommand(
        { id: 'cmd1', action: 'content', selector: '#container' },
        browser
      );

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.html).toContain('Inner');
      }
    });
  });

  describe('close', () => {
    it('should close browser', async () => {
      const response = await executeCommand(
        { id: 'cmd1', action: 'close' },
        browser
      );

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.closed).toBe(true);
      }
    });
  });

  describe('inline help', () => {
    it('should return help for action when help: true', async () => {
      const response = await executeCommand(
        { id: 'cmd1', action: 'click', help: true },
        browser
      );

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.type).toBe('help');
        expect(response.data.action.name).toBe('click');
        expect(response.data.quickRef).toContain('CLICK');
        expect(response.data.quickRef).toContain('Parameters');
        expect(response.data.quickRef).toContain('selector');
      }
    });

    it('should return full help for help action', async () => {
      const response = await executeCommand(
        { id: 'cmd1', action: 'help', help: true },
        browser
      );

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.type).toBe('help');
        expect(response.data.quickRef).toContain('BROWSER AGENT');
        expect(response.data.actions).toContain('click');
        expect(response.data.actions).toContain('snapshot');
      }
    });

    it('should suggest similar actions for typos', async () => {
      const response = await executeCommand(
        { id: 'cmd1', action: 'clck', help: true },
        browser
      );

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.type).toBe('help');
        // Unknown action returns suggestions
        expect(response.data.suggestions).toContain('click');
        expect(response.data.action).toBeUndefined(); // No action info for unknown
      }
    });

    it('should not execute when help: true', async () => {
      document.body.innerHTML = '<button id="btn">Click</button>';
      const button = document.getElementById('btn')!;
      const handler = vi.fn();
      button.addEventListener('click', handler);

      const response = await executeCommand(
        { id: 'cmd1', action: 'click', selector: '#btn', help: true },
        browser
      );

      expect(response.success).toBe(true);
      expect(handler).not.toHaveBeenCalled(); // Should not click
      if (response.success) {
        expect(response.data.type).toBe('help');
      }
    });

    it('should return help for snapshot action', async () => {
      const response = await executeCommand(
        { id: 'cmd1', action: 'snapshot', help: true },
        browser
      );

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.action.name).toBe('snapshot');
        expect(response.data.action.tips).toBeDefined();
      }
    });

    it('should return help for type action', async () => {
      const response = await executeCommand(
        { id: 'cmd1', action: 'type', help: true },
        browser
      );

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.action.name).toBe('type');
        expect(response.data.action.parameters.some((p: { name: string }) => p.name === 'text')).toBe(true);
      }
    });
  });
});
