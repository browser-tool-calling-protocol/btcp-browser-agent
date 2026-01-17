/**
 * @btcp/grep
 *
 * Unix-like grep utility for searching text patterns.
 * Supports regex patterns like real grep.
 *
 * @example
 * ```typescript
 * import { grep } from '@btcp/grep';
 *
 * const text = `line one
 * line two
 * another line`;
 *
 * // String matching
 * grep('line', text);
 * // Returns: "line one\nline two\nanother line"
 *
 * // Regex matching
 * grep('line (one|two)', text);
 * // Returns: "line one\nline two"
 * ```
 */

/**
 * Search for a pattern in text and return matched lines
 *
 * @param pattern - Regex pattern to search for (like real grep)
 * @param text - Text to search in (can be multi-line)
 * @returns Matched lines joined by newlines
 *
 * @example
 * ```typescript
 * // Simple string (treated as regex)
 * grep('error', logText);
 *
 * // Regex patterns
 * grep('error|warn', logText);      // OR matching
 * grep('^ERROR', logText);          // Start of line
 * grep('failed$', logText);         // End of line
 * grep('user:\\d+', logText);       // Digits
 * grep('(?i)error', logText);       // Case insensitive
 * ```
 */
export function grep(pattern: string, text: string): string {
  const lines = text.split('\n');
  try {
    const regex = new RegExp(pattern);
    const matched = lines.filter((line) => regex.test(line));
    return matched.join('\n');
  } catch {
    // Invalid regex, fall back to literal string matching
    const matched = lines.filter((line) => line.includes(pattern));
    return matched.join('\n');
  }
}
