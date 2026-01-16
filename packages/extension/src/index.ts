/**
 * @aspect/extension
 *
 * Chrome extension bridge for browser automation.
 *
 * This package provides:
 * - Content script: Handles DOM commands in web pages
 * - Background script: Handles navigation, tabs, screenshots
 * - Client: API for sending commands from popup or external scripts
 *
 * @example Extension popup usage:
 * ```typescript
 * import { createClient } from '@aspect/extension';
 *
 * const client = createClient();
 *
 * // Navigate to a URL
 * await client.navigate('https://example.com');
 *
 * // Take a snapshot
 * const snapshot = await client.snapshot();
 *
 * // Click an element
 * await client.click('@ref:5');
 *
 * // Take a screenshot
 * const screenshot = await client.screenshot();
 * ```
 */

import type {
  Command,
  ExtensionMessage,
  ExtensionResponse,
  Response,
  TabInfo,
} from './types.js';

export * from './types.js';

// Re-export core types
export type {
  SnapshotData,
  BoundingBox,
  Modifier,
} from '@aspect/core';

/**
 * Client for sending commands to the extension background script
 */
export interface Client {
  /**
   * Execute a raw command
   */
  execute(command: Command): Promise<Response>;

  // --- Navigation ---

  /**
   * Navigate to a URL
   */
  navigate(url: string, options?: { waitUntil?: 'load' | 'domcontentloaded' }): Promise<Response>;

  /**
   * Go back in history
   */
  back(): Promise<Response>;

  /**
   * Go forward in history
   */
  forward(): Promise<Response>;

  /**
   * Reload the page
   */
  reload(options?: { bypassCache?: boolean }): Promise<Response>;

  /**
   * Get the current URL
   */
  getUrl(): Promise<string>;

  /**
   * Get the page title
   */
  getTitle(): Promise<string>;

  // --- DOM ---

  /**
   * Take a snapshot of the page
   */
  snapshot(options?: { selector?: string; maxDepth?: number }): Promise<{
    tree: string;
    refs: Record<string, { selector: string; role: string; name?: string }>;
  }>;

  /**
   * Click an element
   */
  click(selector: string, options?: { button?: 'left' | 'right' | 'middle' }): Promise<Response>;

  /**
   * Type text into an element
   */
  type(selector: string, text: string, options?: { delay?: number; clear?: boolean }): Promise<Response>;

  /**
   * Fill an input with a value
   */
  fill(selector: string, value: string): Promise<Response>;

  /**
   * Get text content of an element
   */
  getText(selector: string): Promise<string | null>;

  /**
   * Check if element is visible
   */
  isVisible(selector: string): Promise<boolean>;

  // --- Tabs ---

  /**
   * Take a screenshot
   */
  screenshot(options?: { format?: 'png' | 'jpeg'; quality?: number }): Promise<string>;

  /**
   * Open a new tab
   */
  tabNew(options?: { url?: string; active?: boolean }): Promise<{ tabId: number; url?: string }>;

  /**
   * Close a tab
   */
  tabClose(tabId?: number): Promise<Response>;

  /**
   * Switch to a tab
   */
  tabSwitch(tabId: number): Promise<Response>;

  /**
   * List all tabs
   */
  tabList(): Promise<TabInfo[]>;
}

let commandIdCounter = 0;

function generateCommandId(): string {
  return `cmd_${Date.now()}_${commandIdCounter++}`;
}

/**
 * Create a client for communicating with the extension
 */
export function createClient(): Client {
  async function sendCommand(command: Command): Promise<Response> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'aspect:command', command } satisfies ExtensionMessage,
        (response) => {
          if (chrome.runtime.lastError) {
            resolve({
              id: command.id,
              success: false,
              error: chrome.runtime.lastError.message || 'Unknown error',
            });
          } else {
            const resp = response as ExtensionResponse;
            resolve(resp.response);
          }
        }
      );
    });
  }

  function assertSuccess(response: Response): asserts response is Response & { success: true } {
    if (!response.success) {
      throw new Error(response.error);
    }
  }

  return {
    execute: sendCommand,

    // Navigation
    async navigate(url, options) {
      return sendCommand({
        id: generateCommandId(),
        action: 'navigate',
        url,
        waitUntil: options?.waitUntil,
      });
    },

    async back() {
      return sendCommand({ id: generateCommandId(), action: 'back' });
    },

    async forward() {
      return sendCommand({ id: generateCommandId(), action: 'forward' });
    },

    async reload(options) {
      return sendCommand({
        id: generateCommandId(),
        action: 'reload',
        bypassCache: options?.bypassCache,
      });
    },

    async getUrl() {
      const response = await sendCommand({ id: generateCommandId(), action: 'getUrl' });
      assertSuccess(response);
      return (response.data as { url: string }).url;
    },

    async getTitle() {
      const response = await sendCommand({ id: generateCommandId(), action: 'getTitle' });
      assertSuccess(response);
      return (response.data as { title: string }).title;
    },

    // DOM
    async snapshot(options) {
      const response = await sendCommand({
        id: generateCommandId(),
        action: 'snapshot',
        selector: options?.selector,
        maxDepth: options?.maxDepth,
      });
      assertSuccess(response);
      return response.data as {
        tree: string;
        refs: Record<string, { selector: string; role: string; name?: string }>;
      };
    },

    async click(selector, options) {
      return sendCommand({
        id: generateCommandId(),
        action: 'click',
        selector,
        button: options?.button,
      });
    },

    async type(selector, text, options) {
      return sendCommand({
        id: generateCommandId(),
        action: 'type',
        selector,
        text,
        delay: options?.delay,
        clear: options?.clear,
      });
    },

    async fill(selector, value) {
      return sendCommand({
        id: generateCommandId(),
        action: 'fill',
        selector,
        value,
      });
    },

    async getText(selector) {
      const response = await sendCommand({
        id: generateCommandId(),
        action: 'getText',
        selector,
      });
      assertSuccess(response);
      return (response.data as { text: string | null }).text;
    },

    async isVisible(selector) {
      const response = await sendCommand({
        id: generateCommandId(),
        action: 'isVisible',
        selector,
      });
      assertSuccess(response);
      return (response.data as { visible: boolean }).visible;
    },

    // Tabs
    async screenshot(options) {
      const response = await sendCommand({
        id: generateCommandId(),
        action: 'screenshot',
        format: options?.format,
        quality: options?.quality,
      });
      assertSuccess(response);
      return (response.data as { screenshot: string }).screenshot;
    },

    async tabNew(options) {
      const response = await sendCommand({
        id: generateCommandId(),
        action: 'tabNew',
        url: options?.url,
        active: options?.active,
      });
      assertSuccess(response);
      return response.data as { tabId: number; url?: string };
    },

    async tabClose(tabId) {
      return sendCommand({
        id: generateCommandId(),
        action: 'tabClose',
        tabId,
      });
    },

    async tabSwitch(tabId) {
      return sendCommand({
        id: generateCommandId(),
        action: 'tabSwitch',
        tabId,
      });
    },

    async tabList() {
      const response = await sendCommand({
        id: generateCommandId(),
        action: 'tabList',
      });
      assertSuccess(response);
      return (response.data as { tabs: TabInfo[] }).tabs;
    },
  };
}
