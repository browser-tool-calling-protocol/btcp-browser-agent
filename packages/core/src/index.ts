/**
 * @aspect/core
 *
 * Core DOM actions for browser automation.
 * Runs in content script context (web page, extension content script, iframe).
 *
 * @example
 * ```typescript
 * import { createContentAgent } from '@aspect/core';
 *
 * const agent = createContentAgent(document, window);
 *
 * // Take a snapshot
 * const snapshot = await agent.execute({
 *   id: '1',
 *   action: 'snapshot'
 * });
 *
 * // Click an element
 * await agent.execute({
 *   id: '2',
 *   action: 'click',
 *   selector: '@ref:5'  // From snapshot
 * });
 * ```
 */

import { DOMActions } from './actions.js';
import { createRefMap, createSimpleRefMap } from './ref-map.js';
import type { Command, Response, RefMap } from './types.js';

export * from './types.js';
export { createSnapshot } from './snapshot.js';
export { createRefMap, createSimpleRefMap } from './ref-map.js';
export { DOMActions } from './actions.js';

/**
 * ContentAgent - DOM automation agent that runs in content script context
 *
 * This agent handles all DOM-level operations:
 * - Element interaction (click, type, fill, etc.)
 * - DOM queries (snapshot, getText, getAttribute, etc.)
 * - Keyboard/mouse events
 *
 * Use this in content scripts or directly in web pages.
 * For browser-level operations (tabs, navigation, screenshots),
 * use BrowserAgent from @aspect/extension.
 */
export interface ContentAgent {
  /**
   * Execute a command and return a response
   */
  execute(command: Command): Promise<Response>;

  /**
   * Execute a command from JSON string
   */
  executeJson(json: string): Promise<string>;

  /**
   * Get the element reference map
   */
  getRefMap(): RefMap;

  /**
   * Clear all element references
   */
  clearRefs(): void;
}

/**
 * Create a ContentAgent for DOM automation
 *
 * @param doc - The document to operate on (defaults to current document)
 * @param win - The window context (defaults to current window)
 * @returns A ContentAgent instance
 *
 * @example
 * ```typescript
 * // In content script
 * const agent = createContentAgent();
 *
 * // Take a snapshot of the page
 * const { data } = await agent.execute({ id: '1', action: 'snapshot' });
 *
 * // Click an element using ref from snapshot
 * await agent.execute({ id: '2', action: 'click', selector: '@ref:5' });
 * ```
 */
export function createContentAgent(doc: Document = document, win: Window = window): ContentAgent {
  // Use WeakRef-based map if available for better memory management
  const refMap = typeof WeakRef !== 'undefined'
    ? createRefMap()
    : createSimpleRefMap();

  const actions = new DOMActions(doc, win, refMap);

  return {
    async execute(command: Command): Promise<Response> {
      return actions.execute(command);
    },

    async executeJson(json: string): Promise<string> {
      try {
        const command = JSON.parse(json) as Command;
        const response = await actions.execute(command);
        return JSON.stringify(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return JSON.stringify({
          id: 'unknown',
          success: false,
          error: `Failed to parse command: ${message}`,
        });
      }
    },

    getRefMap(): RefMap {
      return refMap;
    },

    clearRefs(): void {
      refMap.clear();
    },
  };
}

/**
 * @deprecated Use createContentAgent instead
 */
export const createAgent = createContentAgent;

/**
 * @deprecated Use ContentAgent instead
 */
export type Agent = ContentAgent;

/**
 * Message types for extension communication
 */
export interface AgentMessage {
  type: 'aspect:command';
  command: Command;
}

export interface AgentResponse {
  type: 'aspect:response';
  response: Response;
}

/**
 * Install message listener for extension communication
 * Call this in your content script to enable command execution via postMessage
 *
 * @param agent - The agent instance
 * @returns Cleanup function to remove the listener
 */
export function installMessageListener(agent: Agent): () => void {
  const handler = async (event: MessageEvent) => {
    // Only accept messages from same window
    if (event.source !== window) return;

    const data = event.data as AgentMessage;
    if (data?.type !== 'aspect:command') return;

    const response = await agent.execute(data.command);

    window.postMessage({
      type: 'aspect:response',
      response,
    } satisfies AgentResponse, '*');
  };

  window.addEventListener('message', handler);

  return () => window.removeEventListener('message', handler);
}
