/**
 * click command - Click an element
 */

import type { CommandHandler } from '../types.js';
import { InvalidArgumentsError } from '../errors.js';
import { getFlagString } from '../parser.js';

export const clickCommand: CommandHandler = {
  name: 'click',
  description: 'Click an element',
  usage: 'click <selector> [--button left|right|middle]',
  examples: ['click @ref:5', 'click #submit', 'click @ref:3 --button right'],

  async execute(client, args, flags) {
    if (args.length === 0) {
      throw new InvalidArgumentsError('Selector required', 'click <selector>');
    }

    const selector = args[0];
    const buttonFlag = getFlagString(flags, 'button');
    const button = buttonFlag as 'left' | 'right' | 'middle' | undefined;

    const response = await client.click(selector, { button });

    if (response.success) {
      return { success: true, message: `Clicked: ${selector}` };
    }

    return { success: false, error: response.error };
  },
};
