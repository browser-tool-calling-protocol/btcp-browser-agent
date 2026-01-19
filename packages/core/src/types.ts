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
  | 'validateRefs'
  // Visualization
  | 'highlight'
  | 'clearHighlight'
  // Content extraction
  | 'getPageContent'
  | 'getPageOutline';

// Base command structure (id is optional - auto-generated if not provided)
export interface BaseCommand {
  /** Optional command ID. Auto-generated if not provided. */
  id?: string;
  action: CoreAction;
}

// Internal command with required id (used after execute() adds it)
export interface InternalCommand {
  id: string;
  action: CoreAction;
  [key: string]: unknown;
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
  format?: 'tree' | 'html';
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
 *   action: 'validateElement',
 *   selector: '#username',
 *   capabilities: ['editable']
 * });
 *
 * if (validation.data.compatible) {
 *   await agent.execute({
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
 *   action: 'validateRefs',
 *   refs: ['@ref:0', '@ref:1', '@ref:2']
 * });
 *
 * // Use only valid refs
 * for (const ref of validation.data.valid) {
 *   await agent.execute({ action: 'click', selector: ref });
 * }
 *
 * // Handle invalid refs
 * if (validation.data.invalid.length > 0) {
 *   // Take new snapshot to get fresh refs
 *   await agent.execute({ action: 'snapshot' });
 * }
 * ```
 */
export interface ValidateRefsCommand extends BaseCommand {
  action: 'validateRefs';

  /** List of refs to validate */
  refs: string[];
}

/**
 * Display visual overlay labels for interactive elements
 *
 * Shows reference numbers (@ref:0, @ref:1, etc.) as overlay labels
 * positioned near each interactive element from the last snapshot.
 * Labels persist until explicitly cleared.
 *
 * @example Highlight elements after snapshot
 * ```typescript
 * // Take a snapshot first
 * await agent.execute({ action: 'snapshot' });
 *
 * // Show visual highlights
 * await agent.execute({ action: 'highlight' });
 *
 * // Labels now visible on page with @ref:0, @ref:1, etc.
 * // Use the refs to interact with elements
 * await agent.execute({ action: 'click', selector: '@ref:5' });
 *
 * // Clear highlights when done
 * await agent.execute({ action: 'clearHighlight' });
 * ```
 */
export interface HighlightCommand extends BaseCommand {
  action: 'highlight';
}

/**
 * Remove visual overlay labels
 *
 * Clears all highlight overlays from the page.
 *
 * @example Clear highlights
 * ```typescript
 * await agent.execute({ action: 'clearHighlight' });
 * ```
 */
export interface ClearHighlightCommand extends BaseCommand {
  action: 'clearHighlight';
}

/**
 * Extract readable page content for AI summarization
 *
 * Returns the page's readable text content organized by semantic structure,
 * optimized for AI agents to understand and summarize page content.
 *
 * @example Get page content for summarization
 * ```typescript
 * const result = await agent.execute({
 *   action: 'getPageContent',
 *   strategy: 'readability',
 *   maxLength: 5000,
 *   includeHeadings: true
 * });
 *
 * // result.data contains:
 * // - content: readable text
 * // - headings: heading hierarchy
 * // - landmarks: region summaries
 * // - stats: word/char counts
 * ```
 */
export interface GetPageContentCommand extends BaseCommand {
  action: 'getPageContent';

  /** Content extraction strategy */
  strategy?: 'readability' | 'full' | 'structured';

  /** Maximum content length in characters (default: 10000) */
  maxLength?: number;

  /** Include heading hierarchy (default: true) */
  includeHeadings?: boolean;

  /** Include landmark region summaries (default: true) */
  includeLandmarks?: boolean;

  /** Include metadata like title, description, etc. (default: true) */
  includeMetadata?: boolean;

  /** Extract from specific selector (default: document.body) */
  selector?: Selector;
}

/**
 * Heading info from page content extraction
 */
export interface HeadingInfo {
  level: number;
  text: string;
  /** Ref for drilling down into this section */
  ref?: string;
}

/**
 * Landmark region info for page outline
 */
export interface LandmarkInfo {
  role: string;
  label?: string;
  /** Brief preview of content (for outline mode) */
  preview?: string;
  /** Full summary of content (for content mode) */
  summary?: string;
  /** Ref for drilling down into this landmark */
  ref?: string;
  /** Estimated word count in this section */
  wordCount?: number;
}

/**
 * Section info for page outline
 */
export interface SectionInfo {
  /** Heading text */
  heading: string;
  /** Heading level (1-6) */
  level: number;
  /** Ref for drilling down into this section */
  ref: string;
  /** Brief preview of section content */
  preview: string;
  /** Estimated word count */
  wordCount: number;
  /** Nested subsections */
  subsections?: SectionInfo[];
}

/**
 * Response data for getPageContent command
 */
export interface PageContentResponse {
  /** Main readable text content */
  content: string;

  /** Page title */
  title: string;

  /** Meta description if available */
  description?: string;

  /** Heading hierarchy */
  headings: HeadingInfo[];

  /** Landmark region summaries */
  landmarks: LandmarkInfo[];

  /** Content statistics */
  stats: {
    words: number;
    chars: number;
    headings: number;
    paragraphs: number;
    links: number;
  };
}

/**
 * Get a lightweight page outline for AI-driven exploration
 *
 * Returns just the page structure without heavy content extraction,
 * allowing AI agents to decide which sections to drill into.
 *
 * @example Reactive summarization workflow
 * ```typescript
 * // Step 1: Get page outline
 * const outline = await agent.execute({ action: 'getPageOutline' });
 * // Returns structure with refs for each section
 *
 * // Step 2: AI decides which sections are relevant
 * // "I see a main article and sidebar. Let me extract the article."
 *
 * // Step 3: Drill into specific section
 * const article = await agent.execute({
 *   action: 'getPageContent',
 *   selector: '@ref:3'  // The main article section
 * });
 * ```
 */
export interface GetPageOutlineCommand extends BaseCommand {
  action: 'getPageOutline';

  /** Include section hierarchy with previews (default: true) */
  includeSections?: boolean;

  /** Include landmark regions (default: true) */
  includeLandmarks?: boolean;

  /** Maximum preview length per section (default: 100) */
  previewLength?: number;
}

/**
 * Response data for getPageOutline command
 */
export interface PageOutlineResponse {
  /** Page URL */
  url: string;

  /** Page title */
  title: string;

  /** Meta description */
  description?: string;

  /** Hierarchical section structure with refs */
  sections: SectionInfo[];

  /** Landmark regions with refs */
  landmarks: LandmarkInfo[];

  /** Overall page statistics */
  stats: {
    /** Estimated total word count */
    totalWords: number;
    /** Number of sections */
    sectionCount: number;
    /** Number of links */
    linkCount: number;
    /** Number of images */
    imageCount: number;
    /** Number of forms */
    formCount: number;
  };

  /** Suggested sections to read based on content density */
  suggestions?: string[];
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
  | ValidateRefsCommand
  | HighlightCommand
  | ClearHighlightCommand
  | GetPageContentCommand
  | GetPageOutlineCommand;

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
