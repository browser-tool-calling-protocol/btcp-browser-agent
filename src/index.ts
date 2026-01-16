/**
 * Browser Tool Calling Protocol (BTCP) - Browser Agent
 *
 * A browser-native implementation of the agent-browser protocol for AI agents
 * to interact with web pages using native browser APIs.
 *
 * ## Architecture
 *
 * This package provides two main agents:
 *
 * - **BrowserAgent** (from @aspect/extension): Runs in extension background script.
 *   Manages tabs, navigation, screenshots, and routes DOM commands to ContentAgents.
 *
 * - **ContentAgent** (from @aspect/core): Runs in content scripts or web pages.
 *   Handles all DOM operations (click, type, snapshot, etc.).
 *
 * @example Extension usage
 * ```typescript
 * // background.ts
 * import { BrowserAgent, setupMessageListener } from 'btcp-browser-agent';
 * setupMessageListener();
 *
 * // content.ts
 * import { createContentAgent } from 'btcp-browser-agent';
 * const agent = createContentAgent();
 * await agent.execute({ id: '1', action: 'snapshot' });
 * ```
 *
 * @example Standalone usage (no extension)
 * ```typescript
 * import { createContentAgent } from 'btcp-browser-agent';
 * const agent = createContentAgent();
 * const { data } = await agent.execute({ id: '1', action: 'snapshot' });
 * await agent.execute({ id: '2', action: 'click', selector: '@ref:5' });
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// IMPORTS
// =============================================================================

// NOTE: For the new clean API, import directly from the subpackages:
//   - import { createContentAgent } from 'btcp-browser-agent/core';
//   - import { BrowserAgent } from 'btcp-browser-agent/extension';
//
// The exports below are the legacy API maintained for backwards compatibility.

// Re-export types
export type {
  // Commands
  BaseCommand,
  Command,
  LaunchCommand,
  NavigateCommand,
  ClickCommand,
  TypeCommand,
  FillCommand,
  CheckCommand,
  UncheckCommand,
  UploadCommand,
  DoubleClickCommand,
  FocusCommand,
  DragCommand,
  FrameCommand,
  GetByRoleCommand,
  GetByTextCommand,
  GetByLabelCommand,
  GetByPlaceholderCommand,
  GetByAltTextCommand,
  GetByTitleCommand,
  GetByTestIdCommand,
  NthCommand,
  PressCommand,
  ScreenshotCommand,
  SnapshotCommand,
  EvaluateCommand,
  WaitCommand,
  ScrollCommand,
  SelectCommand,
  HoverCommand,
  ContentCommand,
  TabSwitchCommand,
  TabCloseCommand,
  StorageGetCommand,
  StorageSetCommand,
  StorageClearCommand,
  DialogCommand,
  GetAttributeCommand,
  GetTextCommand,
  IsVisibleCommand,
  IsEnabledCommand,
  IsCheckedCommand,
  CountCommand,
  BoundingBoxCommand,
  ConsoleCommand,
  ErrorsCommand,
  KeyboardCommand,
  WheelCommand,
  TapCommand,
  ClipboardCommand,
  HighlightCommand,
  ClearCommand,
  SelectAllCommand,
  InnerTextCommand,
  InnerHtmlCommand,
  InputValueCommand,
  SetValueCommand,
  DispatchEventCommand,
  AddScriptCommand,
  AddStyleCommand,
  EmulateMediaCommand,
  WaitForUrlCommand,
  WaitForLoadStateCommand,
  SetContentCommand,
  MouseMoveCommand,
  MouseDownCommand,
  MouseUpCommand,
  WaitForFunctionCommand,
  ScrollIntoViewCommand,
  KeyDownCommand,
  KeyUpCommand,
  InsertTextCommand,
  MultiSelectCommand,
  ScreencastStartCommand,
  ScreencastStopCommand,
  InputMouseCommand,
  InputKeyboardCommand,
  InputTouchCommand,
  // Responses
  Response,
  SuccessResponse,
  ErrorResponse,
  NavigateData,
  ScreenshotData,
  SnapshotData,
  EvaluateData,
  ContentData,
  TabListData,
  TabNewData,
  TabSwitchData,
  TabCloseData,
  ScreencastStartData,
  ScreencastStopData,
  InputEventData,
  // Other types
  ElementRef,
  TrackedRequest,
  ConsoleMessage,
  PageError,
  DeviceDescriptor,
} from './types.js';

// Re-export protocol utilities
export {
  parseCommand,
  successResponse,
  errorResponse,
  serializeResponse,
  generateCommandId,
} from './protocol.js';

// Re-export snapshot utilities
export {
  type RefMap,
  type EnhancedSnapshot,
  type SnapshotOptions,
  getEnhancedSnapshot,
  parseRef,
  getSnapshotStats,
  findElementByRef,
} from './snapshot.js';

// Re-export browser manager
export { BrowserManager, type ScreencastFrame, type ScreencastOptions } from './browser.js';

// Re-export action handlers
export { executeCommand, setScreencastFrameCallback, toAIFriendlyError } from './actions.js';

// Re-export unified describe API
export { type Description, describe } from './describe.js';

// Re-export context detection and extension support
export {
  type ContextType,
  type ContextInfo,
  detectContext,
  isExtensionContext,
  isContentScript,
  isBackgroundScript,
  sendToBackground,
  sendToTab,
  captureVisibleTab,
  getActiveTab,
  executeInTab,
  createContextOperations,
} from './context.js';

// Extension-specific functions (clean names)
export {
  type ExtensionMessage,
  type ExtensionResponse,
  screenshot,
  navigate,
  evaluate,
  getTabs,
  newTab,
  switchTab,
  closeTab,
  getCapabilities,
  executeInTabContext,
  setupBackgroundHandler,
  setupContentHandler,
  hasCapability,
} from './extension.js';

// Import for creating the agent
import { BrowserManager } from './browser.js';
import { executeCommand, setScreencastFrameCallback } from './actions.js';
import { parseCommand, serializeResponse, generateCommandId } from './protocol.js';
import { describe, type Description } from './describe.js';
import { detectContext, type ContextInfo } from './context.js';
import { screenshot as extensionScreenshot, hasCapability } from './extension.js';
import type { Command, Response } from './types.js';

/**
 * Configuration options for the BrowserAgent
 */
