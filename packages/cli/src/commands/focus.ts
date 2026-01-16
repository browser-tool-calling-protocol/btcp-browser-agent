/**
 * focus command - Focus an element
 */

import type { CommandHandler } from '../types.js';
import { InvalidArgumentsError } from '../errors.js';

export const focusCommand: CommandHandler = {
  name: 'focus',
  description: 'Focus an element',
  usage: 'focus <selector>',
  examples: ['focus @ref:1', 'focus #input'],

  async execute(client, args) {
    if (args.length === 0) {
      throw new InvalidArgumentsError('Selector required', 'focus <selector>');
    }

    const selector = args[0];

    const response = await client.execute({
      id: `cmd_${Date.now()}`,
      action: 'focus',
      selector,
    } as any);

    if (response.success) {
      return { success: true, message: `Focused: ${selector}` };
    }

    return { success: false, error: response.error };
  },
};
