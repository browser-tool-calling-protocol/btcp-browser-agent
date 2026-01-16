/**
 * @aspect/core - Element Reference Map
 *
 * Maintains a mapping between string refs and DOM elements.
 * Used by the snapshot system to enable @ref:xxx selectors.
 */

import type { RefMap } from './types.js';

/**
 * Create a new element reference map
 */
export function createRefMap(): RefMap {
  const map = new Map<string, WeakRef<Element>>();
  let counter = 0;

  return {
    get(ref: string): Element | null {
      const weakRef = map.get(ref);
      if (!weakRef) return null;

      const element = weakRef.deref();
      if (!element) {
        // Element was garbage collected
        map.delete(ref);
        return null;
      }

      // Check if element is still in DOM
      if (!element.isConnected) {
        map.delete(ref);
        return null;
      }

      return element;
    },

    set(ref: string, element: Element): void {
      map.set(ref, new WeakRef(element));
    },

    clear(): void {
      map.clear();
      counter = 0;
    },

    generateRef(element: Element): string {
      // Check if element already has a ref
      for (const [ref, weakRef] of map.entries()) {
        if (weakRef.deref() === element) {
          return ref;
        }
      }

      // Generate new ref
      const ref = `@ref:${counter++}`;
      map.set(ref, new WeakRef(element));
      return ref;
    },
  };
}

/**
 * Simple ref map without WeakRef (for environments that don't support it)
 */
export function createSimpleRefMap(): RefMap {
  const map = new Map<string, Element>();
  let counter = 0;

  return {
    get(ref: string): Element | null {
      const element = map.get(ref);
      if (!element) return null;

      // Check if element is still in DOM
      if (!element.isConnected) {
        map.delete(ref);
        return null;
      }

      return element;
    },

    set(ref: string, element: Element): void {
      map.set(ref, element);
    },

    clear(): void {
      map.clear();
      counter = 0;
    },

    generateRef(element: Element): string {
      // Check if element already has a ref
      for (const [ref, el] of map.entries()) {
        if (el === element) {
          return ref;
        }
      }

      // Generate new ref
      const ref = `@ref:${counter++}`;
      map.set(ref, element);
      return ref;
    },
  };
}
