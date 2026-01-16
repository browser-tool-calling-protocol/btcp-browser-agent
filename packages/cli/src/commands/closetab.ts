/**
 * closetab command - Close a tab
 */

import type { CommandHandler } from '../types.js';

export const closetabCommand: CommandHandler = {
  name: 'closetab',
  description: 'Close a tab (current tab if no ID specified)',
  usage: 'closetab [id]',
  examples: ['closetab', 'closetab 123'],

  async execute(client, args) {
    const tabId = args[0] ? parseInt(args[0], 10) : undefined;

    if (args[0] && isNaN(tabId!)) {
      return { success: false, error: 'Invalid tab ID' };
    }

    const response = await client.tabClose(tabId);

    if (response.success) {
      return {
        success: true,
        message: tabId ? `Closed tab ${tabId}` : 'Closed current tab',
      };
    }

    return { success: false, error: response.error };
  },
};
