/**
 * Terminal UI Component
 *
 * An in-browser terminal interface for the CLI.
 */

import type { HistoryEntry, TerminalConfig, CommandResult } from '../types.js';
import { formatResult } from '../formatter.js';

/**
 * Terminal options
 */
export interface TerminalOptions {
  /** Execute a command and return the result */
  onExecute: (input: string) => Promise<CommandResult>;
  /** Optional configuration */
  config?: Partial<TerminalConfig>;
}

/**
 * Default terminal configuration
 */
const defaultConfig: TerminalConfig = {
  theme: 'dark',
  fontSize: 14,
  historySize: 1000,
  prompt: '$ ',
};

/**
 * Terminal state
 */
interface TerminalState {
  history: HistoryEntry[];
  commandHistory: string[];
  historyIndex: number;
  inputBuffer: string;
  isExecuting: boolean;
}

/**
 * Terminal UI class
 */
export class Terminal {
  private container: HTMLElement;
  private config: TerminalConfig;
  private state: TerminalState;
  private onExecute: (input: string) => Promise<CommandResult>;

  // DOM elements
  private outputEl!: HTMLElement;
  private inputLineEl!: HTMLElement;
  private promptEl!: HTMLElement;
  private inputEl!: HTMLInputElement;

  constructor(container: HTMLElement, options: TerminalOptions) {
    this.container = container;
    this.config = { ...defaultConfig, ...options.config };
    this.onExecute = options.onExecute;

    this.state = {
      history: [],
      commandHistory: [],
      historyIndex: -1,
      inputBuffer: '',
      isExecuting: false,
    };

    this.render();
    this.bindEvents();
    this.focus();
  }

  /**
   * Render the terminal UI
   */
  private render(): void {
    const isDark = this.config.theme === 'dark';

    this.container.innerHTML = `
      <div class="btcp-terminal" style="
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
        font-size: ${this.config.fontSize}px;
        line-height: 1.4;
        background: ${isDark ? '#1e1e1e' : '#ffffff'};
        color: ${isDark ? '#d4d4d4' : '#1e1e1e'};
        padding: 12px;
        height: 100%;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
      ">
        <div class="btcp-terminal-output" style="
          flex: 1;
          overflow-y: auto;
          white-space: pre-wrap;
          word-wrap: break-word;
        "></div>
        <div class="btcp-terminal-input-line" style="
          display: flex;
          align-items: center;
          margin-top: 8px;
          flex-shrink: 0;
        ">
          <span class="btcp-terminal-prompt" style="
            color: ${isDark ? '#6a9955' : '#008000'};
            margin-right: 8px;
            user-select: none;
          ">${this.config.prompt}</span>
          <input class="btcp-terminal-input" type="text" style="
            flex: 1;
            background: transparent;
            border: none;
            outline: none;
            font-family: inherit;
            font-size: inherit;
            color: inherit;
            padding: 0;
            margin: 0;
          " autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
        </div>
      </div>
    `;

    this.outputEl = this.container.querySelector('.btcp-terminal-output')!;
    this.inputLineEl = this.container.querySelector('.btcp-terminal-input-line')!;
    this.promptEl = this.container.querySelector('.btcp-terminal-prompt')!;
    this.inputEl = this.container.querySelector('.btcp-terminal-input')!;
  }

  /**
   * Bind event listeners
   */
  private bindEvents(): void {
    // Handle input
    this.inputEl.addEventListener('keydown', (e) => this.handleKeyDown(e));

    // Click to focus
    this.container.addEventListener('click', () => this.focus());
  }

