/**
 * @btcp/core - DOM Snapshot
 *
 * Generates a flat accessibility snapshot of the DOM.
 * Produces a compact, AI-friendly list of interactive elements.
 */

import type { SnapshotData, RefMap } from './types.js';

/**
 * Get HTML element constructors from window (works in both browser and jsdom)
 */
function getHTMLConstructors(element: Element) {
  const win = element.ownerDocument.defaultView;
  if (!win) {
    return {
      HTMLElement: null,
      HTMLInputElement: null,
      HTMLTextAreaElement: null,
      HTMLSelectElement: null,
      HTMLAnchorElement: null,
      HTMLButtonElement: null,
      HTMLImageElement: null,
    };
  }
  return {
    HTMLElement: win.HTMLElement,
    HTMLInputElement: win.HTMLInputElement,
    HTMLTextAreaElement: win.HTMLTextAreaElement,
    HTMLSelectElement: win.HTMLSelectElement,
    HTMLAnchorElement: win.HTMLAnchorElement,
    HTMLButtonElement: win.HTMLButtonElement,
    HTMLImageElement: win.HTMLImageElement,
  };
}

/**
 * Grep options (mirrors Unix grep flags)
 */
interface GrepOptions {
  /** Pattern to search for */
  pattern: string;
  /** Case-insensitive matching (grep -i) */
  ignoreCase?: boolean;
  /** Invert match - return non-matching lines (grep -v) */
  invert?: boolean;
  /** Treat pattern as fixed string, not regex (grep -F) */
  fixedStrings?: boolean;
}

interface SnapshotOptions {
  root?: Element;
  maxDepth?: number;
  includeHidden?: boolean;
  interactive?: boolean;
  compact?: boolean;
  all?: boolean;
  /** Grep filter - string pattern or options object */
  grep?: string | GrepOptions;
}

const TRUNCATE_LIMITS = {
  ELEMENT_NAME: 50,
  TEXT_SHORT: 80,
  TEXT_LONG: 120,
  ERROR_MESSAGE: 100,
  URL: 150,
} as const;

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
  const explicitRole = element.getAttribute('role');
  if (explicitRole) return explicitRole;

  const tagName = element.tagName;

  // Special handling for headings - include level
  if (tagName.match(/^H[1-6]$/)) {
    const level = tagName[1];
    return `heading level=${level}`;
  }

  // Special handling for inputs
  if (tagName === 'INPUT') {
    const type = (element as HTMLInputElement).type || 'text';
    return INPUT_ROLES[type] || 'textbox';
  }

  return IMPLICIT_ROLES[tagName] || null;
}

/**
 * Get input type and validation attributes
 */
function getInputAttributes(element: Element): string {
  const constructors = getHTMLConstructors(element);

  const isInput = constructors.HTMLInputElement && element instanceof constructors.HTMLInputElement;
  const isTextArea = constructors.HTMLTextAreaElement && element instanceof constructors.HTMLTextAreaElement;

  if (!(isInput || isTextArea)) {
    return '';
  }

  const attrs: string[] = [];

  if (isInput && (element as HTMLInputElement).type && (element as HTMLInputElement).type !== 'text') {
    attrs.push(`type=${(element as HTMLInputElement).type}`);
  }

  if ((element as HTMLInputElement | HTMLTextAreaElement).required) attrs.push('required');
  if (element.getAttribute('aria-invalid') === 'true') attrs.push('invalid');

  if (isInput) {
    const input = element as HTMLInputElement;
    if (input.minLength > 0) attrs.push(`minlength=${input.minLength}`);
    if (input.maxLength >= 0 && input.maxLength < 524288) attrs.push(`maxlength=${input.maxLength}`);
    if (input.pattern) attrs.push(`pattern=${input.pattern}`);
    if (input.min) attrs.push(`min=${input.min}`);
    if (input.max) attrs.push(`max=${input.max}`);
  }

  return attrs.length > 0 ? ` [${attrs.join(' ')}]` : '';
}

/**
 * Check if element is in viewport
 */
