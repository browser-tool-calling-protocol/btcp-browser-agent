/**
 * forward command - Go forward in browser history
 */

import type { CommandHandler } from '../types.js';

export const forwardCommand: CommandHandler = {
  name: 'forward',
  description: 'Go forward in browser history',
  usage: 'forward',
  examples: ['forward'],

  async execute(client) {
    const response = await client.forward();

    if (response.success) {
      return { success: true, message: 'Navigated forward' };
    }

    return { success: false, error: response.error };
  },
};