  /**
   * Handle key down events
   */
  private async handleKeyDown(e: KeyboardEvent): Promise<void> {
    if (this.state.isExecuting) {
      e.preventDefault();
      return;
    }

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        await this.executeInput();
        break;

      case 'ArrowUp':
        e.preventDefault();
        this.navigateHistory(-1);
        break;

      case 'ArrowDown':
        e.preventDefault();
        this.navigateHistory(1);
        break;

      case 'c':
        if (e.ctrlKey) {
          e.preventDefault();
          this.cancel();
        }
        break;

      case 'l':
        if (e.ctrlKey) {
          e.preventDefault();
          this.clearScreen();
        }
        break;
    }
  }

  /**
   * Execute the current input
   */
  private async executeInput(): Promise<void> {
    const input = this.inputEl.value.trim();

    // Show the input in history
    this.appendOutput(`${this.config.prompt}${input}`, 'input');

    // Clear input
    this.inputEl.value = '';

    if (!input) {
      return;
    }

    // Add to command history
    this.state.commandHistory.push(input);
    this.state.historyIndex = this.state.commandHistory.length;

    // Handle built-in terminal commands
    if (input === 'clear') {
      this.clearScreen();
      return;
    }

    // Execute command
    this.state.isExecuting = true;
    this.setPrompt('...');

    try {
      const result = await this.onExecute(input);
      const formatted = formatResult(result);

      this.appendOutput(formatted.content, formatted.type === 'error' ? 'error' : 'output');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.appendOutput(`Error: ${message}`, 'error');
    } finally {
      this.state.isExecuting = false;
      this.setPrompt(this.config.prompt);
      this.focus();
    }
  }

  /**
   * Navigate command history
   */
  private navigateHistory(direction: number): void {
    const newIndex = this.state.historyIndex + direction;

    if (newIndex < 0) {
      return;
    }

    if (newIndex >= this.state.commandHistory.length) {
      this.state.historyIndex = this.state.commandHistory.length;
      this.inputEl.value = this.state.inputBuffer;
      return;
    }

    // Save current input if navigating from end
    if (this.state.historyIndex === this.state.commandHistory.length) {
      this.state.inputBuffer = this.inputEl.value;
    }

    this.state.historyIndex = newIndex;
    this.inputEl.value = this.state.commandHistory[newIndex];

    // Move cursor to end
    this.inputEl.setSelectionRange(this.inputEl.value.length, this.inputEl.value.length);
  }

  /**
   * Append output to the terminal
   */
  private appendOutput(content: string, type: 'input' | 'output' | 'error' | 'info'): void {
    const isDark = this.config.theme === 'dark';

    let color = isDark ? '#d4d4d4' : '#1e1e1e';
    if (type === 'error') {
      color = isDark ? '#f14c4c' : '#cd3131';
    } else if (type === 'info') {
      color = isDark ? '#3794ff' : '#0066bf';
    } else if (type === 'input') {
      color = isDark ? '#9cdcfe' : '#0066bf';
    }

    const entry: HistoryEntry = {
      type,
      content,
      timestamp: Date.now(),
    };

    this.state.history.push(entry);

    // Trim history if needed
    while (this.state.history.length > this.config.historySize) {
      this.state.history.shift();
    }

    // Append to DOM
    const line = document.createElement('div');
    line.style.color = color;
    line.style.marginBottom = '2px';
    line.textContent = content;
    this.outputEl.appendChild(line);

    // Scroll to bottom
    this.outputEl.scrollTop = this.outputEl.scrollHeight;
  }

  /**
   * Set the prompt text
   */
  private setPrompt(prompt: string): void {
    this.promptEl.textContent = prompt;
  }

  /**
   * Cancel current operation
   */
  private cancel(): void {
    if (this.state.isExecuting) {
      this.appendOutput('^C', 'info');
    } else {
      this.inputEl.value = '';
    }
  }

  /**
   * Clear the screen
   */
  public clearScreen(): void {
    this.outputEl.innerHTML = '';
    this.state.history = [];
  }

  /**
   * Focus the input
   */
  public focus(): void {
    this.inputEl.focus();
  }

  /**
   * Write output programmatically
   */
  public write(content: string, type: 'output' | 'error' | 'info' = 'output'): void {
    this.appendOutput(content, type);
  }

  /**
   * Execute a command programmatically
   */
  public async run(command: string): Promise<CommandResult> {
    this.inputEl.value = command;
    await this.executeInput();
    return { success: true };
  }

  /**
   * Get the history
   */
  public getHistory(): HistoryEntry[] {
    return [...this.state.history];
  }

  /**
   * Get command history
   */
  public getCommandHistory(): string[] {
    return [...this.state.commandHistory];
  }

  /**
   * Destroy the terminal
   */
  public destroy(): void {
    this.container.innerHTML = '';
  }
}
