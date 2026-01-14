/**
 * Browser Tool Calling Protocol - Programmatic Interfaces
 *
 * Provides TypeScript type definitions and callable function metadata
 * for AI agents to generate correct code.
 */

import { AGENT_SCHEMA, getCommandSchema, getAvailableActions } from './schema.js';

/**
 * Function parameter definition
 */
export interface FunctionParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
  default?: unknown;
  enum?: string[];
}

/**
 * Function signature definition
 */
export interface FunctionSignature {
  name: string;
  description: string;
  params: FunctionParam[];
  returns: {
    type: string;
    description: string;
  };
  async: boolean;
  example: string;
}

/**
 * Complete interface definition
 */
export interface InterfaceDefinition {
  typescript: string;
  functions: FunctionSignature[];
  usage: string;
}

/**
 * Convert schema type to TypeScript type
 */
function toTypeScriptType(type: string, enumValues?: string[]): string {
  if (enumValues && enumValues.length > 0) {
    return enumValues.map((v) => `'${v}'`).join(' | ');
  }
  switch (type) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      return 'string[]';
    case 'object':
      return 'Record<string, unknown>';
    default:
      return 'unknown';
  }
}

/**
 * Generate TypeScript interface for a command
 */
function generateCommandInterface(action: string): string {
  const schema = getCommandSchema(action);
  if (!schema) return '';

  const interfaceName = `${action.charAt(0).toUpperCase()}${action.slice(1)}Command`;
  const lines: string[] = [];

  lines.push(`interface ${interfaceName} {`);
  lines.push(`  action: '${action}';`);

  for (const param of schema.parameters) {
    const optional = param.required ? '' : '?';
    const type = toTypeScriptType(param.type, param.enum);
    lines.push(`  /** ${param.description} */`);
    lines.push(`  ${param.name}${optional}: ${type};`);
  }

  lines.push(`}`);

  return lines.join('\n');
}

/**
 * Generate TypeScript interface for command response
 */
function generateResponseInterface(action: string): string {
  const schema = getCommandSchema(action);
  if (!schema) return '';

  const interfaceName = `${action.charAt(0).toUpperCase()}${action.slice(1)}Response`;

  return `interface ${interfaceName} {
  success: true;
  id: string;
  data: {
    /** ${schema.returns.description} */
    ${JSON.stringify(schema.returns.example, null, 2).replace(/\n/g, '\n    ')}
  };
}`;
}

/**
 * Get all TypeScript interfaces as a string
 */
export function getTypeScriptInterfaces(): string {
  const lines: string[] = [
    '// Browser Tool Calling Protocol - TypeScript Interfaces',
    '// Auto-generated type definitions for AI agent code generation',
    '',
    '// Base types',
    'interface BaseCommand {',
    '  id: string;',
    '  action: string;',
    '  /** Set to true to get help instead of executing */',
    '  help?: boolean;',
    '}',
    '',
    'interface SuccessResponse<T = unknown> {',
    '  success: true;',
    '  id: string;',
    '  data: T;',
    '}',
    '',
    'interface ErrorResponse {',
    '  success: false;',
    '  id: string;',
    '  error: string;',
    '}',
    '',
    'type Response<T = unknown> = SuccessResponse<T> | ErrorResponse;',
    '',
    '// Command interfaces',
  ];

  // Generate interfaces for key commands
  const keyActions = [
    'snapshot',
    'click',
    'type',
    'fill',
    'press',
    'hover',
    'scroll',
    'wait',
    'waitForSelector',
    'evaluate',
    'getAttribute',
    'getText',
    'isVisible',
    'screenshot',
  ];

  for (const action of keyActions) {
    const iface = generateCommandInterface(action);
    if (iface) {
      lines.push('');
      lines.push(iface);
    }
  }

  // Union type
  lines.push('');
  lines.push('// Union of all commands');
  lines.push(
    `type Command = ${keyActions
      .map((a) => `${a.charAt(0).toUpperCase()}${a.slice(1)}Command`)
      .join(' | ')};`
  );

  return lines.join('\n');
}

