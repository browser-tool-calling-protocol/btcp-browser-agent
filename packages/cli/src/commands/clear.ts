/**
 * clear command - Clear an input field
 */

import type { CommandHandler } from '../types.js';
import { InvalidArgumentsError } from '../errors.js';

export const clearCommand: CommandHandler = {
  name: 'clear',
  description: 'Clear an input field',
  usage: 'clear <selector>',
  examples: ['clear @ref:1', 'clear #search'],

  async execute(client, args) {
    if (args.length === 0) {
      throw new InvalidArgumentsError('Selector required', 'clear <selector>');
    }

    const selector = args[0];

    const response = await client.execute({
      id: `cmd_${Date.now()}`,
      action: 'clear',
      selector,
    } as any);

    if (response.success) {
      return { success: true, message: `Cleared: ${selector}` };
    }

    return { success: false, error: response.error };
  },
};