function isInViewport(element: Element, window: Window): boolean {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || window.document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || window.document.documentElement.clientWidth)
  );
}

/**
 * Get label from enclosing <label> element
 */
function getEnclosingLabel(element: Element): string {
  const label = element.closest('label');
  if (label) {
    const clone = label.cloneNode(true) as HTMLElement;
    const inputs = clone.querySelectorAll('input, textarea, select');
    inputs.forEach(input => input.remove());
    return clone.textContent?.trim() || '';
  }
  return '';
}

/**
 * Get label for button elements
 */
function getButtonLabel(element: HTMLButtonElement | HTMLInputElement): string {
  const constructors = getHTMLConstructors(element);
  const isInputElement = constructors.HTMLInputElement && element instanceof constructors.HTMLInputElement;

  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.trim();

  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labels = labelledBy
      .split(/\s+/)
      .map((id) => element.ownerDocument.getElementById(id)?.textContent?.trim())
      .filter(Boolean);
    if (labels.length) return labels.join(' ');
  }

  const textContent = element.textContent?.trim();
  if (textContent) return textContent;

  if (isInputElement && ['submit', 'button', 'reset'].includes((element as HTMLInputElement).type)) {
    if (element.value) return element.value;
  }

  const title = element.getAttribute('title');
  if (title) return title.trim();

  return '';
}

/**
 * Get label for link elements
 */
function getLinkLabel(element: HTMLAnchorElement): string {
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.trim();

  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labels = labelledBy
      .split(/\s+/)
      .map((id) => element.ownerDocument.getElementById(id)?.textContent?.trim())
      .filter(Boolean);
    if (labels.length) return labels.join(' ');
  }

  const textContent = element.textContent?.trim();
  if (textContent) return textContent;

  const title = element.getAttribute('title');
  if (title) return title.trim();

  const href = element.getAttribute('href');
  if (href) {
    const path = href.split('?')[0].split('#')[0];
    const segments = path.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1] || segments[segments.length - 2];
    if (lastSegment) {
      return lastSegment.replace(/[-_]/g, ' ').replace(/\.\w+$/, '');
    }
  }

  return '';
}

/**
 * Get label for input/textarea/select elements
 */
function getFormControlLabel(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.trim();

  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labels = labelledBy
      .split(/\s+/)
      .map((id) => element.ownerDocument.getElementById(id)?.textContent?.trim())
      .filter(Boolean);
    if (labels.length) return labels.join(' ');
  }

  const id = element.getAttribute('id');
  if (id) {
    const label = element.ownerDocument.querySelector(`label[for="${id}"]`);
    if (label) {
      const labelText = label.textContent?.trim();
      if (labelText) return labelText;
    }
  }

  const enclosingLabel = getEnclosingLabel(element);
  if (enclosingLabel) return enclosingLabel;

  const title = element.getAttribute('title');
  if (title) return title.trim();

  return '';
}

/**
 * Get label for image elements
 */
function getImageLabel(element: HTMLImageElement): string {
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.trim();

  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labels = labelledBy
      .split(/\s+/)
      .map((id) => element.ownerDocument.getElementById(id)?.textContent?.trim())
      .filter(Boolean);
    if (labels.length) return labels.join(' ');
  }

  const alt = element.getAttribute('alt');
  if (alt) return alt.trim();

  const title = element.getAttribute('title');
  if (title) return title.trim();

  const src = element.getAttribute('src');
  if (src) {
    const filename = src.split('/').pop()?.split('?')[0].replace(/\.\w+$/, '');
    if (filename) return filename.replace(/[-_]/g, ' ');
  }

  return '';
}

/**
 * Get accessible name for an element
 */
