/**
 * hover command - Hover over an element
 */

import type { CommandHandler, CommandClient } from '../types.js';
import { InvalidArgumentsError } from '../errors.js';

export const hoverCommand: CommandHandler = {
  name: 'hover',
  description: 'Hover over an element',
  usage: 'hover <selector>',
  examples: ['hover @ref:5', 'hover .menu-item'],

  async execute(client, args) {
    if (args.length === 0) {
      throw new InvalidArgumentsError('Selector required', 'hover <selector>');
    }

    const selector = args[0];

    // Use execute for hover since it may not be in the simplified client interface
    const response = await client.execute({
      id: `cmd_${Date.now()}`,
      action: 'hover',
      selector,
    } as any);

    if (response.success) {
      return { success: true, message: `Hovered: ${selector}` };
    }

    return { success: false, error: response.error };
  },
};
