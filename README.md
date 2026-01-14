# BTCP Browser Agent

Browser Tool Calling Protocol - A browser-native implementation for AI agents to interact with web pages using native browser APIs.

## Overview

This library is a port of [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser) adapted to run directly in the browser context. Instead of using Playwright (which requires Node.js), it uses native browser APIs to provide similar functionality for browser automation.

## Key Differences from agent-browser

| Feature | agent-browser | btcp-browser-agent |
|---------|--------------|-------------------|
| Runtime | Node.js | Browser |
| Browser Control | Playwright | Native DOM APIs |
| Element Selection | Playwright Locators | CSS Selectors + Refs |
| Accessibility Tree | Playwright ARIA | Custom DOM Walker |
| Screenshots | Playwright API | Canvas API |
| Network | CDP/Routes | fetch/XHR interception |

## Installation

```bash
npm install btcp-browser-agent
```

## Quick Start

```typescript
import { BrowserAgent } from 'btcp-browser-agent';

// Create an agent
const agent = new BrowserAgent();
await agent.launch();

// Get a snapshot of the page
const { snapshot, refs } = await agent.snapshot();
console.log(snapshot);

// Interact with elements using refs
await agent.click('@e1'); // Click element ref e1
await agent.fill('@e2', 'Hello World'); // Fill input ref e2

// Or use CSS selectors
await agent.click('button.submit');
await agent.type('input[name="email"]', 'user@example.com');

// Close when done
await agent.close();
```

## API Reference

### BrowserAgent

The main entry point for browser automation.

```typescript
const agent = new BrowserAgent({
  targetWindow?: Window,      // Target window (default: current window)
  targetDocument?: Document,  // Target document (default: current document)
  onScreencastFrame?: (frame) => void, // Screencast callback
  onResponse?: (response) => void,     // Command response callback
  autoLaunch?: boolean,       // Auto-launch on first command (default: true)
});
```

#### Methods

- `launch()` - Initialize the agent
- `close()` - Clean up and close
- `execute(command)` - Execute a command
- `executeJSON(json)` - Execute command from JSON string
- `snapshot(options?)` - Get DOM snapshot with element refs
- `click(selector, options?)` - Click an element
- `type(selector, text, options?)` - Type text keystroke by keystroke
- `fill(selector, value)` - Fill an input instantly
- `hover(selector)` - Hover over an element
- `press(key, selector?)` - Press a key
- `waitFor(selector, options?)` - Wait for an element
- `scroll(options)` - Scroll the page or element
- `evaluate(script)` - Execute JavaScript
- `getText(selector)` - Get element text content
- `getAttribute(selector, attr)` - Get element attribute
- `isVisible(selector)` - Check element visibility
- `getUrl()` - Get current URL
- `getTitle()` - Get page title
- `describe(action?)` - Get API documentation (see Self-Description API)

### Self-Description API

The agent provides a single unified function for AI agents to understand its capabilities:

```typescript
// Get full API description
const info = agent.describe();
console.log(info.actions);    // ['click', 'snapshot', 'type', ...]
console.log(info.methods);    // [{ name: 'click', signature: '...' }, ...]
console.log(info.quickRef);   // Quick reference string for context injection

// Get specific action help
const clickInfo = agent.describe('click');
console.log(clickInfo.action);  // { name: 'click', parameters: [...], examples: [...] }

// Get suggestions for typos
const typoInfo = agent.describe('clck');
console.log(typoInfo.suggestions);  // ['click']

// Works as static method too
const info = BrowserAgent.describe();
```

The `Description` object contains:
- `agent` - Name, version, and description
- `actions` - List of all available action names
- `action` - Specific action details (when queried)
- `suggestions` - Suggestions for unknown actions
- `methods` - Method signatures with examples
- `selectors` - Selector format reference
- `workflow` - Typical workflow steps
- `quickRef` - Compact reference for AI context injection

### Inline Help

Any command can return documentation instead of executing by setting `help: true`:

```typescript
// Get help for click action without executing
const response = await agent.execute({
  id: 'cmd1',
  action: 'click',
  selector: 'button', // Won't be clicked
  help: true          // Returns documentation instead
});

console.log(response.data.action);    // { name: 'click', parameters: [...] }
console.log(response.data.quickRef);  // Quick reference string
```

This enables AI agents to self-correct by calling the same action with `help: true` when errors occur.

### Commands

Execute commands using the `execute()` method:

```typescript
const response = await agent.execute({
  id: 'cmd1',
  action: 'click',
  selector: 'button.submit'
});
```

#### Available Actions

**Navigation**
- `navigate` - Navigate to URL
- `back` - Go back
- `forward` - Go forward
- `reload` - Reload page

**Interaction**
- `click` - Click element
- `dblclick` - Double click
- `type` - Type text (keystroke by keystroke)
- `fill` - Fill input (instant)
- `check` - Check checkbox
- `uncheck` - Uncheck checkbox
- `select` - Select dropdown option
- `hover` - Hover over element
- `focus` - Focus element
- `drag` - Drag and drop
- `tap` - Touch tap

**Semantic Locators**
- `getbyrole` - Find by ARIA role
- `getbytext` - Find by text content
- `getbylabel` - Find by label
- `getbyplaceholder` - Find by placeholder
- `getbyalttext` - Find by alt text
- `getbytitle` - Find by title
- `getbytestid` - Find by data-testid

