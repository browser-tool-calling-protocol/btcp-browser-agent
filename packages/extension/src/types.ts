/**
 * @btcp/extension - Type definitions
 *
 * Types for extension commands and Chrome API wrappers.
 */

import type { Command as CoreCommand, Response } from '@btcp/core';

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
  | 'tabList';

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
  | TabListCommand;

// Combined command type (core + extension)
export type Command = CoreCommand | ExtensionCommand;

// Re-export Response type
export type { Response };

// Message types for extension communication
export interface ExtensionMessage {
  type: 'btcp:command';
  command: Command;
  tabId?: number;
}

export interface ExtensionResponse {
  type: 'btcp:response';
  response: Response;
}

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
