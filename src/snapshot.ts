/**
 * Browser Tool Calling Protocol - DOM Snapshot
 *
 * Generates accessibility-tree-like snapshots of the DOM with element references.
 * Uses native browser APIs instead of Playwright's accessibility API.
 */

import type { ElementRef } from './types.js';

// Reference map type
export type RefMap = Record<string, ElementRef>;

// Enhanced snapshot result
export interface EnhancedSnapshot {
  tree: string;
  refs: RefMap;
}

// Snapshot options
export interface SnapshotOptions {
  interactive?: boolean;
  maxDepth?: number;
  compact?: boolean;
  selector?: string;
}

// ARIA roles that are interactive
const INTERACTIVE_ROLES = new Set([
  'button',
  'link',
  'textbox',
  'checkbox',
  'radio',
  'combobox',
  'listbox',
  'option',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'tab',
  'switch',
  'slider',
  'spinbutton',
  'searchbox',
  'scrollbar',
  'progressbar',
  'meter',
  'treeitem',
]);

// Content roles that should get refs when they have names
const CONTENT_ROLES = new Set([
  'heading',
  'img',
  'figure',
  'table',
  'cell',
  'row',
  'rowgroup',
  'columnheader',
  'rowheader',
  'listitem',
  'article',
  'region',
  'banner',
  'navigation',
  'main',
  'complementary',
  'contentinfo',
  'form',
  'search',
  'alert',
  'alertdialog',
  'dialog',
  'tooltip',
  'status',
  'log',
  'marquee',
  'timer',
  'definition',
  'term',
  'note',
  'document',
  'application',
]);

// Structural roles to skip in compact mode
const STRUCTURAL_ROLES = new Set([
  'generic',
  'group',
  'list',
  'presentation',
  'none',
  'directory',
  'grid',
  'tree',
  'treegrid',
  'menu',
  'menubar',
  'tablist',
  'toolbar',
  'separator',
]);

// Map HTML elements to implicit ARIA roles
const IMPLICIT_ROLES: Record<string, string | ((el: Element) => string | null)> = {
  A: (el) => (el.hasAttribute('href') ? 'link' : null),
  ARTICLE: 'article',
  ASIDE: 'complementary',
  BUTTON: 'button',
  DATALIST: 'listbox',
  DETAILS: 'group',
  DIALOG: 'dialog',
  FIELDSET: 'group',
  FIGURE: 'figure',
  FOOTER: (el) =>
    isLandmarkContext(el) ? null : 'contentinfo',
  FORM: 'form',
  H1: 'heading',
  H2: 'heading',
  H3: 'heading',
  H4: 'heading',
  H5: 'heading',
  H6: 'heading',
  HEADER: (el) =>
    isLandmarkContext(el) ? null : 'banner',
  HR: 'separator',
  IMG: (el) => (el.getAttribute('alt') === '' ? 'presentation' : 'img'),
  INPUT: getInputRole,
  LI: 'listitem',
  MAIN: 'main',
  MENU: 'list',
  NAV: 'navigation',
  OL: 'list',
  OPTGROUP: 'group',
  OPTION: 'option',
  OUTPUT: 'status',
  PROGRESS: 'progressbar',
  SECTION: (el) => (getAccessibleName(el) ? 'region' : null),
  SELECT: (el) =>
    el.hasAttribute('multiple') || (el as HTMLSelectElement).size > 1 ? 'listbox' : 'combobox',
  SUMMARY: 'button',
  TABLE: 'table',
  TBODY: 'rowgroup',
  TD: 'cell',
  TEXTAREA: 'textbox',
  TFOOT: 'rowgroup',
  TH: (el) => (el.getAttribute('scope') === 'row' ? 'rowheader' : 'columnheader'),
  THEAD: 'rowgroup',
  TR: 'row',
  UL: 'list',
};

/**
 * Check if element is within a landmark context (for header/footer role computation)
 */
function isLandmarkContext(el: Element): boolean {
  let parent = el.parentElement;
  while (parent) {
    const role = getRole(parent);
    if (role === 'article' || role === 'complementary' || role === 'main' || role === 'navigation' || role === 'region') {
      return true;
    }
    parent = parent.parentElement;
  }
  return false;
}

/**
 * Get the role for an input element based on its type
 */
function getInputRole(el: Element): string | null {
  const type = (el as HTMLInputElement).type?.toLowerCase() || 'text';
  switch (type) {
    case 'button':
    case 'submit':
    case 'reset':
    case 'image':
      return 'button';
    case 'checkbox':
      return 'checkbox';
    case 'radio':
      return 'radio';
    case 'range':
      return 'slider';
    case 'number':
      return 'spinbutton';
    case 'search':
      return 'searchbox';
    case 'email':
    case 'tel':
    case 'url':
    case 'text':
    case 'password':
      return 'textbox';
    case 'hidden':
      return null;
    default:
      return 'textbox';
  }
}

/**
 * Get the ARIA role of an element
 */
