/**
 * @btcp/core - Snapshot Filter Utilities
 *
 * Filtering utilities including grep pattern matching and element visibility.
 * Single implementation replacing 4 duplicated copies (~200 lines saved).
 *
 * Grep defaults:
 * - Wildcard mode: `*` matches anything (converted to `.*`)
 * - Case-insensitive by default
 * - Matches against full element data (not just visible output)
 */

import { isVisible as checkElementVisibility } from './inspect.js';

// ============================================================================
// Grep Types
// ============================================================================

/**
 * Grep options (mirrors Unix grep flags)
 *
 * Defaults optimized for AI agent pattern matching:
 * - ignoreCase: true (case-insensitive by default)
 * - Wildcard support: `*` is converted to `.*` for glob-style matching
 */
export interface GrepOptions {
  /** Pattern to search for (supports * wildcard) */
  pattern: string;
  /** Case-insensitive matching - DEFAULT: true */
  ignoreCase?: boolean;
  /** Invert match - return non-matching lines (grep -v) */
  invert?: boolean;
  /** Treat pattern as fixed string, no wildcards or regex (grep -F) */
  fixedStrings?: boolean;
}

/**
 * Element search data for rich grep matching
 * Contains full element data (not truncated) for comprehensive search
 */
export interface ElementSearchData {
  element: Element;
  /** ARIA role */
  role: string;
  /** Accessible name (full, not truncated) */
  name: string;
  /** Full text content of element */
  fullText: string;
  /** All CSS classes */
  classes: string[];
  /** All HTML attributes as key=value pairs */
  attributes: Record<string, string>;
  /** Semantic xpath */
  xpath: string;
}

/**
 * Grep result with metadata
 */
export interface GrepResult<T> {
  /** Filtered items */
  items: T[];
  /** Pattern used for filtering */
  pattern: string;
  /** Number of matches */
  matchCount: number;
  /** Total items before filtering */
  totalCount: number;
}

// ============================================================================
// Wildcard Pattern Conversion
// ============================================================================

/**
 * Convert standalone `*` wildcards to regex `.*`
 *
 * Smart conversion that preserves existing regex patterns:
 * - Standalone `*` (not preceded by `.`) → `.*` (match anything)
 * - `.*` is preserved as-is (valid regex)
 * - Other regex patterns preserved (`.`, `[abc]`, `|`, `+`, `?`)
 *
 * This provides both glob-style wildcard convenience AND full regex support.
 *
 * @example
 * convertWildcards('submit*') → 'submit.*'     // glob-style wildcard
 * convertWildcards('*button') → '.*button'     // wildcard at start
 * convertWildcards('Submit.*') → 'Submit.*'    // regex preserved
 * convertWildcards('Button[12]') → 'Button[12]' // regex preserved
 */
function convertWildcards(pattern: string): string {
  // Convert standalone * (not preceded by .) to .*
  // This preserves existing .* patterns while supporting glob-style wildcards
  return pattern.replace(/(?<!\.)(\*)/g, '.*');
}

/**
 * Build regex from grep pattern with wildcard support
 *
 * @param pattern - Pattern string (may contain wildcards or regex)
 * @param fixedStrings - If true, treat as literal string (no wildcards/regex)
 * @returns Regex-ready pattern string
 */
