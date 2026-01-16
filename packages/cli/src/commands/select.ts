/**
 * select command - Select dropdown option
 */

import type { CommandHandler } from '../types.js';
import { InvalidArgumentsError } from '../errors.js';

export const selectCommand: CommandHandler = {
  name: 'select',
  description: 'Select a dropdown option',
  usage: 'select <selector> <value>',
  examples: ['select @ref:5 "Option 1"', 'select #country US'],

  async execute(client, args) {
    if (args.length < 2) {
      throw new InvalidArgumentsError('Selector and value required', 'select <selector> <value>');
    }

    const selector = args[0];
    const value = args.slice(1).join(' ');

    const response = await client.execute({
      id: `cmd_${Date.now()}`,
      action: 'select',
      selector,
      values: value,
    } as any);

    if (response.success) {
      return { success: true, message: `Selected "${value}" in: ${selector}` };
    }

    return { success: false, error: response.error };
  },
};
