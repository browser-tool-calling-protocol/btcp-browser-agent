/**
 * press command - Press a keyboard key
 */

import type { CommandHandler } from '../types.js';
import { InvalidArgumentsError } from '../errors.js';

export const pressCommand: CommandHandler = {
  name: 'press',
  description: 'Press a keyboard key',
  usage: 'press <key> [selector]',
  examples: [
    'press Enter',
    'press Tab',
    'press Escape',
    'press Enter @ref:1',
  ],

  async execute(client, args) {
    if (args.length === 0) {
      throw new InvalidArgumentsError('Key required', 'press <key> [selector]');
    }

    const key = args[0];
    const selector = args[1];

    const response = await client.execute({
      id: `cmd_${Date.now()}`,
      action: 'press',
      key,
      selector,
    } as any);

    if (response.success) {
      return { success: true, message: `Pressed: ${key}` };
    }

    return { success: false, error: response.error };
  },
};
