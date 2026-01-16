/**
 * @btcp/cli - Command suggestions and fuzzy matching
 *
 * Helps users self-correct typos and discover commands.
 */

import { commands } from './commands/index.js';

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Find similar commands to the given input
 */
export function findSimilarCommands(input: string, maxSuggestions = 3): string[] {
  const inputLower = input.toLowerCase();
  const commandNames = Object.keys(commands);

  // Calculate distances and filter
  const scored = commandNames
    .map((name) => ({
      name,
      distance: levenshteinDistance(inputLower, name),
      startsWith: name.startsWith(inputLower),
      contains: name.includes(inputLower),
    }))
    .filter((item) => {
      // Only suggest if reasonably close
      const maxDistance = Math.max(2, Math.floor(input.length / 2));
      return item.distance <= maxDistance || item.startsWith || item.contains;
    })
    .sort((a, b) => {
      // Prioritize: startsWith > contains > distance
      if (a.startsWith && !b.startsWith) return -1;
      if (!a.startsWith && b.startsWith) return 1;
      if (a.contains && !b.contains) return -1;
      if (!a.contains && b.contains) return 1;
      return a.distance - b.distance;
    });

  return scored.slice(0, maxSuggestions).map((item) => item.name);
}

/**
 * Get contextual suggestions based on command and error
 */
export function getContextualSuggestion(
  commandName: string,
  error: string,
  args: string[]
): string | null {
  const errorLower = error.toLowerCase();

  // Selector not found
  if (errorLower.includes('not found') || errorLower.includes('no element')) {
    return `Element not found. Try:\n  1. Run 'snapshot' to see available elements with @ref IDs\n  2. Use a different selector or wait for the element: 'wait ${args[0] || '<selector>'} --state visible'`;
  }

  // Invalid selector
  if (errorLower.includes('selector') || errorLower.includes('invalid')) {
    return `Invalid selector. Supported formats:\n  - @ref:5 (from snapshot)\n  - #id (CSS ID selector)\n  - .class (CSS class selector)\n  - button, input (tag names)`;
  }

  // Navigation errors
  if (errorLower.includes('navigate') || errorLower.includes('url')) {
    return `Navigation failed. Make sure:\n  1. URL includes protocol (https://)\n  2. The page is accessible\n  3. Try: 'goto https://example.com'`;
  }

  // Timeout
  if (errorLower.includes('timeout')) {
    return `Operation timed out. Try:\n  1. Increase wait time: 'wait 5000'\n  2. Check if element exists: 'snapshot'\n  3. Wait for specific state: 'wait ${args[0] || '<selector>'} --state visible'`;
  }

  // Permission/security
  if (errorLower.includes('permission') || errorLower.includes('security') || errorLower.includes('blocked')) {
    return `Action blocked. This may be due to:\n  1. Cross-origin restrictions\n  2. Browser security policies\n  3. The element may be in an iframe`;
  }

  return null;
}

/**
 * Command categories for organized help
 */
export const commandCategories = {
  navigation: {
    name: 'Navigation',
    description: 'Navigate between pages and control browser history',
    commands: ['goto', 'back', 'forward', 'reload', 'url', 'title'],
  },
  inspection: {
    name: 'Page Inspection',
    description: 'Inspect page content and capture screenshots',
    commands: ['snapshot', 'screenshot', 'text'],
  },
  interaction: {
    name: 'Element Interaction',
    description: 'Click, type, and interact with page elements',
    commands: ['click', 'type', 'fill', 'clear', 'hover', 'focus', 'press'],
  },
  forms: {
    name: 'Form Controls',
    description: 'Work with form inputs like checkboxes and dropdowns',
    commands: ['check', 'uncheck', 'select'],
  },
  scrolling: {
    name: 'Scrolling',
    description: 'Scroll the page or scroll elements into view',
    commands: ['scroll'],
  },
  tabs: {
    name: 'Tab Management',
    description: 'Manage browser tabs',
    commands: ['tabs', 'tab', 'newtab', 'closetab'],
  },
  utility: {
    name: 'Utility',
    description: 'Wait, evaluate JavaScript, and get help',
    commands: ['wait', 'eval', 'help'],
  },
};

/**
 * Get category for a command
 */
export function getCommandCategory(commandName: string): string | null {
  for (const [key, category] of Object.entries(commandCategories)) {
    if (category.commands.includes(commandName)) {
      return key;
    }
  }
  return null;
}

/**
 * Common workflow suggestions
 */
export const workflowSuggestions = {
  afterNavigation: [
    'snapshot     # See page structure and get element refs',
    'screenshot   # Capture visual state',
    'wait 1000    # Wait for page to settle',
  ],
  afterSnapshot: [
    'click @ref:N      # Click an element from snapshot',
    'type @ref:N "..."  # Type into an input',
    'fill @ref:N "..."  # Fill an input field',
  ],
  afterClick: [
    'snapshot     # See updated page state',
    'wait 500     # Wait for animations/updates',
  ],
  afterError: [
    'snapshot     # Check current page state',
    'url          # Verify current URL',
    'tabs         # Check open tabs',
  ],
};

/**
 * Get next step suggestions based on last command
 */
export function getNextStepSuggestions(lastCommand: string): string[] {
  switch (lastCommand) {
    case 'goto':
    case 'reload':
    case 'back':
    case 'forward':
      return workflowSuggestions.afterNavigation;
    case 'snapshot':
      return workflowSuggestions.afterSnapshot;
    case 'click':
    case 'type':
    case 'fill':
    case 'press':
      return workflowSuggestions.afterClick;
    default:
      return [];
  }
}
