/**
 * goto command - Navigate to a URL
 */

import type { CommandHandler } from '../types.js';
import { InvalidArgumentsError } from '../errors.js';

export const gotoCommand: CommandHandler = {
  name: 'goto',
  description: 'Navigate to a URL',
  usage: 'goto <url>',
  examples: ['goto https://example.com', 'goto github.com'],

  async execute(client, args) {
    if (args.length === 0) {
      throw new InvalidArgumentsError('URL required', 'goto <url>');
    }

    let url = args[0];

    // Add https:// if no protocol specified
    if (!url.match(/^https?:\/\//i)) {
      url = `https://${url}`;
    }

    const response = await client.navigate(url);

    if (response.success) {
      return { success: true, message: `Navigated to ${url}` };
    }

    return { success: false, error: response.error };
  },
};
