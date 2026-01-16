/**
 * @btcp/cli - Type definitions
 *
 * Types for CLI commands, parsing, and execution.
 */

import type { Response } from '@btcp/extension';

/**
 * Parsed CLI command structure
 */
export interface ParsedCommand {
  /** Command name (e.g., 'goto', 'click', 'snapshot') */
  name: string;
  /** Positional arguments */
  args: string[];
  /** Flag arguments (--flag or --flag=value) */
  flags: Record<string, string | boolean>;
  /** Original raw input */
  raw: string;
}

/**
 * Command execution result
 */
export interface CommandResult {
  /** Whether the command succeeded */
  success: boolean;
  /** Human-readable message */
  message?: string;
  /** Result data (varies by command) */
  data?: unknown;
  /** Error message if failed */
  error?: string;
}

/**
 * Result of executing multiple commands
 */
export interface BatchResult {
  /** Results for each command in order */
  results: CommandResult[];
  /** Whether all commands succeeded */
  allSucceeded: boolean;
  /** Index of first failed command (-1 if all succeeded) */
  firstFailedIndex: number;
  /** Total number of commands executed */
  executed: number;
}

/**
 * Command handler definition
 */
export interface CommandHandler {
  /** Command name */
  name: string;
  /** Brief description */
  description: string;
  /** Usage pattern (e.g., 'goto <url>') */
  usage: string;
  /** Example usages */
  examples?: string[];
  /** Execute the command */
  execute: CommandExecuteFn;
}

/**
 * Command execute function signature
 */
export type CommandExecuteFn = (
  client: CommandClient,
  args: string[],
  flags: Record<string, string | boolean>
) => Promise<CommandResult>;

/**
 * Client interface for command execution
 * This is a subset of the @btcp/extension Client
 */
export interface CommandClient {
  execute(command: import('@btcp/extension').Command): Promise<Response>;
  navigate(url: string, options?: { waitUntil?: 'load' | 'domcontentloaded' }): Promise<Response>;
  back(): Promise<Response>;
  forward(): Promise<Response>;
  reload(options?: { bypassCache?: boolean }): Promise<Response>;
  getUrl(): Promise<string>;
  getTitle(): Promise<string>;
  snapshot(options?: { selector?: string; maxDepth?: number }): Promise<{
    tree: string;
    refs: Record<string, { selector: string; role: string; name?: string }>;
  }>;
  click(selector: string, options?: { button?: 'left' | 'right' | 'middle' }): Promise<Response>;
  type(selector: string, text: string, options?: { delay?: number; clear?: boolean }): Promise<Response>;
  fill(selector: string, value: string): Promise<Response>;
  getText(selector: string): Promise<string | null>;
  isVisible(selector: string): Promise<boolean>;
  screenshot(options?: { format?: 'png' | 'jpeg'; quality?: number }): Promise<string>;
  tabNew(options?: { url?: string; active?: boolean }): Promise<{ tabId: number; url?: string }>;
  tabClose(tabId?: number): Promise<Response>;
  tabSwitch(tabId: number): Promise<Response>;
  tabList(): Promise<import('@btcp/extension').TabInfo[]>;
}

/**
 * Formatted output for terminal display
 */
export interface FormattedOutput {
  /** Output type for styling */
  type: 'success' | 'error' | 'info' | 'data';
  /** Text content */
  content: string;
}

/**
 * Terminal history entry
 */
export interface HistoryEntry {
  /** Entry type */
  type: 'input' | 'output' | 'error' | 'info';
  /** Text content */
  content: string;
  /** Timestamp */
  timestamp: number;
}

/**
 * Terminal configuration
 */
export interface TerminalConfig {
  /** Color theme */
  theme: 'dark' | 'light';
  /** Font size in pixels */
  fontSize: number;
  /** Max history entries */
  historySize: number;
  /** Command prompt string */
  prompt: string;
}

/**
 * CLI instance interface
 */
export interface CLI {
  /** Execute a single command or multiple commands (split by \n) */
  execute(input: string): Promise<CommandResult>;
  /**
   * Execute multiple commands (split by \n)
   * Stops on first error unless continueOnError is true
   */
  executeAll(input: string, options?: { continueOnError?: boolean }): Promise<BatchResult>;
  /** Get available commands */
  getCommands(): CommandHandler[];
  /** Get help for a specific command */
  getHelp(commandName?: string): string;
}
