/**
 * Browser Tool Calling Protocol - Context Detection & Abstraction
 *
 * Supports both browser tab and Chrome extension contexts with automatic detection.
 */

/**
 * Runtime context types
 */
export type ContextType = 'browser' | 'extension-content' | 'extension-background' | 'extension-popup';

/**
 * Detected context information
 */
export interface ContextInfo {
  type: ContextType;
  isExtension: boolean;
  hasTabsApi: boolean;
  hasDebuggerApi: boolean;
  hasWebRequestApi: boolean;
  hasScriptingApi: boolean;
  canCaptureScreenshot: boolean;
  canAccessCrossOrigin: boolean;
  canInterceptNetwork: boolean;
}

/**
 * Chrome extension APIs type (for type safety without requiring @types/chrome)
 */
interface ChromeRuntime {
  id?: string;
  getManifest?: () => { manifest_version: number };
  getURL?: (path: string) => string;
  sendMessage?: (message: unknown, callback?: (response: unknown) => void) => void;
  onMessage?: {
    addListener: (callback: (message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => boolean | void) => void;
  };
}

interface ChromeTabs {
  query?: (query: object, callback: (tabs: Array<{ id?: number; url?: string }>) => void) => void;
  captureVisibleTab?: (windowId: number | null, options: object, callback: (dataUrl: string) => void) => void;
  sendMessage?: (tabId: number, message: unknown, callback?: (response: unknown) => void) => void;
  create?: (options: object, callback?: (tab: object) => void) => void;
  update?: (tabId: number, options: object, callback?: (tab: object) => void) => void;
  remove?: (tabId: number | number[], callback?: () => void) => void;
  get?: (tabId: number, callback: (tab: object) => void) => void;
}

interface ChromeDebugger {
  attach?: (target: object, version: string, callback?: () => void) => void;
  detach?: (target: object, callback?: () => void) => void;
  sendCommand?: (target: object, method: string, params?: object, callback?: (result: object) => void) => void;
}

interface ChromeScripting {
  executeScript?: (options: object) => Promise<Array<{ result: unknown }>>;
}

interface ChromeWebRequest {
  onBeforeRequest?: {
    addListener: (callback: (details: object) => object | void, filter: object, extraInfoSpec?: string[]) => void;
  };
}

declare const chrome: {
  runtime?: ChromeRuntime;
  tabs?: ChromeTabs;
  debugger?: ChromeDebugger;
  scripting?: ChromeScripting;
  webRequest?: ChromeWebRequest;
} | undefined;

/**
 * Detect the current runtime context
 */
export function detectContext(): ContextInfo {
  const info: ContextInfo = {
    type: 'browser',
    isExtension: false,
    hasTabsApi: false,
    hasDebuggerApi: false,
    hasWebRequestApi: false,
    hasScriptingApi: false,
    canCaptureScreenshot: false,
    canAccessCrossOrigin: false,
    canInterceptNetwork: false,
  };

  // Check if we're in a Chrome extension
  if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
    info.isExtension = true;

    // Check available APIs
    info.hasTabsApi = !!(chrome.tabs?.query);
    info.hasDebuggerApi = !!(chrome.debugger?.attach);
    info.hasWebRequestApi = !!(chrome.webRequest?.onBeforeRequest);
    info.hasScriptingApi = !!(chrome.scripting?.executeScript);

    // Determine context type
    if (typeof window === 'undefined' || !document) {
      // Service worker / background script (Manifest V3)
      info.type = 'extension-background';
    } else if (chrome.tabs?.query) {
      // Has tabs API - popup or background page
      info.type = 'extension-popup';
    } else {
      // Content script - injected into web page
      info.type = 'extension-content';
    }

    // Set capabilities based on context
    if (info.type === 'extension-background' || info.type === 'extension-popup') {
      info.canCaptureScreenshot = !!chrome.tabs?.captureVisibleTab;
      info.canAccessCrossOrigin = info.hasScriptingApi || info.hasTabsApi;
      info.canInterceptNetwork = info.hasWebRequestApi;
    } else if (info.type === 'extension-content') {
      // Content scripts can communicate with background for these features
      info.canCaptureScreenshot = true; // Via message to background
      info.canAccessCrossOrigin = false; // Still same-origin in content script
      info.canInterceptNetwork = false; // Must go through background
    }
  }

  return info;
}

/**
 * Check if running in extension context
 */
export function isExtensionContext(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.runtime?.id;
}

/**
 * Check if running in content script
 */
export function isContentScript(): boolean {
  if (!isExtensionContext()) return false;
  // Content scripts don't have chrome.tabs.query
  return typeof chrome !== 'undefined' && !chrome.tabs?.query;
}

/**
 * Check if running in background/service worker
 */
export function isBackgroundScript(): boolean {
  if (!isExtensionContext()) return false;
  return typeof window === 'undefined' || !document;
}

/**
 * Send message to extension background script
 */