function getAccessibleName(element: Element): string {
  const constructors = getHTMLConstructors(element);

  const isButton = constructors.HTMLButtonElement && element instanceof constructors.HTMLButtonElement;
  const isInputButton = constructors.HTMLInputElement &&
                        element instanceof constructors.HTMLInputElement &&
                        ['button', 'submit', 'reset'].includes((element as HTMLInputElement).type);

  if (isButton || isInputButton) {
    return getButtonLabel(element as HTMLButtonElement | HTMLInputElement);
  }

  const isAnchor = constructors.HTMLAnchorElement && element instanceof constructors.HTMLAnchorElement;
  if (isAnchor) {
    return getLinkLabel(element as HTMLAnchorElement);
  }

  const isInput = constructors.HTMLInputElement && element instanceof constructors.HTMLInputElement;
  const isTextArea = constructors.HTMLTextAreaElement && element instanceof constructors.HTMLTextAreaElement;
  const isSelect = constructors.HTMLSelectElement && element instanceof constructors.HTMLSelectElement;

  if (isInput || isTextArea || isSelect) {
    return getFormControlLabel(element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement);
  }

  const isImage = constructors.HTMLImageElement && element instanceof constructors.HTMLImageElement;
  if (isImage) {
    return getImageLabel(element as HTMLImageElement);
  }

  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.trim();

  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labels = labelledBy
      .split(/\s+/)
      .map((id) => element.ownerDocument.getElementById(id)?.textContent?.trim())
      .filter(Boolean);
    if (labels.length) return labels.join(' ');
  }

  const textContent = element.textContent?.trim();
  if (textContent) return textContent;

  return '';
}

/**
 * Check if element is visible
 */
function isVisible(element: Element): boolean {
  const win = element.ownerDocument.defaultView;
  if (!win) return true;

  const HTMLElementConstructor = win.HTMLElement;
  if (!(element instanceof HTMLElementConstructor)) return true;

  const inlineDisplay = element.style.display;
  const inlineVisibility = element.style.visibility;
  if (inlineDisplay === 'none') return false;
  if (inlineVisibility === 'hidden') return false;

  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  if (style) {
    if (style.display === 'none') return false;
    if (style.visibility === 'hidden') return false;
    if (style.opacity === '0') return false;
  }

  if (element.hidden) return false;

  return true;
}

/**
 * Check if element is interactive
 */
function isInteractive(element: Element): boolean {
  if (element.tagName === 'A' && !element.hasAttribute('href')) {
    return false;
  }

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
 * Truncate string with context-aware limits
 */
function truncateByType(str: string, type: keyof typeof TRUNCATE_LIMITS): string {
  const maxLength = TRUNCATE_LIMITS[type];
  const cleaned = str.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength - 3) + '...';
}

/**
 * Escape CSS identifiers
 */
function cssEscape(value: string): string {
  return value.replace(/[!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~]/g, '\\$&');
}

/**
 * Generate a CSS selector for an element
 */
function generateSelector(element: Element): string {
  try {
    const win = element.ownerDocument.defaultView;
    const escape = (win && 'CSS' in win && win.CSS && 'escape' in win.CSS)
      ? (s: string) => win.CSS.escape(s)
      : cssEscape;

    if (element.id) {
      try {
        return `#${escape(element.id)}`;
      } catch {
        // ID escaping failed, fall through
      }
    }

    const testId = element.getAttribute('data-testid');
    if (testId) {
      return `[data-testid="${testId}"]`;
    }

    const parts: string[] = [];
    let current: Element | null = element;

    while (current && current !== element.ownerDocument.body) {
      let selector = current.tagName.toLowerCase();

      if (current.className && typeof current.className === 'string') {
        try {
          const classes = current.className.trim().split(/\s+/).filter(c => c.length < 30 && c.length > 0);
          if (classes.length) {
            selector += `.${classes.slice(0, 2).map(c => escape(c)).join('.')}`;
          }
        } catch {
          // Class escaping failed
        }
      }

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

      if (parts.length >= 4) break;
    }

    return parts.join(' > ');
  } catch {
    return generateSimpleSelector(element);
  }
}

/**
 * Generate a simple fallback selector
 */
function generateSimpleSelector(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const parent = element.parentElement;

  if (!parent) return tag;

  const siblings = Array.from(parent.children).filter(
    (s) => s.tagName === element.tagName
  );

  if (siblings.length === 1) return tag;

  const index = siblings.indexOf(element) + 1;
  return `${tag}:nth-of-type(${index})`;
}