function getRole(el: Element): string | null {
  // Explicit role takes precedence
  const explicitRole = el.getAttribute('role');
  if (explicitRole) {
    return explicitRole.split(' ')[0]; // Take first role if multiple
  }

  // Get implicit role from tag name
  const tagName = el.tagName;
  const implicitRole = IMPLICIT_ROLES[tagName];

  if (typeof implicitRole === 'function') {
    return implicitRole(el);
  }

  return implicitRole || null;
}

/**
 * Get the accessible name of an element
 */
function getAccessibleName(el: Element): string {
  // aria-labelledby
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labels = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim())
      .filter(Boolean);
    if (labels.length) {
      return labels.join(' ');
    }
  }

  // aria-label
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) {
    return ariaLabel.trim();
  }

  // For images, use alt text
  if (el.tagName === 'IMG') {
    const alt = el.getAttribute('alt');
    if (alt) return alt.trim();
  }

  // For inputs, check for associated label
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
    const id = el.getAttribute('id');
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) {
        return label.textContent?.trim() || '';
      }
    }
    // Check for parent label
    const parentLabel = el.closest('label');
    if (parentLabel) {
      // Get text content excluding the input itself
      const clone = parentLabel.cloneNode(true) as Element;
      clone.querySelectorAll('input, textarea, select').forEach((input) => input.remove());
      return clone.textContent?.trim() || '';
    }
    // Check placeholder
    const placeholder = el.getAttribute('placeholder');
    if (placeholder) {
      return placeholder.trim();
    }
  }

  // For buttons, use text content
  if (el.tagName === 'BUTTON' || (el.tagName === 'INPUT' && ['button', 'submit', 'reset'].includes((el as HTMLInputElement).type))) {
    if (el.tagName === 'INPUT') {
      return (el as HTMLInputElement).value || (el as HTMLInputElement).type;
    }
    return el.textContent?.trim() || '';
  }

  // For elements with explicit button/link roles, use text content
  const explicitRole = el.getAttribute('role');
  if (explicitRole === 'button' || explicitRole === 'link') {
    return el.textContent?.trim() || '';
  }

  // For links, use text content
  if (el.tagName === 'A') {
    return el.textContent?.trim() || '';
  }

  // For headings, use text content
  if (/^H[1-6]$/.test(el.tagName) || explicitRole === 'heading') {
    return el.textContent?.trim() || '';
  }

  // title attribute as fallback
  const title = el.getAttribute('title');
  if (title) {
    return title.trim();
  }

  return '';
}

/**
 * Check if an element is visible
 */
function isVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement)) {
    return true;
  }

  // Check inline style first (faster and works in jsdom)
  const inlineDisplay = el.style.display;
  const inlineVisibility = el.style.visibility;
  if (inlineDisplay === 'none') return false;
  if (inlineVisibility === 'hidden') return false;

  // Check computed style
  const style = el.ownerDocument.defaultView?.getComputedStyle(el);
  if (style) {
    if (style.display === 'none') return false;
    if (style.visibility === 'hidden') return false;
    if (style.opacity === '0') return false;
  }

  // Check hidden attribute
  if (el.hidden) return false;

  // Note: getBoundingClientRect returns zeros in jsdom, so we skip that check
  // In real browsers, elements with zero dimensions would typically not be visible

  return true;
}

/**
 * Check if an element is interactive
 */
function isInteractive(el: Element): boolean {
  const role = getRole(el);
  if (role && INTERACTIVE_ROLES.has(role)) {
    return true;
  }

  // Check for click handlers or tabindex
  if (el.hasAttribute('onclick') || el.hasAttribute('tabindex')) {
    return true;
  }

  // Check for contenteditable
  if ((el as HTMLElement).isContentEditable) {
    return true;
  }

  return false;
}

/**
 * CSS.escape polyfill for environments like jsdom where it's not available
 */
function cssEscape(str: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) {
    return CSS.escape(str);
  }
  // Simple fallback that escapes special characters
  return str.replace(/([^\w-])/g, '\\$1');
}

/**
 * Generate a CSS selector for an element
 */
function generateSelector(el: Element): string {
  // Use ID if available
  if (el.id) {
    return `#${cssEscape(el.id)}`;
  }

  // Use data-testid if available
  const testId = el.getAttribute('data-testid');
  if (testId) {
    return `[data-testid="${cssEscape(testId)}"]`;
  }

  // Build a path-based selector
  const path: string[] = [];
  let current: Element | null = el;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    // Add classes for specificity
    const classes = Array.from(current.classList)
      .filter((c) => !c.startsWith('_') && !c.match(/^[a-z0-9]{6,}$/i)) // Skip generated class names
      .slice(0, 2);
    if (classes.length) {
      selector += '.' + classes.map((c) => cssEscape(c)).join('.');
    }

    // Add nth-child if needed for uniqueness
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (s) => s.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    path.unshift(selector);
    current = current.parentElement;
  }

  return path.join(' > ');
}

/**
 * Build a tree representation of the DOM
 */
