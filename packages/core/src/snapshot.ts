/**
 * @aspect/core - DOM Snapshot
 *
 * Generates accessibility tree representation of the DOM.
 * Produces a compact, AI-friendly view of page structure.
 */

import type { SnapshotData, RefMap } from './types.js';

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

  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  if (!style) return true;

  if (style.display === 'none') return false;
  if (style.visibility === 'hidden') return false;
  if (style.opacity === '0') return false;

  // Check if element has size
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;

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
 */
export function createSnapshot(
  document: Document,
  refMap: RefMap,
  options: SnapshotOptions = {}
): SnapshotData {
  const { root = document.body, maxDepth = 10, includeHidden = false } = options;

  const refs: SnapshotData['refs'] = {};
  const lines: string[] = [];
  let refCounter = 0;

  function generateRef(element: Element): string {
    const ref = `@ref:${refCounter++}`;
    refMap.set(ref, element);
    return ref;
  }

  function processNode(element: Element, depth: number, indent: string): void {
    if (depth > maxDepth) return;

    // Skip hidden elements unless requested
    if (!includeHidden && !isVisible(element)) return;

    const role = getRole(element);
    const name = getAccessibleName(element);
    const interactive = isInteractive(element);

    // Skip non-semantic elements without interesting content
    if (!role && !name && element.children.length === 0) return;

    // Build node representation
    let line = indent;

    if (role) {
      // Generate ref for interactive elements
      let ref: string | undefined;
      if (interactive) {
        ref = generateRef(element);
        refs[ref] = {
          selector: generateSelector(element),
          role,
          name: name || undefined,
        };
      }

      // Format: [ref] role "name" (state)
      if (ref) line += `${ref} `;
      line += role;
      if (name) line += ` "${truncate(name, 50)}"`;

      // Add state info
      const states: string[] = [];
      if (element.hasAttribute('disabled')) states.push('disabled');
      if ((element as HTMLInputElement).checked) states.push('checked');
      if (element.getAttribute('aria-expanded') === 'true') states.push('expanded');
      if (element.getAttribute('aria-selected') === 'true') states.push('selected');

      if (states.length) line += ` (${states.join(', ')})`;

      lines.push(line);
    } else if (name && element.children.length === 0) {
      // Text-only node
      lines.push(`${indent}text "${truncate(name, 80)}"`);
    }

    // Process children
    const childIndent = indent + '  ';
    for (const child of element.children) {
      processNode(child, depth + 1, childIndent);
    }
  }

  processNode(root, 0, '');

  return {
    tree: lines.join('\n') || 'Empty page',
    refs,
  };
}

/**
 * Generate a CSS selector for an element
 */
function generateSelector(element: Element): string {
  // Prefer ID
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
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
        selector += `.${classes.slice(0, 2).map(c => CSS.escape(c)).join('.')}`;
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
