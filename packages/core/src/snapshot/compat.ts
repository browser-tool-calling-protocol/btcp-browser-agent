/**
 * @btcp/core - Snapshot Backward Compatibility
 *
 * Maintains backward compatibility with the legacy createSnapshot() API.
 * Delegates to new specialized functions based on mode.
 *
 * @deprecated Use specific snapshot functions instead:
 * - snapshotHead() for quick page status
 * - snapshotInteractive() for clickable elements (default)
 * - snapshotStructure() for page structure with line budget
 * - snapshotOutline() for structural overview
 * - snapshotContent() for text extraction
 * - snapshotAll() for comprehensive view
 * - extract() for markdown/HTML format conversion
 */

import type { LegacySnapshotOptions, SnapshotData, RefMap } from './types.js';
import { snapshotHead } from './head.js';
import { snapshotInteractive } from './interactive.js';
import { snapshotStructure } from './structure.js';
import { snapshotOutline } from './outline.js';
import { snapshotContent } from './content.js';
import { snapshotAll } from './all.js';
import { extract } from './extract.js';

/**
 * Generate flat snapshot of the DOM (Legacy API)
 *
 * @deprecated Use specific snapshot functions instead.
 *
 * This function maintains backward compatibility with the original API.
 * It delegates to the appropriate new function based on the mode option.
 *
 * Supports modes:
 * - 'head': Quick page status (delegates to snapshotHead)
 * - 'interactive' (default): Find clickable elements (delegates to snapshotInteractive)
 * - 'structure': Page structure with line budget (delegates to snapshotStructure)
 * - 'outline': Structural overview (delegates to snapshotOutline)
 * - 'content': Extract text content (delegates to snapshotContent)
 * - 'all': Comprehensive view (delegates to snapshotAll)
 *
 * @param document - The document to snapshot
 * @param refMap - Reference map for element refs
 * @param options - Legacy options object
 * @returns SnapshotData
 */
export function createSnapshot(
  document: Document,
  refMap: RefMap,
  options: LegacySnapshotOptions = {}
): SnapshotData {
  const {
    root,
    maxDepth,
    includeHidden,
    mode = 'interactive',
    format = 'tree',
    grep,
    maxLength,
    includeLinks,
    includeImages,
    maxLines,
  } = options;

  // Convert GrepOptions to string for backward compatibility
  const grepPattern = typeof grep === 'string' ? grep : grep?.pattern;

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

  // Dispatch based on mode
  switch (mode) {
    case 'head':
      return snapshotHead(document, { root });

    case 'structure':
      return snapshotStructure(document, refMap, {
        root,
        maxDepth,
        includeHidden,
        maxLines,
      });

    case 'outline':
      return snapshotOutline(document, refMap, {
        root,
        maxDepth,
        includeHidden,
        grep: grepPattern,
      });

    case 'content':
      // Handle deprecated format option for backward compatibility
      if (format === 'markdown') {
        // Use extract() for markdown format (deprecated path)
        const markdown = extract(document, {
          root,
          format: 'markdown',
          maxDepth,
          includeHidden,
          maxLength,
          includeLinks,
          includeImages,
        });
        return {
          tree: markdown,
          refs: {},
          metadata: {
            quality: 'high',
            warnings: ['Using deprecated format option. Use extract() for markdown conversion.']
          }
        };
      }
      // Default: use snapshotContent for tree format
      return snapshotContent(document, refMap, {
        root,
        maxDepth,
        includeHidden,
        grep: grepPattern,
        maxLength,
      });

    case 'all':
      return snapshotAll(document, refMap, {
        root,
        maxDepth,
        includeHidden,
      });

    case 'interactive':
    default:
      return snapshotInteractive(document, refMap, {
        root,
        maxDepth,
        includeHidden,
        grep: grepPattern,
      });
  }
}