function buildTree(
  el: Element,
  options: SnapshotOptions,
  refs: RefMap,
  refCounter: { count: number },
  depth: number = 0
): string | null {
  // Check depth limit
  if (options.maxDepth !== undefined && depth > options.maxDepth) {
    return null;
  }

  // Skip hidden elements
  if (!isVisible(el)) {
    return null;
  }

  const role = getRole(el);
  const name = getAccessibleName(el);
  const interactive = isInteractive(el);

  // In interactive-only mode, skip non-interactive elements (but still process children)
  const skipThisElement = options.interactive && !interactive;

  // In compact mode, skip structural elements without names
  const isStructural = role && STRUCTURAL_ROLES.has(role);
  const shouldSkipStructural = options.compact && isStructural && !name;

  // Determine if this element should get a ref
  const shouldGetRef =
    !skipThisElement &&
    !shouldSkipStructural &&
    role &&
    (INTERACTIVE_ROLES.has(role) || (CONTENT_ROLES.has(role) && name));

  // Generate ref if needed
  let ref: string | null = null;
  if (shouldGetRef) {
    refCounter.count++;
    ref = `e${refCounter.count}`;
    refs[ref] = {
      role,
      name: name || undefined,
      selector: generateSelector(el),
    };
  }

  // Process children
  const childLines: string[] = [];
  for (const child of el.children) {
    const childTree = buildTree(child, options, refs, refCounter, depth + 1);
    if (childTree) {
      childLines.push(childTree);
    }
  }

  // If we're skipping this element, just return children
  if (skipThisElement || shouldSkipStructural) {
    return childLines.join('\n');
  }

  // Build the line for this element
  if (!role) {
    // No role, just return children if any
    return childLines.length ? childLines.join('\n') : null;
  }

  const indent = '  '.repeat(depth);
  let line = `${indent}- ${role}`;

  if (name) {
    line += ` "${name}"`;
  }

  if (ref) {
    line += ` [ref=${ref}]`;
  }

  // Add additional info for certain elements
  if (role === 'heading') {
    const level = el.tagName.match(/H(\d)/)?.[1] || el.getAttribute('aria-level');
    if (level) {
      line += ` [level=${level}]`;
    }
  }

  if (role === 'checkbox' || role === 'radio' || role === 'switch') {
    const checked = el.getAttribute('aria-checked') || (el as HTMLInputElement).checked;
    line += ` [${checked ? 'checked' : 'unchecked'}]`;
  }

  if (role === 'textbox' || role === 'searchbox' || role === 'spinbutton') {
    const value = (el as HTMLInputElement).value;
    if (value) {
      line += ` [value="${value.slice(0, 50)}${value.length > 50 ? '...' : ''}"]`;
    }
  }

  if (role === 'link') {
    const href = el.getAttribute('href');
    if (href) {
      line += ` [href="${href.slice(0, 50)}${href.length > 50 ? '...' : ''}"]`;
    }
  }

  // Combine with children
  if (childLines.length) {
    return line + '\n' + childLines.join('\n');
  }

  return line;
}

/**
 * Get an enhanced snapshot of the DOM
 */
export function getEnhancedSnapshot(
  doc: Document = document,
  options: SnapshotOptions = {}
): EnhancedSnapshot {
  const refs: RefMap = {};
  const refCounter = { count: 0 };

  // Get root element
  let root: Element = doc.body;
  if (options.selector) {
    const selected = doc.querySelector(options.selector);
    if (!selected) {
      return { tree: `No element found for selector: ${options.selector}`, refs: {} };
    }
    root = selected;
  }

  const tree = buildTree(root, options, refs, refCounter);

  return {
    tree: tree || 'Empty page',
    refs,
  };
}

/**
 * Parse a ref from a selector string
 * Supports formats: "e1", "@e1", "ref=e1", "[ref=e1]"
 */
export function parseRef(selector: string): string | null {
  const trimmed = selector.trim();

  // Direct ref: "e1"
  if (/^e\d+$/.test(trimmed)) {
    return trimmed;
  }

  // @ prefix: "@e1"
  if (/^@e\d+$/.test(trimmed)) {
    return trimmed.slice(1);
  }

  // ref= prefix: "ref=e1"
  const refMatch = trimmed.match(/^ref=(e\d+)$/);
  if (refMatch) {
    return refMatch[1];
  }

  // Bracketed: "[ref=e1]"
  const bracketMatch = trimmed.match(/^\[ref=(e\d+)\]$/);
  if (bracketMatch) {
    return bracketMatch[1];
  }

  return null;
}

/**
 * Get stats about a snapshot
 */
export function getSnapshotStats(refs: RefMap): {
  total: number;
  byRole: Record<string, number>;
} {
  const byRole: Record<string, number> = {};
  let total = 0;

  for (const ref of Object.values(refs)) {
    total++;
    byRole[ref.role] = (byRole[ref.role] || 0) + 1;
  }

  return { total, byRole };
}

/**
 * Find element by ref
 */
export function findElementByRef(ref: string, refs: RefMap, doc: Document = document): Element | null {
  const refData = refs[ref];
  if (!refData) {
    return null;
  }

  return doc.querySelector(refData.selector);
}
