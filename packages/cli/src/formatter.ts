/**
 * @btcp/cli - Output formatter
 *
 * Formats command results for terminal display.
 */

import type { CommandResult, FormattedOutput } from './types.js';

/**
 * Format a command result for display
 */
export function formatResult(result: CommandResult): FormattedOutput {
  if (result.success) {
    if (result.message) {
      return { type: 'success', content: `✓ ${result.message}` };
    }
    if (result.data !== undefined) {
      return { type: 'data', content: formatData(result.data) };
    }
    return { type: 'success', content: '✓ Done' };
  }

  return {
    type: 'error',
    content: `✗ Error: ${result.error || 'Unknown error'}`,
  };
}

/**
 * Format data for display
 */
export function formatData(data: unknown): string {
  if (data === null || data === undefined) {
    return '';
  }

  if (typeof data === 'string') {
    return data;
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return String(data);
  }

  if (Array.isArray(data)) {
    return formatArray(data);
  }

  if (typeof data === 'object') {
    return formatObject(data as Record<string, unknown>);
  }

  return String(data);
}

/**
 * Format an array for display
 */
function formatArray(arr: unknown[]): string {
  if (arr.length === 0) return '(empty)';

  // Check if it's a simple array of primitives
  if (arr.every((item) => typeof item !== 'object' || item === null)) {
    return arr.map((item) => String(item)).join('\n');
  }

  // Complex array - format each item
  return arr.map((item, i) => `[${i}] ${formatData(item)}`).join('\n');
}

/**
 * Format an object for display
 */
function formatObject(obj: Record<string, unknown>): string {
  const entries = Object.entries(obj);
  if (entries.length === 0) return '{}';

  // Check for specific known formats
  if ('tree' in obj && typeof obj.tree === 'string') {
    // Snapshot data - just return the tree
    return obj.tree;
  }

  if ('tabs' in obj && Array.isArray(obj.tabs)) {
    // Tab list
    return formatTabList(obj.tabs as TabInfo[]);
  }

  // Generic object formatting
  return entries
    .map(([key, value]) => {
      const formattedValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      return `${key}: ${formattedValue}`;
    })
    .join('\n');
}

interface TabInfo {
  id: number;
  url?: string;
  title?: string;
  active: boolean;
  index: number;
}

/**
 * Format tab list for display
 */
function formatTabList(tabs: TabInfo[]): string {
  if (tabs.length === 0) return 'No tabs';

  return tabs
    .map((tab) => {
      const active = tab.active ? '* ' : '  ';
      const title = tab.title || '(untitled)';
      const url = tab.url || '';
      return `${active}[${tab.id}] ${title}\n     ${url}`;
    })
    .join('\n');
}

/**
 * Format help text
 */
export function formatHelp(commands: { name: string; description: string; usage: string }[]): string {
  const maxNameLen = Math.max(...commands.map((c) => c.name.length));

  return commands
    .map((cmd) => {
      const padding = ' '.repeat(maxNameLen - cmd.name.length + 2);
      return `  ${cmd.name}${padding}${cmd.description}`;
    })
    .join('\n');
}

/**
 * Format command help with detailed information
 */
export function formatCommandHelp(command: {
  name: string;
  description: string;
  usage: string;
  examples?: string[];
}): string {
  let output = `${command.name}\n`;
  output += '─'.repeat(30) + '\n\n';
  output += `${command.description}\n\n`;
  output += `Usage:\n  ${command.usage}\n`;

  if (command.examples && command.examples.length > 0) {
    output += '\nExamples:\n';
    output += command.examples.map((ex) => `  ${ex}`).join('\n');
  }

  // Add selector help for commands that use selectors
  const selectorCommands = ['click', 'type', 'fill', 'clear', 'hover', 'focus', 'check', 'uncheck', 'select', 'scroll', 'wait', 'text'];
  if (selectorCommands.includes(command.name)) {
    output += '\n\nSelectors:\n';
    output += '  @ref:N    Element reference from snapshot\n';
    output += '  #id       CSS ID selector\n';
    output += '  .class    CSS class selector\n';
    output += '  tag       HTML tag name';
  }

  return output;
}

/**
 * Format screenshot as base64 data URL info
 */
export function formatScreenshot(dataUrl: string): string {
  // Extract format and size from data URL
  const match = dataUrl.match(/^data:image\/(\w+);base64,/);
  if (match) {
    const format = match[1];
    const base64 = dataUrl.slice(match[0].length);
    const sizeBytes = Math.ceil((base64.length * 3) / 4);
    const sizeKb = (sizeBytes / 1024).toFixed(1);
    return `Screenshot captured (${format}, ${sizeKb} KB)`;
  }
  return 'Screenshot captured';
}

/**
 * Format error with suggestions
 */
export function formatErrorWithSuggestions(
  error: string,
  suggestions?: string[]
): string {
  let output = `✗ Error: ${error}`;

  if (suggestions && suggestions.length > 0) {
    output += '\n\nSuggestions:';
    for (const suggestion of suggestions) {
      output += `\n  • ${suggestion}`;
    }
  }

  return output;
}

/**
 * Format success message with next steps
 */
export function formatSuccessWithNextSteps(
  message: string,
  nextSteps?: string[]
): string {
  let output = `✓ ${message}`;

  if (nextSteps && nextSteps.length > 0) {
    output += '\n\nNext steps:';
    for (const step of nextSteps) {
      output += `\n  ${step}`;
    }
  }

  return output;
}
