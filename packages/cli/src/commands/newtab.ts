/**
 * newtab command - Open a new tab
 */

import type { CommandHandler } from '../types.js';
import { getFlagBool } from '../parser.js';

export const newtabCommand: CommandHandler = {
  name: 'newtab',
  description: 'Open a new tab',
  usage: 'newtab [url] [--background]',
  examples: ['newtab', 'newtab https://example.com', 'newtab github.com --background'],

  async execute(client, args, flags) {
    let url = args[0];

    // Add https:// if URL provided without protocol
    if (url && !url.match(/^https?:\/\//i)) {
      url = `https://${url}`;
    }

    const background = getFlagBool(flags, 'background');

    const result = await client.tabNew({
      url,
      active: !background,
    });

    return {
      success: true,
      message: `Opened new tab [${result.tabId}]${url ? `: ${url}` : ''}`,
      data: result,
    };
  },
};
