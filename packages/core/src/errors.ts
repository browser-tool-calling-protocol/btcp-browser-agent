/**
 * Error handling utilities for BTCP Browser Agent
 *
 * Provides structured error types with machine-readable codes and
 * actionable suggestions to help AI agents self-correct.
 */

/**
 * Machine-readable error codes for programmatic error handling
 */
export enum ErrorCode {
  /** Element not found with given selector */
  ELEMENT_NOT_FOUND = 'ELEMENT_NOT_FOUND',

  /** Element exists but doesn't support the requested action */
  ELEMENT_NOT_COMPATIBLE = 'ELEMENT_NOT_COMPATIBLE',

  /** Ref ID has expired (cleared by new snapshot) */
  REF_EXPIRED = 'REF_EXPIRED',

  /** Invalid selector syntax or format */
  INVALID_SELECTOR = 'INVALID_SELECTOR',

  /** Operation timed out waiting for condition */
  TIMEOUT = 'TIMEOUT',

  /** Element exists but is not visible */
  ELEMENT_NOT_VISIBLE = 'ELEMENT_NOT_VISIBLE',

  /** Element exists but is disabled */
  ELEMENT_DISABLED = 'ELEMENT_DISABLED',

  /** Conflicting parameters provided to command */
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',

  /** Element is not in the expected state */
  INVALID_STATE = 'INVALID_STATE',

  /** Network or navigation error */
  NAVIGATION_ERROR = 'NAVIGATION_ERROR',
}

/**
 * Structured context information for errors
 */
export interface ErrorContext {
  /** The selector that was used */
  selector?: string;

  /** Expected element type or role */
  expectedType?: string;

  /** Actual element type or role found */
  actualType?: string;

  /** Current state of the element */
  elementState?: {
    attached: boolean;
    visible: boolean;
    enabled: boolean;
  };

  /** Actions available for this element */
  availableActions?: string[];

  /** Similar selectors that were found */
  similarSelectors?: Array<{
    selector: string;
    role: string;
    name: string;
    similarity?: number;
  }>;

  /** Nearby interactive elements */
  nearbyElements?: Array<{
    ref: string;
    role: string;
    name: string;
  }>;

  /** Additional context-specific data */
  [key: string]: any;
}

/**
 * Detailed error with structured data for AI agents
 *
 * Provides both human-readable messages and machine-readable
 * error codes, context, and recovery suggestions.
 *
 * @example
 * ```typescript
 * throw new DetailedError(
 *   ErrorCode.ELEMENT_NOT_FOUND,
 *   "Element not found: #submit-btn",
 *   {
 *     selector: "#submit-btn",
 *     similarSelectors: [
 *       { selector: "#submit-button", role: "button", name: "Submit" }
 *     ]
 *   },
 *   [
 *     "Try using selector: #submit-button",
 *     "Run snapshot({ interactive: true }) to see all clickable elements"
 *   ]
 * );
 * ```
 */
export class DetailedError extends Error {
  public readonly code: ErrorCode;
  public readonly context: ErrorContext;
  public readonly suggestions: string[];

  constructor(
    code: ErrorCode,
    message: string,
    context: ErrorContext = {},
    suggestions: string[] = []
  ) {
    // Build enhanced message with suggestions
    let fullMessage = message;

    if (suggestions.length > 0) {
      fullMessage += '\n\nSuggestions:';
      suggestions.forEach(suggestion => {
        fullMessage += `\n  - ${suggestion}`;
      });
    }

    super(fullMessage);
    this.name = 'DetailedError';
    this.code = code;
    this.context = context;
    this.suggestions = suggestions;
  }

  /**
   * Convert to structured object for API responses
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      suggestions: this.suggestions,
    };
  }
}

/**
 * Helper function to create element not found error with suggestions
 */
export function createElementNotFoundError(
  selector: string,
  options: {
    similarSelectors?: Array<{ selector: string; role: string; name: string }>;
    nearbyElements?: Array<{ ref: string; role: string; name: string }>;
    isRef?: boolean;
  } = {}
): DetailedError {
  const { similarSelectors = [], nearbyElements = [], isRef = false } = options;

  const suggestions: string[] = [];

  if (isRef) {
    suggestions.push(
      'Ref may have expired. Refs are cleared on snapshot() calls and page navigation.',
      'Call snapshot() again to get fresh refs.'
    );
  }

  if (similarSelectors.length > 0) {
    suggestions.push(
      `Similar selectors found: ${similarSelectors.map(s => s.selector).join(', ')}`
    );
  }

  if (nearbyElements.length > 0) {
    suggestions.push(
      'Run snapshot({ interactive: true }) to see all clickable elements'
    );
  }

  return new DetailedError(
    isRef ? ErrorCode.REF_EXPIRED : ErrorCode.ELEMENT_NOT_FOUND,
    `Element not found: ${selector}`,
    {
      selector,
      similarSelectors,
      nearbyElements,
    },
    suggestions
  );
}

/**
 * Helper function to create element not compatible error
 */
export function createElementNotCompatibleError(
  selector: string,
  action: string,
  actualType: string,
  expectedTypes: string[],
  availableActions: string[] = []
): DetailedError {
  const suggestions: string[] = [];

  if (availableActions.length > 0) {
    suggestions.push(
      `Available actions for ${actualType}: ${availableActions.join(', ')}`
    );
  }

  suggestions.push(
    `Use snapshot() to verify element type before attempting action`
  );

  return new DetailedError(
    ErrorCode.ELEMENT_NOT_COMPATIBLE,
    `Element ${selector} is ${actualType}, cannot perform action: ${action}`,
    {
      selector,
      actualType,
      expectedType: expectedTypes.join(' or '),
      availableActions,
    },
    suggestions
  );
}

/**
 * Helper function to create timeout error with state information
 */
export function createTimeoutError(
  selector: string | undefined,
  expectedState: string,
  currentState?: {
    attached: boolean;
    visible: boolean;
    enabled: boolean;
  }
): DetailedError {
  const suggestions: string[] = [];

  if (currentState) {
    if (currentState.attached && !currentState.visible && expectedState === 'visible') {
      suggestions.push(
        'Element is attached but not visible. Check CSS display/visibility properties.',
        'Try state="attached" if you just need element to exist in DOM.'
      );
    }

    if (currentState.attached && currentState.visible && !currentState.enabled && expectedState === 'enabled') {
      suggestions.push(
        'Element is visible but disabled. Check disabled attribute or aria-disabled.',
        'Wait for the condition that enables the element, or use force option if available.'
      );
    }
  }

  suggestions.push('Increase timeout value if element appears slowly.');

  const message = selector
    ? `Timeout waiting for ${selector} to be ${expectedState}`
    : `Timeout waiting for page to be ${expectedState}`;

  return new DetailedError(
    ErrorCode.TIMEOUT,
    message,
    {
      selector,
      expectedType: expectedState,
      elementState: currentState,
    },
    suggestions
  );
}

/**
 * Helper function to create invalid parameters error
 */
export function createInvalidParametersError(
  message: string,
  conflictingParams: string[],
  suggestion: string
): DetailedError {
  return new DetailedError(
    ErrorCode.INVALID_PARAMETERS,
    message,
    {
      conflictingParams,
    },
    [suggestion]
  );
}
