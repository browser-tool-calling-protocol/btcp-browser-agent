/**
 * text command - Get text content of an element
 */

import type { CommandHandler } from '../types.js';
import { InvalidArgumentsError } from '../errors.js';

export const textCommand: CommandHandler = {
  name: 'text',
  description: 'Get text content of an element',
  usage: 'text <selector>',
  examples: ['text @ref:5', 'text #heading', 'text .message'],

  async execute(client, args) {
    if (args.length === 0) {
      throw new InvalidArgumentsError('Selector required', 'text <selector>');
    }

    const selector = args[0];
    const text = await client.getText(selector);

    return {
      success: true,
      data: text !== null ? text : '(element not found)',
    };
  },
};