/**
 * Get function signatures for the BrowserAgent class
 */
export function getFunctionSignatures(): FunctionSignature[] {
  const signatures: FunctionSignature[] = [];

  // Core execute method
  signatures.push({
    name: 'execute',
    description: 'Execute any command and return a response',
    params: [
      {
        name: 'command',
        type: 'Command',
        required: true,
        description: 'The command object to execute',
      },
    ],
    returns: {
      type: 'Promise<Response>',
      description: 'Response with success status and data or error',
    },
    async: true,
    example: `await agent.execute({ id: '1', action: 'click', selector: '@e1' })`,
  });

  // Snapshot
  signatures.push({
    name: 'snapshot',
    description: 'Get accessibility tree snapshot of the page with element refs',
    params: [
      {
        name: 'options',
        type: '{ selector?: string; interactive?: boolean; maxDepth?: number; compact?: boolean }',
        required: false,
        description: 'Snapshot options',
      },
    ],
    returns: {
      type: 'Promise<{ snapshot: string; refs: Record<string, { role: string; name?: string }> }>',
      description: 'Accessibility tree and element reference map',
    },
    async: true,
    example: `const { snapshot, refs } = await agent.snapshot()`,
  });

  // Click
  signatures.push({
    name: 'click',
    description: 'Click an element by ref or selector',
    params: [
      {
        name: 'selector',
        type: 'string',
        required: true,
        description: 'Element ref (@e1) or CSS selector',
      },
      {
        name: 'options',
        type: "{ button?: 'left' | 'right' | 'middle' }",
        required: false,
        description: 'Click options',
      },
    ],
    returns: {
      type: 'Promise<void>',
      description: 'Resolves on success, throws on error',
    },
    async: true,
    example: `await agent.click('@e1')`,
  });

  // Type
  signatures.push({
    name: 'type',
    description: 'Type text into an input element with keyboard events',
    params: [
      {
        name: 'selector',
        type: 'string',
        required: true,
        description: 'Element ref or CSS selector',
      },
      {
        name: 'text',
        type: 'string',
        required: true,
        description: 'Text to type',
      },
      {
        name: 'options',
        type: '{ delay?: number; clear?: boolean }',
        required: false,
        description: 'Typing options',
      },
    ],
    returns: {
      type: 'Promise<void>',
      description: 'Resolves on success',
    },
    async: true,
    example: `await agent.type('@e2', 'hello@example.com')`,
  });

  // Fill
  signatures.push({
    name: 'fill',
    description: 'Fill an input element instantly (no keystroke events)',
    params: [
      {
        name: 'selector',
        type: 'string',
        required: true,
        description: 'Element ref or CSS selector',
      },
      {
        name: 'value',
        type: 'string',
        required: true,
        description: 'Value to fill',
      },
    ],
    returns: {
      type: 'Promise<void>',
      description: 'Resolves on success',
    },
    async: true,
    example: `await agent.fill('#email', 'user@example.com')`,
  });

  // Press
  signatures.push({
    name: 'press',
    description: 'Press a keyboard key',
    params: [
      {
        name: 'key',
        type: 'string',
        required: true,
        description: 'Key to press (Enter, Tab, Escape, etc.)',
      },
      {
        name: 'selector',
        type: 'string',
        required: false,
        description: 'Target element (defaults to active element)',
      },
    ],
    returns: {
      type: 'Promise<void>',
      description: 'Resolves on success',
    },
    async: true,
    example: `await agent.press('Enter')`,
  });

  // Hover
  signatures.push({
    name: 'hover',
    description: 'Hover over an element',
    params: [
      {
        name: 'selector',
        type: 'string',
        required: true,
        description: 'Element ref or CSS selector',
      },
    ],
    returns: {
      type: 'Promise<void>',
      description: 'Resolves on success',
    },
    async: true,
    example: `await agent.hover('@e3')`,
  });

  // WaitFor
  signatures.push({
    name: 'waitFor',
    description: 'Wait for an element to appear',
    params: [
      {
        name: 'selector',
        type: 'string',
        required: true,
        description: 'CSS selector to wait for',
      },
      {
        name: 'options',
        type: "{ timeout?: number; state?: 'visible' | 'hidden' }",
        required: false,
        description: 'Wait options',
      },
    ],
    returns: {
      type: 'Promise<void>',
      description: 'Resolves when element appears',
    },
    async: true,
    example: `await agent.waitFor('#results', { timeout: 5000 })`,
  });

  // Evaluate
  signatures.push({
    name: 'evaluate',
    description: 'Execute JavaScript and return result',
    params: [
      {
        name: 'script',
        type: 'string',
        required: true,
        description: 'JavaScript expression to evaluate',
      },
    ],
    returns: {
      type: 'Promise<T>',
      description: 'Result of the expression',
    },
    async: true,
    example: `const title = await agent.evaluate<string>('document.title')`,
  });

  // getText
  signatures.push({
    name: 'getText',
    description: 'Get text content of an element',
    params: [
      {
        name: 'selector',
        type: 'string',
        required: true,
        description: 'Element ref or CSS selector',
      },
    ],
    returns: {
      type: 'Promise<string | null>',
      description: 'Text content',
    },
    async: true,
    example: `const text = await agent.getText('h1')`,
  });

  // getAttribute
  signatures.push({
    name: 'getAttribute',
    description: 'Get attribute value of an element',
    params: [
      {
        name: 'selector',
        type: 'string',
        required: true,
        description: 'Element ref or CSS selector',
      },
      {
        name: 'attribute',
        type: 'string',
        required: true,
        description: 'Attribute name',
      },
    ],
    returns: {
      type: 'Promise<string | null>',
      description: 'Attribute value',
    },
    async: true,
    example: `const href = await agent.getAttribute('@e1', 'href')`,
  });

  // isVisible
  signatures.push({
    name: 'isVisible',
    description: 'Check if element is visible',
    params: [
      {
        name: 'selector',
        type: 'string',
        required: true,
        description: 'Element ref or CSS selector',
      },
    ],
    returns: {
      type: 'Promise<boolean>',
      description: 'True if visible',
    },
    async: true,
    example: `const visible = await agent.isVisible('#modal')`,
  });

  // getUrl
  signatures.push({
    name: 'getUrl',
    description: 'Get current page URL',
    params: [],
    returns: {
      type: 'Promise<string>',
      description: 'Current URL',
    },
    async: true,
    example: `const url = await agent.getUrl()`,
  });

  // getTitle
  signatures.push({
    name: 'getTitle',
    description: 'Get current page title',
    params: [],
    returns: {
      type: 'Promise<string>',
      description: 'Page title',
    },
    async: true,
    example: `const title = await agent.getTitle()`,
  });

  // Self-description method
  signatures.push({
    name: 'describe',
    description: 'Get API documentation (single unified function)',
    params: [
      {
        name: 'action',
        type: 'string',
        required: false,
        description: 'Optional action name for specific documentation',
      },
    ],
    returns: {
      type: 'Description',
      description: 'Complete description object with agent info, actions, methods, selectors, workflow, and quickRef',
    },
    async: false,
    example: `const info = agent.describe(); // Full API\nconst clickInfo = agent.describe('click'); // Specific action`,
  });

  return signatures;
}

