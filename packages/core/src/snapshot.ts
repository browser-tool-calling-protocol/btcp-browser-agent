/**
 * @btcp/core - DOM Snapshot
 *
 * Generates accessibility tree representation of the DOM.
 * Produces a compact, AI-friendly view of page structure.
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

interface SnapshotOptions {
  root?: Element;
  maxDepth?: number;
  includeHidden?: boolean;
  interactive?: boolean;
  compact?: boolean;
  minDepth?: number;
  samplingStrategy?: 'importance' | 'balanced' | 'depth-first';
  contentPreview?: boolean;
  landmarks?: boolean;
  incremental?: boolean;
  baseSnapshot?: import('./types.js').SnapshotData;
  all?: boolean;
}

interface SizeMetrics {
  elementCount: number;
  depthReached: number;
  depthLimited: boolean;
  limitReason?: string;
  totalInteractiveElements: number;
  capturedInteractiveElements: number;
  processingErrors: string[];
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
 * Get the ARIA role for an element with optional semantic enrichment
 */
function getRole(element: Element, options?: { enriched?: boolean }): string | null {
  // Explicit role
  const explicitRole = element.getAttribute('role');
  if (explicitRole) return explicitRole;

  const tagName = element.tagName;

  // Special handling for headings - include level
  if (tagName.match(/^H[1-6]$/)) {
    const level = tagName[1];
    return options?.enriched ? `heading level=${level}` : 'heading';
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

  // Type for inputs
  if (isInput && (element as HTMLInputElement).type && (element as HTMLInputElement).type !== 'text') {
    attrs.push(`type=${(element as HTMLInputElement).type}`);
  }

  // Validation attributes
  if ((element as HTMLInputElement | HTMLTextAreaElement).required) attrs.push('required');
  if (element.getAttribute('aria-invalid') === 'true') attrs.push('invalid');

  // Constraints
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
 * Get error message associated via aria-describedby
 */
function getErrorMessage(element: Element, document: Document): string {
  const describedBy = element.getAttribute('aria-describedby');
  if (!describedBy) return '';

  const describedElement = document.getElementById(describedBy);
  if (!describedElement) return '';

  const errorText = describedElement.textContent?.trim();
  if (!errorText) return '';

  // Check if it looks like an error (contains error-related attributes or classes)
  const isError = describedElement.hasAttribute('role') && describedElement.getAttribute('role') === 'alert' ||
                  describedElement.className.includes('error') ||
                  describedElement.className.includes('invalid') ||
                  element.getAttribute('aria-invalid') === 'true';

  if (isError) {
    return `\n    → error: "${truncateByType(errorText, 'ERROR_MESSAGE')}"`;
  }

  return '';
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
    // Get text but exclude the input's own value
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

  // Priority: aria-label > aria-labelledby > text > value > title
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
  // Priority: aria-label > aria-labelledby > text > title > href
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

  // Fallback: generate name from href
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
  // Priority: aria-label > aria-labelledby > label[for] > enclosing label > title
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

  // Check for associated label via id
  const id = element.getAttribute('id');
  if (id) {
    const label = element.ownerDocument.querySelector(`label[for="${id}"]`);
    if (label) {
      const labelText = label.textContent?.trim();
      if (labelText) return labelText;
    }
  }

  // Check for enclosing label
  const enclosingLabel = getEnclosingLabel(element);
  if (enclosingLabel) return enclosingLabel;

  // Title as fallback (NOT placeholder)
  const title = element.getAttribute('title');
  if (title) return title.trim();

  return '';
}

/**
 * Get label for image elements
 */
function getImageLabel(element: HTMLImageElement): string {
  // Priority: aria-label > aria-labelledby > alt > title > filename
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

  // Fallback: filename from src
  const src = element.getAttribute('src');
  if (src) {
    const filename = src.split('/').pop()?.split('?')[0].replace(/\.\w+$/, '');
    if (filename) return filename.replace(/[-_]/g, ' ');
  }

  return '';
}

/**
 * Get accessible name for an element (smart type-aware selection)
 */
function getAccessibleName(element: Element): string {
  const constructors = getHTMLConstructors(element);

  // Button elements
  const isButton = constructors.HTMLButtonElement && element instanceof constructors.HTMLButtonElement;
  const isInputButton = constructors.HTMLInputElement &&
                        element instanceof constructors.HTMLInputElement &&
                        ['button', 'submit', 'reset'].includes((element as HTMLInputElement).type);

  if (isButton || isInputButton) {
    return getButtonLabel(element as HTMLButtonElement | HTMLInputElement);
  }

  // Link elements
  const isAnchor = constructors.HTMLAnchorElement && element instanceof constructors.HTMLAnchorElement;
  if (isAnchor) {
    return getLinkLabel(element as HTMLAnchorElement);
  }

  // Form control elements (input, textarea, select)
  const isInput = constructors.HTMLInputElement && element instanceof constructors.HTMLInputElement;
  const isTextArea = constructors.HTMLTextAreaElement && element instanceof constructors.HTMLTextAreaElement;
  const isSelect = constructors.HTMLSelectElement && element instanceof constructors.HTMLSelectElement;

  if (isInput || isTextArea || isSelect) {
    return getFormControlLabel(element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement);
  }

  // Image elements
  const isImage = constructors.HTMLImageElement && element instanceof constructors.HTMLImageElement;
  if (isImage) {
    return getImageLabel(element as HTMLImageElement);
  }

  // Generic fallback for other elements
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
  // Get HTMLElement from the element's window to support jsdom
  const win = element.ownerDocument.defaultView;
  if (!win) return true;

  const HTMLElementConstructor = win.HTMLElement;
  if (!(element instanceof HTMLElementConstructor)) return true;

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
  // Filter out non-interactive anchor name tags (legacy HTML fragment identifiers)
  // These are <a name="..."></a> tags without href - not clickable
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
 * Truncate text with smart word boundary preservation
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  // If we found a space and it's not too early in the string, break at word boundary
  if (lastSpace > maxLength * 0.7) {
    return truncated.substring(0, lastSpace) + '...';
  }

  return truncated + '...';
}

/**
 * Extract filename from image src URL
 */
function extractFilename(src: string): string {
  try {
    const url = new URL(src, window.location.href);
    const pathname = url.pathname;
    const filename = pathname.substring(pathname.lastIndexOf('/') + 1);
    return filename || 'image';
  } catch {
    return 'image';
  }
}

/**
 * Check if element is empty structural element (for compact mode)
 */
function isEmptyStructural(element: Element, role: string | null): boolean {
  if (!role) return false;

  // Structural roles that might be empty containers
  const structuralRoles = [
    'region', 'group', 'list', 'listitem', 'table', 'row', 'cell',
    'rowgroup', 'columnheader', 'banner', 'contentinfo', 'complementary',
    'main', 'navigation', 'article', 'form'
  ];

  if (!structuralRoles.includes(role)) return false;

  // Check if it has no accessible name and no interactive descendants
  const name = getAccessibleName(element);
  if (name) return false;

  // Check if it has any interactive descendants
  const hasInteractiveDescendants = Array.from(element.querySelectorAll('*')).some(
    (el) => isInteractive(el as Element)
  );

  return !hasInteractiveDescendants;
}

/**
 * Generate snapshot of the DOM
 */
export function createSnapshot(
  document: Document,
  refMap: RefMap,
  options: SnapshotOptions = {}
): SnapshotData {
  const {
    root = document.body,
    maxDepth = 10,
    includeHidden = false,
    interactive = false,
    compact = true,
    minDepth = 5,
    contentPreview = true,
    landmarks = true,
    all = false
  } = options;

  // Clear old refs before generating new snapshot
  refMap.clear();

  const win = document.defaultView || window;
  const refs: SnapshotData['refs'] = {};
  const lines: string[] = [];
  let refCounter = 0;

  // Pass 1: Quick count to determine adaptive depth and total interactive elements
  let estimatedCount = 0;
  let totalInteractive = 0;
  function countPass(el: Element, d: number): void {
    if (d > maxDepth || estimatedCount > 5000) return;
    if (!includeHidden && !isVisible(el)) return;
    estimatedCount++;
    if (isInteractive(el)) totalInteractive++;
    for (const child of el.children) {
      countPass(child, d + 1);
    }
  }

  try {
    countPass(root, 0);
  } catch (error) {
    // Count pass failed, use estimates
    estimatedCount = 1000;
    totalInteractive = 100;
  }

  // Calculate adaptive depth
  const { effectiveDepth, limited, reason } = calculateAdaptiveDepth(
    estimatedCount,
    maxDepth,
    minDepth,
    interactive
  );

  // Metrics tracking
  const metrics: SizeMetrics = {
    elementCount: 0,
    depthReached: 0,
    depthLimited: limited,
    limitReason: reason,
    totalInteractiveElements: totalInteractive,
    capturedInteractiveElements: 0,
    processingErrors: []
  };

  // Add page context header
  const modes: string[] = [];
  if (interactive) modes.push('interactive');
  if (compact) modes.push('compact');
  if (includeHidden) modes.push('include-hidden');
  if (landmarks) modes.push('landmarks');
  if (contentPreview) modes.push('content-preview');
  if (all) modes.push('all');

  const depthInfo = limited ? `${effectiveDepth}/${maxDepth} (auto-limited: ${reason})` : `${effectiveDepth}/${maxDepth}`;
  const pageHeader = `PAGE: ${document.location?.href || 'about:blank'} | ${document.title || 'Untitled'} | viewport=${win.innerWidth}x${win.innerHeight}`;

  // Snapshot header will be updated at the end with actual captured count
  const snapshotHeaderPlaceholder = lines.length;
  lines.push(pageHeader, '', '');

  // Track processed forms and fieldsets to add boundaries
  const processedForms = new Set<Element>();
  const processedFieldsets = new Set<Element>();

  function generateRef(element: Element): string {
    const ref = `@ref:${refCounter++}`;
    refMap.set(ref, element);
    return ref;
  }

  function processNode(element: Element, depth: number, indent: string): void {
    if (depth > effectiveDepth) return;

    // Track metrics
    metrics.elementCount++;
    metrics.depthReached = Math.max(metrics.depthReached, depth);

    // Skip hidden elements unless requested
    if (!includeHidden && !isVisible(element)) return;

    // Check for form/fieldset boundaries
    const isFormElement = element.tagName === 'FORM';
    const isFieldsetElement = element.tagName === 'FIELDSET';

    // Add form boundary
    if (isFormElement && !processedForms.has(element)) {
      processedForms.add(element);
      const form = element as HTMLFormElement;
      const formId = form.id ? ` id=${form.id}` : '';
      const action = form.action ? ` action=${form.action}` : '';
      const method = form.method ? ` method=${form.method.toUpperCase()}` : '';
      lines.push(`${indent}FORM${formId}${action}${method}`);
      indent = indent + '  ';
    }

    // Add fieldset boundary
    if (isFieldsetElement && !processedFieldsets.has(element)) {
      processedFieldsets.add(element);
      const fieldset = element as HTMLFieldSetElement;
      const legend = fieldset.querySelector('legend');
      const groupName = legend ? ` "${truncateByType(legend.textContent?.trim() || '', 'ELEMENT_NAME')}"` : '';
      lines.push(`${indent}GROUP${groupName}`);
      indent = indent + '  ';
    }

    const role = getRole(element, { enriched: true });
    const name = getAccessibleName(element);
    const isInteractiveElement = isInteractive(element);

    // Handle 'all' mode: capture images, headings, and text content
    if (all) {
      const tagName = element.tagName;

      // Handle images
      if (tagName === 'IMG') {
        const img = element as HTMLImageElement;
        const alt = img.alt?.trim();
        const title = img.title?.trim();
        const imgText = alt || title || extractFilename(img.src);
        if (imgText) {
          const truncatedText = truncateText(imgText, 100);
          lines.push(`${indent}IMAGE "${truncatedText}" src="${img.src}"`);
        }
        return; // Images don't have children to process
      }

      // Handle headings (h1-h6)
      if (tagName.match(/^H[1-6]$/)) {
        const level = tagName.charAt(1);
        const text = element.textContent?.trim();
        if (text) {
          const truncatedText = truncateText(text, 150);
          lines.push(`${indent}HEADING_${level} "${truncatedText}"`);
        }
        return; // Headings typically don't have meaningful children
      }

      // Handle paragraphs and text blocks
      if (tagName === 'P' || (tagName === 'DIV' && element.children.length === 0)) {
        const text = element.textContent?.trim();
        // Only include substantial text (>20 characters)
        if (text && text.length > 20) {
          const truncatedText = truncateText(text, 200);
          lines.push(`${indent}TEXT "${truncatedText}"`);
        }
        // Paragraphs might have children, continue processing
        if (tagName === 'P') {
          const childIndent = indent + '  ';
          for (const child of element.children) {
            processNode(child, depth + 1, childIndent);
          }
          return;
        }
      }
    }

    // Interactive mode: skip non-interactive elements
    if (interactive && !isInteractiveElement && !isFormElement && !isFieldsetElement) {
      // Still process children in case they have interactive elements
      for (const child of element.children) {
        processNode(child, depth + 1, indent);
      }
      return;
    }

    // Compact mode: skip empty structural elements
    if (compact && isEmptyStructural(element, role)) {
      // Still process children
      for (const child of element.children) {
        processNode(child, depth + 1, indent);
      }
      return;
    }

    // Skip non-semantic elements without interesting content
    if (!role && !name && element.children.length === 0 && !isFormElement && !isFieldsetElement) return;

    // Build node representation
    if (role) {
      let line = indent;

      // Generate ref for interactive elements (always for interactive elements, regardless of mode)
      let ref: string | undefined;
      if (isInteractiveElement) {
        ref = generateRef(element);
        metrics.capturedInteractiveElements++;

        // Enhanced refs with bounding box, viewport info, importance, and context
        try {
          const bbox = element.getBoundingClientRect();
          const importance = calculateImportance(element, role);
          const context = role === 'link' ? extractLinkContext(element) : undefined;

          refs[ref] = {
            selector: generateSelector(element),
            role: role.split(' ')[0], // Just the role name without attributes
            name: name || undefined,
            bbox: {
              x: Math.round(bbox.x),
              y: Math.round(bbox.y),
              width: Math.round(bbox.width),
              height: Math.round(bbox.height)
            },
            inViewport: isInViewport(element, win),
            importance,
            context
          };
        } catch (error) {
          // Ref generation failed, use minimal ref
          refs[ref] = {
            selector: generateSimpleSelector(element),
            role: role.split(' ')[0],
            name: name || undefined
          };
          metrics.processingErrors.push(`Ref generation error for ${ref}`);
        }
      }

      // Format: ROLE "name" @ref attributes
      const roleUpper = role.toUpperCase();
      line += roleUpper;
      if (name) line += ` "${truncateByType(name, 'ELEMENT_NAME')}"`;
      if (ref) line += ` @ref:${ref.replace('@ref:', '')}`;

      // Add input attributes
      line += getInputAttributes(element);

      // Add state info
      const states: string[] = [];
      if (element.hasAttribute('disabled')) states.push('disabled');
      if ((element as HTMLInputElement).checked) states.push('checked');
      if (element.getAttribute('aria-expanded') === 'true') states.push('expanded');
      if (element.getAttribute('aria-selected') === 'true') states.push('selected');

      if (states.length) line += ` (${states.join(', ')})`;

      // Add children indicator if we have children
      const totalChildren = countVisibleChildren(element, includeHidden);
      if (totalChildren > 0) {
        let shownChildren = 0;
        let indicatorReason: 'depth-limit' | 'compact-mode' | 'interactive-filter' | undefined;

        // Count how many children will actually be shown
        if (depth + 1 > effectiveDepth) {
          // At depth limit - no children will be shown
          indicatorReason = 'depth-limit';
        } else {
          // Count children that pass filters
          for (const child of element.children) {
            if (!includeHidden && !isVisible(child)) continue;
            if (interactive && !isInteractive(child) && child.tagName !== 'FORM' && child.tagName !== 'FIELDSET') {
              continue;
            }
            if (compact && isEmptyStructural(child, getRole(child, { enriched: true }))) {
              continue;
            }
            shownChildren++;
          }

          if (shownChildren < totalChildren) {
            if (interactive) indicatorReason = 'interactive-filter';
            else if (compact) indicatorReason = 'compact-mode';
          }
        }

        const childIndicator = formatChildrenIndicator(totalChildren, shownChildren, indicatorReason);
        if (childIndicator) {
          line += childIndicator;
        }
      }

      lines.push(line);

      // Add link context if available
      if (role === 'link' && ref) {
        const linkContext = refs[ref]?.context;
        if (linkContext) {
          lines.push(`${indent}  → context: "${linkContext}"`);
        }
      }

      // Add error message if present
      const errorMsg = getErrorMessage(element, document);
      if (errorMsg) {
        lines.push(indent + errorMsg);
      }
    } else if (name && element.children.length === 0) {
      // Text-only node with content preview
      if (contentPreview && name.length > 200) {
        const preview = truncateByType(name, 'TEXT_LONG');
        const remaining = name.length - preview.length;
        lines.push(`${indent}TEXT "${preview}"`);
        if (remaining > 0) {
          lines.push(`${indent}  → (${remaining} additional characters not shown)`);
        }
      } else {
        lines.push(`${indent}TEXT "${truncateByType(name, 'TEXT_SHORT')}"`);
      }
    }

    // Process children
    const childIndent = indent + '  ';
    for (const child of element.children) {
      processNode(child, depth + 1, childIndent);
    }
  }

  // Wrap processNode in error boundary
  try {
    processNode(root, 0, '');
  } catch (error) {
    lines.push('');
    lines.push(`⚠️  Processing interrupted: ${error instanceof Error ? error.message : 'Unknown error'}`);
    lines.push(`Partial results: ${metrics.elementCount} elements, ${metrics.capturedInteractiveElements} interactive refs captured`);
    metrics.processingErrors.push(`Processing interrupted: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Calculate quality score
  const captureRate = metrics.totalInteractiveElements > 0
    ? metrics.capturedInteractiveElements / metrics.totalInteractiveElements
    : 1;
  let quality: 'high' | 'medium' | 'low';
  if (captureRate >= 0.8 && !limited) {
    quality = 'high';
  } else if (captureRate >= 0.5 || (limited && captureRate >= 0.6)) {
    quality = 'medium';
  } else {
    quality = 'low';
  }

  // Update snapshot header with actual metrics
  const capturedInfo = `captured=${metrics.capturedInteractiveElements}/${metrics.totalInteractiveElements}`;
  const qualityInfo = `quality=${quality}`;
  const snapshotHeader = `SNAPSHOT: elements=${estimatedCount} refs=${metrics.capturedInteractiveElements} ${capturedInfo} ${qualityInfo} depth=${depthInfo} mode=${modes.join(',') || 'default'}`;
  lines[snapshotHeaderPlaceholder + 1] = snapshotHeader;

  // Add warnings if any
  if (metrics.processingErrors.length > 0) {
    lines.push('');
    lines.push('⚠️  Warnings:');
    metrics.processingErrors.slice(0, 5).forEach(err => {
      lines.push(`  - ${err}`);
    });
    if (metrics.processingErrors.length > 5) {
      lines.push(`  - ... and ${metrics.processingErrors.length - 5} more warnings`);
    }
  }

  return {
    tree: lines.join('\n') || 'Empty page',
    refs,
    metadata: {
      totalInteractiveElements: metrics.totalInteractiveElements,
      capturedElements: metrics.capturedInteractiveElements,
      quality,
      depthLimited: limited,
      warnings: metrics.processingErrors.length > 0 ? metrics.processingErrors : undefined
    }
  };
}

/**
 * Calculate element importance for prioritization
 */
function calculateImportance(element: Element, role: string | null): 'primary' | 'secondary' | 'utility' {
  // Primary: CTAs, submit buttons, primary navigation
  const isPrimaryButton = role === 'button' && (
    element.classList.contains('primary') ||
    element.classList.contains('cta') ||
    element.classList.contains('btn-primary') ||
    element.getAttribute('type') === 'submit'
  );

  const isPrimaryLink = role === 'link' && (
    element.classList.contains('primary') ||
    element.classList.contains('cta') ||
    element.closest('nav')
  );

  if (isPrimaryButton || isPrimaryLink) return 'primary';

  // Utility: Back-to-top, close buttons, utility actions
  const name = getAccessibleName(element).toLowerCase();
  const isUtility =
    name.includes('back to top') ||
    name.includes('close') ||
    name.includes('dismiss') ||
    name.includes('cancel') ||
    element.classList.contains('close') ||
    element.classList.contains('dismiss');

  if (isUtility) return 'utility';

  // Default: Secondary
  return 'secondary';
}

/**
 * Extract surrounding text context for links
 */
function extractLinkContext(element: Element): string | undefined {
  // Only extract context for ambiguous link text
  const linkText = getAccessibleName(element).toLowerCase();
  const ambiguousTexts = ['click here', 'learn more', 'read more', 'more', 'here', 'link'];

  if (!ambiguousTexts.some(t => linkText.includes(t))) {
    return undefined;
  }

  // Get parent's text content, excluding the link itself
  const parent = element.parentElement;
  if (!parent) return undefined;

  const parentClone = parent.cloneNode(true) as HTMLElement;
  const linkClone = parentClone.querySelector('a');
  if (linkClone) linkClone.remove();

  const context = parentClone.textContent?.trim();
  if (!context || context.length < 10) return undefined;

  // Return first 100 chars as context
  return context.slice(0, 100).replace(/\s+/g, ' ').trim();
}

/**
 * Escape CSS identifiers - polyfill for CSS.escape()
 */
function cssEscape(value: string): string {
  // Simple CSS escape implementation for Node.js/jsdom compatibility
  return value.replace(/[!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~]/g, '\\$&');
}

/**
 * Generate a CSS selector for an element with error recovery
 */
function generateSelector(element: Element): string {
  try {
    // Get CSS.escape from window if available, otherwise use polyfill
    const win = element.ownerDocument.defaultView;
    const escape = (win && 'CSS' in win && win.CSS && 'escape' in win.CSS)
      ? (s: string) => win.CSS.escape(s)
      : cssEscape;

    // Prefer ID
    if (element.id) {
      try {
        return `#${escape(element.id)}`;
      } catch (e) {
        // ID escaping failed, fall through to other strategies
      }
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
        try {
          const classes = current.className.trim().split(/\s+/).filter(c => c.length < 30 && c.length > 0);
          if (classes.length) {
            selector += `.${classes.slice(0, 2).map(c => escape(c)).join('.')}`;
          }
        } catch (e) {
          // Class escaping failed, continue with just tag name
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
  } catch (error) {
    // Fallback: Simple selector with tag + nth-child only
    return generateSimpleSelector(element);
  }
}

/**
 * Generate a simple fallback selector (no CSS escaping required)
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
 * Calculate adaptive depth based on element count (completeness-focused)
 */
function calculateAdaptiveDepth(
  elementCount: number,
  requestedDepth: number,
  minDepth: number = 5,
  interactive: boolean = false
): {
  effectiveDepth: number;
  limited: boolean;
  reason?: string;
} {
  // Interactive mode: more lenient (we're filtering heavily already)
  if (interactive) {
    if (elementCount < 1500) {
      return { effectiveDepth: requestedDepth, limited: false };
    }
    if (elementCount < 3000) {
      return {
        effectiveDepth: Math.max(minDepth, Math.floor(requestedDepth * 0.8)),
        limited: true,
        reason: 'large page'
      };
    }
    return {
      effectiveDepth: Math.max(minDepth, Math.floor(requestedDepth * 0.6)),
      limited: true,
      reason: 'very large page'
    };
  }

  // Non-interactive mode: adjusted thresholds for better completeness
  if (elementCount < 1000) {
    return { effectiveDepth: requestedDepth, limited: false };
  }
  if (elementCount < 2000) {
    return {
      effectiveDepth: Math.max(minDepth, Math.floor(requestedDepth * 0.7)),
      limited: true,
      reason: 'large page'
    };
  }
  if (elementCount < 4000) {
    return {
      effectiveDepth: Math.max(minDepth, Math.floor(requestedDepth * 0.5)),
      limited: true,
      reason: 'very large page'
    };
  }
  return {
    effectiveDepth: minDepth,
    limited: true,
    reason: 'extremely large page'
  };
}

/**
 * Count visible children of an element
 */
function countVisibleChildren(element: Element, includeHidden: boolean): number {
  let count = 0;
  for (const child of element.children) {
    if (!includeHidden && !isVisible(child)) continue;
    count++;
  }
  return count;
}

/**
 * Format children indicator for display
 *
 * Note: Child indicators (filtered, hidden by depth, skipped containers) have been
 * removed as they provide no actionable value to AI agents. Agents only need to
 * know what IS present in the snapshot, not what was filtered out.
 * Metadata about filtering is already available in the SNAPSHOT header.
 */
function formatChildrenIndicator(
  _totalChildren: number,
  _shownChildren: number,
  _reason?: 'depth-limit' | 'compact-mode' | 'interactive-filter'
): string {
  // Return empty string - no indicators needed
  // AI agents work with what's present, not what's missing
  return '';
}
