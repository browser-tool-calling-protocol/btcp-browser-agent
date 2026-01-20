/**
 * @btcp/core - RefMap tests
 *
 * Tests for the element reference map that maintains mappings between
 * string refs and DOM elements.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRefMap, createSimpleRefMap } from './ref-map.js';
import type { RefMap } from './types.js';

describe('createRefMap', () => {
  let refMap: RefMap;

  beforeEach(() => {
    document.body.innerHTML = '';
    refMap = createRefMap();
  });

  describe('generateRef', () => {
    it('should generate a ref for an element', () => {
      document.body.innerHTML = '<button id="btn">Click me</button>';
      const button = document.getElementById('btn')!;

      const ref = refMap.generateRef(button);

      expect(ref).toMatch(/^@ref:\d+$/);
    });

    it('should generate sequential refs', () => {
      document.body.innerHTML = `
        <button id="btn1">Button 1</button>
        <button id="btn2">Button 2</button>
      `;
      const button1 = document.getElementById('btn1')!;
      const button2 = document.getElementById('btn2')!;

      const ref1 = refMap.generateRef(button1);
      const ref2 = refMap.generateRef(button2);

      expect(ref1).toBe('@ref:0');
      expect(ref2).toBe('@ref:1');
    });

    it('should return same ref for same element', () => {
      document.body.innerHTML = '<button id="btn">Click me</button>';
      const button = document.getElementById('btn')!;

      const ref1 = refMap.generateRef(button);
      const ref2 = refMap.generateRef(button);

      expect(ref1).toBe(ref2);
    });

    it('should not increment counter for existing element', () => {
      document.body.innerHTML = `
        <button id="btn1">Button 1</button>
        <button id="btn2">Button 2</button>
      `;
      const button1 = document.getElementById('btn1')!;
      const button2 = document.getElementById('btn2')!;

      const ref1First = refMap.generateRef(button1);
      const ref1Second = refMap.generateRef(button1);
      const ref2 = refMap.generateRef(button2);

      expect(ref1First).toBe('@ref:0');
      expect(ref1Second).toBe('@ref:0');
      expect(ref2).toBe('@ref:1');
    });
  });

  describe('get', () => {
    it('should retrieve element by ref', () => {
      document.body.innerHTML = '<button id="btn">Click me</button>';
      const button = document.getElementById('btn')!;

      const ref = refMap.generateRef(button);
      const element = refMap.get(ref);

      expect(element).toBe(button);
    });

    it('should return null for unknown ref', () => {
      const element = refMap.get('@ref:999');

      expect(element).toBeNull();
    });

    it('should return null for invalid ref format', () => {
      const element = refMap.get('invalid');

      expect(element).toBeNull();
    });

    it('should return null for disconnected element', () => {
      document.body.innerHTML = '<button id="btn">Click me</button>';
      const button = document.getElementById('btn')!;

      const ref = refMap.generateRef(button);

      // Remove element from DOM
      button.remove();

      const element = refMap.get(ref);

      expect(element).toBeNull();
    });

    it('should clean up disconnected element from map', () => {
      document.body.innerHTML = '<button id="btn">Click me</button>';
      const button = document.getElementById('btn')!;

      const ref = refMap.generateRef(button);

      // Remove element from DOM
      button.remove();

      // First get should return null and clean up
      refMap.get(ref);

      // Second get should also return null (ref was removed)
      const element = refMap.get(ref);

      expect(element).toBeNull();
    });
  });

  describe('set', () => {
    it('should set a ref for an element', () => {
      document.body.innerHTML = '<button id="btn">Click me</button>';
      const button = document.getElementById('btn')!;

      refMap.set('@ref:custom', button);
      const element = refMap.get('@ref:custom');

      expect(element).toBe(button);
    });

    it('should override existing ref', () => {
      document.body.innerHTML = `
        <button id="btn1">Button 1</button>
        <button id="btn2">Button 2</button>
      `;
      const button1 = document.getElementById('btn1')!;
      const button2 = document.getElementById('btn2')!;

      refMap.set('@ref:test', button1);
      refMap.set('@ref:test', button2);

      const element = refMap.get('@ref:test');

      expect(element).toBe(button2);
    });
  });

  describe('clear', () => {
    it('should clear all refs', () => {
      document.body.innerHTML = `
        <button id="btn1">Button 1</button>
        <button id="btn2">Button 2</button>
      `;
      const button1 = document.getElementById('btn1')!;
      const button2 = document.getElementById('btn2')!;

      const ref1 = refMap.generateRef(button1);
      const ref2 = refMap.generateRef(button2);

      refMap.clear();

      expect(refMap.get(ref1)).toBeNull();
      expect(refMap.get(ref2)).toBeNull();
    });

    it('should reset counter after clear', () => {
      document.body.innerHTML = '<button id="btn">Button</button>';
      const button = document.getElementById('btn')!;

      refMap.generateRef(button);
      refMap.generateRef(button);

      refMap.clear();

      // Re-add element
      const newRef = refMap.generateRef(button);

      expect(newRef).toBe('@ref:0');
    });
  });
});

describe('createSimpleRefMap', () => {
  let refMap: RefMap;

  beforeEach(() => {
    document.body.innerHTML = '';
    refMap = createSimpleRefMap();
  });

  describe('generateRef', () => {
    it('should generate a ref for an element', () => {
      document.body.innerHTML = '<button id="btn">Click me</button>';
      const button = document.getElementById('btn')!;

      const ref = refMap.generateRef(button);

      expect(ref).toMatch(/^@ref:\d+$/);
    });

    it('should return same ref for same element', () => {
      document.body.innerHTML = '<button id="btn">Click me</button>';
      const button = document.getElementById('btn')!;

      const ref1 = refMap.generateRef(button);
      const ref2 = refMap.generateRef(button);

      expect(ref1).toBe(ref2);
    });
  });

  describe('get', () => {
    it('should retrieve element by ref', () => {
      document.body.innerHTML = '<button id="btn">Click me</button>';
      const button = document.getElementById('btn')!;

      const ref = refMap.generateRef(button);
      const element = refMap.get(ref);

      expect(element).toBe(button);
    });

    it('should return null for unknown ref', () => {
      const element = refMap.get('@ref:999');

      expect(element).toBeNull();
    });

    it('should return null for disconnected element', () => {
      document.body.innerHTML = '<button id="btn">Click me</button>';
      const button = document.getElementById('btn')!;

      const ref = refMap.generateRef(button);

      // Remove element from DOM
      button.remove();

      const element = refMap.get(ref);

      expect(element).toBeNull();
    });
  });

  describe('set', () => {
    it('should set a ref for an element', () => {
      document.body.innerHTML = '<button id="btn">Click me</button>';
      const button = document.getElementById('btn')!;

      refMap.set('@ref:custom', button);
      const element = refMap.get('@ref:custom');

      expect(element).toBe(button);
    });
  });

  describe('clear', () => {
    it('should clear all refs', () => {
      document.body.innerHTML = '<button id="btn">Button</button>';
      const button = document.getElementById('btn')!;

      const ref = refMap.generateRef(button);
      refMap.clear();

      expect(refMap.get(ref)).toBeNull();
    });

    it('should reset counter after clear', () => {
      document.body.innerHTML = '<button id="btn">Button</button>';
      const button = document.getElementById('btn')!;

      refMap.generateRef(button);
      refMap.clear();

      const newRef = refMap.generateRef(button);

      expect(newRef).toBe('@ref:0');
    });
  });
});

describe('RefMap behavior comparison', () => {
  it('both implementations should produce identical refs for same elements', () => {
    document.body.innerHTML = `
      <button id="btn1">Button 1</button>
      <button id="btn2">Button 2</button>
    `;
    const button1 = document.getElementById('btn1')!;
    const button2 = document.getElementById('btn2')!;

    const weakRefMap = createRefMap();
    const simpleRefMap = createSimpleRefMap();

    const weakRef1 = weakRefMap.generateRef(button1);
    const weakRef2 = weakRefMap.generateRef(button2);

    const simpleRef1 = simpleRefMap.generateRef(button1);
    const simpleRef2 = simpleRefMap.generateRef(button2);

    expect(weakRef1).toBe(simpleRef1);
    expect(weakRef2).toBe(simpleRef2);
  });

  it('both implementations should handle element lookup identically', () => {
    document.body.innerHTML = '<button id="btn">Button</button>';
    const button = document.getElementById('btn')!;

    const weakRefMap = createRefMap();
    const simpleRefMap = createSimpleRefMap();

    const weakRef = weakRefMap.generateRef(button);
    const simpleRef = simpleRefMap.generateRef(button);

    expect(weakRefMap.get(weakRef)).toBe(button);
    expect(simpleRefMap.get(simpleRef)).toBe(button);

    // Both should return null for invalid refs
    expect(weakRefMap.get('@ref:999')).toBeNull();
    expect(simpleRefMap.get('@ref:999')).toBeNull();
  });

  it('both implementations should handle disconnected elements', () => {
    document.body.innerHTML = '<button id="btn">Button</button>';
    const button = document.getElementById('btn')!;

    const weakRefMap = createRefMap();
    const simpleRefMap = createSimpleRefMap();

    const weakRef = weakRefMap.generateRef(button);
    const simpleRef = simpleRefMap.generateRef(button);

    // Remove element
    button.remove();

    expect(weakRefMap.get(weakRef)).toBeNull();
    expect(simpleRefMap.get(simpleRef)).toBeNull();
  });
});
