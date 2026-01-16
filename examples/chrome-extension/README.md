# Aspect Browser Agent - Chrome Extension Example

This example shows how to build a Chrome extension that enables AI to control browser tabs.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         WEB PAGE                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Content Script (@aspect/core)                │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │  │
│  │  │   Snapshot  │  │  Actions    │  │  Element Refs   │   │  │
│  │  │  (DOM→A11y) │  │  (click,    │  │  (@ref:0, etc)  │   │  │
│  │  │             │  │   type...)  │  │                 │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                               │
                chrome.runtime.sendMessage
                               │
┌──────────────────────────────┼───────────────────────────────────┐
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Background Service Worker                    │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │  │
│  │  │  Navigation │  │  Tab Mgmt   │  │  Screenshot     │   │  │
│  │  │  (goto,     │  │  (new, close│  │  (capture)      │   │  │
│  │  │   back...)  │  │   switch)   │  │                 │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                         ▲                                        │
│                         │ aspectAgent API                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Popup UI                               │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

## Command Routing

Commands are automatically routed to the right handler:

| Command Type | Handler | Examples |
|--------------|---------|----------|
| **DOM Actions** | Content Script | `snapshot`, `click`, `type`, `fill`, `scroll`, `hover` |
| **Navigation** | Background | `navigate`, `back`, `forward`, `reload` |
| **Tab Management** | Background | `tabNew`, `tabClose`, `tabSwitch`, `tabList` |
| **Screenshot** | Background | `screenshot` |

## Files

- `manifest.json` - Extension manifest (Manifest V3)
- `background.js` - Handles navigation, tabs, screenshots, and routes DOM commands
- `content.js` - Runs in pages, handles DOM commands
- `popup.html/js` - Extension popup UI

## Installation

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select this directory

## Usage

### From Popup UI

1. Click the extension icon to open the popup
2. Use quick actions:
   - **Snapshot** - Get page structure with element refs
   - **Screenshot** - Capture visible tab
   - **List Tabs** - Get all open tabs
   - **Navigate** - Go to a URL
   - **Click** - Click element by ref (`@ref:0`) or CSS selector
   - **Fill** - Fill input field

### Programmatic API

From the background script or popup:

```javascript
// Using the aspectAgent API (available globally in background)
const snapshot = await aspectAgent.snapshot();
console.log(snapshot.data.tree);

// Click using ref from snapshot
await aspectAgent.click('@ref:0');

// Fill a form field
await aspectAgent.fill('@ref:1', 'user@example.com');

// Navigate
await aspectAgent.navigate('https://example.com');

// Take screenshot
const screenshot = await aspectAgent.screenshot();
```

### Raw Command Format

```javascript
// Send command via message
chrome.runtime.sendMessage({
  type: 'aspect:command',
  command: {
    id: 'cmd_1',
    action: 'snapshot'
  }
});

// Response format
{
  type: 'aspect:response',
  response: {
    id: 'cmd_1',
    success: true,
    data: {
      tree: '@ref:0 link "Home"\n@ref:1 textbox "Email"\n...',
      refs: { '@ref:0': { role: 'link', name: 'Home' }, ... }
    }
  }
}
```

## Available Commands

### DOM Commands (handled by content script)

| Command | Parameters | Description |
|---------|------------|-------------|
| `snapshot` | `selector?, maxDepth?` | Get accessibility tree |
| `click` | `selector` | Click element |
| `fill` | `selector, value` | Set input value |
| `type` | `selector, text, clear?, delay?` | Type text |
| `check` | `selector` | Check checkbox/radio |
| `uncheck` | `selector` | Uncheck checkbox |
| `select` | `selector, values` | Select option(s) |
| `hover` | `selector` | Hover over element |
| `scroll` | `selector?, x?, y?` | Scroll |
| `scrollIntoView` | `selector` | Scroll element into view |
| `focus` | `selector` | Focus element |
| `getText` | `selector` | Get element text |
| `getAttribute` | `selector, attribute` | Get attribute value |
| `isVisible` | `selector` | Check visibility |
| `isEnabled` | `selector` | Check if enabled |
| `isChecked` | `selector` | Check if checked |
| `wait` | `selector?, timeout?` | Wait for element |
| `evaluate` | `script` | Execute JavaScript |

### Extension Commands (handled by background)

| Command | Parameters | Description |
|---------|------------|-------------|
| `navigate` | `url, waitUntil?` | Navigate to URL |
| `back` | - | Go back |
| `forward` | - | Go forward |
| `reload` | `bypassCache?` | Reload page |
| `getUrl` | - | Get current URL |
| `getTitle` | - | Get page title |
| `screenshot` | `format?, quality?` | Capture visible tab |
| `tabNew` | `url?, active?` | Create new tab |
| `tabClose` | `tabId?` | Close tab |
| `tabSwitch` | `tabId` | Switch to tab |
| `tabList` | - | List all tabs |

## Selector Formats

- `@ref:0` - Element ref from snapshot (recommended)
- `#id` - CSS ID selector
- `.class` - CSS class selector
- `[data-testid="x"]` - Attribute selector

## Permissions

- `activeTab` - Access current tab
- `tabs` - Tab management and screenshots
- `scripting` - Inject content scripts
- `<all_urls>` - Access all URLs

## AI Integration Example

```javascript
// background.js - AI agent loop
async function runAgent(task) {
  // 1. Get page snapshot
  const { data } = await aspectAgent.snapshot();

  // 2. Send to AI with task
  const aiResponse = await askAI(task, data.tree);

  // 3. Execute AI's command
  const command = JSON.parse(aiResponse);
  return aspectAgent.execute(command);
}
```
