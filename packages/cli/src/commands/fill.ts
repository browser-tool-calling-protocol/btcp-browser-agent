/**
 * fill command - Fill an input field
 */

import type { CommandHandler } from '../types.js';
import { InvalidArgumentsError } from '../errors.js';

export const fillCommand: CommandHandler = {
  name: 'fill',
  description: 'Fill an input field (sets value directly)',
  usage: 'fill <selector> <value>',
  examples: ['fill @ref:1 "john@example.com"', 'fill #email test@test.com'],

  async execute(client, args) {
    if (args.length < 2) {
      throw new InvalidArgumentsError('Selector and value required', 'fill <selector> <value>');
    }

    const selector = args[0];
    const value = args.slice(1).join(' ');

    const response = await client.fill(selector, value);

    if (response.success) {
      return { success: true, message: `Filled: ${selector}` };
    }

    return { success: false, error: response.error };
  },
};
