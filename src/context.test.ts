/**
 * Tests for context.ts - Context detection and abstraction
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  detectContext,
  isExtensionContext,
  isContentScript,
  isBackgroundScript,
  createContextOperations,
} from './context.js';

describe('context detection', () => {
  describe('detectContext', () => {
    it('should detect browser context when chrome is undefined', () => {
      const context = detectContext();

      expect(context.type).toBe('browser');
      expect(context.isExtension).toBe(false);
      expect(context.hasTabsApi).toBe(false);
      expect(context.hasDebuggerApi).toBe(false);
      expect(context.canCaptureScreenshot).toBe(false);
      expect(context.canAccessCrossOrigin).toBe(false);
    });

    it('should return all capabilities as false in browser context', () => {
      const context = detectContext();

      expect(context.hasWebRequestApi).toBe(false);
      expect(context.hasScriptingApi).toBe(false);
      expect(context.canInterceptNetwork).toBe(false);
    });
  });

  describe('isExtensionContext', () => {
    it('should return false when not in extension', () => {
      expect(isExtensionContext()).toBe(false);
    });
  });

  describe('isContentScript', () => {
    it('should return false when not in extension', () => {
      expect(isContentScript()).toBe(false);
    });
  });

  describe('isBackgroundScript', () => {
    it('should return false when not in extension', () => {
      expect(isBackgroundScript()).toBe(false);
    });
  });
});

describe('context operations', () => {
  describe('createContextOperations', () => {
    it('should create browser context operations', () => {
      const ops = createContextOperations(window, document);

      expect(ops.screenshot).toBeDefined();
      expect(ops.evaluate).toBeDefined();
      expect(ops.getUrl).toBeDefined();
      expect(ops.getTitle).toBeDefined();
    });

    it('should return URL from window.location', async () => {
      const ops = createContextOperations(window, document);
      const url = await ops.getUrl();

      expect(url).toBe(window.location.href);
    });

    it('should return title from document', async () => {
      document.title = 'Test Page';
      const ops = createContextOperations(window, document);
      const title = await ops.getTitle();

      expect(title).toBe('Test Page');
    });

    it('should evaluate JavaScript', async () => {
      const ops = createContextOperations(window, document);
      const result = await ops.evaluate<number>('1 + 2');

      expect(result).toBe(3);
    });

    it('should return screenshot as data URL', async () => {
      const ops = createContextOperations(window, document);
      const screenshot = await ops.screenshot();

      // In jsdom, canvas.toDataURL returns a minimal data URL
      expect(screenshot).toBeDefined();
      expect(typeof screenshot).toBe('string');
    });
  });
});

describe('BrowserAgent context methods', () => {
  let agent: import('./index.js').BrowserAgent;

  beforeEach(async () => {
    const { BrowserAgent } = await import('./index.js');
    agent = new BrowserAgent();
  });

  it('getContext() should return context info', () => {
    const context = agent.getContext();

    expect(context).toBeDefined();
    expect(context.type).toBe('browser');
    expect(context.isExtension).toBe(false);
  });

  it('isExtension() should return false in browser context', () => {
    expect(agent.isExtension()).toBe(false);
  });

  it('hasCapability() should check capabilities', () => {
    expect(agent.hasCapability('screenshot')).toBe(false);
    expect(agent.hasCapability('crossOrigin')).toBe(false);
    expect(agent.hasCapability('tabs')).toBe(false);
  });
});

describe('extension context simulation', () => {
  // These tests verify the code paths for extension context
  // In a real extension, these would be integration tests

  it('should have proper interface for extension operations', async () => {
    // Import extension module to verify it exports properly
    const ext = await import('./extension.js');

    expect(ext.screenshot).toBeDefined();
    expect(ext.navigate).toBeDefined();
    expect(ext.evaluate).toBeDefined();
    expect(ext.getTabs).toBeDefined();
    expect(ext.newTab).toBeDefined();
    expect(ext.switchTab).toBeDefined();
    expect(ext.closeTab).toBeDefined();
    expect(ext.getCapabilities).toBeDefined();
    expect(ext.hasCapability).toBeDefined();
  });

  it('screenshot should fail gracefully in browser context', async () => {
    const { screenshot } = await import('./extension.js');
    const response = await screenshot('test-id');

    expect(response.success).toBe(false);
    expect(response.error).toContain('Not running in extension context');
  });

  it('navigate should fail gracefully in browser context', async () => {
    const { navigate } = await import('./extension.js');
    const response = await navigate('test-id', 'https://example.com');

    expect(response.success).toBe(false);
    expect(response.error).toContain('Tabs API not available');
  });

  it('getTabs should fail gracefully in browser context', async () => {
    const { getTabs } = await import('./extension.js');
    const response = await getTabs('test-id');

    expect(response.success).toBe(false);
    expect(response.error).toContain('Not in extension context');
  });

  it('newTab should fail gracefully in browser context', async () => {
    const { newTab } = await import('./extension.js');
    const response = await newTab('test-id');

    expect(response.success).toBe(false);
    expect(response.error).toContain('Not in extension context');
  });

  it('switchTab should fail gracefully in browser context', async () => {
    const { switchTab } = await import('./extension.js');
    const response = await switchTab('test-id', 1);

    expect(response.success).toBe(false);
    expect(response.error).toContain('Not in extension context');
  });

  it('closeTab should fail gracefully in browser context', async () => {
    const { closeTab } = await import('./extension.js');
    const response = await closeTab('test-id');

    expect(response.success).toBe(false);
    expect(response.error).toContain('Not in extension context');
  });

  it('getCapabilities should return browser context info', async () => {
    const { getCapabilities } = await import('./extension.js');
    const caps = getCapabilities();

    expect(caps.type).toBe('browser');
    expect(caps.isExtension).toBe(false);
  });

  it('hasCapability should return false for all in browser context', async () => {
    const { hasCapability } = await import('./extension.js');

    expect(hasCapability('screenshot')).toBe(false);
    expect(hasCapability('crossOrigin')).toBe(false);
    expect(hasCapability('network')).toBe(false);
    expect(hasCapability('tabs')).toBe(false);
    expect(hasCapability('debugger')).toBe(false);
  });
});
