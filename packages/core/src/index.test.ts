/**
 * @btcp/core - Tests for DOM actions and snapshot
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAgent, createSnapshot, createRefMap, DOMActions } from './index.js';
import type { Command } from './types.js';

describe('@btcp/core', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('createAgent', () => {
    it('should create an agent instance', () => {
      const agent = createAgent(document, window);
      expect(agent).toBeDefined();
      expect(agent.execute).toBeDefined();
      expect(agent.executeJson).toBeDefined();
    });
  });

  describe('snapshot', () => {
    it('should generate snapshot for button', async () => {
      document.body.innerHTML = '<button>Click me</button>';
      const agent = createAgent(document, window);

      const response = await agent.execute({
        id: '1',
        action: 'snapshot',
      });

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.tree).toContain('button');
        expect(response.data.tree).toContain('Click me');
        expect(response.data.tree).toContain('@ref:');
      }
    });

    it('should generate refs for interactive elements', async () => {
      document.body.innerHTML = `
        <button>Submit</button>
        <a href="/home">Home</a>
        <input type="text" placeholder="Name">
      `;
      const agent = createAgent(document, window);

      const response = await agent.execute({ id: '1', action: 'snapshot' });

      expect(response.success).toBe(true);
      if (response.success) {
        const refs = response.data.refs;
        expect(Object.keys(refs).length).toBeGreaterThan(0);
      }
    });

    it('should skip hidden elements', async () => {
      document.body.innerHTML = `
        <button>Visible</button>
        <button style="display: none">Hidden</button>
      `;
      const agent = createAgent(document, window);

      const response = await agent.execute({ id: '1', action: 'snapshot' });

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.tree).toContain('Visible');
        expect(response.data.tree).not.toContain('Hidden');
      }
    });

    it('should use aria-label for name', async () => {
      document.body.innerHTML = '<button aria-label="Close dialog">X</button>';
      const agent = createAgent(document, window);

      const response = await agent.execute({ id: '1', action: 'snapshot' });

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.tree).toContain('Close dialog');
      }
    });

    it('should filter snapshot with grep option', async () => {
      document.body.innerHTML = `
        <button>Submit</button>
        <button>Cancel</button>
        <a href="/home">Home</a>
      `;
      const agent = createAgent(document, window);

      const response = await agent.execute({
        id: '1',
        action: 'snapshot',
        grep: 'Submit',
      });

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.tree).toContain('Submit');
        expect(response.data.tree).not.toContain('Cancel');
        expect(response.data.tree).not.toContain('Home');
        expect(response.data.tree).toContain('grep=Submit');
        expect(response.data.tree).toContain('matches=1');
      }
    });

    it('should return all elements when grep matches none', async () => {
      document.body.innerHTML = '<button>Click</button>';
      const agent = createAgent(document, window);

      const response = await agent.execute({
        id: '1',
        action: 'snapshot',
        grep: 'nonexistent',
      });

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.tree).toContain('PAGE:');
        expect(response.data.tree).not.toContain('Click');
      }
    });

    it('should support grep ignoreCase option (-i)', async () => {
      document.body.innerHTML = `
        <button>SUBMIT</button>
        <button>Cancel</button>
      `;
      const agent = createAgent(document, window);

      const response = await agent.execute({
        id: '1',
        action: 'snapshot',
        grep: { pattern: 'submit', ignoreCase: true },
      });

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.tree).toContain('SUBMIT');
        expect(response.data.tree).not.toContain('Cancel');
      }
    });

    it('should support grep invert option (-v)', async () => {
      document.body.innerHTML = `
        <button>Submit</button>
        <button>Cancel</button>
        <a href="/home">Home</a>
      `;
      const agent = createAgent(document, window);

      const response = await agent.execute({
        id: '1',
        action: 'snapshot',
        grep: { pattern: 'BUTTON', invert: true },
      });

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.tree).not.toContain('Submit');
        expect(response.data.tree).not.toContain('Cancel');
        expect(response.data.tree).toContain('Home');
      }
    });

    it('should support grep fixedStrings option (-F)', async () => {
      document.body.innerHTML = `
        <button>Click [here]</button>
        <button>Other</button>
      `;
      const agent = createAgent(document, window);

      const response = await agent.execute({
        id: '1',
        action: 'snapshot',
        grep: { pattern: '[here]', fixedStrings: true },
      });

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.tree).toContain('[here]');
        expect(response.data.tree).not.toContain('Other');
      }
    });
  });

  describe('click', () => {
    it('should click element by CSS selector', async () => {
      document.body.innerHTML = '<button id="btn">Click me</button>';
      const button = document.getElementById('btn')!;
      const handler = vi.fn();
      button.addEventListener('click', handler);

      const agent = createAgent(document, window);
      const response = await agent.execute({
        id: '1',
        action: 'click',
        selector: '#btn',
      });

      expect(response.success).toBe(true);
      expect(handler).toHaveBeenCalled();
    });

    it('should click element by ref', async () => {
      document.body.innerHTML = '<button>Click me</button>';
      const button = document.querySelector('button')!;
      const handler = vi.fn();
      button.addEventListener('click', handler);

      const agent = createAgent(document, window);
      // First get snapshot to generate refs
      await agent.execute({ id: '1', action: 'snapshot' });

      const response = await agent.execute({
        id: '2',
        action: 'click',
        selector: '@ref:0',
      });

      expect(response.success).toBe(true);
      expect(handler).toHaveBeenCalled();
    });

    it('should return error for non-existent element', async () => {
      const agent = createAgent(document, window);
      const response = await agent.execute({
        id: '1',
        action: 'click',
        selector: '#non-existent',
      });

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

      const agent = createAgent(document, window);
      const response = await agent.execute({
        id: '1',
        action: 'type',
        selector: '#input',
        text: 'Hello',
      });

      expect(response.success).toBe(true);
      expect(input.value).toBe('Hello');
    });

    it('should clear input when clear option is true', async () => {
      document.body.innerHTML = '<input id="input" type="text" value="Existing">';
      const input = document.getElementById('input') as HTMLInputElement;

      const agent = createAgent(document, window);
      const response = await agent.execute({
        id: '1',
        action: 'type',
        selector: '#input',
        text: 'New',
        clear: true,
      });

      expect(response.success).toBe(true);
      expect(input.value).toBe('New');
    });
  });

  describe('fill', () => {
    it('should fill input value instantly', async () => {
      document.body.innerHTML = '<input id="input" type="text">';
      const input = document.getElementById('input') as HTMLInputElement;

      const agent = createAgent(document, window);
      const response = await agent.execute({
        id: '1',
        action: 'fill',
        selector: '#input',
        value: 'Test Value',
      });

      expect(response.success).toBe(true);
      expect(input.value).toBe('Test Value');
    });

    it('should dispatch input and change events', async () => {
      document.body.innerHTML = '<input id="input" type="text">';
      const input = document.getElementById('input') as HTMLInputElement;
      const inputHandler = vi.fn();
      const changeHandler = vi.fn();
      input.addEventListener('input', inputHandler);
      input.addEventListener('change', changeHandler);

      const agent = createAgent(document, window);
      await agent.execute({
        id: '1',
        action: 'fill',
        selector: '#input',
        value: 'Test',
      });

      expect(inputHandler).toHaveBeenCalled();
      expect(changeHandler).toHaveBeenCalled();
    });
  });

  describe('check/uncheck', () => {
    it('should check checkbox', async () => {
      document.body.innerHTML = '<input id="cb" type="checkbox">';
      const checkbox = document.getElementById('cb') as HTMLInputElement;

      const agent = createAgent(document, window);
      const response = await agent.execute({
        id: '1',
        action: 'check',
        selector: '#cb',
      });

      expect(response.success).toBe(true);
      expect(checkbox.checked).toBe(true);
    });

    it('should uncheck checkbox', async () => {
      document.body.innerHTML = '<input id="cb" type="checkbox" checked>';
      const checkbox = document.getElementById('cb') as HTMLInputElement;

      const agent = createAgent(document, window);
      const response = await agent.execute({
        id: '1',
        action: 'uncheck',
        selector: '#cb',
      });

      expect(response.success).toBe(true);
      expect(checkbox.checked).toBe(false);
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

      const agent = createAgent(document, window);
      const response = await agent.execute({
        id: '1',
        action: 'select',
        selector: '#sel',
        values: 'b',
      });

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

      const agent = createAgent(document, window);
      const response = await agent.execute({
        id: '1',
        action: 'select',
        selector: '#sel',
        values: ['a', 'c'],
      });

      expect(response.success).toBe(true);
      expect(select.options[0].selected).toBe(true);
      expect(select.options[1].selected).toBe(false);
      expect(select.options[2].selected).toBe(true);
    });
  });

  describe('hover', () => {
    it('should dispatch hover events', async () => {
      document.body.innerHTML = '<button id="btn">Hover</button>';
      const button = document.getElementById('btn')!;
      const enterHandler = vi.fn();
      const overHandler = vi.fn();
      button.addEventListener('mouseenter', enterHandler);
      button.addEventListener('mouseover', overHandler);

      const agent = createAgent(document, window);
      const response = await agent.execute({
        id: '1',
        action: 'hover',
        selector: '#btn',
      });

      expect(response.success).toBe(true);
      expect(enterHandler).toHaveBeenCalled();
      expect(overHandler).toHaveBeenCalled();
    });
  });

  describe('getText', () => {
    it('should get element text', async () => {
      document.body.innerHTML = '<div id="text">Hello World</div>';

      const agent = createAgent(document, window);
      const response = await agent.execute({
        id: '1',
        action: 'getText',
        selector: '#text',
      });

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.text).toBe('Hello World');
      }
    });
  });

  describe('getAttribute', () => {
    it('should get attribute value', async () => {
      document.body.innerHTML = '<div id="el" data-value="123"></div>';

      const agent = createAgent(document, window);
      const response = await agent.execute({
        id: '1',
        action: 'getAttribute',
        selector: '#el',
        attribute: 'data-value',
      });

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.value).toBe('123');
      }
    });
  });

  describe('isVisible', () => {
    it('should return true for visible element', async () => {
      document.body.innerHTML = '<button id="btn">Visible</button>';

      const agent = createAgent(document, window);
      const response = await agent.execute({
        id: '1',
        action: 'isVisible',
        selector: '#btn',
      });

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.visible).toBe(true);
      }
    });

    it('should return false for hidden element', async () => {
      document.body.innerHTML = '<button id="btn" style="display: none">Hidden</button>';

      const agent = createAgent(document, window);
      const response = await agent.execute({
        id: '1',
        action: 'isVisible',
        selector: '#btn',
      });

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.visible).toBe(false);
      }
    });
  });

  describe('isEnabled', () => {
    it('should return false for disabled element', async () => {
      document.body.innerHTML = '<button id="btn" disabled>Disabled</button>';

      const agent = createAgent(document, window);
      const response = await agent.execute({
        id: '1',
        action: 'isEnabled',
        selector: '#btn',
      });

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.enabled).toBe(false);
      }
    });
  });

  describe('isChecked', () => {
    it('should return true for checked checkbox', async () => {
      document.body.innerHTML = '<input id="cb" type="checkbox" checked>';

      const agent = createAgent(document, window);
      const response = await agent.execute({
        id: '1',
        action: 'isChecked',
        selector: '#cb',
      });

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.checked).toBe(true);
      }
    });
  });

  describe('scroll', () => {
    it('should scroll window', async () => {
      const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {});

      const agent = createAgent(document, window);
      const response = await agent.execute({
        id: '1',
        action: 'scroll',
        y: 100,
      });

      expect(response.success).toBe(true);
      expect(scrollBy).toHaveBeenCalled();
    });
  });

  describe('scrollIntoView', () => {
    it('should scroll element into view', async () => {
      document.body.innerHTML = '<div id="target">Target</div>';
      const element = document.getElementById('target')!;
      element.scrollIntoView = vi.fn();

      const agent = createAgent(document, window);
      const response = await agent.execute({
        id: '1',
        action: 'scrollIntoView',
        selector: '#target',
      });

      expect(response.success).toBe(true);
      expect(element.scrollIntoView).toHaveBeenCalled();
    });
  });

  describe('evaluate', () => {
    it('should evaluate JavaScript expression', async () => {
      document.title = 'Test Page';

      const agent = createAgent(document, window);
      const response = await agent.execute({
        id: '1',
        action: 'evaluate',
        script: 'document.title',
      });

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data.result).toBe('Test Page');
      }
    });
  });

  describe('executeJson', () => {
    it('should execute command from JSON string', async () => {
      document.body.innerHTML = '<button id="btn">Click</button>';
      const button = document.getElementById('btn')!;
      const handler = vi.fn();
      button.addEventListener('click', handler);

      const agent = createAgent(document, window);
      const responseJson = await agent.executeJson(
        JSON.stringify({ id: '1', action: 'click', selector: '#btn' })
      );

      const response = JSON.parse(responseJson);
      expect(response.success).toBe(true);
      expect(handler).toHaveBeenCalled();
    });

    it('should return error for invalid JSON', async () => {
      const agent = createAgent(document, window);
      const responseJson = await agent.executeJson('invalid json');

      const response = JSON.parse(responseJson);
      expect(response.success).toBe(false);
      expect(response.error).toContain('parse');
    });
  });

  describe('refMap', () => {
    it('should create and use ref map', () => {
      document.body.innerHTML = '<button id="btn">Click</button>';
      const button = document.getElementById('btn')!;

      const refMap = createRefMap();
      const ref = refMap.generateRef(button);

      expect(ref).toMatch(/^@ref:\d+$/);
      expect(refMap.get(ref)).toBe(button);
    });

    it('should return same ref for same element', () => {
      document.body.innerHTML = '<button id="btn">Click</button>';
      const button = document.getElementById('btn')!;

      const refMap = createRefMap();
      const ref1 = refMap.generateRef(button);
      const ref2 = refMap.generateRef(button);

      expect(ref1).toBe(ref2);
    });

    it('should clear refs', () => {
      document.body.innerHTML = '<button id="btn">Click</button>';
      const button = document.getElementById('btn')!;

      const refMap = createRefMap();
      const ref = refMap.generateRef(button);
      refMap.clear();

      expect(refMap.get(ref)).toBeNull();
    });
  });
});
