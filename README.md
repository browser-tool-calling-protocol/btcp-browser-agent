# btcp-browser-agent

Give AI agents the power to see and control any browser.

A lightweight foundation for building AI systems that need browser access — automation, testing, web agents, or any browser-based workflow.

## Why This Package?

AI agents struggle with browsers because:
- **Raw HTML is too noisy** — thousands of nodes, most irrelevant
- **CSS selectors break** — layouts change, classes get renamed
- **No stable way to reference elements** — across conversation turns

**Browser Agent solves this with smart snapshots:**

```
PAGE: https://github.com/login | Sign in to GitHub | viewport=1920x1080
SNAPSHOT: elements=847 refs=12

TEXTBOX "Username or email address" @ref:0 [required] /main/form/input#login_field
TEXTBOX "Password" @ref:1 [type=password required] /main/form/input#password
LINK "Forgot password?" @ref:2 /main/form/a.forgot-password
BUTTON "Sign in" @ref:3 /main/form/button[type=submit]
LINK "Create an account" @ref:4 /main/div.signup-prompt/a
```

One command gives your agent a clean, semantic view of any page. Stable `@ref` markers let it interact without fragile selectors.

## The Snapshot Advantage

### What Makes It AI-Friendly

| Raw HTML | Browser Agent Snapshot |
|----------|----------------------|
| 50KB of nested `<div>`s | 12 actionable elements |
| `class="btn-primary-lg-v2"` | `BUTTON "Sign in" @ref:3` |
| No context about element purpose | Role + label + semantic xpath |
| Breaks when CSS changes | Refs survive DOM mutations |

### Three Snapshot Modes

```typescript
// Interactive mode (default): Find clickable elements
const snapshot = await client.snapshot();
// Returns: BUTTON "Submit" @ref:0, TEXTBOX "Email" @ref:1, ...

// Outline mode: Understand page structure
const outline = await client.snapshot({ mode: 'outline' });
// Returns: MAIN @ref:0 [342 words] /body/main, NAVIGATION @ref:1 /body/nav, ...

// Content mode: Extract readable text
const content = await client.snapshot({ mode: 'content' });
// Returns: HEADING level=1 "Welcome", TEXT "Sign in to continue...", ...
```

### Grep Filtering

Filter snapshots to focus on specific elements:

```typescript
// Find all buttons
await client.snapshot({ grep: 'BUTTON' });

// Case-insensitive search
await client.snapshot({ grep: { pattern: 'submit', ignoreCase: true } });

// Exclude navigation elements
await client.snapshot({ grep: { pattern: 'nav', invert: true } });
```

## Sample AI Reasoning Process

Here's how an AI agent thinks through a login task using Browser Agent — demonstrating why semantic snapshots outperform raw HTML:

---

**User Request:** "Log into my GitHub account"

**Step 1: Understand the Page**
```typescript
const snapshot = await client.snapshot();
```
```
PAGE: https://github.com/login | Sign in to GitHub | viewport=1920x1080
SNAPSHOT: elements=847 refs=12

TEXTBOX "Username or email address" @ref:0 [required] /main/form/input#login_field
TEXTBOX "Password" @ref:1 [type=password required] /main/form/input#password
LINK "Forgot password?" @ref:2 /main/form/a.forgot-password
BUTTON "Sign in" @ref:3 /main/form/button[type=submit]
LINK "Create an account" @ref:4 /main/div.signup-prompt/a
```

**AI Reasoning:**
> I can see this is GitHub's login page. The snapshot shows 5 relevant interactive elements out of 847 total DOM elements — the noise has been filtered out.
>
> I need to:
> 1. Fill the username field (@ref:0) — labeled "Username or email address", marked required
> 2. Fill the password field (@ref:1) — labeled "Password", type=password, marked required
> 3. Click the sign in button (@ref:3) — labeled "Sign in"
>
> The semantic xpaths confirm these are in the main form. I don't need to parse HTML or guess at selectors.

**Step 2: Fill Credentials**
```typescript
await client.fill('@ref:0', 'user@example.com');
await client.fill('@ref:1', 'secretpassword');
```

**Step 3: Submit**
```typescript
await client.click('@ref:3');
```

**Step 4: Verify Success**
```typescript
const result = await client.snapshot({ grep: 'error|invalid', ignoreCase: true });
```
```
PAGE: https://github.com | GitHub | viewport=1920x1080
SNAPSHOT: elements=1203 refs=0 grep=error|invalid matches=0
```

**AI Reasoning:**
> No error messages found. The page URL changed from `/login` to `/`, indicating successful authentication. Task complete.

---

### Why This Works Better Than Raw HTML

| Approach | What the AI Sees | Problems |
|----------|------------------|----------|
| **Raw HTML** | `<input class="form-control input-block js-login-field" name="login" autocomplete="username" ...>` | No clear purpose, must parse attributes, class names are meaningless |
| **Screenshot + OCR** | Pixel coordinates: (450, 320) | Breaks on different screen sizes, can't distinguish input types |
| **Browser Agent** | `TEXTBOX "Username or email address" @ref:0 [required]` | Clear purpose, stable reference, includes validation state |

The snapshot gives the AI exactly what it needs to reason about the page — nothing more, nothing less.

## Quick Example

