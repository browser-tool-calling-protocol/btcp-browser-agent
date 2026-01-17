/**
 * @btcp/core - Type definitions
 *
 * Core types for DOM automation commands and responses.
 */

// Command types - what the core package can handle
export type CoreAction =
  // Element interaction
  | 'click'
  | 'dblclick'
  | 'type'
  | 'fill'
  | 'clear'
  | 'check'
  | 'uncheck'
  | 'select'
  | 'focus'
  | 'blur'
  | 'hover'
  | 'scroll'
  | 'scrollIntoView'
  // DOM reading
  | 'snapshot'
  | 'querySelector'
  | 'querySelectorAll'
  | 'getText'
  | 'getAttribute'
  | 'getProperty'
  | 'getBoundingBox'
  | 'isVisible'
  | 'isEnabled'
  | 'isChecked'
  // Keyboard/Mouse
  | 'press'
  | 'keyDown'
  | 'keyUp'
  // Utility
  | 'wait'
  | 'evaluate'
  // Validation
  | 'validateElement'
  | 'validateRefs';

// Base command structure
export interface BaseCommand {
  id: string;
  action: CoreAction;
}

// Element selector - supports CSS, ref, or semantic selectors
export type Selector = string;

// Command definitions
export interface ClickCommand extends BaseCommand {
  action: 'click';
  selector: Selector;
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
  modifiers?: Modifier[];
}

export interface DblClickCommand extends BaseCommand {
  action: 'dblclick';
  selector: Selector;
}

export interface TypeCommand extends BaseCommand {
  action: 'type';
  selector: Selector;
  text: string;
  delay?: number;
  clear?: boolean;
}

export interface FillCommand extends BaseCommand {
  action: 'fill';
  selector: Selector;
  value: string;
}

export interface ClearCommand extends BaseCommand {
  action: 'clear';
  selector: Selector;
}

export interface CheckCommand extends BaseCommand {
  action: 'check';
  selector: Selector;
}

export interface UncheckCommand extends BaseCommand {
  action: 'uncheck';
  selector: Selector;
}

export interface SelectCommand extends BaseCommand {
  action: 'select';
  selector: Selector;
  values: string | string[];
}

export interface FocusCommand extends BaseCommand {
  action: 'focus';
  selector: Selector;
}

export interface BlurCommand extends BaseCommand {
  action: 'blur';
  selector: Selector;
}

export interface HoverCommand extends BaseCommand {
  action: 'hover';
  selector: Selector;
}

export interface ScrollCommand extends BaseCommand {
  action: 'scroll';
  selector?: Selector;
  x?: number;
  y?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  amount?: number;
}

export interface ScrollIntoViewCommand extends BaseCommand {
  action: 'scrollIntoView';
  selector: Selector;
  block?: 'start' | 'center' | 'end' | 'nearest';
}

/**
 * Grep options for filtering snapshot output (mirrors Unix grep flags)
 */
export interface GrepOptions {
  /** Pattern to search for (regex by default) */
  pattern: string;
  /** Case-insensitive matching (grep -i) */
  ignoreCase?: boolean;
  /** Invert match - return non-matching lines (grep -v) */
  invert?: boolean;
  /** Treat pattern as fixed string, not regex (grep -F) */
  fixedStrings?: boolean;
}

export interface SnapshotCommand extends BaseCommand {
  action: 'snapshot';
  selector?: Selector;
  maxDepth?: number;
  includeHidden?: boolean;
  interactive?: boolean;
  compact?: boolean;
  minDepth?: number;
  samplingStrategy?: 'importance' | 'balanced' | 'depth-first';
  contentPreview?: boolean;
  landmarks?: boolean;
  incremental?: boolean;
  baseSnapshot?: SnapshotData;
  all?: boolean;
  /** Filter output lines - simple string or full grep options */
  grep?: string | GrepOptions;
}

export interface QuerySelectorCommand extends BaseCommand {
  action: 'querySelector';
  selector: Selector;
}

export interface QuerySelectorAllCommand extends BaseCommand {
  action: 'querySelectorAll';
  selector: Selector;
}

export interface GetTextCommand extends BaseCommand {
  action: 'getText';
  selector: Selector;
}

export interface GetAttributeCommand extends BaseCommand {
  action: 'getAttribute';
  selector: Selector;
  attribute: string;
}

export interface GetPropertyCommand extends BaseCommand {
  action: 'getProperty';
  selector: Selector;
  property: string;
}

export interface GetBoundingBoxCommand extends BaseCommand {
  action: 'getBoundingBox';
  selector: Selector;
}

export interface IsVisibleCommand extends BaseCommand {
  action: 'isVisible';
  selector: Selector;
}

export interface IsEnabledCommand extends BaseCommand {
  action: 'isEnabled';
  selector: Selector;
}

export interface IsCheckedCommand extends BaseCommand {
  action: 'isChecked';
  selector: Selector;
}

export interface PressCommand extends BaseCommand {
  action: 'press';
  key: string;
  selector?: Selector;
  modifiers?: Modifier[];
}

export interface KeyDownCommand extends BaseCommand {
  action: 'keyDown';
  key: string;
}

export interface KeyUpCommand extends BaseCommand {
  action: 'keyUp';
  key: string;
}

export interface WaitCommand extends BaseCommand {
  action: 'wait';
  selector?: Selector;
  state?: 'visible' | 'hidden' | 'attached' | 'detached';
  timeout?: number;
}

export interface EvaluateCommand extends BaseCommand {
  action: 'evaluate';
  script: string;
  args?: unknown[];
}

