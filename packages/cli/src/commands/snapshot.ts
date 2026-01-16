/**
 * snapshot command - Get page accessibility tree
 */

import type { CommandHandler, SnapshotResult } from '../types.js';
import { getFlagString, getFlagNumber, getFlagBool } from '../parser.js';

export const snapshotCommand: CommandHandler = {
  name: 'snapshot',
  description: 'Get page accessibility tree',
  usage: 'snapshot [--selector <css>] [--depth <n>] [--json]',
  examples: [
    'snapshot',
    'snapshot --selector main',
    'snapshot --depth 5',
    'snapshot --json  # Get structured JSON output',
  ],

  async execute(client, _args, flags) {
    const selector = getFlagString(flags, 'selector');
    const maxDepth = getFlagNumber(flags, 'depth');
    const jsonOnly = getFlagBool(flags, 'json');

    const result = await client.snapshot({ selector, maxDepth });
    const refCount = Object.keys(result.refs).length;

    // JSON-only mode: return structured data
    if (jsonOnly) {
      return {
        success: true,
        data: {
          refs: result.refs,
          count: refCount,
        },
      };
    }

    // Default: return both ASCII tree (for display) and refs (for programmatic use)
    const snapshotData: SnapshotResult = {
      tree: result.tree,
      refs: result.refs,
      count: refCount,
    };

    return {
      success: true,
      message: `${refCount} interactive elements found`,
      data: snapshotData,
    };
  },
};
