/**
 * tabs command - List all tabs
 */

import type { CommandHandler } from '../types.js';

export const tabsCommand: CommandHandler = {
  name: 'tabs',
  description: 'List all open tabs',
  usage: 'tabs',
  examples: ['tabs'],

  async execute(client) {
    const tabs = await client.tabList();

    const formatted = tabs
      .map((tab) => {
        const marker = tab.active ? '*' : ' ';
        const title = tab.title || '(untitled)';
        return `${marker} [${tab.id}] ${title}\n    ${tab.url || ''}`;
      })
      .join('\n');

    return { success: true, data: formatted || 'No tabs' };
  },
};
