# btcp-browser-agent

Give AI agents the power to see and control any browser.

A lightweight foundation for building AI systems that need browser access — automation, testing, web agents, or any browser-based workflow.

## Why This Package?

AI agents struggle with browsers because:
- Raw HTML is too noisy (thousands of nodes)
- CSS selectors break when layouts change
- No stable way to reference elements across turns

**Browser Agent solves this with smart snapshots:**

```
BUTTON "Submit" [@ref:0]
TEXTBOX "Email" [required] [@ref:1]
LINK "Forgot password?" [@ref:2]
```

One command gives your agent a clean, semantic view of any page. Stable `@ref` markers let it interact without fragile selectors.

## Features

- **Smart Snapshots** - Accessibility tree format optimized for AI comprehension
- **Stable Element Refs** - `@ref:N` markers that survive DOM changes within a session
- **Full Browser Control** - Navigation, tabs, screenshots, keyboard/mouse
- **46 DOM Actions** - Click, type, fill, scroll, hover, and more
- **Two Modes** - Chrome extension (full control) or standalone (same-origin)

## Quick Example

```typescript
import { createClient } from 'btcp-browser-agent/extension';

const agent = createClient();

// Navigate and understand the page
await agent.navigate('https://example.com');
const snapshot = await agent.snapshot();
// Returns: BUTTON "Login" [@ref:0], TEXTBOX "Email" [@ref:1], ...

// Interact using refs - no CSS selectors needed
await agent.fill('@ref:1', 'user@example.com');
await agent.click('@ref:0');
```

## Use Cases

- **AI Assistants** - Let LLMs browse the web and complete tasks for users
- **Browser Agents** - Foundation for autonomous web agents that research, navigate, and act
- **Automated Testing** - Reliable UI tests with stable element refs that don't break on layout changes
- **Web Automation** - Form filling, data extraction, multi-step workflow automation
- **Web Scraping** - Extract structured data with semantic understanding of page content

## Installation

```bash
npm install btcp-browser-agent
```

## Usage Modes

### Extension Mode (Full Browser Control)

For Chrome extensions with cross-origin access, tab management, and screenshots.

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
const { data } = await agent.execute({ action: 'snapshot' });
console.log(data.tree);  // Accessibility tree with refs

// Click an element using ref from snapshot
await agent.execute({ action: 'click', selector: '@ref:5' });
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

### Standalone Mode (No Extension)

For use directly in a web page (limited to same-origin, no tab management):

```typescript
import { createContentAgent } from 'btcp-browser-agent';

const agent = createContentAgent();

// Take a snapshot
const { data } = await agent.execute({ action: 'snapshot' });

// Interact with elements
await agent.execute({ action: 'click', selector: '@ref:5' });
await agent.execute({ action: 'fill', selector: '@ref:3', value: 'Hello' });
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
await agent.execute({ action: 'click', selector: '#submit' });
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
  { action: 'getText', selector: 'h1' },
  { tabId: tab2.id }
);

// Active tab stays tab1 (no switching needed)
```

### ContentAgent (Content Script)

DOM automation agent that runs in content scripts or web pages.

```typescript
import { createContentAgent } from 'btcp-browser-agent';

const agent = createContentAgent();

// Execute commands
const response = await agent.execute({ action: 'snapshot' });
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
const { data } = await agent.execute({ action: 'snapshot' });
// data.tree: "BUTTON 'Submit' [@ref:5]\nTEXTBOX 'Email' [@ref:3]"

// Use refs in subsequent commands
await agent.execute({ action: 'click', selector: '@ref:5' });
```

## Architecture

The package provides a clean separation between browser-level and DOM-level operations:

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

## Package Structure

```
btcp-browser-agent/
├── @btcp/core          # ContentAgent - DOM operations
│   ├── createContentAgent()
│   ├── DOMActions
│   └── createSnapshot()
│
├── @btcp/extension     # BackgroundAgent - Browser operations
│   ├── BackgroundAgent
│   ├── setupMessageListener()
│   └── createClient()
│
└── btcp-browser-agent   # Main package - re-exports both
```

## Capabilities Comparison

| Capability | ContentAgent (Standalone) | BackgroundAgent (Extension) |
|------------|--------------------------|--------------------------|
| DOM Snapshot | Yes | Yes (via ContentAgent) |
| Element Clicks | Yes | Yes (via ContentAgent) |
| Form Filling | Yes | Yes (via ContentAgent) |
| Cross-origin | Same-origin only | Any page |
| Tab Management | No | Yes |
| Navigation | No | Yes |
| Screenshots | No | Yes |

## License

Apache-2.0
