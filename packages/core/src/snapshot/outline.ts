/**
 * @btcp/core - snapshotOutline
 *
 * Structural overview with metadata (landmarks, sections, headings).
 * Provides refs for major page sections.
 *
 * Unix philosophy: Do one thing well - understand page outline.
 */

import type { OutlineOptions, SnapshotData, RefMap } from './types.js';
import { validateRoot } from './types.js';
import {
  getRole,
  isVisible,
  getSemanticClass,
  getSectionName,
  buildSemanticXPath,
  generateSelector,
  LANDMARK_ROLES,
} from './utils/inspect.js';
import {
  grepElements,
  buildElementSearchData,
  countWords,
  getCleanTextContent,
  detectCodeLanguage,
  type ElementSearchData,
} from './utils/filter.js';
import { truncateByType, buildPageHeader, getPageInfo, buildOutlineMetadata } from './utils/format.js';

/**
 * Create an outline snapshot of the page structure
 *
 * Returns landmarks, sections, headings, and major content blocks with
 * metadata (word counts, link counts, etc.). Provides refs for major sections.
 *
 * @param document - The document to snapshot
 * @param refMap - Reference map to store section refs
 * @param options - Optional configuration
 * @returns SnapshotData with page outline and refs
 *
 * @example
 * ```typescript
 * const refMap = createRefMap();
 * const snapshot = snapshotOutline(document, refMap);
 *
 * // Output shows page structure:
 * // MAIN "content" @ref:0 [500 words, 10 links] /main#content
 * //   HEADING level=1 "Welcome" /main/h1
 * //   ARTICLE "blog post" @ref:1 [200 words] /main/article
 * ```
 */
/**
 * Outline item with element data for grep filtering
 */
interface OutlineItem {
  element: Element;
  line: string;
  indent: number;
  role: string;
  name: string;
  xpath: string;
  needsRef: boolean;
  searchData: ElementSearchData;
}

