/**
 * @btcp/cli - Command executor
 *
 * Executes parsed commands using the client.
 */

import type { ParsedCommand, CommandResult, CommandClient } from './types.js';
import { getCommand } from './commands/index.js';
import { CommandNotFoundError, ExecutionError, CLIError } from './errors.js';

/**
 * Execute a parsed command
 */
export async function executeCommand(
  client: CommandClient,
  command: ParsedCommand
): Promise<CommandResult> {
  const handler = getCommand(command.name);

  if (!handler) {
    throw new CommandNotFoundError(command.name);
  }

  try {
    return await handler.execute(client, command.args, command.flags);
  } catch (error) {
    if (error instanceof CLIError) {
      throw error;
    }

    // Wrap unexpected errors
    const message = error instanceof Error ? error.message : String(error);
    throw new ExecutionError(message);
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
