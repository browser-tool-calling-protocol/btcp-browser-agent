# Chrome Extension Example

Production-ready TypeScript example using `btcp-browser-agent`.

## Project Structure

```
examples/chrome-extension/
├── src/
│   ├── content.ts      # DOM agent + message listener
│   ├── background.ts   # routes messages
│   └── popup.ts        # UI using createClient
├── dist/               # Built output (gitignored)
├── manifest.json       # Chrome extension manifest
├── popup.html          # Popup UI
├── package.json        # Build dependencies
├── tsconfig.json       # TypeScript config
└── build.js            # esbuild script
```

## Source Files

**src/content.ts** - registers DOM agent and message listener
```typescript
import { createContentAgent } from 'btcp-browser-agent/extension';

const agent = createContentAgent();
chrome.runtime.onMessage.addListener(agent.handleMessage);
```

**src/background.ts** - routes messages
```typescript
import { setupMessageListener } from 'btcp-browser-agent/extension';
setupMessageListener();
```

**src/popup.ts** - sends commands
```typescript
import { createClient } from 'btcp-browser-agent/extension';

const client = createClient();
await client.navigate('https://example.com');
const { tree } = await client.snapshot();
await client.click('@ref:5');
```

## Setup

```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Or watch for changes
npm run watch
```

## Load Extension

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select this directory

## Architecture

```
Popup ──chrome.runtime.sendMessage──► Background (setupMessageListener)
                                           │
                                    chrome.tabs.sendMessage
                                           ▼
                                      Content Script (auto-registered)
                                           │
                                      ContentAgent → DOM
```

## API Usage

```typescript
import { createClient } from 'btcp-browser-agent/extension';

const client = createClient();

// Navigation
await client.navigate('https://example.com');
await client.back();
await client.forward();
await client.reload();

// DOM operations
const { tree } = await client.snapshot();
await client.click('@ref:5');
await client.fill('@ref:3', 'hello@example.com');
await client.type('@ref:3', 'typing slowly', { delay: 50 });
const text = await client.getText('@ref:5');
const visible = await client.isVisible('@ref:5');

// Tab management
const tabs = await client.tabList();
const newTab = await client.tabNew({ url: 'https://github.com' });
await client.tabSwitch(newTab.tabId);
await client.tabClose(newTab.tabId);

// Screenshot
const base64 = await client.screenshot();
```

## Command Reference

### Browser Operations (BackgroundAgent)

| Method | Description |
|--------|-------------|
| `navigate(url)` | Navigate to URL |
| `back()` / `forward()` | History navigation |
| `reload()` | Reload page |
| `screenshot()` | Capture visible tab |
| `tabNew()` / `tabClose()` | Tab management |
| `tabSwitch()` / `tabList()` | Tab switching |
| `getUrl()` / `getTitle()` | Get page info |

### DOM Operations (ContentAgent)

| Method | Description |
|--------|-------------|
| `snapshot()` | Get accessibility tree with refs |
| `click(selector)` | Click element |
| `fill(selector, value)` | Set input value |
| `type(selector, text)` | Type text with events |
| `getText(selector)` | Get element text |
| `isVisible(selector)` | Check visibility |

## Selectors

```typescript
// Ref from snapshot (recommended)
await client.click('@ref:5');

// CSS selectors
await client.click('#submit');
await client.click('.btn-primary');
await client.click('[data-testid="login"]');
```

## License

Apache-2.0
