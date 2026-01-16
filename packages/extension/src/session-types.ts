/**
 * Session and Tab Group types for BTCP Browser Agent
 */

import type { ExtensionBaseCommand } from './types.js';

/**
 * Chrome tab group color options
 */
export type GroupColor =
  | 'grey'
  | 'blue'
  | 'red'
  | 'yellow'
  | 'green'
  | 'pink'
  | 'purple'
  | 'cyan'
  | 'orange';

/**
 * Tab group information
 */
export interface GroupInfo {
  id: number;
  title?: string;
  color: GroupColor;
  collapsed: boolean;
  windowId: number;
}

/**
 * Session information
 */
export interface SessionInfo {
  groupId: number;
  title: string;
  color: GroupColor;
  tabCount: number;
  tabIds: number[];
  windowId: number;
  createdAt: number;
}

/**
 * Options for creating a new tab group
 */
export interface GroupCreateOptions {
  tabIds?: number[];
  title?: string;
  color?: GroupColor;
  collapsed?: boolean;
}

/**
 * Options for updating a tab group
 */
export interface GroupUpdateOptions {
  title?: string;
  color?: GroupColor;
  collapsed?: boolean;
}

/**
 * Command to create a new tab group
 */
export interface GroupCreateCommand extends ExtensionBaseCommand {
  action: 'groupCreate';
  tabIds?: number[];
  title?: string;
  color?: GroupColor;
  collapsed?: boolean;
}

/**
 * Command to update a tab group
 */
export interface GroupUpdateCommand extends ExtensionBaseCommand {
  action: 'groupUpdate';
  groupId: number;
  title?: string;
  color?: GroupColor;
  collapsed?: boolean;
}

/**
 * Command to delete a tab group (closes all tabs)
 */
export interface GroupDeleteCommand extends ExtensionBaseCommand {
  action: 'groupDelete';
  groupId: number;
}

/**
 * Command to list all tab groups
 */
export interface GroupListCommand extends ExtensionBaseCommand {
  action: 'groupList';
}

/**
 * Command to add tabs to a group
 */
export interface GroupAddTabsCommand extends ExtensionBaseCommand {
  action: 'groupAddTabs';
  groupId: number;
  tabIds: number[];
}

/**
 * Command to remove tabs from a group
 */
export interface GroupRemoveTabsCommand extends ExtensionBaseCommand {
  action: 'groupRemoveTabs';
  tabIds: number[];
}

/**
 * Command to get a specific tab group
 */
export interface GroupGetCommand extends ExtensionBaseCommand {
  action: 'groupGet';
  groupId: number;
}

/**
 * Command to get current active session
 */
export interface SessionGetCurrentCommand extends ExtensionBaseCommand {
  action: 'sessionGetCurrent';
}

/**
 * Union type of all session-related commands
 */
export type SessionCommand =
  | GroupCreateCommand
  | GroupUpdateCommand
  | GroupDeleteCommand
  | GroupListCommand
  | GroupAddTabsCommand
  | GroupRemoveTabsCommand
  | GroupGetCommand
  | SessionGetCurrentCommand;
