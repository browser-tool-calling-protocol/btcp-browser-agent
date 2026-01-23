/**
 * @btcp/core - DOM Snapshot
 *
 * Generates a flat accessibility snapshot of the DOM.
 * Produces a compact, AI-friendly list of interactive elements.
 *
 * Supports three modes:
 * - 'interactive': Find clickable elements (default)
 * - 'outline': Understand page structure with xpaths + metadata
 * - 'content': Extract text content from sections
 */

import type { SnapshotData, RefMap, SnapshotMode, SnapshotFormat } from './types.js';

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
  compact?: boolean;
  /**
   * Snapshot mode:
   * - 'interactive': Find clickable elements (default)
   * - 'outline': Understand page structure with xpaths + metadata
   * - 'content': Extract text content from sections
   */
  mode?: SnapshotMode;
  /**
   * Output format:
   * - 'tree': Flat accessibility tree (default)
   * - 'html': Raw HTML
   * - 'markdown': Markdown formatted content
   */
  format?: SnapshotFormat;
  /** Grep filter - string pattern or options object */
  grep?: string | GrepOptions;
  /** Max chars per section in content mode */
  maxLength?: number;
  /** Include links as [text](url) in markdown format */
  includeLinks?: boolean;
  /** Include images as ![alt](src) in markdown format */
  includeImages?: boolean;
  /** Maximum number of lines for structure mode output (default: 100) */
  maxLines?: number;
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

  // Detect contenteditable elements (ProseMirror, Quill, TinyMCE, etc.)
  const contentEditable = element.getAttribute('contenteditable');
  if (contentEditable === 'true' || contentEditable === '') {
    return 'textbox';
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

  // Handle contenteditable elements (ProseMirror, Quill, TinyMCE, etc.)
  const contentEditable = element.getAttribute('contenteditable');
  if (contentEditable === 'true' || contentEditable === '') {
    // Try data-placeholder attribute (common in rich text editors)
    const placeholder = element.getAttribute('data-placeholder');
    if (placeholder) return placeholder.trim();

    // Try finding placeholder in child paragraph element
    const placeholderEl = element.querySelector('[data-placeholder]');
    if (placeholderEl) {
      const placeholderText = placeholderEl.getAttribute('data-placeholder');
      if (placeholderText) return placeholderText.trim();
    }
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
 * Check if element or any of its ancestors are hidden
 * This checks the full ancestor chain for proper visibility detection
 */
function isVisible(element: Element, checkAncestors: boolean = true): boolean {
  const win = element.ownerDocument.defaultView;
  if (!win) return true;

  const HTMLElementConstructor = win.HTMLElement;
  if (!(element instanceof HTMLElementConstructor)) return true;

  // Check inline styles first for performance
  const inlineDisplay = element.style.display;
  const inlineVisibility = element.style.visibility;
  if (inlineDisplay === 'none') return false;
  if (inlineVisibility === 'hidden') return false;

  // Check computed styles (but be defensive about failures)
  try {
    const style = win.getComputedStyle(element);
    if (style) {
      if (style.display === 'none') return false;
      if (style.visibility === 'hidden') return false;
      if (style.opacity === '0') return false;
    }
  } catch (e) {
    // If getComputedStyle fails (e.g., on intermediate pages), assume visible
    // This is safer than assuming hidden
  }

  if (element.hidden) return false;

  // Check ancestors if requested (for proper visibility detection)
  if (checkAncestors && element.parentElement) {
    return isVisible(element.parentElement, true);
  }

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

// Landmark roles that define page structure
const LANDMARK_ROLES = new Set([
  'banner', 'main', 'contentinfo', 'navigation', 'complementary', 'region'
]);

/**
 * Count words in text content
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Get full text content with whitespace normalization
 */
function getCleanTextContent(element: Element, maxLength?: number): string {
  const text = (element.textContent || '').replace(/\s+/g, ' ').trim();
  if (maxLength && text.length > maxLength) {
    return text.slice(0, maxLength - 3) + '...';
  }
  return text;
}

/**
 * Count specific child elements
 */
function countChildElements(element: Element, tagNames: string[]): number {
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
function getListItems(element: Element, maxItems: number = 10): string[] {
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
function detectCodeLanguage(element: Element): string | null {
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

/**
 * Build metadata string for outline mode
 */
function buildOutlineMetadata(element: Element): string {
  const parts: string[] = [];
  const wordCount = countWords(element.textContent || '');

  if (wordCount > 0) {
    parts.push(`${wordCount} words`);
  }

  // Count specific elements
  const links = element.querySelectorAll('a[href]').length;
  if (links > 0) parts.push(`${links} links`);

  const paragraphs = countChildElements(element, ['P']);
  if (paragraphs > 1) parts.push(`${paragraphs} paragraphs`);

  const listItems = countChildElements(element, ['LI']);
  if (listItems > 0) parts.push(`${listItems} items`);

  const codeBlocks = element.querySelectorAll('pre, code').length;
  if (codeBlocks > 0) parts.push(`${codeBlocks} code`);

  return parts.length > 0 ? `[${parts.join(', ')}]` : '';
}

/**
 * Get section name/label from element
 */
function getSectionName(element: Element): string {
  // Try aria-label first
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.trim();

  // Try aria-labelledby
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labels = labelledBy
      .split(/\s+/)
      .map(id => element.ownerDocument.getElementById(id)?.textContent?.trim())
      .filter(Boolean);
    if (labels.length) return labels.join(' ');
  }

  // Try id or class for name hint
  const id = element.id;
  if (id && id.length < 30 && !/^\d/.test(id)) {
    return id.replace(/[-_]/g, ' ');
  }

  const semanticClass = getSemanticClass(element);
  if (semanticClass) {
    return semanticClass.replace(/[-_]/g, ' ');
  }

  // Try first heading inside
  const heading = element.querySelector('h1, h2, h3, h4, h5, h6');
  if (heading) {
    return getCleanTextContent(heading, 50);
  }

  return '';
}

/**
 * Create all snapshot - comprehensive view with all elements (interactive + structural)
 * Returns everything: landmarks, sections, headings, interactive elements, links, images
 */
function createAllSnapshot(
  document: Document,
  refMap: RefMap,
  options: SnapshotOptions
): SnapshotData {
  const { root = document.body, maxDepth = 50, includeHidden = false } = options;

  refMap.clear();
  const lines: string[] = [];
  let refCounter = 0;
  const refs: SnapshotData['refs'] = {};

  // Collect all elements
  const elements: Element[] = [];

  function collectElements(element: Element, depth: number): void {
    if (depth > maxDepth) return;
    if (!includeHidden && !isVisible(element, false)) return;

    elements.push(element);

    for (const child of element.children) {
      collectElements(child, depth + 1);
    }
  }

  collectElements(root, 0);

  // Process ALL elements (no filtering)
  for (const element of elements) {
    const role = getRole(element);
    const isInteractiveElement = isInteractive(element);

    // Include ALL elements with a role or that are interactive
    if (!role && !isInteractiveElement) continue;

    const name = getAccessibleName(element);

    // Build line
    let line = '';

    if (role) {
      const roleUpper = role.toUpperCase();
      line = roleUpper;

      if (name) {
        line += ` "${truncateByType(name, 'ELEMENT_NAME')}"`;
      }

      // Generate ref for ALL elements
      const ref = `@ref:${refCounter++}`;
      refMap.set(ref, element);
      line += ` ${ref}`;

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
            height: Math.round(bbox.height),
          },
        };
      } catch {}

      // Add xpath path
      line += ` ${buildSemanticXPath(element)}`;
    }

    lines.push(line);
  }

  const win = document.defaultView || window;
  const url = win.location.href;
  const title = document.title;
  const viewport = `${win.innerWidth}x${win.innerHeight}`;

  const header = `PAGE: ${truncateByType(url, 'URL')} | ${truncateByType(title, 'TEXT_SHORT')} | viewport=${viewport}`;
  const subheader = `ALL: elements=${lines.length} refs=${refCounter}`;
  const tree = [header, subheader, '', ...lines].join('\n');

  return {
    tree,
    refs,
    metadata: {
      totalInteractiveElements: elements.filter(isInteractive).length,
      capturedElements: lines.length,
      quality: 'high'
    }
  };
}

/**
 * Pattern detection helper functions for structure mode
 */

/**
 * Create structure snapshot - high-level page structure insights with line budget
 * Shows: major landmarks, headings, and summarized interactive elements
 * Optimized with lazy statistics collection during breadth-first traversal
 */
function createStructureSnapshot(
  document: Document,
  refMap: RefMap,
  options: SnapshotOptions
): SnapshotData {
  const { root = document.body, maxDepth = 50, includeHidden = false, maxLines = 100 } = options;

  refMap.clear();
  const lines: string[] = [];
  const processedElements = new Set<Element>();

  // Landmark roles we want to show
  const landmarkRoles = new Set([
    'banner', 'navigation', 'main', 'complementary',
    'contentinfo', 'search', 'region', 'form'
  ]);

  // Lazy statistics collection - only for elements we show
  function countInteractiveDescendants(element: Element): { buttons: number; links: number; inputs: number; other: number } {
    const counts = { buttons: 0, links: 0, inputs: 0, other: 0 };
    const stack = [element];

    while (stack.length > 0) {
      const current = stack.pop()!;

      if (isVisible(current, false) && isInteractive(current)) {
        const role = getRole(current);
        const tag = current.tagName.toLowerCase();

        if (role === 'button' || tag === 'button') counts.buttons++;
        else if (role === 'link' || tag === 'a') counts.links++;
        else if (role === 'textbox' || role === 'searchbox' || role === 'combobox' || tag === 'input' || tag === 'textarea' || tag === 'select') counts.inputs++;
        else counts.other++;
      }

      // Add children to stack for traversal
      for (let i = current.children.length - 1; i >= 0; i--) {
        stack.push(current.children[i]);
      }
    }

    return counts;
  }

  // Breadth-first traversal with line budget
  interface QueueItem {
    element: Element;
    depth: number;
    indent: string;
  }

  const queue: QueueItem[] = [{ element: root, depth: 0, indent: '' }];
  let currentLineCount = 0;
  let truncated = false;

  while (queue.length > 0 && currentLineCount < maxLines) {
    const { element, depth, indent } = queue.shift()!;

    if (depth > maxDepth) continue;
    if (processedElements.has(element)) continue;

    // For structure mode: check semantic significance BEFORE visibility
    // This prevents filtering out landmarks/headings that have CSS visibility issues
    // due to missing external stylesheets in saved snapshots
    const role = getRole(element);
    const tag = element.tagName.toLowerCase();

    const isLandmark = role && landmarkRoles.has(role);
    const isHeading = role === 'heading' || /^h[1-6]$/.test(tag);
    const isFormElement = role === 'form' || tag === 'form';
    const isSemanticElement = isLandmark || isHeading || isFormElement;

    // Check visibility, but ALWAYS accept semantic elements regardless of CSS visibility
    // (prioritize semantic structure over CSS visibility for saved snapshots where
    // external stylesheets may not load correctly)
    const skipVisibilityCheck = isSemanticElement;
    if (!includeHidden && !skipVisibilityCheck && !isVisible(element, false)) {
      // Still queue children - they might be visible
      for (const child of element.children) {
        queue.push({ element: child, depth: depth + 1, indent });
      }
      continue;
    }

    processedElements.add(element);

    if (!isLandmark && !isHeading && !isFormElement) {
      // Not showing this element, but queue its children to continue search
      // For structure mode, we always traverse to find semantic elements
      // (no depth limiting for non-semantic elements, since we're only showing a small subset)
      for (const child of element.children) {
        queue.push({ element: child, depth: depth + 1, indent });
      }
      continue;
    }

    // Check if we have budget for this line
    if (currentLineCount >= maxLines) {
      truncated = true;
      break;
    }

    // We're showing this element - build the line with xpath
    const name = getAccessibleName(element);
    const roleUpper = (role || tag).toUpperCase();
    const xpath = buildSemanticXPath(element);

    let line = indent + roleUpper;

    if (name) {
      line += ` "${truncateByType(name, 'ELEMENT_NAME')}"`;
    }

    // For landmarks and forms, add interaction summary (computed lazily)
    if (isLandmark || isFormElement) {
      const counts = countInteractiveDescendants(element);
      const total = counts.buttons + counts.links + counts.inputs + counts.other;
      if (total > 0) {
        const parts = [];
        if (counts.buttons > 0) parts.push(`${counts.buttons} button${counts.buttons > 1 ? 's' : ''}`);
        if (counts.links > 0) parts.push(`${counts.links} link${counts.links > 1 ? 's' : ''}`);
        if (counts.inputs > 0) parts.push(`${counts.inputs} input${counts.inputs > 1 ? 's' : ''}`);
        if (counts.other > 0) parts.push(`${counts.other} other`);
        line += ` [${parts.join(', ')}]`;
      }
    }

    // Add xpath
    line += ` ${xpath}`;

    lines.push(line);
    currentLineCount++;

    // Always queue children of shown elements to find nested structure
    // This allows us to show nested landmarks, headings, and forms
    for (const child of element.children) {
      queue.push({ element: child, depth: depth + 1, indent: indent + '  ' });
    }
  }

  // Build headers with line budget info
  const win = document.defaultView || { innerWidth: 1024, innerHeight: 768 };
  const pageHeader = `PAGE: ${document.location?.href || 'about:blank'} | ${document.title || 'Untitled'} | viewport=${win.innerWidth}x${win.innerHeight}`;

  const totalElements = lines.length;
  const snapshotHeader = `STRUCTURE: elements=${totalElements} maxLines=${maxLines}${truncated ? ' (truncated)' : ''}`;

  // Combine headers and content
  const fullTree = [pageHeader, snapshotHeader, '', ...lines].join('\n');

  return {
    tree: fullTree,
    refs: {},
    metadata: {
      capturedElements: totalElements,
      quality: truncated ? 'medium' : 'high'
    }
  };
}

/**
 * Create head snapshot - lightweight HTTP HEAD-style page overview
 * Returns page metadata without DOM traversal for fast verification
 */
function createHeadSnapshot(
  document: Document,
  _refMap: RefMap,
  options: SnapshotOptions
): SnapshotData {
  const { root = document.body } = options;
  const win = document.defaultView || window;

  // Count elements (lightweight - no deep traversal)
  const allElements = root.querySelectorAll('*');
  const interactiveSelector = 'button, a[href], input, textarea, select, [role="button"], [tabindex]:not([tabindex="-1"])';
  const interactiveElements = root.querySelectorAll(interactiveSelector);

  // Page status detection
  const viewportArea = win.innerWidth * win.innerHeight;
  const hasInteractive = interactiveElements.length > 0;
  const isComplete = document.readyState === 'complete';

  let status = 'loading';
  if (viewportArea === 0) {
    status = 'loading';
  } else if (!hasInteractive) {
    status = 'empty';
  } else if (isComplete) {
    status = 'ready';
  } else {
    status = 'interactive';
  }

  // Build output
  const output = [
    `URL: ${document.location?.href || 'about:blank'}`,
    `TITLE: ${document.title || 'Untitled'}`,
    `VIEWPORT: ${win.innerWidth}x${win.innerHeight}`,
    `STATUS: ${status}`,
    `ELEMENTS: total=${allElements.length} interactive=${interactiveElements.length}`,
    `READY_STATE: ${document.readyState}`
  ].join('\n');

  return {
    tree: output,
    refs: {},  // No refs in head mode
    metadata: {
      totalInteractiveElements: interactiveElements.length,
      capturedElements: 0,
      quality: 'high'
    }
  };
}

/**
 * Create outline snapshot - structural overview with metadata
 */
function createOutlineSnapshot(
  document: Document,
  refMap: RefMap,
  options: SnapshotOptions
): SnapshotData {
  const {
    root = document.body,
    maxDepth = 50,
    includeHidden = false,
    grep: grepPattern
  } = options;

  refMap.clear();
  const win = document.defaultView || window;
  const refs: SnapshotData['refs'] = {};
  const lines: string[] = [];
  let refCounter = 0;

  // Stats for header
  let landmarkCount = 0;
  let sectionCount = 0;
  let headingCount = 0;
  let totalWords = 0;

  // Recursive function to build outline with indentation
  function buildOutline(element: Element, depth: number, indent: number): void {
    if (depth > maxDepth) return;
    if (!includeHidden && !isVisible(element, false)) return;

    const role = getRole(element);
    const tagName = element.tagName;

    // Track stats
    if (role?.startsWith('heading')) headingCount++;
    if (LANDMARK_ROLES.has(role || '')) landmarkCount++;

    // Determine if this element should be in the outline
    let shouldInclude = false;
    let line = '';
    const indentStr = '  '.repeat(indent);

    // Landmarks (MAIN, BANNER, etc.)
    if (role && LANDMARK_ROLES.has(role)) {
      shouldInclude = true;
      const roleUpper = role.toUpperCase();
      const name = getSectionName(element);
      const metadata = buildOutlineMetadata(element);
      const xpath = buildSemanticXPath(element);

      // Generate ref for landmarks
      const ref = `@ref:${refCounter++}`;
      refMap.set(ref, element);
      refs[ref] = {
        selector: generateSelector(element),
        role: role,
        name: name || undefined
      };

      line = `${indentStr}${roleUpper}`;
      if (name) line += ` "${truncateByType(name, 'ELEMENT_NAME')}"`;
      line += ` ${ref}`;
      if (metadata) line += ` ${metadata}`;
      line += ` ${xpath}`;

      sectionCount++;
    }
    // Headings
    else if (role?.startsWith('heading')) {
      shouldInclude = true;
      const level = tagName[1];
      const text = getCleanTextContent(element, 60);
      const xpath = buildSemanticXPath(element);

      line = `${indentStr}HEADING level=${level}`;
      if (text) line += ` "${text}"`;
      line += ` ${xpath}`;
    }
    // Articles and named sections/regions
    else if (tagName === 'ARTICLE' || (tagName === 'SECTION' && (element.id || element.getAttribute('aria-label')))) {
      shouldInclude = true;
      const roleUpper = tagName === 'ARTICLE' ? 'ARTICLE' : 'REGION';
      const name = getSectionName(element);
      const metadata = buildOutlineMetadata(element);
      const xpath = buildSemanticXPath(element);

      // Generate ref
      const ref = `@ref:${refCounter++}`;
      refMap.set(ref, element);
      refs[ref] = {
        selector: generateSelector(element),
        role: roleUpper.toLowerCase(),
        name: name || undefined
      };

      line = `${indentStr}${roleUpper}`;
      if (name) line += ` "${truncateByType(name, 'ELEMENT_NAME')}"`;
      line += ` ${ref}`;
      if (metadata) line += ` ${metadata}`;
      line += ` ${xpath}`;

      sectionCount++;
    }
    // Divs with semantic id/class that contain substantial content
    else if (tagName === 'DIV' && (element.id || getSemanticClass(element))) {
      const wordCount = countWords(element.textContent || '');
      if (wordCount > 50) {
        shouldInclude = true;
        const name = getSectionName(element);
        const metadata = buildOutlineMetadata(element);
        const xpath = buildSemanticXPath(element);

        const ref = `@ref:${refCounter++}`;
        refMap.set(ref, element);
        refs[ref] = {
          selector: generateSelector(element),
          role: 'region',
          name: name || undefined
        };

        line = `${indentStr}REGION`;
        if (name) line += ` "${truncateByType(name, 'ELEMENT_NAME')}"`;
        line += ` ${ref}`;
        if (metadata) line += ` ${metadata}`;
        line += ` ${xpath}`;

        sectionCount++;
      }
    }
    // Paragraph counts (grouped under parent)
    else if (tagName === 'P' && depth > 0) {
      // Don't include individual paragraphs, they're counted in metadata
    }
    // Lists
    else if (tagName === 'UL' || tagName === 'OL') {
      const items = element.querySelectorAll(':scope > li').length;
      if (items > 0) {
        shouldInclude = true;
        const xpath = buildSemanticXPath(element);
        line = `${indentStr}LIST [${items} items] ${xpath}`;
      }
    }
    // Code blocks
    else if (tagName === 'PRE') {
      shouldInclude = true;
      const lang = detectCodeLanguage(element);
      const lineCount = (element.textContent || '').split('\n').length;
      const xpath = buildSemanticXPath(element);

      line = `${indentStr}CODE`;
      if (lang) line += ` [${lang}]`;
      line += ` [${lineCount} lines]`;
      line += ` ${xpath}`;
    }

    if (shouldInclude && line) {
      lines.push(line);
    }

    // Recurse into children (increase indent if we included this element)
    const nextIndent = shouldInclude ? indent + 1 : indent;
    for (const child of element.children) {
      buildOutline(child, depth + 1, nextIndent);
    }
  }

  buildOutline(root, 0, 0);

  // Calculate total words
  totalWords = countWords(root.textContent || '');

  // Apply grep filter
  let filteredLines = lines;
  let grepDisplayPattern = '';

  if (grepPattern) {
    const grepOpts = typeof grepPattern === 'string'
      ? { pattern: grepPattern }
      : grepPattern;

    const { pattern, ignoreCase = false, invert = false, fixedStrings = false } = grepOpts;
    grepDisplayPattern = pattern;

    let regexPattern = fixedStrings
      ? pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      : pattern;

    const flags = ignoreCase ? 'i' : '';

    try {
      const regex = new RegExp(regexPattern, flags);
      filteredLines = lines.filter(line => {
        const matches = regex.test(line);
        return invert ? !matches : matches;
      });
    } catch {
      filteredLines = lines.filter(line => {
        const matches = ignoreCase
          ? line.toLowerCase().includes(pattern.toLowerCase())
          : line.includes(pattern);
        return invert ? !matches : matches;
      });
    }
  }

  // Build headers
  const pageHeader = `PAGE: ${document.location?.href || 'about:blank'} | ${document.title || 'Untitled'} | viewport=${win.innerWidth}x${win.innerHeight}`;
  let outlineHeader = `OUTLINE: landmarks=${landmarkCount} sections=${sectionCount} headings=${headingCount} words=${totalWords}`;
  if (grepPattern) {
    outlineHeader += ` grep=${grepDisplayPattern} matches=${filteredLines.length}`;
  }

  const output = [pageHeader, outlineHeader, '', ...filteredLines].join('\n');

  return {
    tree: output,
    refs,
    metadata: {
      totalInteractiveElements: sectionCount,
      capturedElements: refCounter,
      quality: 'high'
    }
  };
}

/**
 * Content section for markdown generation
 */
interface ContentSection {
  xpath: string;
  element: Element;
  heading?: string;
  headingLevel?: number;
}

/**
 * Create content snapshot - extract text content from sections
 */
function createContentSnapshot(
  document: Document,
  refMap: RefMap,
  options: SnapshotOptions
): SnapshotData {
  const {
    root = document.body,
    maxDepth = 50,
    includeHidden = false,
    format = 'tree',
    grep: grepPattern,
    maxLength = 2000,
    includeLinks = true,
    includeImages = false
  } = options;

  refMap.clear();
  const refs: SnapshotData['refs'] = {};
  let refCounter = 0;

  // Collect content sections based on grep pattern
  const sections: ContentSection[] = [];

  function collectSections(element: Element, depth: number): void {
    if (depth > maxDepth) return;
    if (!includeHidden && !isVisible(element, false)) return;

    const xpath = buildSemanticXPath(element);
    const role = getRole(element);
    const tagName = element.tagName;

    // Check if this element should be a section
    let isSection = false;

    // Landmarks and articles are sections
    if (role && (LANDMARK_ROLES.has(role) || role === 'article')) {
      isSection = true;
    }
    // Named sections/regions
    else if (tagName === 'SECTION' && (element.id || element.getAttribute('aria-label'))) {
      isSection = true;
    }
    // Semantic divs with substantial content
    else if (tagName === 'DIV' && (element.id || getSemanticClass(element))) {
      const wordCount = countWords(element.textContent || '');
      if (wordCount > 30) isSection = true;
    }

    if (isSection) {
      // Get first heading in section
      const heading = element.querySelector('h1, h2, h3, h4, h5, h6');
      sections.push({
        xpath,
        element,
        heading: heading ? getCleanTextContent(heading, 100) : undefined,
        headingLevel: heading ? parseInt(heading.tagName[1]) : undefined
      });
    }

    // Recurse into children
    for (const child of element.children) {
      collectSections(child, depth + 1);
    }
  }

  collectSections(root, 0);

  // Filter sections by grep pattern (matches xpath)
  let filteredSections = sections;
  let grepDisplayPattern = '';

  if (grepPattern) {
    const grepOpts = typeof grepPattern === 'string'
      ? { pattern: grepPattern }
      : grepPattern;

    const { pattern, ignoreCase = false, invert = false, fixedStrings = false } = grepOpts;
    grepDisplayPattern = pattern;

    let regexPattern = fixedStrings
      ? pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      : pattern;

    const flags = ignoreCase ? 'i' : '';

    try {
      const regex = new RegExp(regexPattern, flags);
      filteredSections = sections.filter(section => {
        const matches = regex.test(section.xpath);
        return invert ? !matches : matches;
      });
    } catch {
      filteredSections = sections.filter(section => {
        const matches = ignoreCase
          ? section.xpath.toLowerCase().includes(pattern.toLowerCase())
          : section.xpath.includes(pattern);
        return invert ? !matches : matches;
      });
    }
  }

  // Generate output based on format
  if (format === 'markdown') {
    return generateMarkdownContent(document, filteredSections, refs, refMap, refCounter, {
      maxLength,
      includeLinks,
      includeImages
    });
  }

  // Tree format (default for content mode)
  const lines: string[] = [];
  let totalWords = 0;

  for (const section of filteredSections) {
    const sectionWords = countWords(section.element.textContent || '');
    totalWords += sectionWords;

    lines.push(`SECTION ${section.xpath} [${sectionWords} words]`);

    // Extract content from section
    extractContentLines(section.element, lines, '  ', maxLength, refMap, refs, refCounter);
    lines.push('');
  }

  // Build headers
  const pageHeader = `PAGE: ${document.location?.href || 'about:blank'} | ${document.title || 'Untitled'}`;
  let contentHeader = `CONTENT: sections=${filteredSections.length} words=${totalWords}`;
  if (grepPattern) {
    contentHeader += ` grep=${grepDisplayPattern}`;
  }

  const output = [pageHeader, contentHeader, '', ...lines].join('\n');

  return {
    tree: output,
    refs,
    metadata: {
      totalInteractiveElements: filteredSections.length,
      capturedElements: Object.keys(refs).length,
      quality: 'high'
    }
  };
}

/**
 * Extract content lines from an element (for tree format)
 */
function extractContentLines(
  element: Element,
  lines: string[],
  indent: string,
  maxLength: number,
  refMap: RefMap,
  refs: SnapshotData['refs'],
  refCounter: number
): void {
  const tagName = element.tagName;
  const role = getRole(element);

  // Headings
  if (role?.startsWith('heading')) {
    const level = tagName[1];
    const text = getCleanTextContent(element, 100);
    lines.push(`${indent}HEADING level=${level} "${text}"`);
    return;
  }

  // Paragraphs
  if (tagName === 'P') {
    const text = getCleanTextContent(element, maxLength);
    if (text) {
      lines.push(`${indent}TEXT "${text}"`);
    }
    return;
  }

  // Lists
  if (tagName === 'UL' || tagName === 'OL') {
    const items = getListItems(element, 10);
    if (items.length > 0) {
      lines.push(`${indent}LIST [${items.length} items]`);
      for (const item of items) {
        lines.push(`${indent}  - "${item}"`);
      }
    }
    return;
  }

  // Code blocks
  if (tagName === 'PRE') {
    const lang = detectCodeLanguage(element);
    const code = (element.textContent || '').trim();
    const codeLines = code.split('\n');
    const preview = codeLines.slice(0, 5).join('\n');

    let line = `${indent}CODE`;
    if (lang) line += ` [${lang}, ${codeLines.length} lines]`;
    else line += ` [${codeLines.length} lines]`;
    lines.push(line);

    // Add preview of code
    for (const codeLine of preview.split('\n')) {
      lines.push(`${indent}  ${codeLine}`);
    }
    if (codeLines.length > 5) {
      lines.push(`${indent}  ...`);
    }
    return;
  }

  // Recurse into other elements
  for (const child of element.children) {
    extractContentLines(child, lines, indent, maxLength, refMap, refs, refCounter);
  }
}

/**
 * Generate markdown content output
 */
function generateMarkdownContent(
  document: Document,
  sections: ContentSection[],
  refs: SnapshotData['refs'],
  refMap: RefMap,
  refCounter: number,
  options: {
    maxLength: number;
    includeLinks: boolean;
    includeImages: boolean;
  }
): SnapshotData {
  const { maxLength, includeLinks, includeImages } = options;
  const lines: string[] = [];
  let totalWords = 0;

  // Source comment
  lines.push(`<!-- source: ${document.location?.href || 'about:blank'} -->`);

  for (const section of sections) {
    const sectionWords = countWords(section.element.textContent || '');
    totalWords += sectionWords;

    // Section xpath comment
    lines.push(`<!-- xpath: ${section.xpath} -->`);
    lines.push('');

    // Extract markdown content
    extractMarkdownContent(section.element, lines, maxLength, includeLinks, includeImages, refMap, refs, refCounter);
    lines.push('');
  }

  // End comment
  lines.push(`<!-- end: ${totalWords} words extracted -->`);

  const output = lines.join('\n');

  return {
    tree: output,
    refs,
    metadata: {
      totalInteractiveElements: sections.length,
      capturedElements: Object.keys(refs).length,
      quality: 'high'
    }
  };
}

/**
 * Extract markdown content from element
 */
function extractMarkdownContent(
  element: Element,
  lines: string[],
  maxLength: number,
  includeLinks: boolean,
  includeImages: boolean,
  refMap: RefMap,
  refs: SnapshotData['refs'],
  refCounter: number
): void {
  const tagName = element.tagName;
  const role = getRole(element);

  // Headings
  if (role?.startsWith('heading')) {
    const level = parseInt(tagName[1]);
    const text = getCleanTextContent(element, 100);
    const prefix = '#'.repeat(level);
    lines.push(`${prefix} ${text}`);
    lines.push('');
    return;
  }

  // Paragraphs
  if (tagName === 'P') {
    const text = getCleanTextContent(element, maxLength);
    if (text) {
      lines.push(text);
      lines.push('');
    }
    return;
  }

  // Lists
  if (tagName === 'UL') {
    const items = element.querySelectorAll(':scope > li');
    for (const item of items) {
      const text = getCleanTextContent(item as Element, 200);
      if (text) lines.push(`- ${text}`);
    }
    lines.push('');
    return;
  }

  if (tagName === 'OL') {
    const items = element.querySelectorAll(':scope > li');
    let i = 1;
    for (const item of items) {
      const text = getCleanTextContent(item as Element, 200);
      if (text) lines.push(`${i}. ${text}`);
      i++;
    }
    lines.push('');
    return;
  }

  // Code blocks
  if (tagName === 'PRE') {
    const lang = detectCodeLanguage(element) || '';
    const code = (element.textContent || '').trim();
    lines.push('```' + lang);
    lines.push(code);
    lines.push('```');
    lines.push('');
    return;
  }

  // Blockquotes
  if (tagName === 'BLOCKQUOTE') {
    const text = getCleanTextContent(element, maxLength);
    if (text) {
      const quotedLines = text.split('\n').map(l => `> ${l}`);
      lines.push(...quotedLines);
      lines.push('');
    }
    return;
  }

  // Images (if requested)
  if (includeImages && tagName === 'IMG') {
    const alt = element.getAttribute('alt') || 'image';
    const src = element.getAttribute('src') || '';
    lines.push(`![${alt}](${src})`);
    lines.push('');
    return;
  }

  // Recurse into other elements
  for (const child of element.children) {
    extractMarkdownContent(child, lines, maxLength, includeLinks, includeImages, refMap, refs, refCounter);
  }
}

/**
 * Generate flat snapshot of the DOM
 *
 * Supports three modes:
 * - 'interactive' (default): Find clickable elements with @ref markers
 * - 'outline': Structural overview with xpaths and metadata
 * - 'content': Extract text content from sections
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
    mode = 'interactive',
    format = 'tree',
    grep: grepPattern
  } = options;

  // Dispatch based on mode
  const effectiveMode = mode;

  if (effectiveMode === 'head') {
    return createHeadSnapshot(document, refMap, { ...options, root });
  }

  if (effectiveMode === 'all') {
    return createAllSnapshot(document, refMap, { ...options, root });
  }

  if (effectiveMode === 'structure') {
    return createStructureSnapshot(document, refMap, { ...options, root });
  }

  if (effectiveMode === 'outline') {
    return createOutlineSnapshot(document, refMap, { ...options, root });
  }

  if (effectiveMode === 'content') {
    return createContentSnapshot(document, refMap, { ...options, root });
  }

  // Default: interactive mode (original behavior)

  // Fast path for HTML format - return raw body HTML without processing
  if (format === 'html') {
    const bodyHTML = document.body?.outerHTML || '';

    return {
      tree: bodyHTML,
      refs: {},
      metadata: {
        totalInteractiveElements: 0,
        capturedElements: 0,
        quality: 'high',
        warnings: ['Raw HTML format - no filtering or ref generation applied']
      }
    };
  }

  refMap.clear();

  const win = document.defaultView || window;
  const refs: SnapshotData['refs'] = {};
  const lines: string[] = [];
  let refCounter = 0;

  // Collect all elements
  const elements: Element[] = [];

  function collectElements(element: Element, depth: number): void {
    if (depth > maxDepth) return;
    // Only check element-level visibility, not ancestors (we're already traversing the tree)
    if (!includeHidden && !isVisible(element, false)) return;

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

    // Skip non-interactive elements in interactive mode
    if (!isInteractiveElement) continue;

    // Skip elements without role
    if (!role) continue;

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

  // Detect problematic page states
  const warnings: string[] = [];
  const viewportArea = win.innerWidth * win.innerHeight;

  if (viewportArea === 0) {
    warnings.push('Viewport not initialized (0x0) - page may be loading or redirecting');
  }

  if (capturedInteractive === 0 && totalInteractive === 0 && elements.length < 10) {
    warnings.push('Page appears to be empty or transitional - wait for content to load');
  }

  if (document.location?.href.includes('RotateCookies') ||
      document.location?.href.includes('ServiceLogin') ||
      document.location?.href.includes('/blank')) {
    warnings.push('Detected intermediate/redirect page - snapshot may not contain meaningful content');
  }

  return {
    tree: output,
    refs,
    metadata: {
      totalInteractiveElements: totalInteractive,
      capturedElements: capturedInteractive,
      quality: viewportArea === 0 || capturedInteractive === 0 ? 'low' : capturedInteractive < totalInteractive * 0.5 ? 'medium' : 'high',
      warnings: warnings.length > 0 ? warnings : undefined
    }
  };
}