```typescript
import { createClient } from 'btcp-browser-agent/extension';

const client = createClient();

// Navigate and understand the page
await client.navigate('https://example.com');
const snapshot = await client.snapshot();
// Returns: BUTTON "Login" @ref:0, TEXTBOX "Email" @ref:1, ...

// Interact using refs - no CSS selectors needed
await client.fill('@ref:1', 'user@example.com');
await client.click('@ref:0');
```

## Features

- **Smart Snapshots** — Accessibility tree format optimized for AI comprehension
- **Three Modes** — Interactive (actions), Outline (structure), Content (text)
- **Stable Element Refs** — `@ref:N` markers that survive DOM changes within a session
- **Grep Filtering** — Unix-style filtering to focus on specific elements
- **Semantic XPaths** — Human-readable paths like `/main/form/button` for context
- **Full Browser Control** — Navigation, tabs, screenshots, keyboard/mouse
- **46 DOM Actions** — Click, type, fill, scroll, hover, and more

## Installation

```bash
npm install btcp-browser-agent
```

## API Reference

### Snapshot API

The `snapshot()` method is the core of Browser Agent — it returns a string containing an AI-optimized view of the page.

```typescript
const snapshot = await client.snapshot(options);
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mode` | `'interactive' \| 'outline' \| 'content'` | `'interactive'` | What to capture |
| `format` | `'tree' \| 'html' \| 'markdown'` | `'tree'` | Output format |
| `grep` | `string \| GrepOptions` | — | Filter output lines |
| `selector` | `string` | — | Scope to specific element |
| `maxDepth` | `number` | `50` | Maximum DOM depth |
| `maxLength` | `number` | `2000` | Max chars per section (content mode) |
| `includeLinks` | `boolean` | `true` | Include links in markdown |
| `includeImages` | `boolean` | `false` | Include images in markdown |

#### Modes Explained

**Interactive Mode** (default)
- Returns all clickable/editable elements with `@ref:N` markers
- Best for: Form filling, clicking buttons, navigation
- Output: `BUTTON "Submit" @ref:0 /form/button`

**Outline Mode**
- Returns page structure with landmarks and sections
- Best for: Understanding page layout, finding content areas
- Output: `MAIN @ref:0 [342 words, 5 links] /body/main`

**Content Mode**
- Extracts readable text content from sections
- Best for: Reading articles, extracting information
- Output: `HEADING level=1 "Article Title"` + `TEXT "Article content..."`

#### Grep Options

```typescript
interface GrepOptions {
  pattern: string;      // Search pattern (regex by default)
  ignoreCase?: boolean; // Case-insensitive (like grep -i)
  invert?: boolean;     // Return non-matching (like grep -v)
  fixedStrings?: boolean; // Literal string match (like grep -F)
}
```

### Element Refs

Refs are stable identifiers for elements within a browser session:

```typescript
// Get a snapshot with refs
const snapshot = await client.snapshot();
// "BUTTON 'Submit' @ref:5"

// Use refs in commands
await client.click('@ref:5');
await client.fill('@ref:3', 'hello');
await client.getText('@ref:7');
```

**Ref Lifecycle:**
- Generated fresh on each `snapshot()` call
- Valid until page navigation or DOM refresh
- Use `validateRefs` to check if refs are still valid

### Navigation

```typescript
await client.navigate('https://example.com');
await client.back();
await client.forward();
await client.reload();
const url = await client.getUrl();
const title = await client.getTitle();
```

### Interaction

```typescript
await client.click('@ref:5');                    // Click element
await client.fill('@ref:3', 'text');             // Fill input (instant)
await client.type('@ref:3', 'text', { delay: 50 }); // Type with delay
await client.press('Enter');                     // Press key
await client.wait({ selector: '#loaded' });      // Wait for element
```

### Screenshots

```typescript
const base64 = await client.screenshot({ format: 'png' });
```

## Usage Modes

### Extension Mode (Full Browser Control)

For Chrome extensions with cross-origin access, tab management, and screenshots.

**Background Script:**
```typescript
import { BackgroundAgent, setupMessageListener } from 'btcp-browser-agent/extension';

// Option 1: Just set up message routing
setupMessageListener();

// Option 2: Use BackgroundAgent directly
const agent = new BackgroundAgent();
await agent.navigate('https://example.com');
```

**Content Script:**
```typescript
import { createContentAgent } from 'btcp-browser-agent';

const agent = createContentAgent();
const { data } = await agent.execute({ action: 'snapshot' });
```

**Popup:**
```typescript
import { createClient } from 'btcp-browser-agent/extension';

const client = createClient();
await client.navigate('https://example.com');
const snapshot = await client.snapshot();
```

### Standalone Mode (No Extension)

For use directly in a web page (limited to same-origin):

```typescript
import { createContentAgent } from 'btcp-browser-agent';

const agent = createContentAgent();
const { data } = await agent.execute({ action: 'snapshot' });
await agent.execute({ action: 'click', selector: '@ref:5' });
```

## Architecture

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

## Use Cases

- **AI Assistants** — Let LLMs browse the web and complete tasks for users
- **Browser Agents** — Foundation for autonomous web agents that research, navigate, and act
- **Automated Testing** — Reliable UI tests with stable element refs
- **Web Automation** — Form filling, data extraction, multi-step workflows
- **Web Scraping** — Extract structured data with semantic understanding

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
