/**
 * @btcp/cli - Error classes
 */

/**
 * Base CLI error
 */
export class CLIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CLIError';
  }
}

/**
 * Command not found error
 */
export class CommandNotFoundError extends CLIError {
  constructor(public readonly commandName: string) {
    super(`Unknown command: ${commandName}`);
    this.name = 'CommandNotFoundError';
  }
}

/**
 * Invalid arguments error
 */
export class InvalidArgumentsError extends CLIError {
  constructor(message: string, public readonly usage?: string) {
    super(message);
    this.name = 'InvalidArgumentsError';
  }
}

/**
 * Parse error
 */
export class ParseError extends CLIError {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

/**
 * Execution error (from BackgroundAgent)
 */
export class ExecutionError extends CLIError {
  constructor(message: string) {
    super(message);
    this.name = 'ExecutionError';
  }
}
