# @aspect/extension

Chrome extension bridge for browser automation. Provides `BrowserAgent` for background scripts and integrates with `ContentAgent` from `@aspect/core`.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Background Script                                               │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ BrowserAgent                                                 ││
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
│  │ ContentAgent (from @aspect/core)                             ││
│  │  - DOM snapshot                                              ││
│  │  - Element interaction (click, type, fill)                  ││
│  │  - DOM queries                                               ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Installation

```bash
npm install @aspect/extension
```

## Usage

### Background Script

```typescript
import { BrowserAgent, setupMessageListener } from '@aspect/extension';

// Option 1: Set up automatic message routing
setupMessageListener();

// Option 2: Use BrowserAgent programmatically
const browser = new BrowserAgent();

// Tab management
await browser.newTab({ url: 'https://example.com' });
await browser.switchTab(tabId);
await browser.closeTab();
const tabs = await browser.listTabs();

// Navigation
await browser.navigate('https://example.com');
await browser.back();
await browser.forward();
await browser.reload();

// Screenshots
const screenshot = await browser.screenshot({ format: 'png' });

// Execute DOM commands (routes to ContentAgent)
await browser.execute({ id: '1', action: 'click', selector: '#submit' });
```

### Content Script

```typescript
import { createContentAgent } from '@aspect/core';

const agent = createContentAgent();

// Take a snapshot
const response = await agent.execute({ id: '1', action: 'snapshot' });
console.log(response.data.tree);  // Accessibility tree

// Interact with elements
await agent.execute({ id: '2', action: 'click', selector: '@ref:5' });
await agent.execute({ id: '3', action: 'fill', selector: '@ref:3', value: 'Hello' });
```

### Popup / External Scripts

```typescript
import { createClient } from '@aspect/extension';

const client = createClient();

// All commands route through background script
await client.navigate('https://example.com');
const snapshot = await client.snapshot();
await client.click('@ref:5');
const screenshot = await client.screenshot();
```

## API

### BrowserAgent

| Method | Description |
|--------|-------------|
| `navigate(url, options?)` | Navigate to URL |
| `back()` | Go back in history |
| `forward()` | Go forward in history |
| `reload(options?)` | Reload page |
| `getUrl()` | Get current URL |
| `getTitle()` | Get page title |
| `screenshot(options?)` | Capture screenshot |
| `newTab(options?)` | Create new tab |
| `closeTab(tabId?)` | Close tab |
| `switchTab(tabId)` | Switch to tab |
| `listTabs()` | List all tabs |
| `execute(command)` | Execute any command |

### Exported Functions

| Function | Description |
|----------|-------------|
| `setupMessageListener()` | Set up background message routing |
| `getBrowserAgent()` | Get singleton BrowserAgent instance |
| `createClient()` | Create client for popup/external use |

## License

Apache-2.0
