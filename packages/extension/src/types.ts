/**
 * @aspect/extension - Type definitions
 *
 * Types for extension commands and Chrome API wrappers.
 */

import type { Command as CoreCommand, Response } from '@aspect/core';

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
  type: 'aspect:command';
  command: Command;
  tabId?: number;
}

export interface ExtensionResponse {
  type: 'aspect:response';
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

// Chrome API types (minimal, for type safety without @types/chrome)
export interface ChromeTab {
  id?: number;
  url?: string;
  title?: string;
  active: boolean;
  index: number;
  status?: 'loading' | 'complete' | 'unloaded';
}

export interface ChromeRuntime {
  id?: string;
  lastError?: { message?: string };
  sendMessage: (message: unknown, callback?: (response: unknown) => void) => void;
  onMessage: {
    addListener: (
      callback: (
        message: unknown,
        sender: { tab?: ChromeTab },
        sendResponse: (response: unknown) => void
      ) => boolean | void
    ) => void;
  };
}

export interface ChromeTabs {
  query: (query: object, callback: (tabs: ChromeTab[]) => void) => void;
  get: (tabId: number, callback: (tab: ChromeTab) => void) => void;
  create: (options: object, callback?: (tab: ChromeTab) => void) => void;
  update: (tabId: number, options: object, callback?: (tab: ChromeTab) => void) => void;
  remove: (tabId: number | number[], callback?: () => void) => void;
  captureVisibleTab: (
    windowId: number | null,
    options: { format?: string; quality?: number },
    callback: (dataUrl: string) => void
  ) => void;
  sendMessage: (tabId: number, message: unknown, callback?: (response: unknown) => void) => void;
  goBack: (tabId: number, callback?: () => void) => void;
  goForward: (tabId: number, callback?: () => void) => void;
  reload: (tabId: number, options?: { bypassCache?: boolean }, callback?: () => void) => void;
}

declare global {
  const chrome: {
    runtime: ChromeRuntime;
    tabs: ChromeTabs;
  };
}
