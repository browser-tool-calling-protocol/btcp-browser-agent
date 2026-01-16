/**
 * screenshot command - Capture visible tab
 */

import type { CommandHandler } from '../types.js';
import { getFlagString, getFlagNumber } from '../parser.js';
import { formatScreenshot } from '../formatter.js';

export const screenshotCommand: CommandHandler = {
  name: 'screenshot',
  description: 'Capture screenshot of visible tab',
  usage: 'screenshot [--format png|jpeg] [--quality <0-100>]',
  examples: ['screenshot', 'screenshot --format jpeg --quality 80'],

  async execute(client, _args, flags) {
    const formatFlag = getFlagString(flags, 'format');
    const format = formatFlag === 'jpeg' ? 'jpeg' : 'png';
    const quality = getFlagNumber(flags, 'quality');

    const dataUrl = await client.screenshot({ format, quality });
    return {
      success: true,
      message: formatScreenshot(dataUrl),
      data: dataUrl,
    };
  },
};
