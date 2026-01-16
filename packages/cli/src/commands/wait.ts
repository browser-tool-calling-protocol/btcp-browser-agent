/**
 * wait command - Wait for duration or element
 */

import type { CommandHandler } from '../types.js';
import { getFlagString, getFlagNumber } from '../parser.js';

export const waitCommand: CommandHandler = {
  name: 'wait',
  description: 'Wait for duration (ms) or element state',
  usage: 'wait <ms> | wait <selector> [--state visible|hidden]',
  examples: [
    'wait 1000',
    'wait @ref:5',
    'wait @ref:5 --state visible',
    'wait #loading --state hidden',
  ],

  async execute(client, args, flags) {
    if (args.length === 0) {
      // Default wait
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return { success: true, message: 'Waited 1000ms' };
    }

    const first = args[0];

    // Check if it's a number (duration)
    const duration = parseInt(first, 10);
    if (!isNaN(duration) && String(duration) === first) {
      await new Promise((resolve) => setTimeout(resolve, duration));
      return { success: true, message: `Waited ${duration}ms` };
    }

    // It's a selector - wait for element
    const selector = first;
    const state = getFlagString(flags, 'state') as 'visible' | 'hidden' | undefined;
    const timeout = getFlagNumber(flags, 'timeout', 30000);

    const response = await client.execute({
      id: `cmd_${Date.now()}`,
      action: 'wait',
      selector,
      state: state || 'visible',
      timeout,
    } as any);

    if (response.success) {
      return { success: true, message: `Element ready: ${selector}` };
    }

    return { success: false, error: response.error };
  },
};
