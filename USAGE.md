# Usage Guide

## Installation

```bash
npm install btcp-browser-agent
# or from git
npm install git+https://github.com/browser-tool-calling-protocol/btcp-browser-agent.git
```

## Chrome Extension Setup

### 1. Background Script

```typescript
// background.ts
import { BackgroundAgent, setupMessageListener } from 'btcp-browser-agent/extension';

// Option A: Auto-setup message routing
setupMessageListener();

// Option B: Programmatic control
const agent = new BackgroundAgent();
await agent.navigate('https://example.com');
await agent.screenshot();
```

### 2. Content Script

```typescript
// content.ts
import { createContentAgent } from 'btcp-browser-agent/core';

const agent = createContentAgent();

// Execute commands
const { data } = await agent.execute({ id: '1', action: 'snapshot' });
console.log(data.tree);  // Accessibility tree

await agent.execute({ id: '2', action: 'click', selector: '@ref:5' });
```

### 3. Popup / External Script

```typescript
// popup.ts
import { createClient } from 'btcp-browser-agent/extension';

const client = createClient();

// High-level API
await client.navigate('https://example.com');
const snapshot = await client.snapshot();
await client.click('@ref:5');
await client.fill('@ref:3', 'Hello World');
const screenshot = await client.screenshot();
```

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
| `type` | Type text keystroke by keystroke |
| `fill` | Fill input instantly |
| `hover` | Hover over element |
| `scroll` | Scroll page or element |
| `getText` | Get element text |
| `isVisible` | Check visibility |

### Browser Operations (BackgroundAgent)

| Action | Description |
|--------|-------------|
| `navigate` | Go to URL |
| `back` / `forward` | History navigation |
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