/**
 * Validate element capabilities before attempting an action
 *
 * Allows AI agents to check element compatibility and get actionable feedback
 * before executing commands that might fail.
 *
 * @example Pre-validate before typing
 * ```typescript
 * const validation = await agent.execute({
 *   id: 'v1',
 *   action: 'validateElement',
 *   selector: '#username',
 *   capabilities: ['editable']
 * });
 *
 * if (validation.data.compatible) {
 *   await agent.execute({
 *     id: 'a1',
 *     action: 'type',
 *     selector: '#username',
 *     text: 'user@example.com'
 *   });
 * } else {
 *   console.log(validation.data.suggestion);
 * }
 * ```
 */
export interface ValidateElementCommand extends BaseCommand {
  action: 'validateElement';

  /** Element selector to validate */
  selector: Selector;

  /** Expected element type (optional) */
  expectedType?: 'input' | 'textarea' | 'button' | 'link' | 'select';

  /** Required capabilities (optional) */
  capabilities?: Array<'clickable' | 'editable' | 'checkable' | 'hoverable'>;
}

/**
 * Validate that refs are still valid
 *
 * Checks if refs from a previous snapshot are still valid or have expired.
 * Helps AI agents avoid using stale refs.
 *
 * @example Check ref validity
 * ```typescript
 * const validation = await agent.execute({
 *   id: 'v1',
 *   action: 'validateRefs',
 *   refs: ['@ref:0', '@ref:1', '@ref:2']
 * });
 *
 * // Use only valid refs
 * for (const ref of validation.data.valid) {
 *   await agent.execute({ id: '...', action: 'click', selector: ref });
 * }
 *
 * // Handle invalid refs
 * if (validation.data.invalid.length > 0) {
 *   // Take new snapshot to get fresh refs
 *   await agent.execute({ id: '...', action: 'snapshot' });
 * }
 * ```
 */
export interface ValidateRefsCommand extends BaseCommand {
  action: 'validateRefs';

  /** List of refs to validate */
  refs: string[];
}

export type Modifier = 'Alt' | 'Control' | 'Meta' | 'Shift';

// Union of all commands
export type Command =
  | ClickCommand
  | DblClickCommand
  | TypeCommand
  | FillCommand
  | ClearCommand
  | CheckCommand
  | UncheckCommand
  | SelectCommand
  | FocusCommand
  | BlurCommand
  | HoverCommand
  | ScrollCommand
  | ScrollIntoViewCommand
  | SnapshotCommand
  | QuerySelectorCommand
  | QuerySelectorAllCommand
  | GetTextCommand
  | GetAttributeCommand
  | GetPropertyCommand
  | GetBoundingBoxCommand
  | IsVisibleCommand
  | IsEnabledCommand
  | IsCheckedCommand
  | PressCommand
  | KeyDownCommand
  | KeyUpCommand
  | WaitCommand
  | EvaluateCommand
  | ValidateElementCommand
  | ValidateRefsCommand;

// Response types
export interface SuccessResponse<T = unknown> {
  id: string;
  success: true;
  data: T;
}

/**
 * Error response with structured data for AI agents
 *
 * Includes both human-readable error messages and machine-readable
 * error codes, context, and recovery suggestions.
 */
export interface ErrorResponse {
  id: string;
  success: false;

  /** Human-readable error message */
  error: string;

  /** Machine-readable error code (optional) */
  errorCode?: string;

  /** Structured error context (optional) */
  errorContext?: {
    selector?: string;
    expectedType?: string;
    actualType?: string;
    elementState?: {
      attached: boolean;
      visible: boolean;
      enabled: boolean;
    };
    availableActions?: string[];
    similarSelectors?: Array<{
      selector: string;
      role: string;
      name: string;
    }>;
    nearbyElements?: Array<{
      ref: string;
      role: string;
      name: string;
    }>;
    [key: string]: any;
  };

  /** Actionable recovery suggestions (optional) */
  suggestions?: string[];
}

export type Response<T = unknown> = SuccessResponse<T> | ErrorResponse;

/**
 * Response data for validateElement command
 */
export interface ValidateElementResponse {
  /** Whether element is compatible with requested capabilities */
  compatible: boolean;

  /** Actual element role/tag */
  actualRole: string;

  /** Actual element type (for inputs) */
  actualType?: string;

  /** Capabilities this element supports */
  capabilities: string[];

  /** Current element state */
  state: {
    visible: boolean;
    enabled: boolean;
    attached: boolean;
  };

  /** Suggestion if not compatible */
  suggestion?: string;
}

/**
 * Response data for validateRefs command
 */
export interface ValidateRefsResponse {
  /** List of valid refs */
  valid: string[];

  /** List of invalid refs */
  invalid: string[];

  /** Reasons why each ref is invalid */
  reasons: Record<string, string>;
}

// Snapshot data
export interface SnapshotNode {
  role: string;
  name?: string;
  ref?: string;
  value?: string;
  checked?: boolean;
  disabled?: boolean;
  children?: SnapshotNode[];
}

export interface SnapshotData {
  tree: string;
  refs: Record<string, {
    selector: string;
    role: string;
    name?: string;
    bbox?: BoundingBox;
    inViewport?: boolean;
    importance?: 'primary' | 'secondary' | 'utility';
    context?: string;
  }>;
  metadata?: {
    totalInteractiveElements?: number;
    capturedElements?: number;
    quality?: 'high' | 'medium' | 'low';
    depthLimited?: boolean;
    warnings?: string[];
  };
}

// Bounding box
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Element reference map
export interface RefMap {
  get(ref: string): Element | null;
  set(ref: string, element: Element): void;
  clear(): void;
  generateRef(element: Element): string;
}
