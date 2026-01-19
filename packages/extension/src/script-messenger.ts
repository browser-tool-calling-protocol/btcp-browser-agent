/**
 * @btcp/extension - Script Messenger
 *
 * Type-safe message passing to injected scripts.
 *
 * @example
 * ```typescript
 * // Define message types
 * type HelperMessages = {
 *   getCount: { payload: { selector: string }; result: number };
 *   getData: { payload: { id: string }; result: { name: string; value: number } };
 * };
 *
 * // Create typed messenger
 * const helper = createScriptMessenger<HelperMessages>(client, { scriptId: 'helper' });
 *
 * // Use with full type safety
 * const count = await helper.send('getCount', { selector: '.item' });
 * //    ^? number
 * ```
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Message definition: maps action names to payload and result types
 */
export type MessageDefinitions = {
  [action: string]: {
    payload: unknown;
    result: unknown;
  };
};

/**
 * Extract payload type for a specific action
 */
export type PayloadOf<T extends MessageDefinitions, K extends keyof T> = T[K]['payload'];

/**
 * Extract result type for a specific action
 */
export type ResultOf<T extends MessageDefinitions, K extends keyof T> = T[K]['result'];

// ============================================================================
// Messenger Interface
// ============================================================================

/**
 * Options for creating a script messenger
 */
export interface ScriptMessengerOptions {
  /** Target script ID (default: 'default') */
  scriptId?: string;

  /** Timeout in milliseconds for each message (default: 30000) */
  timeout?: number;
}

/**
 * Script messenger for type-safe communication with injected scripts
 */
export interface ScriptMessenger<T extends MessageDefinitions> {
  /**
   * Send a message to the injected script
   *
   * @param action - The action name
   * @param payload - The payload to send
   * @returns The result from the script
   */
  send<K extends keyof T & string>(
    action: K,
    payload: PayloadOf<T, K>
  ): Promise<ResultOf<T, K>>;

  /**
   * The script ID this messenger communicates with
   */
  readonly scriptId: string;

  /**
   * The default timeout for messages
   */
  readonly timeout: number;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Client interface required by ScriptMessenger
 */
export interface MessengerClient {
  scriptSend(
    payload: unknown,
    options?: { scriptId?: string; timeout?: number }
  ): Promise<unknown>;
}

/**
 * Create a type-safe messenger for communicating with injected scripts
 *
 * @example
 * ```typescript
 * type Messages = {
 *   getCount: { payload: { selector: string }; result: number };
 *   fetchItems: { payload: { category: string }; result: Item[] };
 * };
 *
 * const messenger = createScriptMessenger<Messages>(client, {
 *   scriptId: 'helper',
 * });
 *
 * const count = await messenger.send('getCount', { selector: '.item' });
 * const items = await messenger.send('fetchItems', { category: 'books' });
 * ```
 */
export function createScriptMessenger<T extends MessageDefinitions>(
  client: MessengerClient,
  options: ScriptMessengerOptions = {}
): ScriptMessenger<T> {
  const scriptId = options.scriptId ?? 'default';
  const timeout = options.timeout ?? 30000;

  return {
    scriptId,
    timeout,

    async send(action, payload) {
      const messagePayload = { action, ...(payload as object) };
      const result = await client.scriptSend(messagePayload, { scriptId, timeout });
      return result as any;
    },
  };
}

// ============================================================================
// Convenience: Method-based messenger
// ============================================================================

/**
 * A messenger where each action is a method on the object
 *
 * @example
 * ```typescript
 * const helper = createMethodMessenger<{
 *   getCount: { payload: { selector: string }; result: number };
 * }>(client, { scriptId: 'helper' });
 *
 * const count = await helper.getCount({ selector: '.item' });
 * ```
 */
export type MethodMessenger<T extends MessageDefinitions> = {
  [K in keyof T & string]: (payload: PayloadOf<T, K>) => Promise<ResultOf<T, K>>;
} & {
  readonly scriptId: string;
  readonly timeout: number;
};

/**
 * Create a method-based messenger where each action is a method
 *
 * @example
 * ```typescript
 * type Messages = {
 *   getCount: { payload: { selector: string }; result: number };
 *   click: { payload: { ref: number }; result: void };
 * };
 *
 * const helper = createMethodMessenger<Messages>(client, { scriptId: 'helper' });
 *
 * const count = await helper.getCount({ selector: '.item' });
 * await helper.click({ ref: 5 });
 * ```
 */
export function createMethodMessenger<T extends MessageDefinitions>(
  client: MessengerClient,
  options: ScriptMessengerOptions = {}
): MethodMessenger<T> {
  const messenger = createScriptMessenger<T>(client, options);

  return new Proxy(
    {
      scriptId: messenger.scriptId,
      timeout: messenger.timeout,
    } as any,
    {
      get(target, prop) {
        if (prop === 'scriptId' || prop === 'timeout') {
          return target[prop];
        }

        if (typeof prop === 'string') {
          return (payload: unknown) => messenger.send(prop as any, payload as any);
        }

        return undefined;
      },
    }
  );
}
