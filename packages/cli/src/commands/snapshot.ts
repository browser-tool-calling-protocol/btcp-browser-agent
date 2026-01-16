/**
 * snapshot command - Get page accessibility tree
 */

import type { CommandHandler } from '../types.js';
import { getFlagString, getFlagNumber } from '../parser.js';

export const snapshotCommand: CommandHandler = {
  name: 'snapshot',
  description: 'Get page accessibility tree',
  usage: 'snapshot [--selector <css>] [--depth <n>]',
  examples: ['snapshot', 'snapshot --selector main', 'snapshot --depth 5'],

  async execute(client, _args, flags) {
    const selector = getFlagString(flags, 'selector');
    const maxDepth = getFlagNumber(flags, 'depth');

    const result = await client.snapshot({ selector, maxDepth });
    return { success: true, data: result.tree };
  },
};
