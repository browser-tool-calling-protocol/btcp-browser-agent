# AI Browser Agent - Chrome Extension Example

This example shows how to build a Chrome extension that enables AI to control browser tabs using the BTCP Browser Agent.

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│   Popup     │────▶│  Background     │────▶│  Content    │
│   (UI)      │     │  Service Worker │     │  Script     │
└─────────────┘     └─────────────────┘     └─────────────┘
      │                    │                       │
  User input         chrome.tabs.*           BrowserAgent
  Display results    chrome.scripting        DOM access
                     Screenshots             Element refs
```

## Files

- `manifest.json` - Extension manifest (Manifest V3)
- `background.js` - Service worker handling chrome.* APIs
- `content.js` - Content script running BrowserAgent in page context
- `popup.html/js` - Extension popup UI

## Installation

### Development Mode

1. **Build the agent library** (from project root):
   ```bash
   npm run build
   ```

2. **Copy the built library**:
   ```bash
   cp dist/index.js examples/chrome-extension/btcp-browser-agent.js
   ```

3. **Load in Chrome**:
   - Open `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select this directory (`examples/chrome-extension`)

### Production Build

For production, bundle everything with a tool like esbuild or webpack:

```bash
# Install esbuild
npm install -D esbuild

# Bundle content script with agent
npx esbuild content.js --bundle --outfile=dist/content.js --format=iife

# Bundle background script
npx esbuild background.js --bundle --outfile=dist/background.js --format=esm
```

## Usage

### From Popup UI

1. Click the extension icon to open the popup
2. Check that status shows "Ready"
3. Use quick actions:
   - **Snapshot** - Get accessibility tree with element refs
   - **Screenshot** - Capture visible tab
   - **Click** - Click element by ref (@e1) or CSS selector
   - **Fill** - Fill input field

### From AI Backend

The extension can be controlled programmatically. Example integration:

```javascript
// In your AI backend or orchestration layer
async function aiControlBrowser(tabId, action) {
  // Send command to extension via native messaging or WebSocket
  const command = {
    id: generateId(),
    action: 'snapshot',
    interactive: true,
  };

  // Extension executes and returns result
  const result = await sendToExtension(tabId, command);

  // AI analyzes snapshot and decides next action
  const nextAction = await askAI(result.data.snapshot);

  // Execute AI's decision
  return sendToExtension(tabId, nextAction);
}
```

### Programmatic API

From the background script:

```javascript
// Get snapshot of active tab
const snapshot = await processAICommand({
  id: '1',
  action: 'snapshot',
  interactive: true,
});

// Click element using ref from snapshot
await processAICommand({
  id: '2',
  action: 'click',
  selector: '@e1',
});

// Fill form field
await processAICommand({
  id: '3',
  action: 'fill',
  selector: '@e2',
  value: 'user@example.com',
});

// Take screenshot
const screenshot = await chrome.runtime.sendMessage({ type: 'screenshot' });
```

## AI Integration Examples

### With Claude API

```javascript
// background.js - Add AI integration
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

async function runAIAgent(task) {
  // Get initial snapshot
  const snapshot = await processAICommand({
    id: '1',
    action: 'snapshot',
    interactive: true,
  });

  // Ask Claude what to do
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: `You are a browser automation agent. You can control the browser using these commands:
- snapshot: Get page structure with element refs
- click: Click element (selector: @e1 or CSS)
- fill: Fill input (selector + value)
- type: Type text keystroke by keystroke
- scroll: Scroll page or element
- wait: Wait for element

Current page snapshot:
${snapshot.data.snapshot}

Respond with a JSON command to execute.`,
    messages: [{ role: 'user', content: task }],
  });

  // Parse and execute Claude's command
  const command = JSON.parse(response.content[0].text);
  return processAICommand(command);
}
```

### With OpenAI API

```javascript
import OpenAI from 'openai';

const openai = new OpenAI();

async function runOpenAIAgent(task) {
  const snapshot = await processAICommand({ id: '1', action: 'snapshot', interactive: true });

  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: `Browser automation agent. Page snapshot:\n${snapshot.data.snapshot}`,
      },
      { role: 'user', content: task },
    ],
    functions: [
      {
        name: 'browser_action',
        parameters: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['click', 'fill', 'type', 'scroll'] },
            selector: { type: 'string' },
            value: { type: 'string' },
          },
          required: ['action', 'selector'],
        },
      },
    ],
  });

  const call = completion.choices[0].message.function_call;
  return processAICommand(JSON.parse(call.arguments));
}
```

## Available Commands

| Command | Parameters | Description |
|---------|------------|-------------|
| `snapshot` | `interactive?: boolean` | Get accessibility tree |
| `click` | `selector: string` | Click element |
| `fill` | `selector, value` | Set input value |
| `type` | `selector, text` | Type keystroke by keystroke |
| `scroll` | `selector?, direction?, amount?` | Scroll |
| `hover` | `selector` | Hover over element |
| `wait` | `selector, timeout?` | Wait for element |
| `evaluate` | `script` | Execute JavaScript |
| `getText` | `selector` | Get element text |
| `isVisible` | `selector` | Check visibility |

## Selector Formats

- `@e1` - Element ref from snapshot (recommended)
- `ref=e1` - Alternative ref format
- `#id` - CSS ID selector
- `.class` - CSS class selector
- `[data-testid="x"]` - Attribute selector

## Permissions

The extension requests these permissions:

- `activeTab` - Access current tab
- `tabs` - Tab management
- `scripting` - Inject content scripts
- `<all_urls>` - Access all URLs (for content script)

## Security Notes

1. The extension has broad permissions - review before installing
2. Commands are executed in page context with full DOM access
3. For production, add input validation and sandboxing
4. Consider using isolated worlds for content scripts

## Troubleshooting

**"Content script not loaded"**
- Refresh the page after installing the extension
- Check that the URL isn't restricted (chrome://, etc.)

**"Agent not ready"**
- The content script may have failed to load
- Check the console for errors (right-click popup → Inspect)

**Commands not executing**
- Ensure the element exists (get snapshot first)
- Check selector format (@e1 vs CSS)
- Some pages may block injected scripts
