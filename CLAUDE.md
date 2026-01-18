# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BTCP Browser Agent is a browser-native implementation for AI agents to interact with web pages. It provides a clean separation between browser-level operations (tabs, navigation, screenshots) and DOM-level operations (clicking, typing, reading elements).

## Build Commands

```bash
# Build all packages
npm run build

# Build individual packages (in order)
npm run build:packages

# Build Chrome extension example
cd examples/chrome-extension && npm run build

# Watch mode for extension development
cd examples/chrome-extension && npm run watch

# Clean build artifacts
npm run clean
```

## Testing

```bash
# Run all tests
npm test

# Watch mode for test development
npm run test:watch

# Type checking only
npm run typecheck
```

## Architecture

### Three-Layer Command Flow

Commands flow through three distinct layers:

1. **Client Layer** (`packages/extension/src/index.ts`)
   - `createClient()` provides high-level API methods
   - Sends commands via `chrome.runtime.sendMessage`
   - Used in popups, external scripts

2. **Background Layer** (`packages/extension/src/background.ts`)
   - `BackgroundAgent` handles browser-level operations (tabs, navigation, screenshots)
   - Routes DOM commands to ContentAgent via `chrome.tabs.sendMessage`
   - `SessionManager` maintains tab group state across extension lifecycle

3. **Content Layer** (`packages/core/src/actions.ts`)
   - `DOMActions` executes all DOM operations
   - `createSnapshot()` generates accessibility tree with element refs
   - Runs in content script context (one per tab)

### Command Type System

Commands are strongly typed with a discriminated union:

- **CoreAction** (46 actions in `packages/core/src/types.ts`): DOM operations like `click`, `type`, `snapshot`, `highlight`
- **ExtensionAction** (11 actions in `packages/extension/src/types.ts`): Browser operations like `navigate`, `screenshot`, `tabNew`
- All commands extend `BaseCommand` with `id` and `action` fields

### Element References and Snapshot API

The snapshot system creates stable element references:

```typescript
// Snapshot returns a string (accessibility tree with embedded @ref:N markers)
const tree = await client.snapshot();
// Example output: "- BUTTON \"Submit\" [@ref:1]"

// Use refs in commands: { action: 'click', selector: '@ref:5' }
```

**Important**: The snapshot API returns a `string` directly (the accessibility tree). Element refs are embedded as `@ref:N` markers in the tree and stored internally in a `RefMap` (WeakRef-based for memory management). Refs persist across commands within the same content script session and are used internally for the `highlight` feature.

## Package Structure

```
btcp-browser-agent/           # Monorepo root
├── packages/
│   ├── core/                 # @btcp/core - DOM operations (ContentAgent)
│   │   ├── src/actions.ts    # DOMActions class - all DOM command handlers
│   │   ├── src/snapshot.ts   # Accessibility tree generation
│   │   ├── src/types.ts      # CoreAction types (46 actions)
│   │   └── src/ref-map.ts    # Element reference management
│   │
│   ├── extension/            # @btcp/extension - Browser operations
│   │   ├── src/background.ts        # BackgroundAgent (service worker)
│   │   ├── src/session-manager.ts   # Tab group persistence
│   │   ├── src/content.ts           # Content script setup
│   │   └── src/index.ts             # Client API + types
│   │
│   └── cli/                  # @btcp/cli - Command-line interface
│       ├── src/commands/     # 28 CLI command implementations
│       ├── src/parser.ts     # Natural language command parser
│       └── src/executor.ts   # Command execution + suggestions
│
└── examples/
    ├── chrome-extension/     # Full extension demo (popup + background + content)
    └── snapshots/           # Snapshot generation utilities
```

## Key Concepts

### Highlight vs CLI Commands

The core `DOMActions` class supports `highlight` and `clearHighlight` actions, but these are NOT registered as CLI commands. To use them:

- In popup: Use `client.execute({ id: '...', action: 'highlight' })`
- NOT: `cli.execute('highlight')` (will fail with "Unknown command")

The CLI package (`packages/cli/src/commands/index.ts`) has 28 registered commands. If a core action is missing from the CLI registry, use the raw `client.execute()` method.

### Session Management

The extension uses Chrome Tab Groups for session isolation:

- `SessionManager` persists active session to `chrome.storage.session`
- On extension reload, reconnects to stored group if it still exists
- All extension operations are scoped to the active session's tabs
- Create session: `client.groupCreate()` → returns `{ group: GroupInfo }`

### Multi-Tab Operations

Background agent supports two patterns for multi-tab work:

```typescript
// Pattern 1: tab() handle - interact without switching active tab
const tab = agent.tab(tabId);
await tab.snapshot();
await tab.click('@ref:5');

// Pattern 2: Pass tabId in execute options
await agent.execute(command, { tabId });
```

Both avoid unnecessary tab switching for better performance.

### Snapshot Formats

Snapshots support two output formats:

- `format: 'tree'` (default): Flat accessibility tree with refs
- `format: 'html'`: HTML structure with semantic xpaths

The tree format is optimized for AI consumption and includes role-based element descriptions.

## Development Workflow

### Working on Core Package

```bash
# 1. Make changes in packages/core/src/
# 2. Build core package
npm run build:packages

# 3. Run tests
npm test -- packages/core

# 4. If working on extension example, rebuild it
cd examples/chrome-extension && npm run build
```

### Working on Extension Example

```bash
cd examples/chrome-extension

# Watch mode - auto-rebuilds on changes
npm run watch

# Load unpacked extension in Chrome:
# 1. Open chrome://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select examples/chrome-extension/dist/
```

### Adding New Core Actions

1. Add action type to `CoreAction` in `packages/core/src/types.ts`
2. Create command interface extending `BaseCommand`
3. Add case to `DOMActions.dispatch()` in `packages/core/src/actions.ts`
4. Implement handler method in `DOMActions` class
5. Optionally create CLI command wrapper in `packages/cli/src/commands/`

### Adding New CLI Commands

1. Create command file in `packages/cli/src/commands/[name].ts`
2. Export `CommandHandler` with `name`, `description`, `execute()`, `examples`
3. Register in `packages/cli/src/commands/index.ts`
4. Add suggestions mapping in `packages/cli/src/suggestions.ts` if needed

## Common Pitfalls

1. **CLI vs Client API**: CLI commands are a subset of core actions. Use `client.execute()` for actions not in CLI registry.

2. **Ref Lifecycle**: Element refs are cleared on navigation and only valid within the content script that created them.

3. **Cross-Origin**: ContentAgent only works same-origin when used standalone. Extension context bypasses this via content scripts.

4. **Build Order**: Always build packages before examples (`npm run build:packages` then `cd examples/chrome-extension && npm run build`).

5. **Session Persistence**: Session state survives extension reload via `chrome.storage.session`, but actual tab groups can be deleted by the user.

## Import Paths

The package exports multiple entry points:

```typescript
// Main re-exports (convenience)
import { createContentAgent } from 'btcp-browser-agent';

// Direct package imports (preferred for clarity)
import { createContentAgent } from 'btcp-browser-agent/core';
import { BackgroundAgent, createClient } from 'btcp-browser-agent/extension';
import { createCLI } from 'btcp-browser-agent/cli';

// Extension-specific entry points
import 'btcp-browser-agent/extension/content';    // Content script setup
import 'btcp-browser-agent/extension/background'; // Background script setup
```
