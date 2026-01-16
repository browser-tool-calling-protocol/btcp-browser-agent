/**
 * tab command - Switch to a tab
 */

import type { CommandHandler } from '../types.js';
import { InvalidArgumentsError } from '../errors.js';

export const tabCommand: CommandHandler = {
  name: 'tab',
  description: 'Switch to a tab by ID',
  usage: 'tab <id>',
  examples: ['tab 123'],

  async execute(client, args) {
    if (args.length === 0) {
      throw new InvalidArgumentsError('Tab ID required', 'tab <id>');
    }

    const tabId = parseInt(args[0], 10);
    if (isNaN(tabId)) {
      throw new InvalidArgumentsError('Invalid tab ID', 'tab <id>');
    }

    const response = await client.tabSwitch(tabId);

    if (response.success) {
      return { success: true, message: `Switched to tab ${tabId}` };
    }

    return { success: false, error: response.error };
  },
};
