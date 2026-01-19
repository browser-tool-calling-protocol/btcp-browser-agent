/**
 * @btcp/extension - Type definitions
 *
 * Types for extension commands and Chrome API wrappers.
 */

import type { Command as CoreCommand, Response } from '../../core/dist/index.js';
import type { SessionCommand } from './session-types.js';

// Extension-specific actions
export type ExtensionAction =
  | 'navigate'
  | 'back'
  | 'forward'
  | 'reload'
  | 'getUrl'
  | 'getTitle'
  | 'screenshot'
  | 'tabNew'
  | 'tabClose'
  | 'tabSwitch'
  | 'tabList'
  | 'groupCreate'
  | 'groupUpdate'
  | 'groupDelete'
  | 'groupList'
  | 'groupAddTabs'
  | 'groupRemoveTabs'
  | 'groupGet'
  | 'sessionGetCurrent'
  | 'popupInitialize'
  | 'scriptInject'
  | 'scriptSend';

// Base extension command (id is optional - auto-generated if not provided)
export interface ExtensionBaseCommand {
  /** Optional command ID. Auto-generated if not provided. */
  id?: string;
  action: ExtensionAction;
}

export interface NavigateCommand extends ExtensionBaseCommand {
  action: 'navigate';
  url: string;
  waitUntil?: 'load' | 'domcontentloaded';
}

export interface BackCommand extends ExtensionBaseCommand {
  action: 'back';
}

export interface ForwardCommand extends ExtensionBaseCommand {
  action: 'forward';
}

export interface ReloadCommand extends ExtensionBaseCommand {
  action: 'reload';
  bypassCache?: boolean;
}

export interface GetUrlCommand extends ExtensionBaseCommand {
  action: 'getUrl';
}

export interface GetTitleCommand extends ExtensionBaseCommand {
  action: 'getTitle';
}

export interface ScreenshotCommand extends ExtensionBaseCommand {
  action: 'screenshot';
  format?: 'png' | 'jpeg';
  quality?: number;
}

export interface TabNewCommand extends ExtensionBaseCommand {
  action: 'tabNew';
  url?: string;
  active?: boolean;
}

export interface TabCloseCommand extends ExtensionBaseCommand {
  action: 'tabClose';
  tabId?: number;
}

export interface TabSwitchCommand extends ExtensionBaseCommand {
  action: 'tabSwitch';
  tabId: number;
}

export interface TabListCommand extends ExtensionBaseCommand {
  action: 'tabList';
}

export interface PopupInitializeCommand extends ExtensionBaseCommand {
  action: 'popupInitialize';
}

/**
 * Inject a script into the page's main world
 *
 * The script runs in the page context (not the content script isolated world),
 * allowing access to page-level APIs like window, fetch interceptors, etc.
 *
 * @example
 * ```typescript
 * await client.execute({
 *   action: 'scriptInject',
 *   code: `
 *     window.addEventListener('message', (event) => {
 *       if (event.data?.type !== 'btcp:script-command') return;
 *       if (event.data.scriptId !== 'helper') return;
 *       const { commandId, payload } = event.data;
 *       // Handle command and send ack
 *       window.postMessage({ type: 'btcp:script-ack', commandId, result: { ok: true } }, '*');
 *     });
 *   `,
 *   scriptId: 'helper'
 * });
 * ```
 */
export interface ScriptInjectCommand extends ExtensionBaseCommand {
  action: 'scriptInject';

  /** JavaScript code to inject into the page's main world */
  code: string;

  /** Unique identifier for this script (default: 'default') */
  scriptId?: string;
}

/**
 * Send a command to an injected script and wait for acknowledgment
 *
 * The content script posts a message to the page, and waits for the
 * injected script to respond with an ack.
 *
 * @example
 * ```typescript
 * const result = await client.execute({
 *   action: 'scriptSend',
 *   scriptId: 'helper',
 *   payload: { action: 'getData', selector: '.items' },
 *   timeout: 5000
 * });
 * // result.data = { result: { items: [...] } }
 * ```
 */
export interface ScriptSendCommand extends ExtensionBaseCommand {
  action: 'scriptSend';

  /** Payload to send to the injected script */
  payload: unknown;

  /** Target script ID (default: 'default') */
  scriptId?: string;

  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
}

// Union of extension commands
export type ExtensionCommand =
  | NavigateCommand
  | BackCommand
  | ForwardCommand
  | ReloadCommand
  | GetUrlCommand
  | GetTitleCommand
  | ScreenshotCommand
  | TabNewCommand
  | TabCloseCommand
  | TabSwitchCommand
  | TabListCommand
  | PopupInitializeCommand
  | SessionCommand
  | ScriptInjectCommand
  | ScriptSendCommand;

// Combined command type (core + extension)
export type Command = CoreCommand | ExtensionCommand;

// Re-export Response type
export type { Response };

// Re-export session types
export type {
  SessionCommand,
  GroupInfo,
  SessionInfo,
  GroupCreateOptions,
  GroupUpdateOptions,
} from './session-types.js';

// Message types for extension communication
export interface ExtensionCommandMessage {
  type: 'btcp:command';
  command: Command;
  tabId?: number;
}

export interface ExtensionPingMessage {
  type: 'btcp:ping';
}

export type ExtensionMessage = ExtensionCommandMessage | ExtensionPingMessage;

export interface ExtensionResponseMessage {
  type: 'btcp:response';
  response: Response;
}

export interface ExtensionPongResponse {
  type: 'btcp:pong';
  ready: boolean;
}

export type ExtensionResponse = ExtensionResponseMessage | ExtensionPongResponse;

// Tab info
export interface TabInfo {
  id: number;
  url?: string;
  title?: string;
  active: boolean;
  index: number;
}

// Chrome tab type alias (uses @types/chrome)
export type ChromeTab = chrome.tabs.Tab;

// ============================================================================
// Script Injection Message Types (Content Script <-> Page Script)
// ============================================================================

/**
 * Command sent from content script to injected page script
 */
export interface ScriptCommandMessage {
  type: 'btcp:script-command';
  commandId: string;
  scriptId: string;
  payload: unknown;
}

/**
 * Acknowledgment sent from injected page script to content script
 */
export interface ScriptAckMessage {
  type: 'btcp:script-ack';
  commandId: string;
  result?: unknown;
  error?: string;
}
