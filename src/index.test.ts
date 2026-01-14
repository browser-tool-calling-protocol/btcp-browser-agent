/**
 * Integration tests for BrowserAgent
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BrowserAgent, generateCommandId } from './index.js';

describe('BrowserAgent', () => {
  let agent: BrowserAgent;

  beforeEach(() => {
    document.body.innerHTML = '';
    agent = new BrowserAgent({ autoLaunch: true });
  });

  afterEach(async () => {
    await agent.close();
  });

  describe('initialization', () => {
    it('should create agent with default config', () => {
      const newAgent = new BrowserAgent();
      expect(newAgent).toBeDefined();
    });

    it('should accept custom window and document', () => {
      const customAgent = new BrowserAgent({
        targetWindow: window,
        targetDocument: document,
      });
      expect(customAgent).toBeDefined();
    });

    it('should launch manually', async () => {
      const manualAgent = new BrowserAgent({ autoLaunch: false });
      await manualAgent.launch();
      // Should not throw
      await manualAgent.close();
    });
  });

  describe('execute', () => {
    it('should execute commands and return responses', async () => {
      document.body.innerHTML = '<button>Click</button>';

      const response = await agent.execute({
        id: 'cmd1',
        action: 'snapshot',
      });

      expect(response.success).toBe(true);
    });

    it('should auto-launch on first command', async () => {
      const autoAgent = new BrowserAgent({ autoLaunch: true });

      const response = await autoAgent.execute({
        id: 'cmd1',
        action: 'url',
      });

      expect(response.success).toBe(true);
      await autoAgent.close();
    });

    it('should call onResponse callback', async () => {
      const onResponse = vi.fn();
      const callbackAgent = new BrowserAgent({ onResponse });

      await callbackAgent.execute({ id: 'cmd1', action: 'url' });

      expect(onResponse).toHaveBeenCalled();
      expect(onResponse.mock.calls[0][0].success).toBe(true);

      await callbackAgent.close();
    });
  });

  describe('executeJSON', () => {
    it('should execute command from JSON string', async () => {
      document.body.innerHTML = '<button>Click</button>';

      const json = JSON.stringify({ id: 'cmd1', action: 'snapshot' });
      const responseJson = await agent.executeJSON(json);
      const response = JSON.parse(responseJson);

      expect(response.success).toBe(true);
    });

    it('should return error for invalid JSON', async () => {
      const responseJson = await agent.executeJSON('invalid json');
      const response = JSON.parse(responseJson);

      expect(response.success).toBe(false);
    });

    it('should return error for invalid command', async () => {
      const json = JSON.stringify({ id: 'cmd1', action: 'unknown' });
      const responseJson = await agent.executeJSON(json);
      const response = JSON.parse(responseJson);

      expect(response.success).toBe(false);
    });
  });

  describe('snapshot', () => {
    it('should return snapshot and refs', async () => {
      document.body.innerHTML = '<button>Submit</button>';

      const result = await agent.snapshot();

      expect(result.snapshot).toContain('button');
      expect(result.refs).toBeDefined();
    });

    it('should support options', async () => {
      document.body.innerHTML = `
        <div id="section">
          <button>Click</button>
        </div>
      `;

      const result = await agent.snapshot({ selector: '#section' });

      expect(result.snapshot).toContain('button');
    });
  });

  describe('click', () => {
    it('should click element', async () => {
      document.body.innerHTML = '<button id="btn">Click</button>';
      const button = document.getElementById('btn')!;
      const handler = vi.fn();
      button.addEventListener('click', handler);

      await agent.click('#btn');

      expect(handler).toHaveBeenCalled();
    });

    it('should throw for non-existent element', async () => {
      await expect(agent.click('#non-existent')).rejects.toThrow();
    });
  });

  describe('type', () => {
    it('should type text into input', async () => {
      document.body.innerHTML = '<input id="input">';
      const input = document.getElementById('input') as HTMLInputElement;

      await agent.type('#input', 'Hello World');

      expect(input.value).toBe('Hello World');
    });

    it('should clear before typing when requested', async () => {
      document.body.innerHTML = '<input id="input" value="Existing">';
      const input = document.getElementById('input') as HTMLInputElement;

      await agent.type('#input', 'New', { clear: true });

      expect(input.value).toBe('New');
    });
  });

  describe('fill', () => {
    it('should fill input value', async () => {
      document.body.innerHTML = '<input id="input">';
      const input = document.getElementById('input') as HTMLInputElement;

      await agent.fill('#input', 'Test Value');

      expect(input.value).toBe('Test Value');
    });
  });

  describe('hover', () => {
    it('should trigger hover events', async () => {
      document.body.innerHTML = '<button id="btn">Hover</button>';
      const button = document.getElementById('btn')!;
      const handler = vi.fn();
      button.addEventListener('mouseenter', handler);

      await agent.hover('#btn');

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('press', () => {
    it('should press key', async () => {
      document.body.innerHTML = '<input id="input">';
      const input = document.getElementById('input')!;
      input.focus();
      const handler = vi.fn();
      input.addEventListener('keydown', handler);

      await agent.press('Enter', '#input');

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('waitFor', () => {
    it('should wait for element', async () => {
      setTimeout(() => {
        document.body.innerHTML = '<div id="target">Loaded</div>';
      }, 50);

      await agent.waitFor('#target', { timeout: 1000 });

      expect(document.getElementById('target')).not.toBeNull();
    });

    it('should timeout if element never appears', async () => {
      await expect(agent.waitFor('#never', { timeout: 100 })).rejects.toThrow();
    });
  });

  describe('scroll', () => {
    it('should scroll page', async () => {
      await agent.scroll({ direction: 'down', amount: 100 });
      // Should not throw
    });
  });

  describe('evaluate', () => {
    it('should evaluate JavaScript and return result', async () => {
      document.title = 'Test Page';

      const result = await agent.evaluate<string>('document.title');

      expect(result).toBe('Test Page');
    });

    it('should evaluate complex expressions', async () => {
      const result = await agent.evaluate<number>('1 + 2 + 3');

      expect(result).toBe(6);
    });
  });

  describe('getText', () => {
    it('should get element text content', async () => {
      document.body.innerHTML = '<div id="content">Hello World</div>';

      const text = await agent.getText('#content');

      expect(text).toBe('Hello World');
    });
  });

  describe('getAttribute', () => {
    it('should get element attribute', async () => {
      document.body.innerHTML = '<a id="link" href="/about">About</a>';

      const href = await agent.getAttribute('#link', 'href');

      expect(href).toBe('/about');
    });
  });

  describe('isVisible', () => {
    it('should check element visibility', async () => {
      document.body.innerHTML = '<div id="visible">Visible</div>';

      const visible = await agent.isVisible('#visible');

      expect(visible).toBe(true);
    });
  });

  describe('getUrl', () => {
    it('should get current URL', async () => {
      const url = await agent.getUrl();

      expect(typeof url).toBe('string');
    });
  });

  describe('getTitle', () => {
    it('should get page title', async () => {
      document.title = 'My Page';

      const title = await agent.getTitle();

      expect(title).toBe('My Page');
    });
  });

  describe('getBrowserManager', () => {
    it('should return underlying browser manager', () => {
      const manager = agent.getBrowserManager();

      expect(manager).toBeDefined();
      expect(typeof manager.getDocument).toBe('function');
    });
  });

  describe('close', () => {
    it('should close without error', async () => {
      await agent.close();
      // Should not throw
    });

    it('should be safe to call multiple times', async () => {
      await agent.close();
      await agent.close();
      // Should not throw
    });
  });
});

describe('generateCommandId', () => {
  it('should generate unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateCommandId());
    }
    expect(ids.size).toBe(100);
  });

  it('should have correct format', () => {
    const id = generateCommandId();
    expect(id).toMatch(/^cmd_\d+_[a-z0-9]+$/);
  });
});

describe('complete workflow', () => {
  let agent: BrowserAgent;

  beforeEach(() => {
    agent = new BrowserAgent();
  });

  afterEach(async () => {
    await agent.close();
  });

  it('should complete a form filling workflow', async () => {
    document.body.innerHTML = `
      <form id="login-form">
        <label for="username">Username</label>
        <input id="username" type="text" name="username">

        <label for="password">Password</label>
        <input id="password" type="password" name="password">

        <button type="submit">Login</button>
      </form>
    `;

    // Get snapshot to see the form
    const { snapshot } = await agent.snapshot();
    expect(snapshot).toContain('textbox');
    expect(snapshot).toContain('button');

    // Fill in the form
    await agent.fill('#username', 'testuser');
    await agent.fill('#password', 'testpass');

    // Verify values
    const username = document.getElementById('username') as HTMLInputElement;
    const password = document.getElementById('password') as HTMLInputElement;

    expect(username.value).toBe('testuser');
    expect(password.value).toBe('testpass');
  });

  it('should work with refs from snapshot', async () => {
    document.body.innerHTML = `
      <button>First Button</button>
      <button>Second Button</button>
    `;

    const { refs } = await agent.snapshot();

    // Find the refs for buttons
    const buttonRefs = Object.entries(refs)
      .filter(([_, data]) => data.role === 'button')
      .map(([key]) => key);

    expect(buttonRefs.length).toBe(2);

    // Click using ref
    const handlers = [vi.fn(), vi.fn()];
    const buttons = document.querySelectorAll('button');
    buttons[0].addEventListener('click', handlers[0]);
    buttons[1].addEventListener('click', handlers[1]);

    await agent.click(`@${buttonRefs[0]}`);
    expect(handlers[0]).toHaveBeenCalled();
  });

  it('should handle dynamic content', async () => {
    document.body.innerHTML = '<div id="container"></div>';

    // Initially empty
    let { snapshot } = await agent.snapshot({ selector: '#container' });
    expect(snapshot).not.toContain('button');

    // Add content dynamically
    document.getElementById('container')!.innerHTML = '<button>Dynamic</button>';

    // Should now see button
    ({ snapshot } = await agent.snapshot({ selector: '#container' }));
    expect(snapshot).toContain('button');
    expect(snapshot).toContain('Dynamic');
  });
});
