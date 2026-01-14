/**
 * Browser Tool Calling Protocol - Unified Describe API
 *
 * Single function interface for AI agents to understand capabilities.
 */

import { AGENT_SCHEMA, getAvailableActions, getCommandSchema, suggestAction } from './schema.js';

/**
 * Description result returned by describe()
 */
export interface Description {
  /** Agent name and version */
  agent: {
    name: string;
    version: string;
    description: string;
  };

  /** List of all available actions */
  actions: string[];

  /** When querying a specific action, its details */
  action?: {
    name: string;
    description: string;
    parameters: Array<{
      name: string;
      type: string;
      required: boolean;
      description: string;
      default?: unknown;
    }>;
    returns: string;
    examples: Array<{
      description: string;
      code: string;
    }>;
    tips?: string[];
  };

  /** Suggestions when action not found */
  suggestions?: string[];

  /** Core methods with signatures */
  methods: Array<{
    name: string;
    signature: string;
    description: string;
    example: string;
  }>;

  /** Selector format reference */
  selectors: string[];

  /** Typical workflow */
  workflow: string[];

  /** Quick reference string (for context injection) */
  quickRef: string;
}

/**
 * Core method definitions
 */
const METHODS = [
  {
    name: 'snapshot',
    signature: 'snapshot(options?): Promise<{ snapshot: string, refs: Record<string, {role, name}> }>',
    description: 'Get accessibility tree with element refs',
    example: 'const { snapshot, refs } = await agent.snapshot()',
  },
  {
    name: 'click',
    signature: 'click(selector, options?): Promise<void>',
    description: 'Click element by ref (@e1) or CSS selector',
    example: 'await agent.click("@e1")',
  },
  {
    name: 'type',
    signature: 'type(selector, text, options?): Promise<void>',
    description: 'Type text with keyboard events',
    example: 'await agent.type("@e2", "hello")',
  },
  {
    name: 'fill',
    signature: 'fill(selector, value): Promise<void>',
    description: 'Set input value instantly',
    example: 'await agent.fill("#email", "user@example.com")',
  },
  {
    name: 'press',
    signature: 'press(key, selector?): Promise<void>',
    description: 'Press keyboard key',
    example: 'await agent.press("Enter")',
  },
  {
    name: 'hover',
    signature: 'hover(selector): Promise<void>',
    description: 'Hover over element',
    example: 'await agent.hover("@e3")',
  },
  {
    name: 'waitFor',
    signature: 'waitFor(selector, options?): Promise<void>',
    description: 'Wait for element to appear',
    example: 'await agent.waitFor("#results")',
  },
  {
    name: 'evaluate',
    signature: 'evaluate<T>(script): Promise<T>',
    description: 'Execute JavaScript',
    example: 'const count = await agent.evaluate("document.querySelectorAll(\"button\").length")',
  },
  {
    name: 'getText',
    signature: 'getText(selector): Promise<string | null>',
    description: 'Get element text content',
    example: 'const text = await agent.getText("h1")',
  },
  {
    name: 'getAttribute',
    signature: 'getAttribute(selector, attr): Promise<string | null>',
    description: 'Get element attribute',
    example: 'const href = await agent.getAttribute("@e1", "href")',
  },
  {
    name: 'isVisible',
    signature: 'isVisible(selector): Promise<boolean>',
    description: 'Check element visibility',
    example: 'const visible = await agent.isVisible("#modal")',
  },
  {
    name: 'execute',
    signature: 'execute(command): Promise<Response>',
    description: 'Execute raw command object',
    example: 'await agent.execute({ id: "1", action: "click", selector: "@e1" })',
  },
  {
    name: 'describe',
    signature: 'describe(action?): Description',
    description: 'Get API documentation (this function)',
    example: 'const info = agent.describe("click")',
  },
];

const SELECTORS = [
  '@e1, e1  → Element ref from snapshot (preferred, stable)',
  '#id      → CSS ID selector',
  '.class   → CSS class selector',
  '[attr]   → CSS attribute selector',
  'tag      → CSS tag selector',
];

const WORKFLOW = [
  '1. agent.snapshot() → Get page structure, receive refs (e1, e2, ...)',
  '2. agent.click("@e1") / agent.fill("@e2", "value") → Interact using refs',
  '3. agent.waitFor("#new-element") → Wait for dynamic content',
  '4. agent.snapshot() → Refresh view after changes',
];

/**
 * Generate quick reference string for AI context
 */
function generateQuickRef(action?: string): string {
  const lines: string[] = [];

  if (action) {
    const schema = getCommandSchema(action);
    if (schema) {
      lines.push(`=== ${action.toUpperCase()} ===`);
      lines.push(schema.description);
      lines.push('');
      lines.push('Parameters:');
      for (const p of schema.parameters) {
        const req = p.required ? '(required)' : '(optional)';
        lines.push(`  ${p.name}: ${p.type} ${req} - ${p.description}`);
      }
      lines.push('');
      lines.push('Example:');
      lines.push(`  ${JSON.stringify(schema.examples[0]?.command)}`);
      if (schema.tips?.length) {
        lines.push('');
        lines.push('Tips:');
        for (const tip of schema.tips) {
          lines.push(`  - ${tip}`);
        }
      }
      return lines.join('\n');
    }
  }

  // Full quick reference
  lines.push('=== BROWSER AGENT ===');
  lines.push('');
  lines.push('Methods:');
  for (const m of METHODS.slice(0, 8)) {
    lines.push(`  ${m.signature}`);
  }
  lines.push('');
  lines.push('Selectors: @e1 (ref) | #id | .class | [attr] | tag');
  lines.push('');
  lines.push('Workflow:');
  lines.push('  snapshot() → click/fill(@ref) → waitFor() → snapshot()');
  lines.push('');
  lines.push('Help: agent.describe() or { action: "x", help: true }');

  return lines.join('\n');
}

/**
 * Single unified function to describe the agent's capabilities
 *
 * @param action Optional action name to get specific documentation
 * @returns Complete description object with all needed information
 *
 * @example
 * // Get full API description
 * const info = agent.describe();
 *
 * // Get specific action help
 * const clickInfo = agent.describe('click');
 *
 * // Quick context for AI
 * console.log(agent.describe().quickRef);
 */
export function describe(action?: string): Description {
  const result: Description = {
    agent: {
      name: AGENT_SCHEMA.name,
      version: AGENT_SCHEMA.version,
      description: AGENT_SCHEMA.description,
    },
    actions: getAvailableActions(),
    methods: METHODS,
    selectors: SELECTORS,
    workflow: WORKFLOW,
    quickRef: generateQuickRef(action),
  };

  // If specific action requested
  if (action) {
    const schema = getCommandSchema(action);
    if (schema) {
      result.action = {
        name: schema.action,
        description: schema.description,
        parameters: schema.parameters.map((p) => ({
          name: p.name,
          type: p.type,
          required: p.required,
          description: p.description,
          default: p.default,
        })),
        returns: schema.returns.description,
        examples: schema.examples.map((e) => ({
          description: e.description,
          code: JSON.stringify(e.command),
        })),
        tips: schema.tips,
      };
    } else {
      // Unknown action - provide suggestions
      result.suggestions = suggestAction(action);
    }
  }

  return result;
}
