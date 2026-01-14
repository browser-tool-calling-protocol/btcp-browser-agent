/**
 * Browser Tool Calling Protocol - Chrome Extension Support
 *
 * Enhanced browser control using Chrome Extension APIs.
 * Provides cross-origin access, better screenshots, and more capabilities.
 */

import {
  detectContext,
  isExtensionContext,
  isContentScript,
  sendToBackground,
  sendToTab,
  captureVisibleTab,
  getActiveTab,
  executeInTab,
  type ContextInfo,
} from './context.js';
import type { Response, ScreenshotData, NavigateData } from './types.js';
import { successResponse, errorResponse } from './protocol.js';

/**
 * Chrome extension message types
 */
export interface ExtensionMessage {
  type: string;
  id: string;
  [key: string]: unknown;
}

export interface ExtensionResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Extension-enhanced screenshot using chrome.tabs.captureVisibleTab
 */
export async function screenshot(
  commandId: string,
  options: { format?: 'png' | 'jpeg'; quality?: number } = {}
): Promise<Response> {
  try {
    const context = detectContext();

    if (!context.isExtension) {
      return errorResponse(commandId, 'Not running in extension context');
    }

    let dataUrl: string;

    if (context.type === 'extension-content') {
      // Content script - request from background
      const response = await sendToBackground<ExtensionResponse>({
        type: 'screenshot',
        id: commandId,
        format: options.format || 'png',
        quality: options.quality,
      });

      if (!response.success) {
        return errorResponse(commandId, response.error || 'Screenshot failed');
      }

      dataUrl = response.data as string;
    } else {
      // Background/popup - use API directly
      dataUrl = await captureVisibleTab(options.format || 'png', options.quality);
    }

    // Extract base64 data
    const base64 = dataUrl.split(',')[1];

    return successResponse<ScreenshotData>(commandId, {
      screenshot: base64,
      format: options.format || 'png',
    });
  } catch (error) {
    return errorResponse(commandId, `Screenshot failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Navigate using chrome.tabs API
 */
export async function navigate(
  commandId: string,
  url: string
): Promise<Response> {
  try {
    const context = detectContext();

    if (!context.isExtension || !context.hasTabsApi) {
      return errorResponse(commandId, 'Tabs API not available');
    }

    const tab = await getActiveTab();
    if (!tab?.id) {
      return errorResponse(commandId, 'No active tab');
    }

    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.tabs?.update) {
        chrome.tabs.update(tab.id!, { url }, () => {
          if (chrome.runtime && 'lastError' in chrome.runtime) {
            resolve(errorResponse(commandId, String((chrome.runtime as { lastError?: { message?: string } }).lastError?.message)));
          } else {
            resolve(successResponse<NavigateData>(commandId, { url, title: '' }));
          }
        });
      } else {
        resolve(errorResponse(commandId, 'Tabs API not available'));
      }
    });
  } catch (error) {
    return errorResponse(commandId, `Navigation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Execute script in active tab using chrome.scripting API
 */
export async function evaluate<T = unknown>(
  commandId: string,
  script: string
): Promise<Response> {
  try {
    const context = detectContext();

    if (context.type === 'extension-content') {
      // In content script - execute directly
      // eslint-disable-next-line no-eval
      const result = eval(script) as T;
      return successResponse(commandId, { result });
    }

    if (!context.hasScriptingApi) {
      return errorResponse(commandId, 'Scripting API not available');
    }

    const tab = await getActiveTab();
    if (!tab?.id) {
      return errorResponse(commandId, 'No active tab');
    }

    const result = await executeInTab<T>(tab.id, () => {
      // eslint-disable-next-line no-eval
      return eval(script);
    });

    return successResponse(commandId, { result });
  } catch (error) {
    return errorResponse(commandId, `Evaluate failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get all tabs (extension only)
 */
export async function getTabs(commandId: string): Promise<Response> {
  try {
    if (!isExtensionContext()) {
      return errorResponse(commandId, 'Not in extension context');
    }

    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
        chrome.tabs.query({}, (tabs) => {
          if (chrome.runtime && 'lastError' in chrome.runtime) {
            resolve(errorResponse(commandId, String((chrome.runtime as { lastError?: { message?: string } }).lastError?.message)));
          } else {
            resolve(successResponse(commandId, {
              tabs: tabs.map((t) => ({
                id: t.id,
                url: t.url,
              })),
            }));
          }
        });
      } else {
        resolve(errorResponse(commandId, 'Tabs API not available'));
      }
    });
  } catch (error) {
    return errorResponse(commandId, `Get tabs failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Create new tab (extension only)
 */
export async function newTab(
  commandId: string,
  url?: string
): Promise<Response> {
  try {
    if (!isExtensionContext()) {
      return errorResponse(commandId, 'Not in extension context');
    }

    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
        chrome.tabs.create({ url: url || 'about:blank' }, (tab) => {
          if (chrome.runtime && 'lastError' in chrome.runtime) {
            resolve(errorResponse(commandId, String((chrome.runtime as { lastError?: { message?: string } }).lastError?.message)));
          } else {
            resolve(successResponse(commandId, {
              tabId: (tab as { id?: number }).id,
              url: (tab as { url?: string }).url,
            }));
          }
        });
      } else {
        resolve(errorResponse(commandId, 'Tabs API not available'));
      }
    });
  } catch (error) {
    return errorResponse(commandId, `New tab failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Switch to tab (extension only)
 */
export async function switchTab(
  commandId: string,
  tabId: number
): Promise<Response> {
  try {
    if (!isExtensionContext()) {
      return errorResponse(commandId, 'Not in extension context');
    }

    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.tabs?.update) {
        chrome.tabs.update(tabId, { active: true }, (tab) => {
          if (chrome.runtime && 'lastError' in chrome.runtime) {
            resolve(errorResponse(commandId, String((chrome.runtime as { lastError?: { message?: string } }).lastError?.message)));
          } else {
            resolve(successResponse(commandId, {
              tabId: (tab as { id?: number })?.id,
              url: (tab as { url?: string })?.url,
            }));
          }
        });
      } else {
        resolve(errorResponse(commandId, 'Tabs API not available'));
      }
    });
  } catch (error) {
    return errorResponse(commandId, `Switch tab failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Close tab (extension only)
 */
export async function closeTab(
  commandId: string,
  tabId?: number
): Promise<Response> {
  try {
    if (!isExtensionContext()) {
      return errorResponse(commandId, 'Not in extension context');
    }

    const targetTabId = tabId ?? (await getActiveTab())?.id;
    if (!targetTabId) {
      return errorResponse(commandId, 'No tab to close');
    }

    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.tabs?.remove) {
        chrome.tabs.remove(targetTabId, () => {
          if (chrome.runtime && 'lastError' in chrome.runtime) {
            resolve(errorResponse(commandId, String((chrome.runtime as { lastError?: { message?: string } }).lastError?.message)));
          } else {
            resolve(successResponse(commandId, { closed: true, tabId: targetTabId }));
          }
        });
      } else {
        resolve(errorResponse(commandId, 'Tabs API not available'));
      }
    });
  } catch (error) {
    return errorResponse(commandId, `Close tab failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Execute command in specific tab via content script
 */
export async function executeInTabContext(
  tabId: number,
  command: ExtensionMessage
): Promise<ExtensionResponse> {
  try {
    return await sendToTab<ExtensionResponse>(tabId, command);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Background script message handler setup
 */
export function setupBackgroundHandler(
  handler: (message: ExtensionMessage, sendResponse: (response: ExtensionResponse) => void) => boolean | Promise<boolean>
): void {
  if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) {
    console.warn('Cannot setup background handler: not in extension context');
    return;
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const result = handler(message as ExtensionMessage, sendResponse);

    // If handler returns a promise, we need to return true to indicate async response
    if (result instanceof Promise) {
      result.then((keepOpen) => {
        if (!keepOpen) {
          sendResponse({ success: false, error: 'Handler did not respond' });
        }
      });
      return true; // Keep message channel open for async response
    }

    return result;
  });
}

/**
 * Content script message handler setup
 */
export function setupContentHandler(
  handler: (message: ExtensionMessage, sendResponse: (response: ExtensionResponse) => void) => boolean | Promise<boolean>
): void {
  if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) {
    console.warn('Cannot setup content handler: not in extension context');
    return;
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const result = handler(message as ExtensionMessage, sendResponse);

    if (result instanceof Promise) {
      result.then((keepOpen) => {
        if (!keepOpen) {
          sendResponse({ success: false, error: 'Handler did not respond' });
        }
      });
      return true;
    }

    return result;
  });
}

/**
 * Get extension capabilities
 */
export function getCapabilities(): ContextInfo {
  return detectContext();
}

/**
 * Check if a specific capability is available
 */
export function hasCapability(
  capability: 'screenshot' | 'crossOrigin' | 'network' | 'tabs' | 'debugger'
): boolean {
  const context = detectContext();

  switch (capability) {
    case 'screenshot':
      return context.canCaptureScreenshot;
    case 'crossOrigin':
      return context.canAccessCrossOrigin;
    case 'network':
      return context.canInterceptNetwork;
    case 'tabs':
      return context.hasTabsApi;
    case 'debugger':
      return context.hasDebuggerApi;
    default:
      return false;
  }
}