// Semantic HTML tags worth preserving in xpath
const SEMANTIC_TAGS = new Set([
  'main', 'nav', 'header', 'footer', 'article', 'section', 'aside',
  'form', 'table', 'ul', 'ol', 'li', 'dialog', 'menu',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'a', 'button', 'input', 'select', 'textarea', 'label',
  'figure', 'figcaption', 'details', 'summary'
]);

// Class name patterns that are semantically meaningful
const SEMANTIC_CLASS_PATTERNS = [
  /^(nav|menu|header|footer|sidebar|content|main|search|login|signup|cart|modal|dialog)/i,
  /^(btn|button|link|tab|card|list|item|form|input|field)/i,
  /^(primary|secondary|active|selected|disabled|error|success|warning)/i,
  /^(container|wrapper|row|col|grid)$/i,
];

/**
 * Check if a class name is semantically meaningful
 */
function isSemanticClass(className: string): boolean {
  // Skip utility classes (too short, or common CSS framework classes)
  if (className.length < 3 || className.length > 25) return false;
  if (/^[a-z]-/.test(className)) return false; // Tailwind-like single letter prefix
  if (/^(mt|mb|ml|mr|mx|my|pt|pb|pl|pr|px|py|w-|h-|flex|grid|text-|bg-|border)/i.test(className)) return false;

  return SEMANTIC_CLASS_PATTERNS.some(pattern => pattern.test(className));
}

/**
 * Get the best semantic class from an element
 */
function getSemanticClass(element: Element): string | null {
  if (!element.className || typeof element.className !== 'string') return null;

  const classes = element.className.trim().split(/\s+/).filter(c => c.length > 0);
  const semantic = classes.find(c => isSemanticClass(c));

  return semantic || null;
}

/**
 * Build a semantic xpath for an element
 * Format: /body/main#content/nav.primary/ul/li[2]/a.nav-link
 */
function buildSemanticXPath(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;
  const body = element.ownerDocument.body;

  while (current && current !== body && current.parentElement) {
    const tag = current.tagName.toLowerCase();
    const id = current.id;
    const semanticClass = getSemanticClass(current);
    const isSemanticTag = SEMANTIC_TAGS.has(tag);

    // Build the segment
    let segment = '';

    // Always include semantic tags, skip generic div/span unless they have id/class
    if (isSemanticTag || id || semanticClass) {
      segment = tag;

      // Add id if present (most specific)
      if (id && id.length < 30 && !/^\d/.test(id) && !/[^a-zA-Z0-9_-]/.test(id)) {
        segment += `#${id}`;
      }
      // Add semantic class if no id
      else if (semanticClass) {
        segment += `.${semanticClass}`;
      }

      // Add index if there are siblings with same tag
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(s => s.tagName === current!.tagName);
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          segment += `[${index}]`;
        }
      }

      parts.unshift(segment);
    }

    current = current.parentElement;

    // Limit depth to keep xpath readable
    if (parts.length >= 6) break;
  }

  // Always start with body for context
  if (parts.length === 0) {
    return '/' + element.tagName.toLowerCase();
  }

  return '/' + parts.join('/');
}

/**
 * Generate flat snapshot of the DOM
 */
