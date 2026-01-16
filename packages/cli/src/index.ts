/**
 * @btcp/cli
 *
 * Browser-based CLI for browser automation.
 * Commands are sent directly from Chrome extension.
 *
 * @example Single command:
 * ```typescript
 * import { createCLI } from '@btcp/cli';
 * import { createClient } from '@btcp/extension';
 *
 * const client = createClient();
 * const cli = createCLI(client);
 *
 * await cli.execute('goto https://example.com');
 * await cli.execute('snapshot');
 * await cli.execute('click @ref:1');
 * ```
 *
 * @example Multiple commands (split by \n):
 * ```typescript
 * // Execute multiple commands - stops on first error
 * await cli.execute(`
 *   goto https://example.com
 *   snapshot
 *   click @ref:1
 *   fill @ref:2 "hello"
 * `);
 *
 * // Or use executeAll for detailed results
 * const batch = await cli.executeAll(`
 *   goto https://example.com
 *   snapshot
 *   click @ref:1
 * `);
 * console.log(batch.allSucceeded, batch.results);
 *
 * // Continue on error
 * const batch2 = await cli.executeAll(commands, { continueOnError: true });
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

import type { CLI, CommandClient, CommandResult, CommandHandler, BatchResult } from './types.js';
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
  BatchResult,
  ParsedCommand,
  FormattedOutput,
  HistoryEntry,
  TerminalConfig,
} from './types.js';

// Re-export utilities
export { parseCommand, getFlagString, getFlagNumber, getFlagBool } from './parser.js';
export { executeCommand } from './executor.js';
export {
  formatResult,
  formatHelp,
  formatCommandHelp,
  formatData,
  formatScreenshot,
  formatErrorWithSuggestions,
  formatSuccessWithNextSteps,
} from './formatter.js';
export { commands, getCommand, getAllCommands } from './commands/index.js';
export {
  CLIError,
  CommandNotFoundError,
  InvalidArgumentsError,
  ParseError,
  ExecutionError,
  ElementNotFoundError,
  NavigationError,
  TimeoutError,
} from './errors.js';
export {
  findSimilarCommands,
  getContextualSuggestion,
  getNextStepSuggestions,
  commandCategories,
  getCommandCategory,
  workflowSuggestions,
} from './suggestions.js';

/**
 * Execute a single command line
 */
async function executeSingle(client: CommandClient, line: string): Promise<CommandResult> {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith('#')) {
    // Empty line or comment
    return { success: true, message: '' };
  }

  try {
    const command = parseCommand(trimmed);
    return await executeCommand(client, command);
  } catch (error) {
    if (error instanceof CLIError) {
      // Use formatted error with suggestions
      return {
        success: false,
        error: error.toFormattedString(),
      };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

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

      // Check if input contains multiple commands (split by \n)
      const lines = trimmed.split('\n').filter((line) => {
        const l = line.trim();
        return l && !l.startsWith('#');
      });

      if (lines.length === 0) {
        return { success: true, message: '' };
      }

      // Single command - execute directly
      if (lines.length === 1) {
        return executeSingle(client, lines[0]);
      }

      // Multiple commands - execute sequentially, stop on first error
      const results: CommandResult[] = [];
      for (const line of lines) {
        const result = await executeSingle(client, line);
        results.push(result);

        if (!result.success) {
          // Return aggregated result on failure
          return {
            success: false,
            error: `Command failed at line ${results.length}: ${result.error}`,
            data: { results, failedAt: results.length - 1 },
          };
        }
      }

      // All commands succeeded - return last result with summary
      const lastResult = results[results.length - 1];
      return {
        success: true,
        message: lastResult.message || `Executed ${results.length} commands`,
        data: lastResult.data ?? { results },
      };
    },

    async executeAll(
      input: string,
      options?: { continueOnError?: boolean }
    ): Promise<BatchResult> {
      const trimmed = input.trim();
      const continueOnError = options?.continueOnError ?? false;

      if (!trimmed) {
        return {
          results: [],
          allSucceeded: true,
          firstFailedIndex: -1,
          executed: 0,
        };
      }

      // Split by newlines, filter empty lines and comments
      const lines = trimmed.split('\n').filter((line) => {
        const l = line.trim();
        return l && !l.startsWith('#');
      });

      const results: CommandResult[] = [];
      let firstFailedIndex = -1;

      for (let i = 0; i < lines.length; i++) {
        const result = await executeSingle(client, lines[i]);
        results.push(result);

        if (!result.success && firstFailedIndex === -1) {
          firstFailedIndex = i;
          if (!continueOnError) {
            break;
          }
        }
      }

      return {
        results,
        allSucceeded: firstFailedIndex === -1,
        firstFailedIndex,
        executed: results.length,
      };
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
