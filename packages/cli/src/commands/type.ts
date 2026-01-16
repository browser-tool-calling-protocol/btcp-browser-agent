/**
 * type command - Type text into an element
 */

import type { CommandHandler } from '../types.js';
import { InvalidArgumentsError } from '../errors.js';
import { getFlagNumber, getFlagBool } from '../parser.js';

export const typeCommand: CommandHandler = {
  name: 'type',
  description: 'Type text into an element (character by character)',
  usage: 'type <selector> <text> [--delay <ms>] [--clear]',
  examples: [
    'type @ref:1 "hello world"',
    'type #search hello',
    'type @ref:2 "test" --delay 50',
    'type @ref:3 "new text" --clear',
  ],

  async execute(client, args, flags) {
    if (args.length < 2) {
      throw new InvalidArgumentsError('Selector and text required', 'type <selector> <text>');
    }

    const selector = args[0];
    const text = args.slice(1).join(' ');
    const delay = getFlagNumber(flags, 'delay');
    const clear = getFlagBool(flags, 'clear');

    const response = await client.type(selector, text, { delay, clear });

    if (response.success) {
      return { success: true, message: `Typed "${text}" into: ${selector}` };
    }

    return { success: false, error: response.error };
  },
};
