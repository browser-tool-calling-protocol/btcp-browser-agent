/**
 * @btcp/cli - Command parser
 *
 * Parses CLI input strings into structured commands.
 */

import type { ParsedCommand } from './types.js';
import { ParseError } from './errors.js';

/**
 * Parse a CLI input string into a structured command
 *
 * @example
 * parseCommand('goto https://example.com')
 * // { name: 'goto', args: ['https://example.com'], flags: {}, raw: '...' }
 *
 * @example
 * parseCommand('click @ref:5 --wait 1000')
 * // { name: 'click', args: ['@ref:5'], flags: { wait: '1000' }, raw: '...' }
 *
 * @example
 * parseCommand('type @ref:1 "hello world"')
 * // { name: 'type', args: ['@ref:1', 'hello world'], flags: {}, raw: '...' }
 */
export function parseCommand(input: string): ParsedCommand {
  const raw = input;
  const trimmed = input.trim();

  if (!trimmed) {
    throw new ParseError('Empty command');
  }

  const tokens = tokenize(trimmed);

  if (tokens.length === 0) {
    throw new ParseError('Empty command');
  }

  const name = tokens[0].toLowerCase();
  const { args, flags } = parseArgs(tokens.slice(1));

  return { name, args, flags, raw };
}

/**
 * Tokenize input string, handling quoted strings
 */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuote: string | null = null;
  let escapeNext = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (escapeNext) {
      current += char;
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (inQuote) {
      if (char === inQuote) {
        // End of quoted string
        inQuote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      // Start of quoted string
      inQuote = char;
      continue;
    }

    if (char === ' ' || char === '\t') {
      // Whitespace - end current token
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  // Handle unterminated quote
  if (inQuote) {
    throw new ParseError(`Unterminated ${inQuote === '"' ? 'double' : 'single'} quote`);
  }

  // Add final token
  if (current) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Parse tokens into args and flags
 */
function parseArgs(tokens: string[]): { args: string[]; flags: Record<string, string | boolean> } {
  const args: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.startsWith('--')) {
      // Long flag
      const flagContent = token.slice(2);

      if (flagContent.includes('=')) {
        // --flag=value format
        const [key, ...valueParts] = flagContent.split('=');
        flags[key] = valueParts.join('=');
      } else if (i + 1 < tokens.length && !tokens[i + 1].startsWith('-')) {
        // --flag value format
        flags[flagContent] = tokens[++i];
      } else {
        // Boolean flag
        flags[flagContent] = true;
      }
    } else if (token.startsWith('-') && token.length === 2) {
      // Short flag (e.g., -v)
      const flagChar = token[1];

      if (i + 1 < tokens.length && !tokens[i + 1].startsWith('-')) {
        // -f value format
        flags[flagChar] = tokens[++i];
      } else {
        // Boolean flag
        flags[flagChar] = true;
      }
    } else {
      // Positional argument
      args.push(token);
    }
  }

  return { args, flags };
}

/**
 * Get flag value as string
 */
export function getFlagString(
  flags: Record<string, string | boolean>,
  name: string,
  defaultValue?: string
): string | undefined {
  const value = flags[name];
  if (value === undefined) return defaultValue;
  if (typeof value === 'boolean') return defaultValue;
  return value;
}

/**
 * Get flag value as number
 */
export function getFlagNumber(
  flags: Record<string, string | boolean>,
  name: string,
  defaultValue?: number
): number | undefined {
  const value = flags[name];
  if (value === undefined) return defaultValue;
  if (typeof value === 'boolean') return defaultValue;
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

/**
 * Get flag value as boolean
 */
export function getFlagBool(
  flags: Record<string, string | boolean>,
  name: string,
  defaultValue = false
): boolean {
  const value = flags[name];
  if (value === undefined) return defaultValue;
  if (typeof value === 'boolean') return value;
  return value.toLowerCase() === 'true' || value === '1';
}
