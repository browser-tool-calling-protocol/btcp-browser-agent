/**
 * help command - Show help information
 */

import type { CommandHandler } from '../types.js';
import { formatCommandHelp } from '../formatter.js';
import { commands } from './index.js';
import { commandCategories, findSimilarCommands } from '../suggestions.js';

/**
 * Format categorized help
 */
function formatCategorizedHelp(): string {
  let output = 'BTCP Browser CLI - Available Commands\n';
  output += '═'.repeat(40) + '\n\n';

  for (const [, category] of Object.entries(commandCategories)) {
    output += `▸ ${category.name}\n`;
    output += `  ${category.description}\n\n`;

    for (const cmdName of category.commands) {
      const cmd = commands[cmdName];
      if (cmd) {
        const padding = ' '.repeat(Math.max(0, 12 - cmdName.length));
        output += `    ${cmdName}${padding}${cmd.description}\n`;
      }
    }
    output += '\n';
  }

  output += '─'.repeat(40) + '\n';
  output += 'Tips:\n';
  output += '  • Type "help <command>" for detailed usage\n';
  output += '  • Type "help category <name>" for category commands\n';
  output += '  • Use @ref:N selectors from snapshot output\n';
  output += '  • Comments start with # in multi-line input\n';

  return output;
}

/**
 * Format category-specific help
 */
function formatCategoryHelp(categoryKey: string): string | null {
  const category = commandCategories[categoryKey as keyof typeof commandCategories];
  if (!category) return null;

  let output = `${category.name}\n`;
  output += '─'.repeat(30) + '\n';
  output += `${category.description}\n\n`;
  output += 'Commands:\n\n';

  for (const cmdName of category.commands) {
    const cmd = commands[cmdName];
    if (cmd) {
      output += `  ${cmd.usage}\n`;
      output += `    ${cmd.description}\n`;
      if (cmd.examples && cmd.examples.length > 0) {
        output += `    Example: ${cmd.examples[0]}\n`;
      }
      output += '\n';
    }
  }

  return output;
}

/**
 * Format quick reference
 */
function formatQuickRef(): string {
  let output = 'Quick Reference\n';
  output += '═'.repeat(40) + '\n\n';

  output += 'Common Workflow:\n';
  output += '  goto <url>        Navigate to page\n';
  output += '  snapshot          See page elements\n';
  output += '  click @ref:N      Click element\n';
  output += '  type @ref:N "..." Type into input\n';
  output += '  fill @ref:N "..." Fill input field\n\n';

  output += 'Selectors:\n';
  output += '  @ref:5            Element ref from snapshot\n';
  output += '  #id               CSS ID selector\n';
  output += '  .class            CSS class selector\n';
  output += '  button            Tag name selector\n\n';

  output += 'Multi-line:\n';
  output += '  Commands can be separated by newlines\n';
  output += '  Lines starting with # are comments\n';
  output += '  Execution stops on first error\n';

  return output;
}

export const helpCommand: CommandHandler = {
  name: 'help',
  description: 'Show help information',
  usage: 'help [command|category <name>|quick]',
  examples: [
    'help',
    'help goto',
    'help category navigation',
    'help quick',
  ],

  async execute(_client, args) {
    if (args.length === 0) {
      return { success: true, data: formatCategorizedHelp() };
    }

    const first = args[0].toLowerCase();

    // Quick reference
    if (first === 'quick' || first === 'ref') {
      return { success: true, data: formatQuickRef() };
    }

    // Category help
    if (first === 'category' || first === 'cat') {
      if (args.length < 2) {
        const categories = Object.keys(commandCategories).join(', ');
        return {
          success: true,
          data: `Available categories: ${categories}\n\nUsage: help category <name>`,
        };
      }
      const categoryHelp = formatCategoryHelp(args[1].toLowerCase());
      if (categoryHelp) {
        return { success: true, data: categoryHelp };
      }
      const categories = Object.keys(commandCategories).join(', ');
      return {
        success: false,
        error: `Unknown category: ${args[1]}\n\nAvailable: ${categories}`,
      };
    }

    // Command help
    const cmdName = first;
    const cmd = commands[cmdName];

    if (cmd) {
      return { success: true, data: formatCommandHelp(cmd) };
    }

    // Suggest similar commands
    const similar = findSimilarCommands(cmdName);
    if (similar.length > 0) {
      const suggestions = similar.map((s) => `  ${s}`).join('\n');
      return {
        success: false,
        error: `Unknown command: ${cmdName}\n\nDid you mean:\n${suggestions}\n\nType "help" for all commands`,
      };
    }

    return {
      success: false,
      error: `Unknown command: ${cmdName}\n\nType "help" to see available commands`,
    };
  },
};
