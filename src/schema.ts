/**
 * Browser Tool Calling Protocol - Self-Descriptive Schema
 *
 * Provides semantic context and documentation for all available commands.
 * Enables AI agents to understand capabilities and self-correct.
 */

export interface ParameterSchema {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
  default?: unknown;
  enum?: string[];
  example?: unknown;
}

export interface CommandSchema {
  action: string;
  category: 'navigation' | 'interaction' | 'input' | 'query' | 'wait' | 'media' | 'storage' | 'utility';
  description: string;
  parameters: ParameterSchema[];
  returns: {
    description: string;
    example?: unknown;
  };
  examples: Array<{
    description: string;
    command: Record<string, unknown>;
  }>;
  tips?: string[];
  errors?: Array<{
    condition: string;
    message: string;
    recovery: string;
  }>;
}

export interface AgentSchema {
  name: string;
  version: string;
  description: string;
  commands: CommandSchema[];
}

/**
 * Complete schema for all browser agent commands
 */
export const AGENT_SCHEMA: AgentSchema = {
  name: 'btcp-browser-agent',
  version: '0.1.0',
  description: 'Browser Tool Calling Protocol agent for browser automation using native DOM APIs. Provides accessibility-tree-based snapshots and element interaction via refs or CSS selectors.',

  commands: [
    // === NAVIGATION ===
    {
      action: 'snapshot',
      category: 'query',
      description: 'Get an accessibility-tree snapshot of the current page. Returns a text representation of interactive elements with refs (e1, e2, etc.) that can be used to target elements in subsequent commands.',
      parameters: [
        {
          name: 'selector',
          type: 'string',
          required: false,
          description: 'CSS selector to snapshot a specific subtree instead of the whole page',
          example: '#main-content',
        },
        {
          name: 'interactive',
          type: 'boolean',
          required: false,
          description: 'Only include interactive elements (buttons, links, inputs)',
          default: false,
        },
        {
          name: 'maxDepth',
          type: 'number',
          required: false,
          description: 'Maximum depth to traverse the DOM tree',
        },
        {
          name: 'compact',
          type: 'boolean',
          required: false,
          description: 'Skip structural elements without names for more compact output',
          default: false,
        },
      ],
      returns: {
        description: 'Accessibility tree as text with element refs, plus a refs map containing role, name, and selector for each ref',
        example: {
          snapshot: '- button "Submit" [ref=e1]\n- textbox "Email" [ref=e2]',
          refs: {
            e1: { role: 'button', name: 'Submit', selector: '#submit-btn' },
            e2: { role: 'textbox', name: 'Email', selector: '#email' },
          },
        },
      },
      examples: [
        {
          description: 'Get full page snapshot',
          command: { action: 'snapshot' },
        },
        {
          description: 'Get snapshot of a specific section',
          command: { action: 'snapshot', selector: '#login-form' },
        },
        {
          description: 'Get only interactive elements',
          command: { action: 'snapshot', interactive: true },
        },
      ],
      tips: [
        'Always take a snapshot first to understand page structure and get element refs',
        'Use refs (e.g., @e1) instead of selectors when possible - they are more stable',
        'The snapshot output shows element roles, names, and refs in a hierarchical format',
      ],
    },

    {
      action: 'url',
      category: 'query',
      description: 'Get the current page URL',
      parameters: [],
      returns: {
        description: 'The current URL as a string',
        example: { url: 'https://example.com/page' },
      },
      examples: [
        {
          description: 'Get current URL',
          command: { action: 'url' },
        },
      ],
    },

    {
      action: 'title',
      category: 'query',
      description: 'Get the current page title',
      parameters: [],
      returns: {
        description: 'The page title as a string',
        example: { title: 'Example Page Title' },
      },
      examples: [
        {
          description: 'Get page title',
          command: { action: 'title' },
        },
      ],
    },

    // === INTERACTION ===
    {
      action: 'click',
      category: 'interaction',
      description: 'Click on an element. Can use a ref from snapshot (e.g., @e1) or a CSS selector.',
      parameters: [
        {
          name: 'selector',
          type: 'string',
          required: true,
          description: 'Element ref (e.g., @e1, e1) or CSS selector to click',
          example: '@e1',
        },
        {
          name: 'button',
          type: 'string',
          required: false,
          description: 'Mouse button to use',
          enum: ['left', 'right', 'middle'],
          default: 'left',
        },
        {
          name: 'clickCount',
          type: 'number',
          required: false,
          description: 'Number of clicks (1 for single, 2 for double)',
          default: 1,
        },
        {
          name: 'modifiers',
          type: 'array',
          required: false,
          description: 'Modifier keys to hold during click',
          example: ['Shift', 'Control'],
        },
      ],
      returns: {
        description: 'Success status',
        example: { success: true },
      },
      examples: [
        {
          description: 'Click a button using ref',
          command: { action: 'click', selector: '@e1' },
        },
        {
          description: 'Click using CSS selector',
          command: { action: 'click', selector: '#submit-btn' },
        },
        {
          description: 'Double click',
          command: { action: 'click', selector: '@e1', clickCount: 2 },
        },
        {
          description: 'Right click',
          command: { action: 'click', selector: '@e1', button: 'right' },
        },
      ],
      tips: [
        'Prefer using refs (@e1) over CSS selectors for more reliable targeting',
        'Take a snapshot first to find the correct ref for the element you want to click',
      ],
      errors: [
        {
          condition: 'Element not found',
          message: 'No element found for selector: ...',
          recovery: 'Take a new snapshot to verify the element exists and get its current ref',
        },
      ],
    },

    {
      action: 'hover',
      category: 'interaction',
      description: 'Hover over an element to trigger hover states and tooltips',
      parameters: [
        {
          name: 'selector',
          type: 'string',
          required: true,
          description: 'Element ref or CSS selector to hover',
          example: '@e3',
        },
      ],
      returns: {
        description: 'Success status',
        example: { success: true },
      },
      examples: [
        {
          description: 'Hover over element',
          command: { action: 'hover', selector: '@e3' },
        },
      ],
    },

    {
      action: 'focus',
      category: 'interaction',
      description: 'Focus an element (useful for inputs before typing)',
      parameters: [
        {
          name: 'selector',
          type: 'string',
          required: true,
          description: 'Element ref or CSS selector to focus',
          example: '@e2',
        },
      ],
      returns: {
        description: 'Success status',
        example: { success: true },
      },
      examples: [
        {
          description: 'Focus an input field',
          command: { action: 'focus', selector: '#username' },
        },
      ],
    },

    {
      action: 'blur',
      category: 'interaction',
      description: 'Remove focus from an element',
      parameters: [
        {
          name: 'selector',
          type: 'string',
          required: true,
          description: 'Element ref or CSS selector to blur',
        },
      ],
      returns: {
        description: 'Success status',
        example: { success: true },
      },
      examples: [
        {
          description: 'Blur the current element',
          command: { action: 'blur', selector: '@e2' },
        },
      ],
    },

    // === INPUT ===
    {
      action: 'type',
      category: 'input',
      description: 'Type text into an input element character by character, triggering keyboard events',
      parameters: [
        {
          name: 'selector',
          type: 'string',
          required: true,
          description: 'Element ref or CSS selector of the input',
          example: '@e2',
        },
        {
          name: 'text',
          type: 'string',
          required: true,
          description: 'Text to type',
          example: 'hello@example.com',
        },
        {
          name: 'delay',
          type: 'number',
          required: false,
          description: 'Delay between keystrokes in milliseconds',
          default: 0,
        },
        {
          name: 'clear',
          type: 'boolean',
          required: false,
          description: 'Clear the input before typing',
          default: false,
        },
      ],
      returns: {
        description: 'Success status',
        example: { success: true },
      },
      examples: [
        {
          description: 'Type into an input',
          command: { action: 'type', selector: '@e2', text: 'hello@example.com' },
        },
        {
          description: 'Clear and type new text',
          command: { action: 'type', selector: '@e2', text: 'new value', clear: true },
        },
      ],
      tips: [
        'Use "fill" action for faster input without keystroke events',
        'Use "clear: true" to replace existing content',
      ],
    },

    {
      action: 'fill',
      category: 'input',
      description: 'Fill an input with text instantly (faster than type, but no keystroke events)',
      parameters: [
        {
          name: 'selector',
          type: 'string',
          required: true,
          description: 'Element ref or CSS selector of the input',
        },
        {
          name: 'value',
          type: 'string',
          required: true,
          description: 'Value to fill',
        },
      ],
      returns: {
        description: 'Success status',
        example: { success: true },
      },
      examples: [
        {
          description: 'Fill an input field',
          command: { action: 'fill', selector: '#email', value: 'user@example.com' },
        },
      ],
      tips: [
        'Use "fill" for simple value setting, "type" when keystroke events matter',
      ],
    },

    {
      action: 'clear',
      category: 'input',
      description: 'Clear the value of an input element',
      parameters: [
        {
          name: 'selector',
          type: 'string',
          required: true,
          description: 'Element ref or CSS selector of the input to clear',
        },
      ],
      returns: {
        description: 'Success status',
        example: { success: true },
      },
      examples: [
        {
          description: 'Clear an input',
          command: { action: 'clear', selector: '@e2' },
        },
      ],
    },

    {
      action: 'press',
      category: 'input',
      description: 'Press a keyboard key (Enter, Tab, Escape, etc.)',
      parameters: [
        {
          name: 'key',
          type: 'string',
          required: true,
          description: 'Key to press (e.g., Enter, Tab, Escape, ArrowDown, a, A)',
          example: 'Enter',
        },
        {
          name: 'selector',
          type: 'string',
          required: false,
          description: 'Element to target (defaults to active element)',
        },
        {
          name: 'modifiers',
          type: 'array',
          required: false,
          description: 'Modifier keys (Control, Alt, Shift, Meta)',
          example: ['Control'],
        },
      ],
      returns: {
        description: 'Success status',
        example: { success: true },
      },
      examples: [
        {
          description: 'Press Enter to submit',
          command: { action: 'press', key: 'Enter' },
        },
        {
          description: 'Press Tab to move focus',
          command: { action: 'press', key: 'Tab' },
        },
        {
          description: 'Press Ctrl+A to select all',
          command: { action: 'press', key: 'a', modifiers: ['Control'] },
        },
      ],
    },

    {
      action: 'select',
      category: 'input',
      description: 'Select option(s) in a <select> dropdown',
      parameters: [
        {
          name: 'selector',
          type: 'string',
          required: true,
          description: 'Element ref or CSS selector of the select element',
        },
        {
          name: 'values',
          type: 'array',
          required: true,
          description: 'Array of option values to select',
          example: ['option1'],
        },
      ],
      returns: {
        description: 'Success status with selected values',
        example: { success: true, selected: ['option1'] },
      },
      examples: [
        {
          description: 'Select a single option',
          command: { action: 'select', selector: '#country', values: ['US'] },
        },
        {
          description: 'Select multiple options',
          command: { action: 'select', selector: '#tags', values: ['tag1', 'tag2'] },
        },
      ],
    },

    {
      action: 'check',
      category: 'input',
      description: 'Check a checkbox or radio button',
      parameters: [
        {
          name: 'selector',
          type: 'string',
          required: true,
          description: 'Element ref or CSS selector',
        },
      ],
      returns: {
        description: 'Success status',
        example: { success: true },
      },
      examples: [
        {
          description: 'Check a checkbox',
          command: { action: 'check', selector: '#agree-terms' },
        },
      ],
    },

    {
      action: 'uncheck',
      category: 'input',
      description: 'Uncheck a checkbox',
      parameters: [
        {
          name: 'selector',
          type: 'string',
          required: true,
          description: 'Element ref or CSS selector',
        },
      ],
      returns: {
        description: 'Success status',
        example: { success: true },
      },
      examples: [
        {
          description: 'Uncheck a checkbox',
          command: { action: 'uncheck', selector: '#newsletter' },
        },
      ],
    },

    // === QUERY ===
    {
      action: 'getAttribute',
      category: 'query',
      description: 'Get the value of an element attribute',
      parameters: [
        {
          name: 'selector',
          type: 'string',
          required: true,
          description: 'Element ref or CSS selector',
        },
        {
          name: 'name',
          type: 'string',
          required: true,
          description: 'Attribute name to get',
          example: 'href',
        },
      ],
      returns: {
        description: 'Attribute value or null if not present',
        example: { value: 'https://example.com' },
      },
      examples: [
        {
          description: 'Get href attribute',
          command: { action: 'getAttribute', selector: '@e1', name: 'href' },
        },
        {
          description: 'Get data attribute',
          command: { action: 'getAttribute', selector: '#item', name: 'data-id' },
        },
      ],
    },

    {
      action: 'getText',
      category: 'query',
      description: 'Get the text content of an element',
      parameters: [
        {
          name: 'selector',
          type: 'string',
          required: true,
          description: 'Element ref or CSS selector',
        },
      ],
      returns: {
        description: 'Text content of the element',
        example: { text: 'Hello World' },
      },
      examples: [
        {
          description: 'Get text of a heading',
          command: { action: 'getText', selector: 'h1' },
        },
      ],
    },

    {
      action: 'getHTML',
      category: 'query',
      description: 'Get the HTML content of an element',
      parameters: [
        {
          name: 'selector',
          type: 'string',
          required: true,
          description: 'Element ref or CSS selector',
        },
        {
          name: 'outer',
          type: 'boolean',
          required: false,
          description: 'Include outer element HTML (default: inner only)',
          default: false,
        },
      ],
      returns: {
        description: 'HTML content as string',
        example: { html: '<span>Content</span>' },
      },
      examples: [
        {
          description: 'Get inner HTML',
          command: { action: 'getHTML', selector: '#container' },
        },
        {
          description: 'Get outer HTML',
          command: { action: 'getHTML', selector: '#container', outer: true },
        },
      ],
    },

    {
      action: 'getValue',
      category: 'query',
      description: 'Get the value of an input element',
      parameters: [
        {
          name: 'selector',
          type: 'string',
          required: true,
          description: 'Element ref or CSS selector',
        },
      ],
      returns: {
        description: 'Input value',
        example: { value: 'user@example.com' },
      },
      examples: [
        {
          description: 'Get input value',
          command: { action: 'getValue', selector: '#email' },
        },
      ],
    },

    {
      action: 'isVisible',
      category: 'query',
      description: 'Check if an element is visible on the page',
      parameters: [
        {
          name: 'selector',
          type: 'string',
          required: true,
          description: 'Element ref or CSS selector',
        },
      ],
      returns: {
        description: 'Boolean indicating visibility',
        example: { visible: true },
      },
      examples: [
        {
          description: 'Check if modal is visible',
          command: { action: 'isVisible', selector: '#modal' },
        },
      ],
    },

    {
      action: 'isEnabled',
      category: 'query',
      description: 'Check if an element is enabled (not disabled)',
      parameters: [
        {
          name: 'selector',
          type: 'string',
          required: true,
          description: 'Element ref or CSS selector',
        },
      ],
      returns: {
        description: 'Boolean indicating enabled state',
        example: { enabled: true },
      },
      examples: [
        {
          description: 'Check if button is enabled',
          command: { action: 'isEnabled', selector: '#submit' },
        },
      ],
    },

    {
      action: 'isChecked',
      category: 'query',
      description: 'Check if a checkbox or radio is checked',
      parameters: [
        {
          name: 'selector',
          type: 'string',
          required: true,
          description: 'Element ref or CSS selector',
        },
      ],
      returns: {
        description: 'Boolean indicating checked state',
        example: { checked: true },
      },
      examples: [
        {
          description: 'Check if checkbox is checked',
          command: { action: 'isChecked', selector: '#agree' },
        },
      ],
    },

    {
      action: 'count',
      category: 'query',
      description: 'Count elements matching a selector',
      parameters: [
        {
          name: 'selector',
          type: 'string',
          required: true,
          description: 'CSS selector to match',
        },
      ],
      returns: {
        description: 'Number of matching elements',
        example: { count: 5 },
      },
      examples: [
        {
          description: 'Count list items',
          command: { action: 'count', selector: 'li.item' },
        },
      ],
    },

    {
      action: 'evaluate',
      category: 'query',
      description: 'Execute JavaScript code and return the result',
      parameters: [
        {
          name: 'expression',
          type: 'string',
          required: true,
          description: 'JavaScript expression to evaluate',
          example: 'document.title',
        },
      ],
      returns: {
        description: 'Result of the expression (JSON-serializable)',
        example: { result: 'Page Title' },
      },
      examples: [
        {
          description: 'Get document title',
          command: { action: 'evaluate', expression: 'document.title' },
        },
        {
          description: 'Calculate a value',
          command: { action: 'evaluate', expression: 'document.querySelectorAll("button").length' },
        },
      ],
      tips: [
        'Only use for operations not covered by other commands',
        'Result must be JSON-serializable (no DOM elements, functions, etc.)',
      ],
    },

    // === WAIT ===
    {
      action: 'wait',
      category: 'wait',
      description: 'Wait for a specified duration',
      parameters: [
        {
          name: 'timeout',
          type: 'number',
          required: true,
          description: 'Time to wait in milliseconds',
          example: 1000,
        },
      ],
      returns: {
        description: 'Success status after waiting',
        example: { success: true },
      },
      examples: [
        {
          description: 'Wait 1 second',
          command: { action: 'wait', timeout: 1000 },
        },
      ],
    },

    {
      action: 'waitForSelector',
      category: 'wait',
      description: 'Wait for an element to appear in the DOM',
      parameters: [
        {
          name: 'selector',
          type: 'string',
          required: true,
          description: 'CSS selector to wait for',
        },
        {
          name: 'timeout',
          type: 'number',
          required: false,
          description: 'Maximum time to wait in milliseconds',
          default: 30000,
        },
        {
          name: 'state',
          type: 'string',
          required: false,
          description: 'State to wait for',
          enum: ['attached', 'detached', 'visible', 'hidden'],
          default: 'attached',
        },
      ],
      returns: {
        description: 'Success status',
        example: { success: true },
      },
      examples: [
        {
          description: 'Wait for element to appear',
          command: { action: 'waitForSelector', selector: '#results' },
        },
        {
          description: 'Wait for element to disappear',
          command: { action: 'waitForSelector', selector: '#loading', state: 'detached' },
        },
        {
          description: 'Wait with custom timeout',
          command: { action: 'waitForSelector', selector: '#data', timeout: 5000 },
        },
      ],
      errors: [
        {
          condition: 'Timeout exceeded',
          message: 'Timeout waiting for selector',
          recovery: 'Check if the element exists with a different selector, or increase timeout',
        },
      ],
    },

    {
      action: 'waitForFunction',
      category: 'wait',
      description: 'Wait for a JavaScript function to return truthy',
      parameters: [
        {
          name: 'expression',
          type: 'string',
          required: true,
          description: 'JavaScript expression that should return truthy',
        },
        {
          name: 'timeout',
          type: 'number',
          required: false,
          description: 'Maximum time to wait in milliseconds',
          default: 30000,
        },
        {
          name: 'polling',
          type: 'number',
          required: false,
          description: 'Polling interval in milliseconds',
          default: 100,
        },
      ],
      returns: {
        description: 'Success status',
        example: { success: true },
      },
      examples: [
        {
          description: 'Wait for data to load',
          command: { action: 'waitForFunction', expression: 'window.dataLoaded === true' },
        },
      ],
    },

    // === SCROLL ===
    {
      action: 'scroll',
      category: 'interaction',
      description: 'Scroll the page or an element into view',
      parameters: [
        {
          name: 'selector',
          type: 'string',
          required: false,
          description: 'Element to scroll into view (omit for page scroll)',
        },
        {
          name: 'direction',
          type: 'string',
          required: false,
          description: 'Scroll direction (when no selector)',
          enum: ['up', 'down', 'left', 'right'],
        },
        {
          name: 'amount',
          type: 'number',
          required: false,
          description: 'Amount to scroll in pixels',
          default: 100,
        },
      ],
      returns: {
        description: 'Success status with scroll position',
        example: { success: true, scrollX: 0, scrollY: 500 },
      },
      examples: [
        {
          description: 'Scroll element into view',
          command: { action: 'scroll', selector: '#footer' },
        },
        {
          description: 'Scroll page down',
          command: { action: 'scroll', direction: 'down', amount: 300 },
        },
      ],
    },

    // === STORAGE ===
    {
      action: 'getStorage',
      category: 'storage',
      description: 'Get a value from localStorage or sessionStorage',
      parameters: [
        {
          name: 'key',
          type: 'string',
          required: true,
          description: 'Storage key to retrieve',
        },
        {
          name: 'storageType',
          type: 'string',
          required: false,
          description: 'Type of storage',
          enum: ['local', 'session'],
          default: 'local',
        },
      ],
      returns: {
        description: 'Stored value (parsed from JSON if possible)',
        example: { value: { user: 'john' } },
      },
      examples: [
        {
          description: 'Get localStorage item',
          command: { action: 'getStorage', key: 'authToken' },
        },
      ],
    },

    {
      action: 'setStorage',
      category: 'storage',
      description: 'Set a value in localStorage or sessionStorage',
      parameters: [
        {
          name: 'key',
          type: 'string',
          required: true,
          description: 'Storage key',
        },
        {
          name: 'value',
          type: 'string',
          required: true,
          description: 'Value to store (will be JSON stringified if object)',
        },
        {
          name: 'storageType',
          type: 'string',
          required: false,
          description: 'Type of storage',
          enum: ['local', 'session'],
          default: 'local',
        },
      ],
      returns: {
        description: 'Success status',
        example: { success: true },
      },
      examples: [
        {
          description: 'Set localStorage item',
          command: { action: 'setStorage', key: 'theme', value: 'dark' },
        },
      ],
    },

    {
      action: 'getCookies',
      category: 'storage',
      description: 'Get cookies for the current page',
      parameters: [],
      returns: {
        description: 'Array of cookies',
        example: { cookies: [{ name: 'session', value: 'abc123' }] },
      },
      examples: [
        {
          description: 'Get all cookies',
          command: { action: 'getCookies' },
        },
      ],
    },

    {
      action: 'setCookie',
      category: 'storage',
      description: 'Set a cookie',
      parameters: [
        {
          name: 'name',
          type: 'string',
          required: true,
          description: 'Cookie name',
        },
        {
          name: 'value',
          type: 'string',
          required: true,
          description: 'Cookie value',
        },
        {
          name: 'options',
          type: 'object',
          required: false,
          description: 'Cookie options (path, domain, expires, secure, sameSite)',
        },
      ],
      returns: {
        description: 'Success status',
        example: { success: true },
      },
      examples: [
        {
          description: 'Set a simple cookie',
          command: { action: 'setCookie', name: 'preference', value: 'compact' },
        },
      ],
    },

    // === MEDIA ===
    {
      action: 'screenshot',
      category: 'media',
      description: 'Take a screenshot of the page or element (returns base64)',
      parameters: [
        {
          name: 'selector',
          type: 'string',
          required: false,
          description: 'Element to screenshot (omit for full page)',
        },
        {
          name: 'format',
          type: 'string',
          required: false,
          description: 'Image format',
          enum: ['png', 'jpeg', 'webp'],
          default: 'png',
        },
        {
          name: 'quality',
          type: 'number',
          required: false,
          description: 'Quality for jpeg/webp (0-100)',
          default: 80,
        },
      ],
      returns: {
        description: 'Base64 encoded image data',
        example: { screenshot: 'iVBORw0KGgo...' },
      },
      examples: [
        {
          description: 'Screenshot full page',
          command: { action: 'screenshot' },
        },
        {
          description: 'Screenshot specific element',
          command: { action: 'screenshot', selector: '#chart' },
        },
      ],
    },

    {
      action: 'emulateMedia',
      category: 'media',
      description: 'Emulate media features (prefers-color-scheme, etc.)',
      parameters: [
        {
          name: 'media',
          type: 'string',
          required: false,
          description: 'Media type',
          enum: ['screen', 'print'],
        },
        {
          name: 'colorScheme',
          type: 'string',
          required: false,
          description: 'Color scheme preference',
          enum: ['light', 'dark', 'no-preference'],
        },
        {
          name: 'reducedMotion',
          type: 'string',
          required: false,
          description: 'Reduced motion preference',
          enum: ['reduce', 'no-preference'],
        },
      ],
      returns: {
        description: 'Success status',
        example: { success: true },
      },
      examples: [
        {
          description: 'Emulate dark mode',
          command: { action: 'emulateMedia', colorScheme: 'dark' },
        },
        {
          description: 'Emulate print media',
          command: { action: 'emulateMedia', media: 'print' },
        },
      ],
    },

    // === UTILITY ===
    {
      action: 'getConsole',
      category: 'utility',
      description: 'Get console messages logged by the page',
      parameters: [
        {
          name: 'clear',
          type: 'boolean',
          required: false,
          description: 'Clear messages after retrieving',
          default: false,
        },
      ],
      returns: {
        description: 'Array of console messages',
        example: { messages: [{ type: 'log', text: 'Hello', timestamp: 1234567890 }] },
      },
      examples: [
        {
          description: 'Get console messages',
          command: { action: 'getConsole' },
        },
      ],
    },

    {
      action: 'getErrors',
      category: 'utility',
      description: 'Get JavaScript errors from the page',
      parameters: [
        {
          name: 'clear',
          type: 'boolean',
          required: false,
          description: 'Clear errors after retrieving',
          default: false,
        },
      ],
      returns: {
        description: 'Array of error objects',
        example: { errors: [{ message: 'TypeError: x is not defined', timestamp: 1234567890 }] },
      },
      examples: [
        {
          description: 'Get page errors',
          command: { action: 'getErrors' },
        },
      ],
    },

    {
      action: 'getNetworkRequests',
      category: 'utility',
      description: 'Get network requests made by the page',
      parameters: [
        {
          name: 'clear',
          type: 'boolean',
          required: false,
          description: 'Clear requests after retrieving',
          default: false,
        },
      ],
      returns: {
        description: 'Array of network request objects',
        example: { requests: [{ url: 'https://api.example.com/data', method: 'GET', status: 200 }] },
      },
      examples: [
        {
          description: 'Get network requests',
          command: { action: 'getNetworkRequests' },
        },
      ],
    },
  ],
};

