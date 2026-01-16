/**
 * @btcp/cli
 *
 * Browser-based CLI for browser automation.
 * Commands are sent directly from Chrome extension.
 *
 * @example Basic usage:
 * ```typescript
 * import { createCLI } from '@btcp/cli';
 * import { createClient } from '@btcp/extension';
 *
 * const client = createClient();
 * const cli = createCLI(client);
 *
 * // Execute commands
 * await cli.execute('goto https://example.com');
 * await cli.execute('snapshot');
 * await cli.execute('click @ref:1');
 * ```
 *
 * @example With terminal UI:
 * ```typescript
 * import { createCLI, Terminal } from '@btcp/cli';
 * import { createClient } from '@btcp/extension';
 *
 * const client = createClient();
 * const cli = createCLI(client);
 *
 * const terminal = new Terminal(document.getElementById('terminal')!, {
 *   onExecute: (input) => cli.execute(input),
 * });
 * ```
 */

import type { CLI, CommandClient, CommandResult, CommandHandler } from './types.js';
import { parseCommand } from './parser.js';
import { executeCommand } from './executor.js';
import { formatResult, formatHelp, formatCommandHelp } from './formatter.js';
import { getAllCommands, getCommand } from './commands/index.js';
import { CLIError } from './errors.js';

// Re-export types
export type {
  CLI,
  CommandClient,
  CommandResult,
  CommandHandler,
  ParsedCommand,
  FormattedOutput,
  HistoryEntry,
  TerminalConfig,
} from './types.js';

// Re-export utilities
export { parseCommand, getFlagString, getFlagNumber, getFlagBool } from './parser.js';
export { executeCommand } from './executor.js';
export { formatResult, formatHelp, formatCommandHelp, formatData, formatScreenshot } from './formatter.js';
export { commands, getCommand, getAllCommands } from './commands/index.js';
export {
  CLIError,
  CommandNotFoundError,
  InvalidArgumentsError,
  ParseError,
  ExecutionError,
} from './errors.js';

/**
 * Create a CLI instance
 */
export function createCLI(client: CommandClient): CLI {
  return {
    async execute(input: string): Promise<CommandResult> {
      const trimmed = input.trim();

      if (!trimmed) {
        return { success: true, message: '' };
      }

      try {
        const command = parseCommand(trimmed);
        return await executeCommand(client, command);
      } catch (error) {
        if (error instanceof CLIError) {
          return { success: false, error: error.message };
        }
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message };
      }
    },

    getCommands(): CommandHandler[] {
      return getAllCommands();
    },

    getHelp(commandName?: string): string {
      if (commandName) {
        const cmd = getCommand(commandName);
        if (!cmd) {
          return `Unknown command: ${commandName}`;
        }
        return formatCommandHelp(cmd);
      }

      const commandList = getAllCommands().map((cmd) => ({
        name: cmd.name,
        description: cmd.description,
        usage: cmd.usage,
      }));

      return `BTCP Browser CLI - Available Commands\n\n${formatHelp(commandList)}\n\nType "help <command>" for more info`;
    },
  };
}

// Re-export terminal (will be created next)
export { Terminal, type TerminalOptions } from './terminal/index.js';