/**
 * Generate callable metadata for AI code generation
 */
export interface CallableFunction {
  name: string;
  signature: string;
  jsdoc: string;
  example: string;
}

/**
 * Get callable function definitions
 */
export function getCallableFunctions(): CallableFunction[] {
  const signatures = getFunctionSignatures();

  return signatures.map((sig) => {
    const params = sig.params
      .map((p) => `${p.name}${p.required ? '' : '?'}: ${p.type}`)
      .join(', ');

    const signature = sig.async
      ? `async ${sig.name}(${params}): ${sig.returns.type}`
      : `${sig.name}(${params}): ${sig.returns.type}`;

    const paramDocs = sig.params
      .map((p) => ` * @param ${p.name} ${p.description}`)
      .join('\n');

    const jsdoc = `/**
 * ${sig.description}
${paramDocs}
 * @returns ${sig.returns.description}
 * @example ${sig.example}
 */`;

    return {
      name: sig.name,
      signature,
      jsdoc,
      example: sig.example,
    };
  });
}

/**
 * Get complete interface definition for AI agents
 */
export function getInterfaces(): InterfaceDefinition {
  const typescript = getTypeScriptInterfaces();
  const functions = getFunctionSignatures();

  const usage = `// Browser Agent Usage Guide

// 1. Create agent instance
const agent = new BrowserAgent();

// 2. Take a snapshot to see page structure
const { snapshot, refs } = await agent.snapshot();
// snapshot contains accessibility tree text
// refs contains { e1: { role: 'button', name: 'Submit' }, ... }

// 3. Interact using refs from snapshot
await agent.click('@e1');           // Click by ref
await agent.click('#submit');       // Or by CSS selector

// 4. Fill forms
await agent.fill('@e2', 'email@example.com');
await agent.type('@e3', 'password', { clear: true });

// 5. Press keys
await agent.press('Enter');
await agent.press('Tab');

// 6. Wait for elements
await agent.waitFor('#results');

// 7. Get information
const text = await agent.getText('h1');
const href = await agent.getAttribute('@e1', 'href');
const visible = await agent.isVisible('#modal');

// 8. Execute arbitrary JavaScript
const count = await agent.evaluate<number>('document.querySelectorAll("button").length');

// 9. Get help using describe()
const info = agent.describe();           // Full API documentation
const clickInfo = agent.describe('click'); // Action-specific help

// 10. Or use inline help with commands
const helpResponse = await agent.execute({ id: '1', action: 'click', help: true });
`;

  return {
    typescript,
    functions,
    usage,
  };
}