export interface BrowserAgentConfig {
  /** Target window to control (defaults to current window) */
  targetWindow?: Window;
  /** Target document to control (defaults to current document) */
  targetDocument?: Document;
  /** Callback for screencast frames */
  onScreencastFrame?: (frame: import('./browser.js').ScreencastFrame) => void;
  /** Callback for command responses */
  onResponse?: (response: Response) => void;
  /** Whether to auto-launch on first command */
  autoLaunch?: boolean;
  /** Force specific context mode ('browser' | 'extension') */
  forceContext?: 'browser' | 'extension';
  /** Use extension APIs when available (default: true) */
  useExtensionApis?: boolean;
}

/**
 * BrowserAgent - Main class for browser automation in browser context
 *
 * This is the primary entry point for using BTCP in a browser environment.
 * It provides a high-level API for executing commands and managing browser state.
 *
 * @example
 * ```typescript
 * const agent = new BrowserAgent();
 * await agent.launch();
 *
 * // Execute commands
 * const response = await agent.execute({
 *   id: 'cmd1',
 *   action: 'snapshot'
 * });
 *
 * // Or use the convenience methods
 * const snapshot = await agent.snapshot();
 * await agent.click('button.submit');
 * await agent.fill('input[name="email"]', 'user@example.com');
 * ```
 */
export class BrowserAgent {
  private browser: BrowserManager;
  private config: BrowserAgentConfig;
  private launched: boolean = false;
  private contextInfo: ContextInfo;

  constructor(config: BrowserAgentConfig = {}) {
    this.config = {
      useExtensionApis: true, // Default to using extension APIs when available
      ...config,
    };
    this.browser = new BrowserManager(config.targetWindow, config.targetDocument);
    this.contextInfo = detectContext();

    if (config.onScreencastFrame) {
      setScreencastFrameCallback(config.onScreencastFrame);
    }
  }

