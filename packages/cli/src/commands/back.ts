/**
 * back command - Go back in browser history
 */

import type { CommandHandler } from '../types.js';

export const backCommand: CommandHandler = {
  name: 'back',
  description: 'Go back in browser history',
  usage: 'back',
  examples: ['back'],

  async execute(client) {
    const response = await client.back();

    if (response.success) {
      return { success: true, message: 'Navigated back' };
    }

    return { success: false, error: response.error };
  },
};
