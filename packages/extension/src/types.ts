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
  | 'popupInitialize';

// Base extension command
export interface ExtensionBaseCommand {
  id: string;
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
  | SessionCommand;

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
