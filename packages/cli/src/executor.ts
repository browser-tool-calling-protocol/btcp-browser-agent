/**
 * @btcp/cli - Command executor
 *
 * Executes parsed commands using the client.
 */

import type { ParsedCommand, CommandResult, CommandClient } from './types.js';
import { getCommand } from './commands/index.js';
import { CommandNotFoundError, ExecutionError, CLIError } from './errors.js';
import { findSimilarCommands, getContextualSuggestion } from './suggestions.js';

/**
 * Execute a parsed command
 */
export async function executeCommand(
  client: CommandClient,
  command: ParsedCommand
): Promise<CommandResult> {
  const handler = getCommand(command.name);

  if (!handler) {
    // Find similar commands for suggestion
    const similar = findSimilarCommands(command.name);
    throw new CommandNotFoundError(command.name, similar);
  }

  try {
    const result = await handler.execute(client, command.args, command.flags);

    // Add contextual suggestions on error
    if (!result.success && result.error) {
      const suggestion = getContextualSuggestion(command.name, result.error, command.args);
      if (suggestion) {
        return {
          ...result,
          error: `${result.error}\n\n${suggestion}`,
        };
      }
    }

    return result;
  } catch (error) {
    if (error instanceof CLIError) {
      throw error;
    }

    // Wrap unexpected errors with contextual suggestions
    const message = error instanceof Error ? error.message : String(error);
    const suggestion = getContextualSuggestion(command.name, message, command.args);

    throw new ExecutionError(message, {
      suggestions: suggestion ? [suggestion] : undefined,
      command: command.name,
    });
  }
}

/**
 * Execute a raw command string
 */
export async function executeCommandString(
  client: CommandClient,
  input: string,
  parse: (input: string) => ParsedCommand
): Promise<CommandResult> {
  const command = parse(input);
  return executeCommand(client, command);
}
