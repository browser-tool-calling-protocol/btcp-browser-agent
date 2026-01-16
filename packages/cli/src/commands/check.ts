/**
 * check command - Check a checkbox
 */

import type { CommandHandler } from '../types.js';
import { InvalidArgumentsError } from '../errors.js';

export const checkCommand: CommandHandler = {
  name: 'check',
  description: 'Check a checkbox',
  usage: 'check <selector>',
  examples: ['check @ref:5', 'check #agree'],

  async execute(client, args) {
    if (args.length === 0) {
      throw new InvalidArgumentsError('Selector required', 'check <selector>');
    }

    const selector = args[0];

    const response = await client.execute({
      id: `cmd_${Date.now()}`,
      action: 'check',
      selector,
    } as any);

    if (response.success) {
      return { success: true, message: `Checked: ${selector}` };
    }

    return { success: false, error: response.error };
  },
};