export function snapshotOutline(
  document: Document,
  refMap: RefMap,
  options: OutlineOptions = {}
): SnapshotData {
  const root = validateRoot(options.root, document);
  const { maxDepth = 50, includeHidden = false, grep: grepPattern } = options;

  refMap.clear();
  const refs: SnapshotData['refs'] = {};
  let refCounter = 0;

  // Stats for header
  let landmarkCount = 0;
  let sectionCount = 0;
  let headingCount = 0;

  // Collect outline items with search data (BEFORE grep)
  const outlineItems: OutlineItem[] = [];

  // Recursive function to collect outline items
  function collectOutlineItems(element: Element, depth: number, indent: number): void {
    if (depth > maxDepth) return;
    if (!includeHidden && !isVisible(element, false)) return;

    const role = getRole(element);
    const tagName = element.tagName;

    // Track stats
    if (role?.startsWith('heading')) headingCount++;
    if (LANDMARK_ROLES.has(role || '')) landmarkCount++;

    // Determine if this element should be in the outline
    let shouldInclude = false;
    let lineBase = '';
    let itemRole = '';
    let itemName = '';
    let itemXpath = '';
    let needsRef = false;
    const indentStr = '  '.repeat(indent);

    // Landmarks (MAIN, BANNER, etc.)
    if (role && LANDMARK_ROLES.has(role)) {
      shouldInclude = true;
      needsRef = true;
      itemRole = role.toUpperCase();
      itemName = getSectionName(element);
      const metadata = buildOutlineMetadata(element);
      itemXpath = buildSemanticXPath(element);

      lineBase = `${indentStr}${itemRole}`;
      if (itemName) lineBase += ` "${truncateByType(itemName, 'ELEMENT_NAME')}"`;
      lineBase += ` {{REF}}`;  // Placeholder for ref
      if (metadata) lineBase += ` ${metadata}`;
      lineBase += ` ${itemXpath}`;

      sectionCount++;
    }
    // Headings
    else if (role?.startsWith('heading')) {
      shouldInclude = true;
      const level = tagName[1];
      itemRole = 'heading';
      itemName = getCleanTextContent(element, 60);
      itemXpath = buildSemanticXPath(element);

      lineBase = `${indentStr}HEADING level=${level}`;
      if (itemName) lineBase += ` "${itemName}"`;
      lineBase += ` ${itemXpath}`;
    }
    // Articles and named sections/regions
    else if (tagName === 'ARTICLE' || (tagName === 'SECTION' && (element.id || element.getAttribute('aria-label')))) {
      shouldInclude = true;
      needsRef = true;
      itemRole = tagName === 'ARTICLE' ? 'ARTICLE' : 'REGION';
      itemName = getSectionName(element);
      const metadata = buildOutlineMetadata(element);
      itemXpath = buildSemanticXPath(element);

      lineBase = `${indentStr}${itemRole}`;
      if (itemName) lineBase += ` "${truncateByType(itemName, 'ELEMENT_NAME')}"`;
      lineBase += ` {{REF}}`;
      if (metadata) lineBase += ` ${metadata}`;
      lineBase += ` ${itemXpath}`;

      sectionCount++;
    }
    // Divs with semantic id/class that contain substantial content
    else if (tagName === 'DIV' && (element.id || getSemanticClass(element))) {
      const wordCount = countWords(element.textContent || '');
      if (wordCount > 50) {
        shouldInclude = true;
        needsRef = true;
        itemRole = 'REGION';
        itemName = getSectionName(element);
        const metadata = buildOutlineMetadata(element);
        itemXpath = buildSemanticXPath(element);

        lineBase = `${indentStr}REGION`;
        if (itemName) lineBase += ` "${truncateByType(itemName, 'ELEMENT_NAME')}"`;
        lineBase += ` {{REF}}`;
        if (metadata) lineBase += ` ${metadata}`;
        lineBase += ` ${itemXpath}`;

        sectionCount++;
      }
    }
    // Lists
    else if (tagName === 'UL' || tagName === 'OL') {
      const items = element.querySelectorAll(':scope > li').length;
      if (items > 0) {
        shouldInclude = true;
        itemRole = 'list';
        itemXpath = buildSemanticXPath(element);
        lineBase = `${indentStr}LIST [${items} items] ${itemXpath}`;
      }
    }
    // Code blocks
    else if (tagName === 'PRE') {
      shouldInclude = true;
      itemRole = 'code';
      const lang = detectCodeLanguage(element);
      const lineCount = (element.textContent || '').split('\n').length;
      itemXpath = buildSemanticXPath(element);

      lineBase = `${indentStr}CODE`;
      if (lang) lineBase += ` [${lang}]`;
      lineBase += ` [${lineCount} lines]`;
      lineBase += ` ${itemXpath}`;
    }

    if (shouldInclude && lineBase) {
      // Build rich search data with full text and attributes
      const searchData = buildElementSearchData(element, itemRole, itemName, itemXpath);

      outlineItems.push({
        element,
        line: lineBase,
        indent,
        role: itemRole,
        name: itemName,
        xpath: itemXpath,
        needsRef,
        searchData,
      });
    }

    // Recurse into children (increase indent if we included this element)
    const nextIndent = shouldInclude ? indent + 1 : indent;
    for (const child of element.children) {
      collectOutlineItems(child, depth + 1, nextIndent);
    }
  }

  collectOutlineItems(root, 0, 0);

  // Calculate total words
  const totalWords = countWords(root.textContent || '');

  // Apply grep filter at ELEMENT level (matches against full data)
  let matchedItems = outlineItems;
  let grepInfo: { pattern: string; matchCount: number; totalCount: number } | undefined;

  if (grepPattern) {
    const searchDataList = outlineItems.map(item => item.searchData);
    const grepResult = grepElements(searchDataList, grepPattern);

    // Map back to items
    const matchedSet = new Set(grepResult.items.map(d => d.element));
    matchedItems = outlineItems.filter(item => matchedSet.has(item.element));

    grepInfo = {
      pattern: grepResult.pattern,
      matchCount: grepResult.matchCount,
      totalCount: grepResult.totalCount,
    };
  }

  // Build final lines with refs (only for matched items)
  const lines: string[] = [];
  for (const item of matchedItems) {
    let line = item.line;

    if (item.needsRef) {
      const ref = `@ref:${refCounter++}`;
      refMap.set(ref, item.element);
      refs[ref] = {
        selector: generateSelector(item.element),
        role: item.role.toLowerCase(),
        name: item.name || undefined,
      };
      line = line.replace('{{REF}}', ref);
    }

    lines.push(line);
  }

  // Build headers
  const pageInfo = getPageInfo(document);
  const pageHeader = buildPageHeader(pageInfo);

  let outlineHeader = `OUTLINE: landmarks=${landmarkCount} sections=${sectionCount} headings=${headingCount} words=${totalWords}`;
  if (grepInfo) {
    outlineHeader += ` grep=${grepInfo.pattern} matches=${grepInfo.matchCount}`;
  }

  const output = [pageHeader, outlineHeader, '', ...lines].join('\n');

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
