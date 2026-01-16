/**
 * help command - Show help information
 */

import type { CommandHandler } from '../types.js';
import { formatHelp, formatCommandHelp } from '../formatter.js';
import { commands } from './index.js';

export const helpCommand: CommandHandler = {
  name: 'help',
  description: 'Show help information',
  usage: 'help [command]',
  examples: ['help', 'help goto', 'help click'],

  async execute(_client, args) {
    if (args.length === 0) {
      // Show all commands
      const commandList = Object.values(commands).map((cmd) => ({
        name: cmd.name,
        description: cmd.description,
        usage: cmd.usage,
      }));

      const output = `BTCP Browser CLI - Available Commands\n\n${formatHelp(commandList)}\n\nType "help <command>" for more info`;
      return { success: true, data: output };
    }

    // Show help for specific command
    const cmdName = args[0].toLowerCase();
    const cmd = commands[cmdName];

    if (!cmd) {
      return { success: false, error: `Unknown command: ${cmdName}` };
    }

    return { success: true, data: formatCommandHelp(cmd) };
  },
};