/**
 * Get a list of all available actions
 */
export function getAvailableActions(): string[] {
  return AGENT_SCHEMA.commands.map((cmd) => cmd.action);
}

/**
 * Get commands by category
 */
export function getCommandsByCategory(category: CommandSchema['category']): CommandSchema[] {
  return AGENT_SCHEMA.commands.filter((cmd) => cmd.category === category);
}

/**
 * Get schema for a specific action
 */
export function getCommandSchema(action: string): CommandSchema | undefined {
  return AGENT_SCHEMA.commands.find((cmd) => cmd.action === action);
}

/**
 * Generate help text for a specific command
 */
export function getCommandHelp(action: string): string {
  const cmd = getCommandSchema(action);
  if (!cmd) {
    return `Unknown action: ${action}\n\nAvailable actions: ${getAvailableActions().join(', ')}`;
  }

  const lines: string[] = [
    `ACTION: ${cmd.action}`,
    `CATEGORY: ${cmd.category}`,
    '',
    'DESCRIPTION:',
    `  ${cmd.description}`,
    '',
  ];

  if (cmd.parameters.length > 0) {
    lines.push('PARAMETERS:');
    for (const param of cmd.parameters) {
      const required = param.required ? '(required)' : '(optional)';
      const defaultVal = param.default !== undefined ? ` [default: ${JSON.stringify(param.default)}]` : '';
      lines.push(`  ${param.name}: ${param.type} ${required}${defaultVal}`);
      lines.push(`    ${param.description}`);
      if (param.enum) {
        lines.push(`    Values: ${param.enum.join(', ')}`);
      }
      if (param.example !== undefined) {
        lines.push(`    Example: ${JSON.stringify(param.example)}`);
      }
    }
    lines.push('');
  }

  lines.push('RETURNS:');
  lines.push(`  ${cmd.returns.description}`);
  if (cmd.returns.example) {
    lines.push(`  Example: ${JSON.stringify(cmd.returns.example)}`);
  }
  lines.push('');

  if (cmd.examples.length > 0) {
    lines.push('EXAMPLES:');
    for (const example of cmd.examples) {
      lines.push(`  # ${example.description}`);
      lines.push(`  ${JSON.stringify(example.command)}`);
    }
    lines.push('');
  }

  if (cmd.tips && cmd.tips.length > 0) {
    lines.push('TIPS:');
    for (const tip of cmd.tips) {
      lines.push(`  - ${tip}`);
    }
    lines.push('');
  }

  if (cmd.errors && cmd.errors.length > 0) {
    lines.push('COMMON ERRORS:');
    for (const error of cmd.errors) {
      lines.push(`  ${error.condition}:`);
      lines.push(`    Message: ${error.message}`);
      lines.push(`    Recovery: ${error.recovery}`);
    }
  }

  return lines.join('\n');
}

