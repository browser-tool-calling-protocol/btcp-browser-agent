/**
 * Tests for browser.ts - BrowserManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BrowserManager } from './browser.js';

describe('BrowserManager', () => {
  let browser: BrowserManager;

  beforeEach(() => {
    document.body.innerHTML = '';
    browser = new BrowserManager(window, document);
  });

  afterEach(async () => {
    await browser.close();
  });

  describe('launch', () => {
    it('should launch successfully', async () => {
      expect(browser.isLaunched()).toBe(false);

      await browser.launch({ id: 'launch1', action: 'launch' });

      expect(browser.isLaunched()).toBe(true);
    });

    it('should be idempotent', async () => {
      await browser.launch({ id: 'launch1', action: 'launch' });
      await browser.launch({ id: 'launch2', action: 'launch' });

      expect(browser.isLaunched()).toBe(true);
    });
  });

  describe('getSnapshot', () => {
    beforeEach(async () => {
      await browser.launch({ id: 'launch', action: 'launch' });
    });

    it('should return snapshot and refs', async () => {
      document.body.innerHTML = '<button>Click me</button>';

      const { tree, refs } = await browser.getSnapshot();

      expect(tree).toContain('button');
      expect(Object.keys(refs).length).toBeGreaterThan(0);
    });

    it('should cache ref map', async () => {
      document.body.innerHTML = '<button>Click</button>';

      await browser.getSnapshot();
      const refMap = browser.getRefMap();

      expect(refMap.e1).toBeDefined();
    });
  });

  describe('getElement', () => {
    beforeEach(async () => {
      await browser.launch({ id: 'launch', action: 'launch' });
    });

    it('should find element by selector', () => {
      document.body.innerHTML = '<button id="my-btn">Click</button>';

      const element = browser.getElement('#my-btn');

      expect(element).not.toBeNull();
      expect(element?.tagName).toBe('BUTTON');
    });

    it('should find element by ref', async () => {
      document.body.innerHTML = '<button>Click</button>';
      await browser.getSnapshot();

      const element = browser.getElement('@e1');

      expect(element).not.toBeNull();
      expect(element?.tagName).toBe('BUTTON');
    });

    it('should return null for non-existent element', () => {
      const element = browser.getElement('#does-not-exist');

      expect(element).toBeNull();
    });
  });

  describe('getElements', () => {
    beforeEach(async () => {
      await browser.launch({ id: 'launch', action: 'launch' });
    });

    it('should return all matching elements', () => {
      document.body.innerHTML = `
        <button>Button 1</button>
        <button>Button 2</button>
        <button>Button 3</button>
      `;

      const elements = browser.getElements('button');

      expect(elements).toHaveLength(3);
    });

    it('should return empty array for no matches', () => {
      const elements = browser.getElements('.non-existent');

      expect(elements).toHaveLength(0);
    });
  });

  describe('isRef', () => {
    it('should identify valid refs', () => {
      expect(browser.isRef('e1')).toBe(true);
      expect(browser.isRef('@e1')).toBe(true);
      expect(browser.isRef('ref=e1')).toBe(true);
      expect(browser.isRef('[ref=e1]')).toBe(true);
    });

    it('should reject non-refs', () => {
      expect(browser.isRef('button')).toBe(false);
      expect(browser.isRef('#id')).toBe(false);
      expect(browser.isRef('.class')).toBe(false);
    });
  });

  describe('getDocument and getWindow', () => {
    beforeEach(async () => {
      await browser.launch({ id: 'launch', action: 'launch' });
    });

    it('should return current document', () => {
      expect(browser.getDocument()).toBe(document);
    });

    it('should return current window', () => {
      expect(browser.getWindow()).toBe(window);
    });
  });

  describe('switchToFrame and switchToMainFrame', () => {
    beforeEach(async () => {
      await browser.launch({ id: 'launch', action: 'launch' });
    });

    it('should switch to iframe by selector', async () => {
      document.body.innerHTML = '<iframe id="my-frame"></iframe>';
      const iframe = document.getElementById('my-frame') as HTMLIFrameElement;
      // jsdom doesn't fully support iframes, but we can test the selector matching

      await expect(browser.switchToFrame({ selector: '#my-frame' })).resolves.not.toThrow();
    });

    it('should throw for non-existent frame', async () => {
      await expect(browser.switchToFrame({ selector: '#non-existent' })).rejects.toThrow();
    });

    it('should switch back to main frame', () => {
      browser.switchToMainFrame();
      // Should not throw
      expect(browser.getDocument()).toBe(document);
    });
  });

  describe('dispatchMouseEvent', () => {
    beforeEach(async () => {
      await browser.launch({ id: 'launch', action: 'launch' });
    });

    it('should dispatch click event', () => {
      document.body.innerHTML = '<button id="btn">Click</button>';
      const button = document.getElementById('btn')!;
      const handler = vi.fn();
      button.addEventListener('click', handler);

      browser.dispatchMouseEvent(button, 'click');

      expect(handler).toHaveBeenCalled();
    });

    it('should dispatch mousedown event', () => {
      document.body.innerHTML = '<button id="btn">Click</button>';
      const button = document.getElementById('btn')!;
      const handler = vi.fn();
      button.addEventListener('mousedown', handler);

      browser.dispatchMouseEvent(button, 'mousedown');

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('dispatchKeyboardEvent', () => {
    beforeEach(async () => {
      await browser.launch({ id: 'launch', action: 'launch' });
    });

    it('should dispatch keydown event', () => {
      document.body.innerHTML = '<input id="input">';
      const input = document.getElementById('input')!;
      const handler = vi.fn();
      input.addEventListener('keydown', handler);

      browser.dispatchKeyboardEvent(input, 'keydown', 'Enter');

      expect(handler).toHaveBeenCalled();
      expect(handler.mock.calls[0][0].key).toBe('Enter');
    });
  });

  describe('waitFor', () => {
    beforeEach(async () => {
      await browser.launch({ id: 'launch', action: 'launch' });
    });

    it('should resolve when condition is met', async () => {
      let value = false;
      setTimeout(() => {
        value = true;
      }, 50);

      await browser.waitFor(() => value, 1000, 10);

      expect(value).toBe(true);
    });

    it('should timeout if condition is never met', async () => {
      await expect(browser.waitFor(() => false, 100, 10)).rejects.toThrow('Timeout');
    });
  });

  describe('waitForElement', () => {
    beforeEach(async () => {
      await browser.launch({ id: 'launch', action: 'launch' });
    });

    it('should find existing element', async () => {
      document.body.innerHTML = '<button>Click</button>';

      const element = await browser.waitForElement('button', { timeout: 1000 });

      expect(element).not.toBeNull();
    });

    it('should wait for element to appear', async () => {
      setTimeout(() => {
        document.body.innerHTML = '<button>Click</button>';
      }, 50);

      const element = await browser.waitForElement('button', { timeout: 1000 });

      expect(element).not.toBeNull();
    });

    it('should timeout if element never appears', async () => {
      await expect(
        browser.waitForElement('.non-existent', { timeout: 100 })
      ).rejects.toThrow('Timeout');
    });
  });

  describe('highlightElement', () => {
    beforeEach(async () => {
      await browser.launch({ id: 'launch', action: 'launch' });
    });

    it('should add highlight overlay', () => {
      document.body.innerHTML = '<button id="btn">Click</button>';

      browser.highlightElement('#btn');

      // Check that a highlight div was added
      const highlights = document.querySelectorAll('div[style*="position: fixed"]');
      expect(highlights.length).toBeGreaterThan(0);
    });

    it('should clear highlights', () => {
      document.body.innerHTML = '<button id="btn">Click</button>';
      browser.highlightElement('#btn');

      browser.clearHighlights();

      const highlights = document.querySelectorAll('div[style*="border: 2px solid red"]');
      expect(highlights.length).toBe(0);
    });
  });

  describe('console and error tracking', () => {
    beforeEach(async () => {
      await browser.launch({ id: 'launch', action: 'launch' });
    });

    it('should track console messages', () => {
      console.log('Test message');

      const messages = browser.getConsoleMessages();

      expect(messages.some((m) => m.text.includes('Test message'))).toBe(true);
    });

    it('should clear console messages', () => {
      console.log('Test');
      browser.clearConsoleMessages();

      const messages = browser.getConsoleMessages();

      expect(messages).toHaveLength(0);
    });

    it('should track page errors', () => {
      // Dispatch error event
      const errorEvent = new ErrorEvent('error', { message: 'Test error' });
      window.dispatchEvent(errorEvent);

      const errors = browser.getPageErrors();

      expect(errors.some((e) => e.message.includes('Test error'))).toBe(true);
    });

    it('should clear page errors', () => {
      const errorEvent = new ErrorEvent('error', { message: 'Test error' });
      window.dispatchEvent(errorEvent);
      browser.clearPageErrors();

      const errors = browser.getPageErrors();

      expect(errors).toHaveLength(0);
    });
  });

  describe('request tracking', () => {
    beforeEach(async () => {
      await browser.launch({ id: 'launch', action: 'launch' });
    });

    it('should track fetch requests', async () => {
      // Trigger a fetch (will fail in jsdom but should be tracked)
      try {
        await fetch('https://example.com/api');
      } catch {
        // Expected to fail in jsdom
      }

      const requests = browser.getRequests();

      expect(requests.some((r) => r.url.includes('example.com'))).toBe(true);
    });

    it('should filter requests', async () => {
      try {
        await fetch('https://api.example.com/data');
        await fetch('https://other.com/data');
      } catch {
        // Expected to fail
      }

      const requests = browser.getRequests('api.example.com');

      expect(requests.every((r) => r.url.includes('api.example.com'))).toBe(true);
    });

    it('should clear requests', async () => {
      try {
        await fetch('https://example.com');
      } catch {
        // Expected
      }
      browser.clearRequests();

      const requests = browser.getRequests();

      expect(requests).toHaveLength(0);
    });
  });

  describe('devices', () => {
    it('should return device descriptor', () => {
      const device = browser.getDevice('iPhone 12');

      expect(device).toBeDefined();
      expect(device?.viewport.width).toBe(390);
      expect(device?.isMobile).toBe(true);
    });

    it('should return undefined for unknown device', () => {
      const device = browser.getDevice('Unknown Device');

      expect(device).toBeUndefined();
    });

    it('should list available devices', () => {
      const devices = browser.listDevices();

      expect(devices).toContain('iPhone 12');
      expect(devices).toContain('Desktop');
    });
  });

  describe('close', () => {
    it('should clean up state', async () => {
      await browser.launch({ id: 'launch', action: 'launch' });
      await browser.close();

      expect(browser.isLaunched()).toBe(false);
    });

    it('should be safe to call multiple times', async () => {
      await browser.launch({ id: 'launch', action: 'launch' });
      await browser.close();
      await browser.close();

      expect(browser.isLaunched()).toBe(false);
    });
  });
});
