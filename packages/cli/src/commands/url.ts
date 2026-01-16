/**
 * url command - Get current page URL
 */

import type { CommandHandler } from '../types.js';

export const urlCommand: CommandHandler = {
  name: 'url',
  description: 'Get the current page URL',
  usage: 'url',
  examples: ['url'],

  async execute(client) {
    const url = await client.getUrl();
    return { success: true, data: url };
  },
};
