/**
 * title command - Get current page title
 */

import type { CommandHandler } from '../types.js';

export const titleCommand: CommandHandler = {
  name: 'title',
  description: 'Get the current page title',
  usage: 'title',
  examples: ['title'],

  async execute(client) {
    const title = await client.getTitle();
    return { success: true, data: title };
  },
};
