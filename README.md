# BTCP Browser Agent

Browser Tool Calling Protocol - A browser-native implementation for AI agents to interact with web pages using native browser APIs.

## Architecture

This package provides a clean separation between browser-level and DOM-level operations:

```
┌─────────────────────────────────────────────────────────────────┐
│  Background Script (Extension Service Worker)                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ BackgroundAgent                                              ││
│  │  - Tab management (create, close, switch, list)             ││
│  │  - Navigation (goto, back, forward, reload)                 ││
│  │  - Screenshots (chrome.tabs.captureVisibleTab)              ││
│  │  - Routes DOM commands → ContentAgent                       ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
            chrome.tabs.sendMessage
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Content Script (Per Tab)                                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ContentAgent                                                 ││
│  │  - DOM snapshot (accessibility tree)                        ││
│  │  - Element interaction (click, type, fill, hover)           ││
│  │  - DOM queries (getText, getAttribute, isVisible)           ││
│  │  - Keyboard/mouse events                                    ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Installation

```bash
npm install btcp-browser-agent
```

## Quick Start

### Extension Usage

**Background Script:**
```typescript
import { BackgroundAgent, setupMessageListener } from 'btcp-browser-agent/extension';

// Option 1: Just set up message routing
setupMessageListener();

// Option 2: Use BackgroundAgent directly for programmatic control
const agent = new BackgroundAgent();
await agent.navigate('https://example.com');
await agent.screenshot();
```

**Content Script:**
```typescript
import { createContentAgent } from 'btcp-browser-agent';

const agent = createContentAgent();

// Take a snapshot
const { data } = await agent.execute({ id: '1', action: 'snapshot' });
console.log(data.tree);  // Accessibility tree with refs

// Click an element using ref from snapshot
await agent.execute({ id: '2', action: 'click', selector: '@ref:5' });
```

**Popup (sending commands via messaging):**
```typescript
import { createClient } from 'btcp-browser-agent';

const client = createClient();

// Navigate and interact
await client.navigate('https://example.com');
const snapshot = await client.snapshot();
await client.click('@ref:5');
const screenshot = await client.screenshot();
```

### Standalone Usage (No Extension)

For use directly in a web page (limited to same-origin, no tab management):

```typescript
import { createContentAgent } from 'btcp-browser-agent';

const agent = createContentAgent();

// Take a snapshot
const { data } = await agent.execute({ id: '1', action: 'snapshot' });

// Interact with elements
await agent.execute({ id: '2', action: 'click', selector: '@ref:5' });
await agent.execute({ id: '3', action: 'fill', selector: '@ref:3', value: 'Hello' });
```

## API Reference

### BackgroundAgent (Extension Background Script)

High-level browser orchestrator that runs in the extension's background script.

```typescript
import { BackgroundAgent } from 'btcp-browser-agent/extension';

const agent = new BackgroundAgent();

// Tab Management
await agent.newTab({ url: 'https://example.com' });
await agent.switchTab(tabId);
await agent.closeTab(tabId);
const tabs = await agent.listTabs();

// Navigation
await agent.navigate('https://example.com');
await agent.back();
await agent.forward();
await agent.reload();

// Screenshots
const screenshot = await agent.screenshot({ format: 'png' });

// Execute commands (routes to ContentAgent for DOM operations)
await agent.execute({ id: '1', action: 'click', selector: '#submit' });
```

#### Multi-Tab Operations

```typescript
// Open tabs
const tab1 = await agent.newTab({ url: 'https://google.com' });
const tab2 = await agent.newTab({ url: 'https://github.com', active: false });

// Method 1: tab() handle - interact without switching
const githubTab = agent.tab(tab2.id);
await githubTab.snapshot();
await githubTab.click('@ref:5');

// Method 2: Specify tabId in execute
await agent.execute(
  { id: '1', action: 'getText', selector: 'h1' },
  { tabId: tab2.id }
);

