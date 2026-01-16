/**
 * BTCP Browser Agent
 *
 * Browser automation with clean separation of concerns:
 * - ContentAgent (@btcp/core): DOM operations in content scripts
 * - BackgroundAgent (@btcp/extension): Tab management in background scripts
 * - Client: API for sending commands from popup/external scripts
 *
 * @example Extension usage
 * ```typescript
 * // background.ts
 * import { BackgroundAgent, setupMessageListener } from 'btcp-browser-agent/extension';
 * setupMessageListener();
 *
 * // content.ts
 * import { createContentAgent } from 'btcp-browser-agent/core';
 * const agent = createContentAgent();
 *
 * // popup.ts
 * import { createClient } from 'btcp-browser-agent/extension';
 * const client = createClient();
 * ```
 *
 * @example Standalone usage (no extension)
 * ```typescript
 * import { createContentAgent } from 'btcp-browser-agent';
 * const agent = createContentAgent();
 * await agent.execute({ id: '1', action: 'snapshot' });
 * ```
 */

// Re-export everything from core (for standalone usage)
export {
  createContentAgent,
  type ContentAgent,
  DOMActions,
  createSnapshot,
  createRefMap,
  createSimpleRefMap,
  type Command,
  type Response,
  type SnapshotData,
  type BoundingBox,
  type RefMap,
  type Modifier,
} from '../packages/core/dist/index.js';

// Re-export extension types and utilities
export type {
  ExtensionMessage,
  ExtensionResponse,
  TabInfo,
  ChromeTab,
  ExtensionCommand,
} from '../packages/extension/dist/index.js';

// Re-export extension functions
export {
  BackgroundAgent,
  getBackgroundAgent,
  setupMessageListener,
  createClient,
  type Client,
} from '../packages/extension/dist/index.js';
