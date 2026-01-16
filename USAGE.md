# Usage Guide

## Installation

```bash
npm install btcp-browser-agent
# or from git
npm install git+https://github.com/browser-tool-calling-protocol/btcp-browser-agent.git
```

## Chrome Extension Setup

Three files, minimal setup:

### 1. Content Script (registers DOM agent)

```typescript
// content.ts
import { createContentAgent } from 'btcp-browser-agent/extension';

const agent = createContentAgent();
chrome.runtime.onMessage.addListener(agent.handleMessage);
```

### 2. Background Script (routes messages)

```typescript
// background.ts
import { setupMessageListener } from 'btcp-browser-agent/extension';

setupMessageListener();
```

### 3. Popup (sends commands)

```typescript
// popup.ts
import { createClient } from 'btcp-browser-agent/extension';

const client = createClient();

// Navigate and interact
await client.navigate('https://example.com');
const { tree } = await client.snapshot();
console.log(tree);
// - button 'Submit' [ref=5]
// - textbox 'Email' [ref=3]

await client.fill('@ref:3', 'user@example.com');
await client.click('@ref:5');
```

**Flow:** Popup → Background → Content → DOM

## Standalone Usage (No Extension)

```typescript
import { createContentAgent } from 'btcp-browser-agent';

const agent = createContentAgent();

// Take snapshot
const { data } = await agent.execute({ id: '1', action: 'snapshot' });

// Interact with elements using refs from snapshot
await agent.execute({ id: '2', action: 'click', selector: '@ref:5' });
await agent.execute({ id: '3', action: 'fill', selector: '@ref:3', value: 'text' });
```

## Available Actions

### DOM Operations (ContentAgent)

| Action | Description |
|--------|-------------|
| `snapshot` | Get accessibility tree with element refs |
| `click` | Click element |
| `dblclick` | Double-click element |
| `type` | Type text keystroke by keystroke |
| `fill` | Fill input instantly |
| `clear` | Clear input value |
| `check` | Check a checkbox |
| `uncheck` | Uncheck a checkbox |
| `select` | Select option(s) in a dropdown |
| `focus` | Focus an element |
| `blur` | Remove focus from element |
| `hover` | Hover over element |
| `scroll` | Scroll page or element |
| `scrollIntoView` | Scroll element into view |
| `querySelector` | Find element by selector |
| `querySelectorAll` | Find all matching elements |
| `getText` | Get element text |
| `getAttribute` | Get element attribute value |
| `getProperty` | Get element property value |
| `getBoundingBox` | Get element dimensions and position |
| `isVisible` | Check visibility |
| `isEnabled` | Check if element is enabled |
| `isChecked` | Check if checkbox/radio is checked |
| `press` | Press a keyboard key |
| `keyDown` | Key down event |
| `keyUp` | Key up event |
| `wait` | Wait for element state |
| `evaluate` | Execute JavaScript in page context |

### Browser Operations (BackgroundAgent)

| Action | Description |
|--------|-------------|
| `navigate` | Go to URL |
| `back` / `forward` | History navigation |
| `reload` | Reload the page |
| `getUrl` | Get current page URL |
| `getTitle` | Get current page title |
| `screenshot` | Capture visible tab |
| `tabNew` / `tabClose` | Tab management |
| `tabSwitch` / `tabList` | Tab switching |

## Element Selection

Use refs from snapshot for stable element selection:

```typescript
// Get snapshot with refs
const { data } = await agent.execute({ id: '1', action: 'snapshot' });
// data.tree: "- button 'Submit' [ref=5]\n- textbox 'Email' [ref=3]"

// Use ref in commands
await agent.execute({ id: '2', action: 'click', selector: '@ref:5' });

// Or use CSS selectors
await agent.execute({ id: '3', action: 'click', selector: '#submit-btn' });
```

## Message Protocol

Commands use a simple JSON protocol:

```typescript
// Request
{ id: string, action: string, ...params }

// Response
{ id: string, success: boolean, data?: any, error?: string }
```

Extension messages use `btcp:command` and `btcp:response` types.
