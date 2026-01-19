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
  /** @deprecated Use mode: 'interactive' instead */
  interactive?: boolean;
  compact?: boolean;
  /** @deprecated Use mode instead */
  all?: boolean;
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
    interactive = true,
    all = false,
    mode,
    format = 'tree',
    grep: grepPattern
  } = options;

  // Dispatch based on mode
  const effectiveMode = mode || (all ? 'all' : (interactive ? 'interactive' : 'interactive'));

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
