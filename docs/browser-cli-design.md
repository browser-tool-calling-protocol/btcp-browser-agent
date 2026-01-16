# Browser-Based CLI Design Document

## Overview

This document proposes an approach to implement a browser-based CLI for btcp-browser-agent, inspired by [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser).

## Goals

1. Provide a command-line interface for browser automation within the browser context
2. Enable AI agents to control browsers using simple text commands
3. Maintain compatibility with existing @btcp/core and @btcp/extension packages
4. Support both interactive and programmatic usage

## Reference: agent-browser CLI

The agent-browser project provides these command patterns:

```bash
agent-browser open example.com       # Navigate to URL
agent-browser click @e2              # Click element by ref
agent-browser type @e3 "hello"       # Type into element
agent-browser snapshot               # Get accessibility tree
agent-browser screenshot page.png    # Capture screenshot
agent-browser fill @e5 "value"       # Fill form field
agent-browser scroll down 200        # Scroll page
agent-browser press Enter            # Press key
```

## Architecture

### In-Browser CLI (Chrome Extension Only)

Commands are sent directly from the Chrome extension - no external processes or WebSocket bridges needed.

```
┌─────────────────────────────────────────────────────────────┐
│ Chrome Extension                                             │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Terminal UI (Popup/Panel)                               ││
│  │ $ snapshot                                              ││
│  │ - button 'Submit' [@ref:1]                              ││
│  │ - textbox 'Email' [@ref:2]                              ││
│  │                                                          ││
│  │ $ click @ref:1                                          ││
│  │ ✓ Clicked element: button 'Submit'                      ││
│  └─────────────────────────────────────────────────────────┘│
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ CLI Parser & Executor (@btcp/cli)                       ││
│  │ parseCommand() → executeCommand()                       ││
│  └─────────────────────────────────────────────────────────┘│
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ BackgroundAgent (@btcp/extension)                       ││
│  │ Tab management, navigation, routing                     ││
│  └─────────────────────────────────────────────────────────┘│
│                          │                                   │
│           chrome.tabs.sendMessage()                          │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ContentAgent (@btcp/core)                               ││
│  │ DOM operations, snapshots, interactions                 ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Benefits:**
- Pure browser-native approach
- No external dependencies
- Direct integration with existing @btcp packages
- Real-time command execution
- Works entirely within extension context

## Implementation Plan

### Phase 1: Command Parser & Executor

Create a new package `@btcp/cli` that provides command parsing and execution.

```
packages/
  cli/
    src/
      index.ts          # Main exports
      parser.ts         # Command line parser
      executor.ts       # Command executor
      commands/         # Individual command implementations
        goto.ts
        click.ts
        type.ts
        snapshot.ts
        screenshot.ts
        ...
      formatter.ts      # Output formatting
      types.ts          # TypeScript types
```

#### Command Syntax

```typescript
// Command structure
interface CLICommand {
  name: string;
  args: string[];
  flags: Record<string, string | boolean>;
}

// Examples:
// "goto https://example.com" → { name: 'goto', args: ['https://example.com'], flags: {} }
// "click @ref:5 --wait 1000" → { name: 'click', args: ['@ref:5'], flags: { wait: '1000' } }
// "screenshot --full" → { name: 'screenshot', args: [], flags: { full: true } }
```

#### Supported Commands

| Command | Syntax | Description |
|---------|--------|-------------|
| `goto` | `goto <url>` | Navigate to URL |
| `back` | `back` | Go back in history |
| `forward` | `forward` | Go forward in history |
| `reload` | `reload` | Reload current page |
| `snapshot` | `snapshot` | Get accessibility tree |
| `screenshot` | `screenshot [filename]` | Capture screenshot |
| `click` | `click <selector>` | Click element |
| `dblclick` | `dblclick <selector>` | Double-click element |
| `type` | `type <selector> <text>` | Type text into element |
| `fill` | `fill <selector> <value>` | Fill input field |
| `clear` | `clear <selector>` | Clear input field |
| `check` | `check <selector>` | Check checkbox |
| `uncheck` | `uncheck <selector>` | Uncheck checkbox |
| `select` | `select <selector> <value>` | Select dropdown option |
| `hover` | `hover <selector>` | Hover over element |
| `scroll` | `scroll <direction> [amount]` | Scroll page |
| `press` | `press <key>` | Press keyboard key |
| `wait` | `wait <ms>` | Wait for duration |
| `eval` | `eval <code>` | Execute JavaScript |
| `tabs` | `tabs` | List all tabs |
| `tab` | `tab <id>` | Switch to tab |
| `newtab` | `newtab [url]` | Open new tab |
| `closetab` | `closetab [id]` | Close tab |
| `help` | `help [command]` | Show help |

### Phase 2: In-Browser Terminal UI

Create a terminal component for the extension popup or a dedicated panel.

#### Terminal Component

```typescript
// packages/cli/src/terminal/
interface TerminalConfig {
  theme: 'dark' | 'light';
  fontSize: number;
  historySize: number;
  prompt: string;
}