  /**
   * Launch the browser agent
   */
  async launch(): Promise<void> {
    if (this.launched) return;

    await this.browser.launch({
      id: generateCommandId(),
      action: 'launch',
      targetWindow: this.config.targetWindow,
      targetDocument: this.config.targetDocument,
    });

    this.launched = true;
  }

  /**
   * Execute a command
   */
  async execute(command: Command): Promise<Response> {
    // Auto-launch if needed
    if (this.config.autoLaunch !== false && !this.launched && command.action !== 'launch') {
      await this.launch();
    }

    const response = await executeCommand(command, this.browser);

    if (this.config.onResponse) {
      this.config.onResponse(response);
    }

    return response;
  }

  /**
   * Execute a command from JSON string
   */
  async executeJSON(json: string): Promise<string> {
    const parsed = parseCommand(json);

    if ('error' in parsed) {
      return serializeResponse({
        id: parsed.id || 'unknown',
        success: false,
        error: parsed.error,
      });
    }

    const response = await this.execute(parsed);
    return serializeResponse(response);
  }

  /**
   * Close the browser agent
   */
  async close(): Promise<void> {
    await this.browser.close();
    this.launched = false;
  }

  // Convenience methods

  /**
   * Get DOM snapshot
   */
  async snapshot(options?: {
    interactive?: boolean;
    maxDepth?: number;
    compact?: boolean;
    selector?: string;
  }): Promise<{ snapshot: string; refs?: Record<string, { role: string; name?: string }> }> {
    const response = await this.execute({
      id: generateCommandId(),
      action: 'snapshot',
      ...options,
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    return response.data as { snapshot: string; refs?: Record<string, { role: string; name?: string }> };
  }

  /**
   * Click an element
   */
  async click(selector: string, options?: { button?: 'left' | 'right' | 'middle' }): Promise<void> {
    const response = await this.execute({
      id: generateCommandId(),
      action: 'click',
      selector,
      ...options,
    });

    if (!response.success) {
      throw new Error(response.error);
    }
  }

  /**
   * Type text into an element
   */
  async type(selector: string, text: string, options?: { delay?: number; clear?: boolean }): Promise<void> {
    const response = await this.execute({
      id: generateCommandId(),
      action: 'type',
      selector,
      text,
      ...options,
    });

    if (!response.success) {
      throw new Error(response.error);
    }
  }

  /**
   * Fill an input element
   */
  async fill(selector: string, value: string): Promise<void> {
    const response = await this.execute({
      id: generateCommandId(),
      action: 'fill',
      selector,
      value,
    });

    if (!response.success) {
      throw new Error(response.error);
    }
  }

  /**
   * Hover over an element
   */
  async hover(selector: string): Promise<void> {
    const response = await this.execute({
      id: generateCommandId(),
      action: 'hover',
      selector,
    });

    if (!response.success) {
      throw new Error(response.error);
    }
  }

  /**
   * Press a key
   */
  async press(key: string, selector?: string): Promise<void> {
    const response = await this.execute({
      id: generateCommandId(),
      action: 'press',
      key,
      selector,
    });

    if (!response.success) {
      throw new Error(response.error);
    }
  }

  /**
   * Wait for an element
   */
  async waitFor(selector: string, options?: { timeout?: number; state?: 'visible' | 'hidden' }): Promise<void> {
    const response = await this.execute({
      id: generateCommandId(),
      action: 'wait',
      selector,
      ...options,
    });

    if (!response.success) {
      throw new Error(response.error);
    }
  }

  /**
   * Scroll the page or an element
   */
  async scroll(options: {
    selector?: string;
    direction?: 'up' | 'down' | 'left' | 'right';
    amount?: number;
    x?: number;
    y?: number;
  }): Promise<void> {
    const response = await this.execute({
      id: generateCommandId(),
      action: 'scroll',
      ...options,
    });

    if (!response.success) {
      throw new Error(response.error);
    }
  }

  /**
   * Evaluate JavaScript
   */
  async evaluate<T = unknown>(script: string): Promise<T> {
    const response = await this.execute({
      id: generateCommandId(),
      action: 'evaluate',
      script,
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    return (response.data as { result: T }).result;
  }

  /**
   * Get element text
   */
  async getText(selector: string): Promise<string | null> {
    const response = await this.execute({
      id: generateCommandId(),
      action: 'gettext',
      selector,
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    return (response.data as { text: string | null }).text;
  }

  /**
   * Get element attribute
   */
  async getAttribute(selector: string, attribute: string): Promise<string | null> {
    const response = await this.execute({
      id: generateCommandId(),
      action: 'getattribute',
      selector,
      attribute,
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    return (response.data as { value: string | null }).value;
  }

  /**
   * Check if element is visible
   */
  async isVisible(selector: string): Promise<boolean> {
    const response = await this.execute({
      id: generateCommandId(),
      action: 'isvisible',
      selector,
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    return (response.data as { visible: boolean }).visible;
  }

  /**
   * Get current URL
   */
  async getUrl(): Promise<string> {
    const response = await this.execute({
      id: generateCommandId(),
      action: 'url',
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    return (response.data as { url: string }).url;
  }

  /**
   * Get page title
   */
  async getTitle(): Promise<string> {
    const response = await this.execute({
      id: generateCommandId(),
      action: 'title',
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    return (response.data as { title: string }).title;
  }

  /**
   * Get access to the underlying BrowserManager
   */
  getBrowserManager(): BrowserManager {
    return this.browser;
  }

  // ============================================================================
  // CONTEXT & EXTENSION API
  // ============================================================================

  /**
   * Get the current runtime context information
   *
   * @example
   * ```typescript
   * const ctx = agent.getContext();
   * if (ctx.isExtension) {
   *   console.log('Running in extension:', ctx.type);
   *   console.log('Can screenshot:', ctx.canCaptureScreenshot);
   * }
   * ```
   */
  getContext(): ContextInfo {
    return this.contextInfo;
  }

  /**
   * Check if running in Chrome extension context
   */
  isExtension(): boolean {
    return this.contextInfo.isExtension;
  }

  /**
   * Check if a specific capability is available
   */
  hasCapability(capability: 'screenshot' | 'crossOrigin' | 'network' | 'tabs' | 'debugger'): boolean {
    return hasCapability(capability);
  }

  /**
   * Take a screenshot (uses extension API when available for better results)
   *
   * @example
   * ```typescript
   * const { screenshot, format } = await agent.screenshot();
   * // screenshot is base64 encoded image data
   * ```
   */
  async screenshot(options?: { format?: 'png' | 'jpeg'; quality?: number }): Promise<{ screenshot: string; format: string }> {
    // Use extension API if available and enabled
    if (this.config.useExtensionApis && this.contextInfo.canCaptureScreenshot) {
      const response = await extensionScreenshot(generateCommandId(), options);
      if (response.success) {
        return response.data as { screenshot: string; format: string };
      }
      // Fall back to standard method if extension screenshot fails
    }

    // Use standard screenshot command
    const response = await this.execute({
      id: generateCommandId(),
      action: 'screenshot',
      ...options,
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    return response.data as { screenshot: string; format: string };
  }

  // ============================================================================
  // SELF-DESCRIPTION API
  // ============================================================================

  /**
   * Describe the agent's capabilities - single unified API for AI agents
   *
   * @param action Optional action name to get specific documentation
   * @returns Description object with all needed information
   *
   * @example
   * ```typescript
   * // Get full API description
   * const info = agent.describe();
   * console.log(info.actions);    // ['click', 'snapshot', ...]
   * console.log(info.methods);    // [{ name: 'click', signature: '...' }, ...]
   * console.log(info.quickRef);   // Quick reference string
   *
   * // Get specific action help
   * const clickInfo = agent.describe('click');
   * console.log(clickInfo.action);  // { name: 'click', parameters: [...] }
   *
   * // For AI context injection
   * const ctx = agent.describe().quickRef;
   * ```
   */
  describe(action?: string): Description {
    return describe(action);
  }

  /**
   * Describe the agent's capabilities (static version)
   */
  static describe(action?: string): Description {
    return describe(action);
  }
}

// Default export
export default BrowserAgent;
