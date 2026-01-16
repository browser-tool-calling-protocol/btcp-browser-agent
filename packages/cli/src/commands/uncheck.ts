/**
 * uncheck command - Uncheck a checkbox
 */

import type { CommandHandler } from '../types.js';
import { InvalidArgumentsError } from '../errors.js';

export const uncheckCommand: CommandHandler = {
  name: 'uncheck',
  description: 'Uncheck a checkbox',
  usage: 'uncheck <selector>',
  examples: ['uncheck @ref:5', 'uncheck #newsletter'],

  async execute(client, args) {
    if (args.length === 0) {
      throw new InvalidArgumentsError('Selector required', 'uncheck <selector>');
    }

    const selector = args[0];

    const response = await client.execute({
      id: `cmd_${Date.now()}`,
      action: 'uncheck',
      selector,
    } as any);

    if (response.success) {
      return { success: true, message: `Unchecked: ${selector}` };
    }

    return { success: false, error: response.error };
  },
};
