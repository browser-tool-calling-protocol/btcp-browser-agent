/**
 * eval command - Execute JavaScript in page context
 */

import type { CommandHandler } from '../types.js';
import { InvalidArgumentsError } from '../errors.js';

export const evalCommand: CommandHandler = {
  name: 'eval',
  description: 'Execute JavaScript in the page context',
  usage: 'eval <code>',
  examples: [
    'eval document.title',
    'eval "window.scrollTo(0, 0)"',
    'eval "document.querySelectorAll(\'a\').length"',
  ],

  async execute(client, args) {
    if (args.length === 0) {
      throw new InvalidArgumentsError('JavaScript code required', 'eval <code>');
    }

    const script = args.join(' ');

    const response = await client.execute({
      id: `cmd_${Date.now()}`,
      action: 'evaluate',
      script,
    } as any);

    if (response.success) {
      const result = (response as any).data?.result;
      return {
        success: true,
        data: result !== undefined ? String(result) : '(undefined)',
      };
    }

    return { success: false, error: response.error };
  },
};