interface TerminalState {
  history: HistoryEntry[];
  inputBuffer: string;
  cursorPosition: number;
  commandHistory: string[];
  historyIndex: number;
}

interface HistoryEntry {
  type: 'input' | 'output' | 'error';
  content: string;
  timestamp: number;
}
```

#### UI Features

1. **Command input** with cursor and editing
2. **Command history** (up/down arrows)
3. **Tab completion** for commands and refs
4. **Syntax highlighting** for commands
5. **Output formatting** (success/error/info)
6. **Scrollable history**
7. **Copy/paste support**

### Phase 3: Integration with BackgroundAgent

Connect the CLI to the existing BackgroundAgent for execution.

```typescript
// Example integration
import { BackgroundAgent } from '@btcp/extension';
import { parseCommand, executeCommand } from '@btcp/cli';

const agent = new BackgroundAgent();

async function handleCommand(input: string): Promise<string> {
  const command = parseCommand(input);
  const result = await executeCommand(agent, command);
  return formatResult(result);
}
```

## Detailed Component Design

### 1. Command Parser (`parser.ts`)

```typescript
export function parseCommand(input: string): CLICommand {
  const tokens = tokenize(input);
  const name = tokens[0];
  const { args, flags } = parseArgs(tokens.slice(1));
  return { name, args, flags };
}

function tokenize(input: string): string[] {
  // Handle quoted strings, escape characters
  // "type @ref:1 \"hello world\"" → ['type', '@ref:1', 'hello world']
}