/**
 * Generate full help text (like --help)
 */
export function getFullHelp(): string {
  const lines: string[] = [
    '================================================================================',
    'BROWSER TOOL CALLING PROTOCOL - AGENT HELP',
    '================================================================================',
    '',
    AGENT_SCHEMA.description,
    '',
    '--------------------------------------------------------------------------------',
    'QUICK START',
    '--------------------------------------------------------------------------------',
    '',
    '1. Take a snapshot to see the page structure:',
    '   { "action": "snapshot" }',
    '',
    '2. Use refs from the snapshot to interact with elements:',
    '   { "action": "click", "selector": "@e1" }',
    '',
    '3. Fill inputs using refs or CSS selectors:',
    '   { "action": "fill", "selector": "@e2", "value": "hello@example.com" }',
    '',
    '--------------------------------------------------------------------------------',
    'SELECTOR FORMATS',
    '--------------------------------------------------------------------------------',
    '',
    'The agent supports multiple selector formats:',
    '',
    '  @e1, e1      - Element ref from snapshot (preferred)',
    '  #id          - CSS ID selector',
    '  .class       - CSS class selector',
    '  [attr=val]   - CSS attribute selector',
    '  tag          - CSS tag selector',
    '',
    'Element refs (e1, e2, etc.) are assigned during snapshot and provide',
    'stable references to elements even if the DOM changes.',
    '',
    '--------------------------------------------------------------------------------',
    'AVAILABLE COMMANDS BY CATEGORY',
    '--------------------------------------------------------------------------------',
    '',
  ];

  const categories: CommandSchema['category'][] = [
    'query',
    'interaction',
    'input',
    'wait',
    'storage',
    'media',
    'utility',
  ];

  for (const category of categories) {
    const cmds = getCommandsByCategory(category);
    if (cmds.length > 0) {
      lines.push(`[${category.toUpperCase()}]`);
      for (const cmd of cmds) {
        const params = cmd.parameters
          .filter((p) => p.required)
          .map((p) => p.name)
          .join(', ');
        lines.push(`  ${cmd.action}${params ? `(${params})` : ''} - ${cmd.description.split('.')[0]}`);
      }
      lines.push('');
    }
  }

  lines.push('--------------------------------------------------------------------------------');
  lines.push('COMMAND DETAILS');
  lines.push('--------------------------------------------------------------------------------');
  lines.push('');
  lines.push('Use agent.describeCommand(action) or getCommandHelp(action) for detailed');
  lines.push('information about a specific command including parameters, examples, and tips.');
  lines.push('');
  lines.push('--------------------------------------------------------------------------------');
  lines.push('COMMON PATTERNS');
  lines.push('--------------------------------------------------------------------------------');
  lines.push('');
  lines.push('Form filling:');
  lines.push('  1. snapshot → find input refs');
  lines.push('  2. fill(@e1, "value") → fill each input');
  lines.push('  3. click(@submit) → submit the form');
  lines.push('');
  lines.push('Navigation with dynamic content:');
  lines.push('  1. click(@link) → trigger navigation/update');
  lines.push('  2. waitForSelector("#content") → wait for content');
  lines.push('  3. snapshot → get new page structure');
  lines.push('');
  lines.push('Debugging:');
  lines.push('  1. getConsole → check for console messages');
  lines.push('  2. getErrors → check for JavaScript errors');
  lines.push('  3. screenshot → visual verification');
  lines.push('');

  return lines.join('\n');
}

