/**
 * @btcp/core - DOM Snapshot
 *
 * Generates accessibility tree representation of the DOM.
 * Produces a compact, AI-friendly view of page structure.
 */

import type { SnapshotData, SnapshotElement, SnapshotRef, RefMap } from './types.js';

interface SnapshotOptions {
  root?: Element;
  maxDepth?: number;
  includeHidden?: boolean;
}

// Role mappings for implicit ARIA roles
const IMPLICIT_ROLES: Record<string, string> = {
  A: 'link',
  ARTICLE: 'article',
  ASIDE: 'complementary',
  BUTTON: 'button',
  DIALOG: 'dialog',
  FOOTER: 'contentinfo',
  FORM: 'form',
  H1: 'heading',
  H2: 'heading',
  H3: 'heading',
  H4: 'heading',
  H5: 'heading',
  H6: 'heading',
  HEADER: 'banner',
  IMG: 'img',
  INPUT: 'textbox',
  LI: 'listitem',
  MAIN: 'main',
  NAV: 'navigation',
  OL: 'list',
  OPTION: 'option',
  PROGRESS: 'progressbar',
  SECTION: 'region',
  SELECT: 'combobox',
  TABLE: 'table',
  TBODY: 'rowgroup',
  TD: 'cell',
  TEXTAREA: 'textbox',
  TH: 'columnheader',
  THEAD: 'rowgroup',
  TR: 'row',
  UL: 'list',
};

// Input type to role mapping
const INPUT_ROLES: Record<string, string> = {
  button: 'button',
  checkbox: 'checkbox',
  email: 'textbox',
  number: 'spinbutton',
  password: 'textbox',
  radio: 'radio',
  range: 'slider',
  search: 'searchbox',
  submit: 'button',
  tel: 'textbox',
  text: 'textbox',
  url: 'textbox',
};

/**
 * Get the ARIA role for an element
 */
function getRole(element: Element): string | null {
  // Explicit role
  const explicitRole = element.getAttribute('role');
  if (explicitRole) return explicitRole;

  const tagName = element.tagName;

  // Special handling for inputs
  if (tagName === 'INPUT') {
    const type = (element as HTMLInputElement).type || 'text';
    return INPUT_ROLES[type] || 'textbox';
  }

  return IMPLICIT_ROLES[tagName] || null;
}

/**
 * Get accessible name for an element
 */
function getAccessibleName(element: Element): string {
  // aria-label
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.trim();

  // aria-labelledby
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labels = labelledBy
      .split(/\s+/)
      .map((id) => element.ownerDocument.getElementById(id)?.textContent?.trim())
      .filter(Boolean);
    if (labels.length) return labels.join(' ');
  }

  // For inputs, check associated label
  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT') {
    const id = element.getAttribute('id');
    if (id) {
      const label = element.ownerDocument.querySelector(`label[for="${id}"]`);
      if (label) return label.textContent?.trim() || '';
    }
  }

  // For images, use alt text
  if (element.tagName === 'IMG') {
    const alt = element.getAttribute('alt');
    if (alt) return alt.trim();
  }

  // For buttons and links, use text content
  if (element.tagName === 'BUTTON' || element.tagName === 'A') {
    return element.textContent?.trim() || '';
  }

  // For inputs with value as name (submit buttons)
  if (element.tagName === 'INPUT') {
    const input = element as HTMLInputElement;
    if (['submit', 'button', 'reset'].includes(input.type)) {
      return input.value || input.type;
    }
    // Placeholder as fallback
    if (input.placeholder) return input.placeholder;
  }

  return '';
}

/**
 * Check if element is visible
 */
function isVisible(element: Element): boolean {
  if (!(element instanceof HTMLElement)) return true;

  // Check inline style first (faster and works in jsdom)
  const inlineDisplay = element.style.display;
  const inlineVisibility = element.style.visibility;
  if (inlineDisplay === 'none') return false;
  if (inlineVisibility === 'hidden') return false;

  // Check computed style
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  if (style) {
    if (style.display === 'none') return false;
    if (style.visibility === 'hidden') return false;
    if (style.opacity === '0') return false;
  }

  // Check hidden attribute
  if (element.hidden) return false;

  // Note: getBoundingClientRect returns zeros in jsdom, so we skip that check
  // In real browsers, you might want to check for zero-size elements

  return true;
}

/**
 * Check if element is interactive
 */
function isInteractive(element: Element): boolean {
  const role = getRole(element);
  if (!role) return false;

  const interactiveRoles = [
    'button',
    'link',
    'textbox',
    'checkbox',
    'radio',
    'combobox',
    'listbox',
    'menuitem',
    'option',
    'slider',
    'spinbutton',
    'switch',
    'tab',
    'searchbox',
  ];

  return interactiveRoles.includes(role);
}

/**
 * Generate snapshot of the DOM
 * Returns both ASCII tree representation and structured JSON elements
 */