function parseArgs(tokens: string[]): { args: string[], flags: Record<string, string | boolean> } {
  // Parse --flag and --flag=value patterns
}
```

### 2. Command Executor (`executor.ts`)

```typescript
export async function executeCommand(
  agent: BackgroundAgent,
  command: CLICommand
): Promise<CommandResult> {
  const handler = commands[command.name];
  if (!handler) {
    throw new CLIError(`Unknown command: ${command.name}`);
  }
  return handler.execute(agent, command.args, command.flags);
}
```

### 3. Individual Commands (`commands/*.ts`)

```typescript
// commands/goto.ts
export const gotoCommand: CommandHandler = {
  name: 'goto',
  description: 'Navigate to a URL',
  usage: 'goto <url>',
  examples: [
    'goto https://example.com',
    'goto github.com',
  ],
  async execute(agent, args, flags) {
    const url = args[0];
    if (!url) {
      throw new CLIError('URL required');
    }
    await agent.navigate(url);
    return { success: true, message: `Navigated to ${url}` };
  }
};

// commands/snapshot.ts
export const snapshotCommand: CommandHandler = {
  name: 'snapshot',
  description: 'Get page accessibility tree',
  usage: 'snapshot [--refs-only]',
  async execute(agent, args, flags) {
    const result = await agent.execute({
      id: generateId(),
      action: 'snapshot'
    });
    return {
      success: true,
      data: result.data.tree
    };
  }
};
```

### 4. Output Formatter (`formatter.ts`)

```typescript
export function formatResult(result: CommandResult): FormattedOutput {
  if (result.success) {
    return {
      type: 'success',
      content: result.message || formatData(result.data)
    };
  }
  return {
    type: 'error',
    content: `Error: ${result.error}`
  };
}

function formatData(data: unknown): string {
  // Format snapshots, screenshots, etc.
  if (typeof data === 'string') return data;
  return JSON.stringify(data, null, 2);
}
```

### 5. Terminal UI (`terminal/Terminal.ts`)

```typescript
export class Terminal {
  private state: TerminalState;
  private config: TerminalConfig;
  private onExecute: (command: string) => Promise<string>;

  constructor(container: HTMLElement, config: Partial<TerminalConfig>) {
    this.config = { ...defaultConfig, ...config };
    this.state = initialState();
    this.render(container);
    this.bindEvents();
  }

  async handleInput(input: string): Promise<void> {
    this.appendHistory({ type: 'input', content: `$ ${input}` });
    try {
      const output = await this.onExecute(input);
      this.appendHistory({ type: 'output', content: output });
    } catch (error) {
      this.appendHistory({ type: 'error', content: error.message });
    }
  }

  private bindEvents(): void {
    // Keyboard handling: Enter, Up, Down, Tab, etc.
  }

  private render(container: HTMLElement): void {
    // Create terminal UI elements
  }
}
```

## File Structure

```
packages/
  cli/
    package.json
    tsconfig.json
    src/
      index.ts                 # Main exports
      types.ts                 # TypeScript types
      parser.ts                # Command parser
      executor.ts              # Command executor
      formatter.ts             # Output formatting
      errors.ts                # CLI errors
      commands/
        index.ts               # Command registry
        goto.ts
        back.ts
        forward.ts
        reload.ts
        snapshot.ts
        screenshot.ts
        click.ts
        dblclick.ts
        type.ts
        fill.ts
        clear.ts
        check.ts
        uncheck.ts
        select.ts
        hover.ts
        scroll.ts
        press.ts
        wait.ts
        eval.ts
        tabs.ts
        tab.ts
        newtab.ts
        closetab.ts
        help.ts
      terminal/
        index.ts               # Terminal exports
        Terminal.ts            # Terminal class
        renderer.ts            # DOM rendering
        history.ts             # Command history
        completion.ts          # Tab completion
        styles.css             # Terminal styles
```

## Example Usage

### Interactive Session

```
$ goto https://github.com
✓ Navigated to https://github.com

$ snapshot
- banner
  - link 'Homepage' [@ref:1]
  - navigation
    - link 'Product' [@ref:2]
    - link 'Solutions' [@ref:3]
    - link 'Resources' [@ref:4]
  - textbox 'Search or jump to...' [@ref:5]
  - link 'Sign in' [@ref:6]
  - link 'Sign up' [@ref:7]
- main
  - heading 'Let's build from here' level=1
  - textbox 'Search code...' [@ref:8]

$ click @ref:6
✓ Clicked: link 'Sign in'

$ snapshot
- main
  - heading 'Sign in to GitHub' level=1
  - textbox 'Username or email' [@ref:1]
  - textbox 'Password' [@ref:2]
  - button 'Sign in' [@ref:3]
  - link 'Forgot password?' [@ref:4]

$ type @ref:1 myusername
✓ Typed "myusername" into: textbox 'Username or email'

$ fill @ref:2 mypassword
✓ Filled: textbox 'Password'

$ click @ref:3
✓ Clicked: button 'Sign in'
```

### Programmatic API (within extension)

```typescript
// In popup.ts or background.ts
import { createCLI } from '@btcp/cli';
import { BackgroundAgent } from '@btcp/extension';

const agent = new BackgroundAgent();
const cli = createCLI(agent);

// Execute commands programmatically from extension code
await cli.execute('goto https://example.com');
const snapshot = await cli.execute('snapshot');
await cli.execute('click @ref:1');

// Or use the Client API for structured access
import { createClient } from '@btcp/extension';
const client = createClient();
await client.navigate('https://example.com');
const result = await client.snapshot();
await client.click('@ref:1');
```

## Implementation Timeline

### Milestone 1: Core CLI Package
- [ ] Set up @btcp/cli package structure
- [ ] Implement command parser
- [ ] Implement command executor
- [ ] Implement core navigation commands (goto, back, forward, reload)
- [ ] Implement snapshot command
- [ ] Add basic output formatting

### Milestone 2: DOM Commands
- [ ] Implement click, dblclick
- [ ] Implement type, fill, clear
- [ ] Implement check, uncheck, select
- [ ] Implement hover, scroll
- [ ] Implement press (keyboard)
- [ ] Implement wait, eval

### Milestone 3: Tab Management
- [ ] Implement tabs, tab, newtab, closetab
- [ ] Add multi-tab command support

### Milestone 4: Terminal UI
- [ ] Create terminal component
- [ ] Implement command input handling
- [ ] Add command history (up/down)
- [ ] Add tab completion
- [ ] Style terminal UI
- [ ] Integrate with extension popup

### Milestone 5: Polish & Documentation
- [ ] Add help command with usage info
- [ ] Add command validation and helpful errors
- [ ] Write documentation
- [ ] Add tests

## Conclusion

This design provides a pure in-browser CLI implementation that:

1. **Mimics agent-browser** with similar command syntax
2. **Runs entirely within Chrome extension** - no external processes
3. **Integrates seamlessly** with existing @btcp/core and @btcp/extension packages
4. **Provides terminal UI** in extension popup/panel for interactive use
5. **Supports programmatic API** for AI agents within the browser

The implementation starts with the core CLI package (parser, executor, commands), then adds the terminal UI component for the extension.