export function sendToBackground<T = unknown>(message: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      reject(new Error('Not in extension context'));
      return;
    }

    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime && 'lastError' in chrome.runtime) {
        reject(new Error(String((chrome.runtime as { lastError?: { message?: string } }).lastError?.message)));
      } else {
        resolve(response as T);
      }
    });
  });
}

/**
 * Send message to content script in a tab
 */
export function sendToTab<T = unknown>(tabId: number, message: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.tabs?.sendMessage) {
      reject(new Error('Tabs API not available'));
      return;
    }

    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime && 'lastError' in chrome.runtime) {
        reject(new Error(String((chrome.runtime as { lastError?: { message?: string } }).lastError?.message)));
      } else {
        resolve(response as T);
      }
    });
  });
}

/**
 * Capture visible tab screenshot (extension only)
 */
export function captureVisibleTab(format: 'png' | 'jpeg' = 'png', quality?: number): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.tabs?.captureVisibleTab) {
      reject(new Error('captureVisibleTab not available'));
      return;
    }

    const options: { format: string; quality?: number } = { format };
    if (quality !== undefined) {
      options.quality = quality;
    }

    chrome.tabs.captureVisibleTab(null, options, (dataUrl) => {
      if (chrome.runtime && 'lastError' in chrome.runtime) {
        reject(new Error(String((chrome.runtime as { lastError?: { message?: string } }).lastError?.message)));
      } else {
        resolve(dataUrl);
      }
    });
  });
}

/**
 * Get current active tab (extension only)
 */
export function getActiveTab(): Promise<{ id: number; url?: string } | null> {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.tabs?.query) {
      reject(new Error('Tabs API not available'));
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime && 'lastError' in chrome.runtime) {
        reject(new Error(String((chrome.runtime as { lastError?: { message?: string } }).lastError?.message)));
      } else {
        const tab = tabs[0];
        resolve(tab?.id ? { id: tab.id, url: tab.url } : null);
      }
    });
  });
}

/**
 * Execute script in tab (extension only, Manifest V3)
 */
export function executeInTab<T = unknown>(tabId: number, func: () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.scripting?.executeScript) {
      reject(new Error('Scripting API not available'));
      return;
    }

    chrome.scripting.executeScript({
      target: { tabId },
      func,
    }).then((results) => {
      resolve(results[0]?.result as T);
    }).catch(reject);
  });
}

/**
 * Context-aware wrapper for operations that differ by context
 */
export interface ContextOperations {
  /** Take a screenshot */
  screenshot(): Promise<string>;
  /** Execute JavaScript in the page */
  evaluate<T>(script: string): Promise<T>;
  /** Get page URL */
  getUrl(): Promise<string>;
  /** Get page title */
  getTitle(): Promise<string>;
}

/**
 * Create context-specific operations
 */
export function createContextOperations(
  targetWindow: Window = window,
  targetDocument: Document = document
): ContextOperations {
  const context = detectContext();

  if (context.type === 'extension-background' || context.type === 'extension-popup') {
    // Background/popup - use chrome APIs
    return {
      async screenshot(): Promise<string> {
        return captureVisibleTab('png');
      },
      async evaluate<T>(script: string): Promise<T> {
        const tab = await getActiveTab();
        if (!tab?.id) throw new Error('No active tab');
        return executeInTab(tab.id, () => {
          return eval(script); // eslint-disable-line no-eval
        });
      },
      async getUrl(): Promise<string> {
        const tab = await getActiveTab();
        return tab?.url || '';
      },
      async getTitle(): Promise<string> {
        const tab = await getActiveTab();
        if (!tab?.id) return '';
        return executeInTab(tab.id, () => document.title);
      },
    };
  } else if (context.type === 'extension-content') {
    // Content script - use DOM + message passing for some features
    return {
      async screenshot(): Promise<string> {
        // Request screenshot from background
        return sendToBackground<string>({ type: 'screenshot' });
      },
      async evaluate<T>(script: string): Promise<T> {
        // eslint-disable-next-line no-eval
        return eval(script) as T;
      },
      async getUrl(): Promise<string> {
        return targetWindow.location.href;
      },
      async getTitle(): Promise<string> {
        return targetDocument.title;
      },
    };
  } else {
    // Browser tab - use canvas for screenshot
    return {
      async screenshot(): Promise<string> {
        // Canvas-based screenshot (limited)
        const canvas = targetDocument.createElement('canvas');
        canvas.width = targetWindow.innerWidth || 800;
        canvas.height = targetWindow.innerHeight || 600;
        // Note: This won't actually capture the page content in most browsers
        // due to security restrictions. It's a placeholder.
        try {
          const dataUrl = canvas.toDataURL('image/png');
          return dataUrl || 'data:image/png;base64,';
        } catch {
          // Handle environments where canvas isn't fully implemented (like jsdom)
          return 'data:image/png;base64,';
        }
      },
      async evaluate<T>(script: string): Promise<T> {
        // eslint-disable-next-line no-eval
        return eval(script) as T;
      },
      async getUrl(): Promise<string> {
        return targetWindow.location.href;
      },
      async getTitle(): Promise<string> {
        return targetDocument.title;
      },
    };
  }
}