**Queries**
- `snapshot` - Get accessibility snapshot
- `content` - Get HTML content
- `getattribute` - Get attribute value
- `gettext` - Get text content
- `innertext` - Get inner text
- `innerhtml` - Get inner HTML
- `inputvalue` - Get input value
- `isvisible` - Check visibility
- `isenabled` - Check if enabled
- `ischecked` - Check if checked
- `count` - Count matching elements
- `boundingbox` - Get element bounds

**Keyboard**
- `press` - Press key
- `keyboard` - Press key combo
- `keydown` - Key down event
- `keyup` - Key up event
- `inserttext` - Insert text

**Mouse**
- `mousemove` - Move mouse
- `mousedown` - Mouse down
- `mouseup` - Mouse up
- `wheel` - Mouse wheel

**Frames**
- `frame` - Switch to frame
- `mainframe` - Switch to main frame

**Storage**
- `storage_get` - Get storage value
- `storage_set` - Set storage value
- `storage_clear` - Clear storage

**Waiting**
- `wait` - Wait for condition
- `waitforurl` - Wait for URL
- `waitforloadstate` - Wait for load state
- `waitforfunction` - Wait for function

**Other**
- `screenshot` - Take screenshot
- `evaluate` - Execute JavaScript
- `scroll` - Scroll page/element
- `scrollintoview` - Scroll element into view
- `highlight` - Highlight element
- `clear` - Clear input
- `selectall` - Select all text
- `dispatch` - Dispatch event
- `addscript` - Add script tag
- `addstyle` - Add style tag
- `setcontent` - Set page HTML
- `console` - Get console messages
- `errors` - Get page errors

### Element Refs

The `snapshot` command returns element references that can be used for stable element selection:

```typescript
const { snapshot, refs } = await agent.snapshot();
// snapshot contains: "- button 'Submit' [ref=e1]"

// Use refs in commands
await agent.click('@e1');
await agent.click('ref=e1');
await agent.click('[ref=e1]');
await agent.click('e1');
```

### Low-Level API

For more control, use the individual modules:

```typescript
import {
  BrowserManager,
  executeCommand,
  parseCommand,
  getEnhancedSnapshot,
} from 'btcp-browser-agent';

// Create browser manager
const browser = new BrowserManager();
await browser.launch({ id: '1', action: 'launch' });

// Get snapshot
const snapshot = await browser.getSnapshot();

// Execute commands
const response = await executeCommand({
  id: '2',
  action: 'click',
  selector: 'button'
}, browser);
```

## AI Agent Optimization

The agent is designed specifically for AI workflows. Recommended approach:

### Workflow

1. **Get snapshot** - Capture accessibility tree with element refs
2. **Identify targets** - Use refs like `@e1`, `@e2` from snapshot
3. **Execute actions** - Use refs for stable element selection
4. **Re-snapshot** - Refresh view after page changes

```typescript
// 1. Get initial snapshot
const { snapshot, refs } = await agent.snapshot({ interactive: true });
// Returns: "- button 'Submit' [ref=e1]\n- textbox 'Email' [ref=e2]"

// 2. Interact using refs (stable, deterministic)
await agent.fill('@e2', 'user@example.com');
await agent.click('@e1');

// 3. Wait for changes and re-snapshot
await agent.waitFor('#success');
const updated = await agent.snapshot();
```

### Selector Formats

| Format | Example | Description |
|--------|---------|-------------|
| `@e1` | `@e1` | Element ref (preferred, stable) |
| `ref=` | `ref=e1` | Alt ref format |
| `#id` | `#submit` | CSS ID selector |
| `.class` | `.btn` | CSS class selector |
| `[attr]` | `[data-testid="x"]` | CSS attribute selector |

### Context Injection

Use `describe().quickRef` for minimal AI context:

```typescript
const systemPrompt = `You are a browser automation agent.
${agent.describe().quickRef}`;
```

### Error Recovery

When actions fail, use inline help to understand correct usage:

```typescript
try {
  await agent.execute({ id: '1', action: 'clck', selector: '#btn' });
} catch (error) {
  // Get help for similar action
  const help = await agent.execute({ id: '2', action: 'clck', help: true });
  console.log(help.data.suggestions); // ['click']
}
```

## Limitations

This browser-native implementation has some limitations compared to the Playwright-based version:

1. **No cross-origin access** - Can only interact with same-origin content
2. **Limited screenshot support** - Full screenshot requires canvas rendering
3. **No HAR recording** - Limited to fetch/XHR request tracking
4. **No video recording** - Not available in browser context
5. **No PDF generation** - Requires server-side processing
6. **No file upload** - File input interaction is limited
7. **No network interception** - Can only track requests, not modify responses
8. **Dialog handling** - Native dialogs (alert, confirm, prompt) cannot be intercepted

## Use Cases

- **Browser extensions** - Add AI agent capabilities to extensions
- **Web applications** - Build automation features into web apps
- **Testing tools** - Create browser-based testing frameworks
- **Accessibility tools** - Build tools that analyze and interact with pages
- **AI assistants** - Enable AI models to control web pages

## License

Apache-2.0 (same as original agent-browser)