// Active tab stays tab1 (no switching needed)
```

### BrowserAgent (Standalone - Browser Tab)

For use directly in a browser tab with convenience methods:

```typescript
import { BrowserAgent } from 'btcp-browser-agent';

const agent = new BrowserAgent();
await agent.launch();

// Convenience methods
const { snapshot, refs } = await agent.snapshot();
await agent.click('@e1');
await agent.fill('@e2', 'Hello World');
await agent.type('input[name="email"]', 'user@example.com');

await agent.close();
```

### ContentAgent (Content Script)

DOM automation agent that runs in content scripts or web pages.

```typescript
import { createContentAgent } from 'btcp-browser-agent';

const agent = createContentAgent();

// Execute commands
const response = await agent.execute({
  id: 'cmd1',
  action: 'snapshot'
});
```

#### Available Actions

**DOM Reading:**
| Action | Description |
|--------|-------------|
| `snapshot` | Get accessibility tree with element refs |
| `getText` | Get element text content |
| `getAttribute` | Get element attribute value |
| `isVisible` | Check if element is visible |
| `isEnabled` | Check if element is enabled |
| `isChecked` | Check if checkbox/radio is checked |
| `getBoundingBox` | Get element dimensions |

**Element Interaction:**
| Action | Description |
|--------|-------------|
| `click` | Click an element |
| `dblclick` | Double-click an element |
| `type` | Type text (keystroke by keystroke) |
| `fill` | Fill input (instant) |
| `clear` | Clear input value |
| `check` | Check checkbox |
| `uncheck` | Uncheck checkbox |
| `select` | Select dropdown option |
| `hover` | Hover over element |
| `focus` | Focus element |
| `blur` | Remove focus |

**Keyboard/Mouse:**
| Action | Description |
|--------|-------------|
| `press` | Press a key |
| `keyDown` | Key down event |
| `keyUp` | Key up event |

**Other:**
| Action | Description |
|--------|-------------|
| `scroll` | Scroll page or element |
| `scrollIntoView` | Scroll element into view |
| `wait` | Wait for element state |
| `evaluate` | Execute JavaScript |

### Element Refs

The `snapshot` action returns element references for stable selection:

```typescript
const { data } = await agent.execute({ id: '1', action: 'snapshot' });
// data.tree: "- button 'Submit' [ref=5]\n- textbox 'Email' [ref=3]"
// data.refs: { '5': { role: 'button', name: 'Submit' }, ... }

// Use refs in subsequent commands
await agent.execute({ id: '2', action: 'click', selector: '@ref:5' });
```

## Package Structure

```
btcp-browser-agent/
├── @aspect/core          # ContentAgent - DOM operations
│   ├── createContentAgent()
│   ├── DOMActions
│   └── createSnapshot()
│
├── @aspect/extension     # BackgroundAgent - Browser operations
│   ├── BackgroundAgent
│   ├── setupMessageListener()
│   └── createClient()
│
└── btcp-browser-agent    # Main package - re-exports both
```

## Capabilities Comparison

| Capability | ContentAgent (Standalone) | BackgroundAgent (Extension) |
|------------|--------------------------|--------------------------|
| DOM Snapshot | ✅ | ✅ (via ContentAgent) |
| Element Clicks | ✅ | ✅ (via ContentAgent) |
| Form Filling | ✅ | ✅ (via ContentAgent) |
| Cross-origin | ❌ Same-origin only | ✅ Any page |
| Tab Management | ❌ | ✅ |
| Navigation | ❌ | ✅ |
| Screenshots | ❌ | ✅ |

## Use Cases

- **Browser Extensions** - Full browser automation with BackgroundAgent + ContentAgent
- **Web Applications** - DOM automation with ContentAgent only
- **Testing Tools** - Automated UI testing
- **AI Assistants** - Enable AI models to control web pages

## License

Apache-2.0