export function createSnapshot(
  document: Document,
  refMap: RefMap,
  options: SnapshotOptions = {}
): SnapshotData {
  const { root = document.body, maxDepth = 10, includeHidden = false } = options;

  const refs: Record<string, SnapshotRef> = {};
  const lines: string[] = [];
  let refCounter = 0;

  function generateRef(element: Element): string {
    const ref = `@ref:${refCounter++}`;
    refMap.set(ref, element);
    return ref;
  }

  /**
   * Process a DOM node and return structured element + append to ASCII lines
   */
  function processNode(element: Element, depth: number, indent: string): SnapshotElement | null {
    if (depth > maxDepth) return null;

    // Skip hidden elements unless requested
    if (!includeHidden && !isVisible(element)) return null;

    const role = getRole(element);
    const name = getAccessibleName(element);
    const interactive = isInteractive(element);

    // Skip non-semantic elements without interesting content
    if (!role && !name && element.children.length === 0) return null;

    // Build node representation
    let line = indent;
    let snapshotElement: SnapshotElement | null = null;

    if (role) {
      // Generate ref for interactive elements
      let ref: string | undefined;
      let selector: string | undefined;
      if (interactive) {
        ref = generateRef(element);
        selector = generateSelector(element);
        refs[ref] = {
          selector,
          role,
          name: name || undefined,
        };
      }

      // Get element state
      const disabled = element.hasAttribute('disabled');
      const checked = (element as HTMLInputElement).checked || false;
      const expanded = element.getAttribute('aria-expanded') === 'true';
      const selected = element.getAttribute('aria-selected') === 'true';

      // Build ASCII line: [ref] role "name" (state)
      if (ref) line += `${ref} `;
      line += role;
      if (name) line += ` "${truncate(name, 50)}"`;

      // Add state info to ASCII
      const states: string[] = [];
      if (disabled) states.push('disabled');
      if (checked) states.push('checked');
      if (expanded) states.push('expanded');
      if (selected) states.push('selected');
      if (states.length) line += ` (${states.join(', ')})`;

      lines.push(line);

      // Build structured element
      snapshotElement = {
        role,
        ...(ref && { ref }),
        ...(name && { name }),
        ...(selector && { selector }),
        ...(disabled && { disabled }),
        ...(checked && { checked }),
        ...(expanded && { expanded }),
        ...(selected && { selected }),
      };
    } else if (name && element.children.length === 0) {
      // Text-only node
      lines.push(`${indent}text "${truncate(name, 80)}"`);
      snapshotElement = {
        role: 'text',
        name,
      };
    }

    // Process children
    const childIndent = indent + '  ';
    const children: SnapshotElement[] = [];
    for (const child of element.children) {
      const childElement = processNode(child, depth + 1, childIndent);
      if (childElement) {
        children.push(childElement);
      }
    }

    // Add children to the structured element if any
    if (snapshotElement && children.length > 0) {
      snapshotElement.children = children;
    }

    // Return children even if parent has no role (for collecting nested elements)
    if (!snapshotElement && children.length > 0) {
      // Return a generic container for elements with no semantic meaning but with children
      return {
        role: 'group',
        children,
      };
    }

    return snapshotElement;
  }

  const rootElement = processNode(root, 0, '');

  // Extract top-level elements array
  const elements: SnapshotElement[] = rootElement?.children || (rootElement ? [rootElement] : []);

  return {
    tree: lines.join('\n') || 'Empty page',
    elements,
    refs,
  };
}

/**
 * Escape CSS identifiers - uses CSS.escape when available, fallback for test environments
 */
function cssEscape(str: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) {
    return CSS.escape(str);
  }
  // Basic fallback for environments without CSS.escape (e.g., jsdom)
  return str.replace(/([^\w-])/g, '\\$1');
}

/**
 * Generate a CSS selector for an element
 */
function generateSelector(element: Element): string {
  // Prefer ID
  if (element.id) {
    return `#${cssEscape(element.id)}`;
  }

  // Try data-testid
  const testId = element.getAttribute('data-testid');
  if (testId) {
    return `[data-testid="${testId}"]`;
  }

  // Build path-based selector
  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current !== element.ownerDocument.body) {
    let selector = current.tagName.toLowerCase();

    // Add class if unique among siblings
    if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/).filter(c => c.length < 30);
      if (classes.length) {
        selector += `.${classes.slice(0, 2).map(c => cssEscape(c)).join('.')}`;
      }
    }

    // Add nth-child if needed
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

    parts.unshift(selector);
    current = current.parentElement;

    // Limit depth
    if (parts.length >= 4) break;
  }

  return parts.join(' > ');
}

/**
 * Truncate string with ellipsis
 */
function truncate(str: string, maxLength: number): string {
  const cleaned = str.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength - 3) + '...';
}
