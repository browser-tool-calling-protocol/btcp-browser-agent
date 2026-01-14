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

    expect(ext.extensionScreenshot).toBeDefined();
    expect(ext.extensionNavigate).toBeDefined();
    expect(ext.extensionEvaluate).toBeDefined();
    expect(ext.extensionGetTabs).toBeDefined();
    expect(ext.extensionNewTab).toBeDefined();
    expect(ext.extensionSwitchTab).toBeDefined();
    expect(ext.extensionCloseTab).toBeDefined();
    expect(ext.getExtensionCapabilities).toBeDefined();
    expect(ext.hasCapability).toBeDefined();
  });

  it('extensionScreenshot should fail gracefully in browser context', async () => {
    const { extensionScreenshot } = await import('./extension.js');
    const response = await extensionScreenshot('test-id');

    expect(response.success).toBe(false);
    expect(response.error).toContain('Not running in extension context');
  });

  it('extensionNavigate should fail gracefully in browser context', async () => {
    const { extensionNavigate } = await import('./extension.js');
    const response = await extensionNavigate('test-id', 'https://example.com');

    expect(response.success).toBe(false);
    expect(response.error).toContain('Tabs API not available');
  });

  it('extensionGetTabs should fail gracefully in browser context', async () => {
    const { extensionGetTabs } = await import('./extension.js');
    const response = await extensionGetTabs('test-id');

    expect(response.success).toBe(false);
    expect(response.error).toContain('Not in extension context');
  });

  it('extensionNewTab should fail gracefully in browser context', async () => {
    const { extensionNewTab } = await import('./extension.js');
    const response = await extensionNewTab('test-id');

    expect(response.success).toBe(false);
    expect(response.error).toContain('Not in extension context');
  });

  it('extensionSwitchTab should fail gracefully in browser context', async () => {
    const { extensionSwitchTab } = await import('./extension.js');
    const response = await extensionSwitchTab('test-id', 1);

    expect(response.success).toBe(false);
    expect(response.error).toContain('Not in extension context');
  });

  it('extensionCloseTab should fail gracefully in browser context', async () => {
    const { extensionCloseTab } = await import('./extension.js');
    const response = await extensionCloseTab('test-id');

    expect(response.success).toBe(false);
    expect(response.error).toContain('Not in extension context');
  });

  it('getExtensionCapabilities should return browser context info', async () => {
    const { getExtensionCapabilities } = await import('./extension.js');
    const caps = getExtensionCapabilities();

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
