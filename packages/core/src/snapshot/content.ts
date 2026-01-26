/**
 * @btcp/core - snapshotContent
 *
 * Extract text content from sections.
 * Supports tree and markdown output formats.
 *
 * Unix philosophy: Do one thing well - extract readable content.
 */

import type { ContentOptions, SnapshotData, RefMap } from './types.js';
import { validateRoot, validateContentOptions } from './types.js';
import {
  getRole,
  isVisible,
  getSemanticClass,
  buildSemanticXPath,
  LANDMARK_ROLES,
} from './utils/inspect.js';
import {
  grepElements,
  buildElementSearchData,
  countWords,
  getCleanTextContent,
  getListItems,
  detectCodeLanguage,
  type ElementSearchData,
} from './utils/filter.js';
import {
  buildPageHeader,
  getPageInfo,
  buildContentSectionHeader,
  buildCodeBlockOutput,
  buildListOutput,
  buildMarkdownHeading,
  buildMarkdownListItem,
  buildMarkdownCodeBlock,
  buildMarkdownBlockquote,
  buildMarkdownImage,
} from './utils/format.js';

/**
 * Content section for processing with search data
 */
interface ContentSection {
  xpath: string;
  element: Element;
  heading?: string;
  headingLevel?: number;
  searchData: ElementSearchData;
}

/**
 * Create a content snapshot extracting text from sections
 *
 * Extracts text content from landmarks, articles, and named sections.
 * Supports tree format (default) or markdown format.
 *
 * @param document - The document to snapshot
 * @param refMap - Reference map (optional, refs generated for sections)
 * @param options - Optional configuration
 * @returns SnapshotData with extracted content
 *
 * @example Tree format
 * ```typescript
 * const snapshot = snapshotContent(document, refMap);
 * // SECTION /main#content [500 words]
 * //   HEADING level=1 "Welcome"
 * //   TEXT "This is the introduction..."
 * //   LIST [3 items]
 * //     - "First item"
 * //     - "Second item"
 * ```
 *
 * @example Markdown format
 * ```typescript
 * const snapshot = snapshotContent(document, refMap, { format: 'markdown' });
 * // <!-- source: https://example.com -->
 * // # Welcome
 * // This is the introduction...
 * // - First item
 * // - Second item
 * ```
 */
export function snapshotContent(
  document: Document,
  refMap: RefMap,
  options: ContentOptions = {}
): SnapshotData {
  const root = validateRoot(options.root, document);
  validateContentOptions(options);

  const {
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

  // Collect content sections with search data
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
      const headingText = heading ? getCleanTextContent(heading, 100) : undefined;

      // Build rich search data for element-level grep
      const searchData = buildElementSearchData(element, role || 'section', headingText, xpath);

      sections.push({
        xpath,
        element,
        heading: headingText,
        headingLevel: heading ? parseInt(heading.tagName[1]) : undefined,
        searchData,
      });
    }

    // Recurse into children
    for (const child of element.children) {
      collectSections(child, depth + 1);
    }
  }

  collectSections(root, 0);

  // Filter sections by grep pattern at ELEMENT level (matches full content)
  let filteredSections = sections;
  let grepInfo: { pattern: string; matchCount: number; totalCount: number } | undefined;

  if (grepPattern) {
    const searchDataList = sections.map(s => s.searchData);
    const grepResult = grepElements(searchDataList, grepPattern);

    // Map back to sections
    const matchedSet = new Set(grepResult.items.map(d => d.element));
    filteredSections = sections.filter(s => matchedSet.has(s.element));

    grepInfo = {
      pattern: grepResult.pattern,
      matchCount: grepResult.matchCount,
      totalCount: grepResult.totalCount,
    };
  }

  // Generate output based on format
  if (format === 'markdown') {
    return generateMarkdownContent(document, filteredSections, refs, {
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

    lines.push(buildContentSectionHeader(section.xpath, sectionWords));

    // Extract content from section
    extractContentLines(section.element, lines, '  ', maxLength);
    lines.push('');
  }

  // Build headers
  const pageInfo = getPageInfo(document);
  const pageHeader = buildPageHeader(pageInfo);

  let contentHeader = `CONTENT: sections=${filteredSections.length} words=${totalWords}`;
  if (grepInfo) {
    contentHeader += ` grep=${grepInfo.pattern} matches=${grepInfo.matchCount}`;
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
  maxLength: number
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
      const listLines = buildListOutput(items, indent);
      lines.push(...listLines);
    }
    return;
  }

  // Code blocks
  if (tagName === 'PRE') {
    const codeLines = buildCodeBlockOutput(element, indent);
    lines.push(...codeLines);
    return;
  }

  // Recurse into other elements
  for (const child of element.children) {
    extractContentLines(child, lines, indent, maxLength);
  }
}

/**
 * Generate markdown content output
 */
function generateMarkdownContent(
  document: Document,
  sections: ContentSection[],
  refs: SnapshotData['refs'],
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
    extractMarkdownContent(section.element, lines, maxLength, includeLinks, includeImages);
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
  includeImages: boolean
): void {
  const tagName = element.tagName;
  const role = getRole(element);

  // Headings
  if (role?.startsWith('heading')) {
    const level = parseInt(tagName[1]);
    const text = getCleanTextContent(element, 100);
    lines.push(buildMarkdownHeading(level, text));
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

  // Unordered lists
  if (tagName === 'UL') {
    const items = element.querySelectorAll(':scope > li');
    for (const item of items) {
      const text = getCleanTextContent(item as Element, 200);
      if (text) lines.push(buildMarkdownListItem(text));
    }
    lines.push('');
    return;
  }

  // Ordered lists
  if (tagName === 'OL') {
    const items = element.querySelectorAll(':scope > li');
    let i = 1;
    for (const item of items) {
      const text = getCleanTextContent(item as Element, 200);
      if (text) lines.push(buildMarkdownListItem(text, true, i));
      i++;
    }
    lines.push('');
    return;
  }

  // Code blocks
  if (tagName === 'PRE') {
    const lang = detectCodeLanguage(element) || '';
    const code = (element.textContent || '').trim();
    const codeLines = buildMarkdownCodeBlock(code, lang);
    lines.push(...codeLines);
    lines.push('');
    return;
  }

  // Blockquotes
  if (tagName === 'BLOCKQUOTE') {
    const text = getCleanTextContent(element, maxLength);
    if (text) {
      const quotedLines = buildMarkdownBlockquote(text);
      lines.push(...quotedLines);
      lines.push('');
    }
    return;
  }

  // Images (if requested)
  if (includeImages && tagName === 'IMG') {
    const alt = element.getAttribute('alt') || 'image';
    const src = element.getAttribute('src') || '';
    lines.push(buildMarkdownImage(alt, src));
    lines.push('');
    return;
  }

  // Recurse into other elements
  for (const child of element.children) {
    extractMarkdownContent(child, lines, maxLength, includeLinks, includeImages);
  }
}
