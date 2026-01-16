/**
 * @btcp/cli - Error classes with contextual feedback
 */

/**
 * Base CLI error with optional suggestions
 */
export class CLIError extends Error {
  /** Suggestions for fixing the error */
  public suggestions?: string[];
  /** Usage hint */
  public usage?: string;
  /** Related command */
  public command?: string;

  constructor(
    message: string,
    options?: {
      suggestions?: string[];
      usage?: string;
      command?: string;
    }
  ) {
    super(message);
    this.name = 'CLIError';
    this.suggestions = options?.suggestions;
    this.usage = options?.usage;
    this.command = options?.command;
  }

  /**
   * Format error with suggestions for display
   */
  toFormattedString(): string {
    let output = this.message;

    if (this.usage) {
      output += `\n\nUsage: ${this.usage}`;
    }

    if (this.suggestions && this.suggestions.length > 0) {
      output += '\n\nSuggestions:';
      for (const suggestion of this.suggestions) {
        output += `\n  - ${suggestion}`;
      }
    }

    return output;
  }
}

/**
 * Command not found error with similar command suggestions
 */
export class CommandNotFoundError extends CLIError {
  constructor(
    public readonly commandName: string,
    similarCommands?: string[]
  ) {
    const suggestions = similarCommands?.length
      ? similarCommands.map((cmd) => `Did you mean '${cmd}'?`)
      : ['Type "help" to see available commands'];

    super(`Unknown command: ${commandName}`, {
      suggestions,
      command: commandName,
    });
    this.name = 'CommandNotFoundError';
  }
}

/**
 * Invalid arguments error with usage hint
 */
export class InvalidArgumentsError extends CLIError {
  constructor(
    message: string,
    usage?: string,
    examples?: string[]
  ) {
    const suggestions = examples?.map((ex) => `Example: ${ex}`);
    super(message, { usage, suggestions });
    this.name = 'InvalidArgumentsError';
  }
}

/**
 * Parse error with syntax help
 */
export class ParseError extends CLIError {
  constructor(message: string, hint?: string) {
    const suggestions = hint ? [hint] : [
      'Commands should be: <command> [args] [--flags]',
      'Use quotes for text with spaces: type @ref:1 "hello world"',
    ];
    super(message, { suggestions });
    this.name = 'ParseError';
  }
}

/**
 * Execution error with recovery suggestions
 */
export class ExecutionError extends CLIError {
  constructor(
    message: string,
    options?: {
      suggestions?: string[];
      command?: string;
    }
  ) {
    super(message, options);
    this.name = 'ExecutionError';
  }
}

/**
 * Element not found error
 */
export class ElementNotFoundError extends CLIError {
  constructor(selector: string) {
    super(`Element not found: ${selector}`, {
      suggestions: [
        'Run "snapshot" to see available elements with @ref IDs',
        `Wait for element: wait ${selector} --state visible`,
        'Check if the element is inside an iframe',
      ],
    });
    this.name = 'ElementNotFoundError';
  }
}

/**
 * Navigation error
 */
export class NavigationError extends CLIError {
  constructor(url: string, reason?: string) {
    super(`Navigation failed: ${reason || url}`, {
      suggestions: [
        'Ensure URL includes protocol (https://)',
        'Check if the URL is accessible',
        'Try: goto https://example.com',
      ],
    });
    this.name = 'NavigationError';
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends CLIError {
  constructor(operation: string, selector?: string) {
    const suggestions = [
      'Increase wait time: wait 5000',
      'Check if element exists: snapshot',
    ];
    if (selector) {
      suggestions.push(`Wait for element: wait ${selector} --state visible`);
    }
    super(`Timeout: ${operation}`, { suggestions });
    this.name = 'TimeoutError';
  }
}
