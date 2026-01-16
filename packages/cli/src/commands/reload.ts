/**
 * reload command - Reload the current page
 */

import type { CommandHandler } from '../types.js';
import { getFlagBool } from '../parser.js';

export const reloadCommand: CommandHandler = {
  name: 'reload',
  description: 'Reload the current page',
  usage: 'reload [--hard]',
  examples: ['reload', 'reload --hard'],

  async execute(client, _args, flags) {
    const bypassCache = getFlagBool(flags, 'hard');
    const response = await client.reload({ bypassCache });

    if (response.success) {
      const msg = bypassCache ? 'Hard reloaded page' : 'Reloaded page';
      return { success: true, message: msg };
    }

    return { success: false, error: response.error };
  },
};
