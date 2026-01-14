/**
 * Tests for schema.ts - Self-descriptive agent interface
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AGENT_SCHEMA,
  getAvailableActions,
  getCommandsByCategory,
  getCommandSchema,
  getCommandHelp,
  getFullHelp,
  getJSONSchema,
  suggestAction,
  formatError,
} from './schema.js';
import { BrowserAgent } from './index.js';

describe('schema', () => {
  describe('AGENT_SCHEMA', () => {
    it('should have required metadata', () => {
      expect(AGENT_SCHEMA.name).toBe('btcp-browser-agent');
      expect(AGENT_SCHEMA.version).toBeDefined();
      expect(AGENT_SCHEMA.description).toBeDefined();
      expect(AGENT_SCHEMA.commands).toBeInstanceOf(Array);
      expect(AGENT_SCHEMA.commands.length).toBeGreaterThan(0);
    });

    it('should have valid command schemas', () => {
      for (const cmd of AGENT_SCHEMA.commands) {
        expect(cmd.action).toBeDefined();
        expect(cmd.category).toBeDefined();
        expect(cmd.description).toBeDefined();
        expect(cmd.parameters).toBeInstanceOf(Array);
        expect(cmd.returns).toBeDefined();
        expect(cmd.examples).toBeInstanceOf(Array);
        expect(cmd.examples.length).toBeGreaterThan(0);
      }
    });

    it('should have valid parameter schemas', () => {
      for (const cmd of AGENT_SCHEMA.commands) {
        for (const param of cmd.parameters) {
          expect(param.name).toBeDefined();
          expect(param.type).toBeDefined();
          expect(typeof param.required).toBe('boolean');
          expect(param.description).toBeDefined();
        }
      }
    });
  });

  describe('getAvailableActions', () => {
    it('should return array of action names', () => {
      const actions = getAvailableActions();
      expect(actions).toBeInstanceOf(Array);
      expect(actions.length).toBeGreaterThan(0);
      expect(actions).toContain('snapshot');
      expect(actions).toContain('click');
      expect(actions).toContain('type');
      expect(actions).toContain('fill');
    });

    it('should return unique action names', () => {
      const actions = getAvailableActions();
      const uniqueActions = new Set(actions);
      expect(uniqueActions.size).toBe(actions.length);
    });
  });

  describe('getCommandsByCategory', () => {
    it('should return commands for interaction category', () => {
      const commands = getCommandsByCategory('interaction');
      expect(commands.length).toBeGreaterThan(0);
      expect(commands.some((c) => c.action === 'click')).toBe(true);
      expect(commands.some((c) => c.action === 'hover')).toBe(true);
    });

    it('should return commands for query category', () => {
      const commands = getCommandsByCategory('query');
      expect(commands.length).toBeGreaterThan(0);
      expect(commands.some((c) => c.action === 'snapshot')).toBe(true);
    });

    it('should return commands for input category', () => {
      const commands = getCommandsByCategory('input');
      expect(commands.length).toBeGreaterThan(0);
      expect(commands.some((c) => c.action === 'type')).toBe(true);
      expect(commands.some((c) => c.action === 'fill')).toBe(true);
    });

    it('should return empty array for unknown category', () => {
      const commands = getCommandsByCategory('nonexistent' as any);
      expect(commands).toEqual([]);
    });
  });

  describe('getCommandSchema', () => {
    it('should return schema for known action', () => {
      const schema = getCommandSchema('click');
      expect(schema).toBeDefined();
      expect(schema?.action).toBe('click');
      expect(schema?.parameters).toBeInstanceOf(Array);
    });

    it('should return undefined for unknown action', () => {
      const schema = getCommandSchema('nonexistent');
      expect(schema).toBeUndefined();
    });

    it('should have selector parameter for click', () => {
      const schema = getCommandSchema('click');
      const selectorParam = schema?.parameters.find((p) => p.name === 'selector');
      expect(selectorParam).toBeDefined();
      expect(selectorParam?.required).toBe(true);
    });
  });

  describe('getCommandHelp', () => {
    it('should return help text for known action', () => {
      const help = getCommandHelp('click');
      expect(help).toContain('ACTION: click');
      expect(help).toContain('DESCRIPTION');
      expect(help).toContain('PARAMETERS');
      expect(help).toContain('selector');
      expect(help).toContain('EXAMPLES');
    });

    it('should return error for unknown action', () => {
      const help = getCommandHelp('nonexistent');
      expect(help).toContain('Unknown action');
      expect(help).toContain('Available actions');
    });

    it('should include tips when available', () => {
      const help = getCommandHelp('snapshot');
      expect(help).toContain('TIPS');
    });

    it('should include errors when available', () => {
      const help = getCommandHelp('click');
      expect(help).toContain('ERRORS');
      expect(help).toContain('Recovery');
    });
  });

  describe('getFullHelp', () => {
    it('should return comprehensive help text', () => {
      const help = getFullHelp();
      expect(help).toContain('BROWSER TOOL CALLING PROTOCOL');
      expect(help).toContain('QUICK START');
      expect(help).toContain('SELECTOR FORMATS');
      expect(help).toContain('AVAILABLE COMMANDS');
      expect(help).toContain('COMMON PATTERNS');
    });

    it('should list all categories', () => {
      const help = getFullHelp();
      expect(help).toContain('[QUERY]');
      expect(help).toContain('[INTERACTION]');
      expect(help).toContain('[INPUT]');
      expect(help).toContain('[WAIT]');
    });

    it('should include examples', () => {
      const help = getFullHelp();
      expect(help).toContain('snapshot');
      expect(help).toContain('click');
    });
  });

  describe('getJSONSchema', () => {
    it('should return valid JSON schema structure', () => {
      const schema = getJSONSchema();
      expect(schema.$schema).toContain('json-schema');
      expect(schema.type).toBe('object');
      expect(schema.required).toContain('action');
      expect(schema.properties).toBeDefined();
    });

    it('should include action enum', () => {
      const schema = getJSONSchema() as any;
      expect(schema.properties.action.enum).toBeInstanceOf(Array);
      expect(schema.properties.action.enum).toContain('click');
      expect(schema.properties.action.enum).toContain('snapshot');
    });
  });

  describe('suggestAction', () => {
    it('should suggest similar actions for typos', () => {
      const suggestions = suggestAction('clck');
      expect(suggestions).toContain('click');
    });

    it('should suggest actions with prefix match', () => {
      const suggestions = suggestAction('snap');
      expect(suggestions).toContain('snapshot');
    });

    it('should suggest multiple possibilities', () => {
      const suggestions = suggestAction('get');
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some((s) => s.startsWith('get'))).toBe(true);
    });

    it('should return suggestions even for unrelated input', () => {
      const suggestions = suggestAction('xyz');
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('formatError', () => {
    it('should format error with action context', () => {
      const message = formatError('click', 'Element not found');
      expect(message).toContain('ERROR');
      expect(message).toContain('click');
      expect(message).toContain('Element not found');
    });

    it('should include recovery suggestions when available', () => {
      const message = formatError('click', 'Element not found');
      expect(message).toContain('RECOVERY SUGGESTION');
    });

    it('should suggest actions for unknown action', () => {
      const message = formatError('clck', 'Unknown action');
      expect(message).toContain('DID YOU MEAN');
      expect(message).toContain('click');
    });
  });
});

describe('BrowserAgent help methods', () => {
  let agent: BrowserAgent;

  beforeEach(() => {
    agent = new BrowserAgent();
  });

  describe('instance methods', () => {
    it('help() should return full help text', () => {
      const help = agent.help();
      expect(help).toContain('BROWSER TOOL CALLING PROTOCOL');
      expect(help).toContain('AVAILABLE COMMANDS');
    });

    it('describeCommand() should return command help', () => {
      const help = agent.describeCommand('click');
      expect(help).toContain('ACTION: click');
      expect(help).toContain('PARAMETERS');
    });

    it('getAvailableCommands() should return action list', () => {
      const commands = agent.getAvailableCommands();
      expect(commands).toContain('click');
      expect(commands).toContain('snapshot');
    });

    it('getCommandInfo() should return command schema', () => {
      const info = agent.getCommandInfo('click');
      expect(info?.action).toBe('click');
      expect(info?.parameters).toBeInstanceOf(Array);
    });

    it('getJSONSchema() should return JSON schema', () => {
      const schema = agent.getJSONSchema();
      expect(schema.$schema).toBeDefined();
      expect(schema.type).toBe('object');
    });

    it('suggestCommand() should suggest similar actions', () => {
      const suggestions = agent.suggestCommand('clck');
      expect(suggestions).toContain('click');
    });

    it('formatCommandError() should format errors', () => {
      const message = agent.formatCommandError('click', 'Element not found');
      expect(message).toContain('ERROR');
      expect(message).toContain('click');
    });

    it('getAgentInfo() should return agent metadata', () => {
      const info = agent.getAgentInfo();
      expect(info.name).toBe('btcp-browser-agent');
      expect(info.version).toBeDefined();
      expect(info.description).toBeDefined();
    });
  });

  describe('static methods', () => {
    it('BrowserAgent.help() should work without instance', () => {
      const help = BrowserAgent.help();
      expect(help).toContain('BROWSER TOOL CALLING PROTOCOL');
    });

    it('BrowserAgent.describeCommand() should work without instance', () => {
      const help = BrowserAgent.describeCommand('snapshot');
      expect(help).toContain('ACTION: snapshot');
    });

    it('BrowserAgent.getAvailableCommands() should work without instance', () => {
      const commands = BrowserAgent.getAvailableCommands();
      expect(commands).toContain('snapshot');
    });

    it('BrowserAgent.getJSONSchema() should work without instance', () => {
      const schema = BrowserAgent.getJSONSchema();
      expect(schema.$schema).toBeDefined();
    });

    it('BrowserAgent.getAgentInfo() should work without instance', () => {
      const info = BrowserAgent.getAgentInfo();
      expect(info.name).toBe('btcp-browser-agent');
    });
  });
});

describe('schema completeness', () => {
  it('should have documentation for all major actions', () => {
    const requiredActions = [
      'snapshot',
      'click',
      'type',
      'fill',
      'press',
      'hover',
      'scroll',
      'wait',
      'waitForSelector',
      'evaluate',
      'screenshot',
      'getAttribute',
      'getText',
      'isVisible',
    ];

    const availableActions = getAvailableActions();
    for (const action of requiredActions) {
      expect(availableActions).toContain(action);
    }
  });

  it('should have examples for all commands', () => {
    for (const cmd of AGENT_SCHEMA.commands) {
      expect(cmd.examples.length).toBeGreaterThan(0);
      expect(cmd.examples[0].command).toBeDefined();
      expect(cmd.examples[0].description).toBeDefined();
    }
  });

  it('should have return descriptions for all commands', () => {
    for (const cmd of AGENT_SCHEMA.commands) {
      expect(cmd.returns.description).toBeDefined();
      expect(cmd.returns.description.length).toBeGreaterThan(0);
    }
  });
});
