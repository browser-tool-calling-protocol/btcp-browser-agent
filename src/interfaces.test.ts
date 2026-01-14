/**
 * Tests for interfaces.ts - Programmatic interface definitions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getTypeScriptInterfaces,
  getFunctionSignatures,
  getCallableFunctions,
  getInterfaces,
  getCompactInterface,
  getInterfaceString,
} from './interfaces.js';
import { BrowserAgent } from './index.js';

describe('interfaces', () => {
  describe('getTypeScriptInterfaces', () => {
    it('should return TypeScript interface definitions', () => {
      const types = getTypeScriptInterfaces();

      expect(types).toContain('interface');
      expect(types).toContain('BaseCommand');
      expect(types).toContain('SuccessResponse');
      expect(types).toContain('ErrorResponse');
    });

    it('should include command interfaces', () => {
      const types = getTypeScriptInterfaces();

      expect(types).toContain('ClickCommand');
      expect(types).toContain('SnapshotCommand');
      expect(types).toContain('TypeCommand');
      expect(types).toContain('FillCommand');
    });

    it('should include action literal types', () => {
      const types = getTypeScriptInterfaces();

      expect(types).toContain("action: 'click'");
      expect(types).toContain("action: 'snapshot'");
    });

    it('should include help property', () => {
      const types = getTypeScriptInterfaces();

      expect(types).toContain('help?: boolean');
    });

    it('should include Command union type', () => {
      const types = getTypeScriptInterfaces();

      expect(types).toContain('type Command =');
    });
  });

  describe('getFunctionSignatures', () => {
    it('should return array of function signatures', () => {
      const sigs = getFunctionSignatures();

      expect(sigs).toBeInstanceOf(Array);
      expect(sigs.length).toBeGreaterThan(0);
    });

    it('should include core methods', () => {
      const sigs = getFunctionSignatures();
      const names = sigs.map((s) => s.name);

      expect(names).toContain('execute');
      expect(names).toContain('snapshot');
      expect(names).toContain('click');
      expect(names).toContain('type');
      expect(names).toContain('fill');
    });

    it('should have complete signature info', () => {
      const sigs = getFunctionSignatures();
      const clickSig = sigs.find((s) => s.name === 'click');

      expect(clickSig).toBeDefined();
      expect(clickSig?.description).toBeDefined();
      expect(clickSig?.params).toBeInstanceOf(Array);
      expect(clickSig?.returns).toBeDefined();
      expect(clickSig?.async).toBe(true);
      expect(clickSig?.example).toBeDefined();
    });

    it('should have parameter details', () => {
      const sigs = getFunctionSignatures();
      const clickSig = sigs.find((s) => s.name === 'click');
      const selectorParam = clickSig?.params.find((p) => p.name === 'selector');

      expect(selectorParam).toBeDefined();
      expect(selectorParam?.type).toBe('string');
      expect(selectorParam?.required).toBe(true);
      expect(selectorParam?.description).toBeDefined();
    });
  });

  describe('getCallableFunctions', () => {
    it('should return callable function definitions', () => {
      const funcs = getCallableFunctions();

      expect(funcs).toBeInstanceOf(Array);
      expect(funcs.length).toBeGreaterThan(0);
    });

    it('should include function signature strings', () => {
      const funcs = getCallableFunctions();
      const clickFunc = funcs.find((f) => f.name === 'click');

      expect(clickFunc).toBeDefined();
      expect(clickFunc?.signature).toContain('async');
      expect(clickFunc?.signature).toContain('click');
      expect(clickFunc?.signature).toContain('selector');
    });

    it('should include JSDoc comments', () => {
      const funcs = getCallableFunctions();
      const clickFunc = funcs.find((f) => f.name === 'click');

      expect(clickFunc?.jsdoc).toContain('/**');
      expect(clickFunc?.jsdoc).toContain('@param');
      expect(clickFunc?.jsdoc).toContain('@returns');
      expect(clickFunc?.jsdoc).toContain('@example');
    });

    it('should include examples', () => {
      const funcs = getCallableFunctions();
      const clickFunc = funcs.find((f) => f.name === 'click');

      expect(clickFunc?.example).toContain('agent.click');
    });
  });

  describe('getInterfaces', () => {
    it('should return complete interface definition', () => {
      const interfaces = getInterfaces();

      expect(interfaces.typescript).toBeDefined();
      expect(interfaces.functions).toBeInstanceOf(Array);
      expect(interfaces.usage).toBeDefined();
    });

    it('should include usage guide', () => {
      const interfaces = getInterfaces();

      expect(interfaces.usage).toContain('BrowserAgent');
      expect(interfaces.usage).toContain('snapshot');
      expect(interfaces.usage).toContain('click');
      expect(interfaces.usage).toContain('fill');
    });
  });

  describe('getCompactInterface', () => {
    it('should return compact structure', () => {
      const compact = getCompactInterface();

      expect(compact.actions).toBeInstanceOf(Array);
      expect(compact.methods).toBeInstanceOf(Array);
      expect(compact.selectorFormats).toBeInstanceOf(Array);
      expect(compact.workflow).toBeInstanceOf(Array);
    });

    it('should include actions list', () => {
      const compact = getCompactInterface();

      expect(compact.actions).toContain('click');
      expect(compact.actions).toContain('snapshot');
      expect(compact.actions).toContain('type');
    });

    it('should include method signatures', () => {
      const compact = getCompactInterface();
      const clickMethod = compact.methods.find((m) => m.name === 'click');

      expect(clickMethod).toBeDefined();
      expect(clickMethod?.signature).toContain('click');
      expect(clickMethod?.example).toBeDefined();
    });

    it('should include selector formats', () => {
      const compact = getCompactInterface();

      expect(compact.selectorFormats.some((s) => s.includes('@e1'))).toBe(true);
      expect(compact.selectorFormats.some((s) => s.includes('#id'))).toBe(true);
    });

    it('should include workflow steps', () => {
      const compact = getCompactInterface();

      expect(compact.workflow.some((w) => w.includes('snapshot'))).toBe(true);
    });
  });

  describe('getInterfaceString', () => {
    it('should return formatted string', () => {
      const str = getInterfaceString();

      expect(typeof str).toBe('string');
      expect(str.length).toBeGreaterThan(0);
    });

    it('should include method signatures', () => {
      const str = getInterfaceString();

      expect(str).toContain('AVAILABLE METHODS');
      expect(str).toContain('click');
      expect(str).toContain('snapshot');
    });

    it('should include selector formats', () => {
      const str = getInterfaceString();

      expect(str).toContain('SELECTOR FORMATS');
      expect(str).toContain('@e1');
    });

    it('should include workflow', () => {
      const str = getInterfaceString();

      expect(str).toContain('WORKFLOW');
    });

    it('should include examples', () => {
      const str = getInterfaceString();

      expect(str).toContain('QUICK EXAMPLES');
      expect(str).toContain('await agent');
    });

    it('should include help info', () => {
      const str = getInterfaceString();

      expect(str).toContain('GET HELP');
      expect(str).toContain('agent.describe()');
    });
  });
});

describe('BrowserAgent describe() API (interfaces)', () => {
  let agent: BrowserAgent;

  beforeEach(() => {
    agent = new BrowserAgent();
  });

  describe('instance method', () => {
    it('describe() should include method signatures', () => {
      const desc = agent.describe();

      expect(desc.methods).toBeInstanceOf(Array);
      expect(desc.methods.some((m) => m.name === 'click')).toBe(true);
      expect(desc.methods.some((m) => m.name === 'snapshot')).toBe(true);
    });

    it('describe() should include selector formats', () => {
      const desc = agent.describe();

      expect(desc.selectors).toBeInstanceOf(Array);
      expect(desc.selectors.some((s) => s.includes('@e1'))).toBe(true);
    });

    it('describe() should include workflow', () => {
      const desc = agent.describe();

      expect(desc.workflow).toBeInstanceOf(Array);
      expect(desc.workflow.some((w) => w.includes('snapshot'))).toBe(true);
    });

    it('describe(action) should include parameter info', () => {
      const desc = agent.describe('click');

      expect(desc.action?.parameters).toBeInstanceOf(Array);
      expect(desc.action?.parameters.some((p) => p.name === 'selector')).toBe(true);
    });
  });

  describe('static method', () => {
    it('BrowserAgent.describe() should include methods', () => {
      const desc = BrowserAgent.describe();

      expect(desc.methods).toBeInstanceOf(Array);
    });

    it('BrowserAgent.describe() should include actions list', () => {
      const desc = BrowserAgent.describe();

      expect(desc.actions).toContain('click');
      expect(desc.actions).toContain('snapshot');
    });
  });
});

describe('interface completeness', () => {
  it('should have signatures for all key methods', () => {
    const sigs = getFunctionSignatures();
    const names = sigs.map((s) => s.name);

    const expectedMethods = [
      'execute',
      'snapshot',
      'click',
      'type',
      'fill',
      'press',
      'hover',
      'waitFor',
      'evaluate',
      'getText',
      'getAttribute',
      'isVisible',
      'getUrl',
      'getTitle',
      'describe',
    ];

    for (const method of expectedMethods) {
      expect(names).toContain(method);
    }
  });

  it('should have examples for all signatures', () => {
    const sigs = getFunctionSignatures();

    for (const sig of sigs) {
      expect(sig.example).toBeDefined();
      expect(sig.example.length).toBeGreaterThan(0);
    }
  });

  it('should have descriptions for all signatures', () => {
    const sigs = getFunctionSignatures();

    for (const sig of sigs) {
      expect(sig.description).toBeDefined();
      expect(sig.description.length).toBeGreaterThan(0);
    }
  });
});
