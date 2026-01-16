/**
 * scroll command - Scroll the page
 */

import type { CommandHandler } from '../types.js';
import { getFlagNumber } from '../parser.js';

export const scrollCommand: CommandHandler = {
  name: 'scroll',
  description: 'Scroll the page',
  usage: 'scroll <direction> [amount] | scroll <selector>',
  examples: [
    'scroll down',
    'scroll up 500',
    'scroll down 200',
    'scroll @ref:5',
  ],

  async execute(client, args, flags) {
    if (args.length === 0) {
      // Default to scroll down
      const response = await client.execute({
        id: `cmd_${Date.now()}`,
        action: 'scroll',
        direction: 'down',
        amount: 300,
      } as any);
      return response.success
        ? { success: true, message: 'Scrolled down' }
        : { success: false, error: response.error };
    }

    const first = args[0].toLowerCase();

    // Check if it's a direction
    if (['up', 'down', 'left', 'right'].includes(first)) {
      const direction = first as 'up' | 'down' | 'left' | 'right';
      const amount = args[1] ? parseInt(args[1], 10) : 300;

      const response = await client.execute({
        id: `cmd_${Date.now()}`,
        action: 'scroll',
        direction,
        amount: isNaN(amount) ? 300 : amount,
      } as any);

      return response.success
        ? { success: true, message: `Scrolled ${direction}` }
        : { success: false, error: response.error };
    }

    // It's a selector - scroll element into view
    const selector = args[0];
    const response = await client.execute({
      id: `cmd_${Date.now()}`,
      action: 'scrollIntoView',
      selector,
    } as any);

    return response.success
      ? { success: true, message: `Scrolled to: ${selector}` }
      : { success: false, error: response.error };
  },
};