/**
 * Get a compact JSON representation for AI context
 */
export function getCompactInterface(): {
  actions: string[];
  methods: Array<{ name: string; signature: string; example: string }>;
  selectorFormats: string[];
  workflow: string[];
} {
  return {
    actions: getAvailableActions(),
    methods: getCallableFunctions().map((f) => ({
      name: f.name,
      signature: f.signature,
      example: f.example,
    })),
    selectorFormats: [
      '@e1, e1     - Element ref from snapshot (preferred)',
      '#id        - CSS ID selector',
      '.class     - CSS class selector',
      '[attr=val] - CSS attribute selector',
    ],
    workflow: [
      '1. snapshot() → get page structure and refs',
      '2. click/fill/type → interact using refs',
      '3. waitFor() → wait for dynamic content',
      '4. snapshot() → refresh view after changes',
    ],
  };
}

/**
 * Format interface as a single string for AI context injection
 */
export function getInterfaceString(): string {
  const compact = getCompactInterface();
  const functions = getCallableFunctions();

  const lines: string[] = [
    '=== BROWSER AGENT INTERFACE ===',
    '',
    'AVAILABLE METHODS:',
    ...functions.map((f) => `  ${f.signature}`),
    '',
    'SELECTOR FORMATS:',
    ...compact.selectorFormats.map((s) => `  ${s}`),
    '',
    'TYPICAL WORKFLOW:',
    ...compact.workflow.map((w) => `  ${w}`),
    '',
    'QUICK EXAMPLES:',
    '  const { snapshot, refs } = await agent.snapshot();',
    '  await agent.click("@e1");',
    '  await agent.fill("@e2", "value");',
    '  await agent.press("Enter");',
    '  await agent.waitFor("#results");',
    '',
    'GET HELP:',
    '  agent.describe()                // Full API documentation',
    '  agent.describe("click")         // Action-specific help',
    '  { action: "click", help: true } // Inline help',
  ];

  return lines.join('\n');
}