export function createSnapshot(
  document: Document,
  refMap: RefMap,
  options: SnapshotOptions = {}
): SnapshotData {
  const {
    root = document.body,
    maxDepth = 50,
    includeHidden = false,
    interactive = true,
    all = false,
    grep: grepPattern
  } = options;

  refMap.clear();

  const win = document.defaultView || window;
  const refs: SnapshotData['refs'] = {};
  const lines: string[] = [];
  let refCounter = 0;

  // Collect all elements
  const elements: Element[] = [];

  function collectElements(element: Element, depth: number): void {
    if (depth > maxDepth) return;
    if (!includeHidden && !isVisible(element)) return;

    elements.push(element);

    for (const child of element.children) {
      collectElements(child, depth + 1);
    }
  }

  collectElements(root, 0);

  // Filter and process elements
  let totalInteractive = 0;
  let capturedInteractive = 0;

  for (const element of elements) {
    const role = getRole(element);
    const isInteractiveElement = isInteractive(element);

    if (isInteractiveElement) totalInteractive++;

    // Skip non-interactive in interactive mode
    if (interactive && !isInteractiveElement) continue;

    // Skip elements without role in non-all mode
    if (!all && !role) continue;

    const name = getAccessibleName(element);

    // Build line
    let line = '';

    if (role) {
      const roleUpper = role.toUpperCase();
      line = roleUpper;

      if (name) {
        line += ` "${truncateByType(name, 'ELEMENT_NAME')}"`;
      }

      // Generate ref for interactive elements
      if (isInteractiveElement) {
        const ref = `@ref:${refCounter++}`;
        refMap.set(ref, element);
        line += ` ${ref}`;
        capturedInteractive++;

        try {
          const bbox = element.getBoundingClientRect();
          refs[ref] = {
            selector: generateSelector(element),
            role: role.split(' ')[0],
            name: name || undefined,
            bbox: {
              x: Math.round(bbox.x),
              y: Math.round(bbox.y),
              width: Math.round(bbox.width),
              height: Math.round(bbox.height)
            },
            inViewport: isInViewport(element, win)
          };
        } catch {
          refs[ref] = {
            selector: generateSimpleSelector(element),
            role: role.split(' ')[0],
            name: name || undefined
          };
        }
      }

      // Add input attributes
      line += getInputAttributes(element);

      // Add state info
      const states: string[] = [];
      if (element.hasAttribute('disabled')) states.push('disabled');
      if ((element as HTMLInputElement).checked) states.push('checked');
      if (element.getAttribute('aria-expanded') === 'true') states.push('expanded');
      if (element.getAttribute('aria-selected') === 'true') states.push('selected');

      if (states.length) line += ` (${states.join(', ')})`;

      // Add semantic xpath
      const xpath = buildSemanticXPath(element);
      line += ` ${xpath}`;

      lines.push(line);
    }
  }

  // Build header
  const pageHeader = `PAGE: ${document.location?.href || 'about:blank'} | ${document.title || 'Untitled'} | viewport=${win.innerWidth}x${win.innerHeight}`;

  // Apply grep filter if specified (supports Unix grep options)
  let filteredLines = lines;
  let grepDisplayPattern = '';

  if (grepPattern) {
    // Parse grep options
    const grepOpts = typeof grepPattern === 'string'
      ? { pattern: grepPattern }
      : grepPattern;

    const { pattern, ignoreCase = false, invert = false, fixedStrings = false } = grepOpts;
    grepDisplayPattern = pattern;

    // Build regex
    let regexPattern = fixedStrings
      ? pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')  // Escape regex chars
      : pattern;

    const flags = ignoreCase ? 'i' : '';

    try {
      const regex = new RegExp(regexPattern, flags);
      filteredLines = lines.filter(line => {
        const matches = regex.test(line);
        return invert ? !matches : matches;
      });
    } catch {
      // Invalid regex, fall back to string matching
      filteredLines = lines.filter(line => {
        const matches = ignoreCase
          ? line.toLowerCase().includes(pattern.toLowerCase())
          : line.includes(pattern);
        return invert ? !matches : matches;
      });
    }
  }

  // Build snapshot header with grep info if applicable
  let snapshotHeader = `SNAPSHOT: elements=${elements.length} refs=${capturedInteractive}`;
  if (grepPattern) {
    snapshotHeader += ` grep=${grepDisplayPattern} matches=${filteredLines.length}`;
  }

  const output = [pageHeader, snapshotHeader, '', ...filteredLines].join('\n');

  return {
    tree: output,
    refs,
    metadata: {
      totalInteractiveElements: totalInteractive,
      capturedElements: capturedInteractive,
      quality: 'high'
    }
  };
}