function buildRegexPattern(pattern: string, fixedStrings: boolean): string {
  if (fixedStrings) {
    // Escape everything for literal matching
    return pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  // Convert glob-style wildcards while preserving regex patterns
  return convertWildcards(pattern);
}

// ============================================================================
// Grep Implementation
// ============================================================================

/**
 * Apply grep filter to lines
 *
 * Defaults to case-insensitive with wildcard support.
 *
 * @param lines - Array of strings to filter
 * @param grepPattern - String pattern or GrepOptions object
 * @returns Grep result with filtered lines and metadata
 */
export function grepLines(lines: string[], grepPattern: string | GrepOptions): GrepResult<string> {
  const grepOpts = typeof grepPattern === 'string'
    ? { pattern: grepPattern }
    : grepPattern;

  // DEFAULT: ignoreCase = true (case-insensitive by default)
  const { pattern, ignoreCase = true, invert = false, fixedStrings = false } = grepOpts;

  const regexPattern = buildRegexPattern(pattern, fixedStrings);
  const flags = ignoreCase ? 'i' : '';

  let filteredLines: string[];

  try {
    const regex = new RegExp(regexPattern, flags);
    filteredLines = lines.filter(line => {
      const matches = regex.test(line);
      return invert ? !matches : matches;
    });
  } catch {
    // Invalid regex, fall back to simple string matching
    filteredLines = lines.filter(line => {
      const matches = ignoreCase
        ? line.toLowerCase().includes(pattern.toLowerCase())
        : line.includes(pattern);
      return invert ? !matches : matches;
    });
  }

  return {
    items: filteredLines,
    pattern,
    matchCount: filteredLines.length,
    totalCount: lines.length,
  };
}

/**
 * Apply grep filter to an array of objects by extracting a string field
 *
 * Defaults to case-insensitive with wildcard support.
 *
 * @param items - Array of objects to filter
 * @param grepPattern - String pattern or GrepOptions object
 * @param extractor - Function to extract the string to match against
 * @returns Grep result with filtered items and metadata
 */
export function grepItems<T>(
  items: T[],
  grepPattern: string | GrepOptions,
  extractor: (item: T) => string
): GrepResult<T> {
  const grepOpts = typeof grepPattern === 'string'
    ? { pattern: grepPattern }
    : grepPattern;

  // DEFAULT: ignoreCase = true (case-insensitive by default)
  const { pattern, ignoreCase = true, invert = false, fixedStrings = false } = grepOpts;

  const regexPattern = buildRegexPattern(pattern, fixedStrings);
  const flags = ignoreCase ? 'i' : '';

  let filteredItems: T[];

  try {
    const regex = new RegExp(regexPattern, flags);
    filteredItems = items.filter(item => {
      const text = extractor(item);
      const matches = regex.test(text);
      return invert ? !matches : matches;
    });
  } catch {
    // Invalid regex, fall back to simple string matching
    filteredItems = items.filter(item => {
      const text = extractor(item);
      const matches = ignoreCase
        ? text.toLowerCase().includes(pattern.toLowerCase())
        : text.includes(pattern);
      return invert ? !matches : matches;
    });
  }

  return {
    items: filteredItems,
    pattern,
    matchCount: filteredItems.length,
    totalCount: items.length,
  };
}

/**
 * Check if a string matches a grep pattern
 *
 * Defaults to case-insensitive with wildcard support.
 *
 * @param text - Text to check
 * @param grepPattern - String pattern or GrepOptions object
 * @returns True if text matches the pattern
 */
export function matchesGrep(text: string, grepPattern: string | GrepOptions): boolean {
  const grepOpts = typeof grepPattern === 'string'
    ? { pattern: grepPattern }
    : grepPattern;

  // DEFAULT: ignoreCase = true (case-insensitive by default)
  const { pattern, ignoreCase = true, invert = false, fixedStrings = false } = grepOpts;

  const regexPattern = buildRegexPattern(pattern, fixedStrings);
  const flags = ignoreCase ? 'i' : '';

  try {
    const regex = new RegExp(regexPattern, flags);
    const matches = regex.test(text);
    return invert ? !matches : matches;
  } catch {
    // Invalid regex, fall back to simple string matching
    const matches = ignoreCase
      ? text.toLowerCase().includes(pattern.toLowerCase())
      : text.includes(pattern);
    return invert ? !matches : matches;
  }
}

// ============================================================================
// Element-Level Grep (Full Data Matching)
// ============================================================================

/**
 * Build searchable text from element data
 *
 * Combines all element fields into a single searchable string.
 * This ensures grep matches against the FULL element data,
 * not just the truncated display text.
 */
export function buildElementSearchText(data: ElementSearchData): string {
  const parts: string[] = [];

  // Role (e.g., "button", "link", "textbox")
  if (data.role) parts.push(data.role);

  // Accessible name (full, not truncated)
  if (data.name) parts.push(data.name);

  // Full text content
  if (data.fullText) parts.push(data.fullText);

  // All CSS classes
  if (data.classes.length > 0) parts.push(data.classes.join(' '));

  // All attributes as key=value
  for (const [key, value] of Object.entries(data.attributes)) {
    parts.push(`${key}=${value}`);
  }

  // XPath for structural matching
  if (data.xpath) parts.push(data.xpath);

  return parts.join(' ');
}

/**
 * Filter elements by grep pattern matching against full element data
 *
 * This is the core improvement: grep matches against ALL element data
 * (role, name, full text, classes, attributes, xpath) not just the
 * truncated display line.
 *
 * @param elements - Array of ElementSearchData to filter
 * @param grepPattern - String pattern or GrepOptions object
 * @returns Grep result with matched elements
 *
 * @example
 * ```typescript
 * // Matches elements with "checkout" anywhere in text/attributes/classes
 * grepElements(elements, 'checkout')
 *
 * // Matches elements with class containing "nav"
 * grepElements(elements, 'nav-*-link')
 *
 * // Matches links to checkout page
 * grepElements(elements, 'href=*checkout*')
 * ```
 */
export function grepElements(
  elements: ElementSearchData[],
  grepPattern: string | GrepOptions
): GrepResult<ElementSearchData> {
  return grepItems(elements, grepPattern, buildElementSearchText);
}

// ============================================================================
// Visibility Filtering
// ============================================================================

/**
 * Filter elements by visibility
 *
 * @param elements - Array of elements to filter
 * @param includeHidden - If true, include hidden elements
 * @param checkAncestors - If true, check ancestor visibility too
 * @returns Filtered array of visible elements
 */
export function filterVisible(
  elements: Element[],
  includeHidden: boolean = false,
  checkAncestors: boolean = false
): Element[] {
  if (includeHidden) {
    return elements;
  }

  return elements.filter(el => checkElementVisibility(el, checkAncestors));
}

/**
 * Filter elements by a predicate function
 *
 * @param elements - Array of elements to filter
 * @param predicate - Function that returns true for elements to include
 * @returns Filtered array of elements
 */
export function filterElements(
  elements: Element[],
  predicate: (element: Element) => boolean
): Element[] {
  return elements.filter(predicate);
}

// ============================================================================
// Content Filtering
// ============================================================================

/**
 * Count words in text content
 */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Get full text content with whitespace normalization
 */
export function getCleanTextContent(element: Element, maxLength?: number): string {
  const text = (element.textContent || '').replace(/\s+/g, ' ').trim();
  if (maxLength && text.length > maxLength) {
    return text.slice(0, maxLength - 3) + '...';
  }
  return text;
}

/**
 * Count specific child elements by tag name
 */
export function countChildElements(element: Element, tagNames: string[]): number {
  const tags = new Set(tagNames.map(t => t.toUpperCase()));
  let count = 0;
  const walk = (el: Element) => {
    if (tags.has(el.tagName)) count++;
    for (const child of el.children) walk(child);
  };
  walk(element);
  return count;
}

/**
 * Get list items as strings
 */
export function getListItems(element: Element, maxItems: number = 10): string[] {
  const items: string[] = [];
  const listItems = element.querySelectorAll('li');
  for (let i = 0; i < Math.min(listItems.length, maxItems); i++) {
    const text = getCleanTextContent(listItems[i], 100);
    if (text) items.push(text);
  }
  return items;
}

/**
 * Detect code language from class or content
 */
export function detectCodeLanguage(element: Element): string | null {
  // Check class names for language hints
  const classes = element.className?.toString() || '';
  const match = classes.match(/(?:language-|lang-)(\w+)/i);
  if (match) return match[1].toLowerCase();

  // Check parent pre/code element
  const parent = element.closest('pre, code');
  if (parent && parent !== element) {
    const parentClasses = parent.className?.toString() || '';
    const parentMatch = parentClasses.match(/(?:language-|lang-)(\w+)/i);
    if (parentMatch) return parentMatch[1].toLowerCase();
  }

  return null;
}

// ============================================================================
// Element Search Data Builder
// ============================================================================

/**
 * Extract all searchable attributes from an element
 *
 * Includes common attributes that AI agents might search for:
 * - href, src (links, images)
 * - data-* attributes (test ids, state)
 * - aria-* attributes (accessibility)
 * - name, id, type, value (form elements)
 */
function extractElementAttributes(element: Element): Record<string, string> {
  const attrs: Record<string, string> = {};

  // Get all attributes
  for (const attr of Array.from(element.attributes)) {
    const name = attr.name.toLowerCase();
    const value = attr.value;

    // Skip empty or very long values (like inline styles or base64)
    if (!value || value.length > 500) continue;

    // Include important attributes
    if (
      name === 'href' ||
      name === 'src' ||
      name === 'id' ||
      name === 'name' ||
      name === 'type' ||
      name === 'value' ||
      name === 'placeholder' ||
      name === 'title' ||
      name === 'alt' ||
      name.startsWith('data-') ||
      name.startsWith('aria-')
    ) {
      attrs[name] = value;
    }
  }

  return attrs;
}

/**
 * Extract CSS classes from an element
 */
function extractElementClasses(element: Element): string[] {
  if (!element.className || typeof element.className !== 'string') {
    return [];
  }
  return element.className.trim().split(/\s+/).filter(c => c.length > 0);
}

/**
 * Build ElementSearchData from a DOM element
 *
 * This extracts ALL searchable data from the element for rich grep matching.
 * The data includes full text content (not truncated) and all attributes.
 *
 * @param element - DOM element to extract data from
 * @param role - Pre-computed role (optional, will compute if not provided)
 * @param name - Pre-computed accessible name (optional)
 * @param xpath - Pre-computed xpath (optional)
 * @returns ElementSearchData for grep matching
 */
export function buildElementSearchData(
  element: Element,
  role?: string,
  name?: string,
  xpath?: string
): ElementSearchData {
  return {
    element,
    role: role || '',
    name: name || '',
    fullText: (element.textContent || '').replace(/\s+/g, ' ').trim(),
    classes: extractElementClasses(element),
    attributes: extractElementAttributes(element),
    xpath: xpath || '',
  };
}