/**
 * Get JSON schema for all commands (for programmatic use)
 */
export function getJSONSchema(): Record<string, unknown> {
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'Browser Agent Command',
    description: AGENT_SCHEMA.description,
    type: 'object',
    required: ['action'],
    properties: {
      id: {
        type: 'string',
        description: 'Unique command identifier',
      },
      action: {
        type: 'string',
        enum: getAvailableActions(),
        description: 'The action to perform',
      },
    },
    allOf: AGENT_SCHEMA.commands.map((cmd) => ({
      if: {
        properties: { action: { const: cmd.action } },
      },
      then: {
        properties: Object.fromEntries(
          cmd.parameters.map((param) => [
            param.name,
            {
              type: param.type,
              description: param.description,
              ...(param.enum ? { enum: param.enum } : {}),
              ...(param.default !== undefined ? { default: param.default } : {}),
            },
          ])
        ),
        required: cmd.parameters.filter((p) => p.required).map((p) => p.name),
      },
    })),
  };
}

/**
 * Suggest corrections for an unknown action
 */
export function suggestAction(unknownAction: string): string[] {
  const actions = getAvailableActions();
  const lower = unknownAction.toLowerCase();

  // Exact prefix match
  const prefixMatches = actions.filter((a) => a.toLowerCase().startsWith(lower));
  if (prefixMatches.length > 0) {
    return prefixMatches;
  }

  // Contains match
  const containsMatches = actions.filter((a) => a.toLowerCase().includes(lower));
  if (containsMatches.length > 0) {
    return containsMatches;
  }

  // Levenshtein-like similarity (simple version)
  const scored = actions.map((a) => ({
    action: a,
    score: similarity(lower, a.toLowerCase()),
  }));
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 3).map((s) => s.action);
}

/**
 * Simple string similarity score
 */
function similarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) matches++;
  }

  return matches / longer.length;
}

/**
 * Format error with recovery suggestions
 */
export function formatError(action: string, error: string): string {
  const cmd = getCommandSchema(action);
  const lines: string[] = [
    `ERROR executing "${action}": ${error}`,
    '',
  ];

  if (cmd?.errors) {
    const matchingError = cmd.errors.find(
      (e) => error.toLowerCase().includes(e.condition.toLowerCase()) ||
             error.toLowerCase().includes(e.message.toLowerCase())
    );
    if (matchingError) {
      lines.push('RECOVERY SUGGESTION:');
      lines.push(`  ${matchingError.recovery}`);
      lines.push('');
    }
  }

  if (cmd) {
    lines.push('COMMAND USAGE:');
    lines.push(getCommandHelp(action));
  } else {
    const suggestions = suggestAction(action);
    if (suggestions.length > 0) {
      lines.push('DID YOU MEAN:');
      for (const suggestion of suggestions) {
        lines.push(`  - ${suggestion}`);
      }
    }
  }

  return lines.join('\n');
}
