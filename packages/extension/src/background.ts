/**
 * @btcp/extension - Background Script
 *
 * Contains BrowserAgent - the high-level orchestrator that runs in the
 * extension's background/service worker context.
 *
 * BrowserAgent manages:
 * - Tab lifecycle (create, close, switch, list)
 * - Navigation (goto, back, forward, reload)
 * - Screenshots (chrome.tabs.captureVisibleTab)
 * - Session state
 * - Routing DOM commands to ContentAgents in target tabs
 */

import type {
  Command,
  ExtensionCommand,
  ExtensionMessage,
  ExtensionResponse,
  Response,
  TabInfo,
  ChromeTab,
} from './types.js';
import { SessionManager } from './session-manager.js';

/**
 * TabHandle - Interface for interacting with a specific tab
 *
 * Returned by BackgroundAgent.tab(tabId) for tab-specific operations.
 */
export interface TabHandle {
  readonly tabId: number;
  execute(command: Command): Promise<Response>;
  snapshot(options?: { selector?: string; maxDepth?: number }): Promise<Response>;
  click(selector: string): Promise<Response>;
  fill(selector: string, value: string): Promise<Response>;
  type(selector: string, text: string, options?: { clear?: boolean }): Promise<Response>;
  getText(selector: string): Promise<Response>;
  isVisible(selector: string): Promise<Response>;
}

/**
 * BackgroundAgent - High-level browser automation orchestrator
 *
 * Runs in the extension's background script/service worker.
 * Manages browser-level operations and routes DOM commands to
 * ContentAgent instances running in content scripts.
 *
 * @example Single tab (default - uses activeTabId)
 * ```typescript
 * const agent = new BackgroundAgent();
 * await agent.navigate('https://example.com');
 * await agent.execute({ id: '1', action: 'click', selector: '#submit' });
 * ```
 *
 * @example Multi-tab with explicit tabId
 * ```typescript
 * const agent = new BackgroundAgent();
 *
 * // Open two tabs
 * const tab1 = await agent.newTab({ url: 'https://google.com' });
 * const tab2 = await agent.newTab({ url: 'https://github.com', active: false });
 *
 * // Interact with specific tabs without switching
 * await agent.tab(tab1.id).click('#search');
 * await agent.tab(tab2.id).snapshot();
 *
 * // Or specify tabId in command
 * await agent.execute({ id: '1', action: 'snapshot' }, { tabId: tab2.id });
 * ```
 */
export class BackgroundAgent {
  private activeTabId: number | null = null;
  private sessionManager: SessionManager;
  private heartbeatInterval: number | null = null;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds

  constructor() {
    this.sessionManager = new SessionManager();
    // Initialize active tab on creation
    this.initActiveTab();
    // Start heartbeat to keep session tabs alive
    this.startHeartbeat();
  }

  private async initActiveTab(): Promise<void> {
    const tab = await this.getActiveTab();
    this.activeTabId = tab?.id ?? null;
  }

  /**
   * Get the current active tab ID
   */
  getActiveTabId(): number | null {
    return this.activeTabId;
  }

  /**
   * Set the active tab ID (for manual control)
   */
  setActiveTabId(tabId: number): void {
    this.activeTabId = tabId;
  }

  /**
   * Get a handle for interacting with a specific tab
   *
   * This allows you to send commands to any tab without switching the active tab.
   *
   * @example
   * ```typescript
   * const tab2Handle = browser.tab(tab2.id);
   * await tab2Handle.snapshot();
   * await tab2Handle.click('@ref:5');
   * ```
   */
  tab(tabId: number): TabHandle {
    const agent = this;
    let cmdCounter = 0;
    const genId = () => `tab_${tabId}_${Date.now()}_${cmdCounter++}`;

    return {
      tabId,

      execute(command: Command): Promise<Response> {
        return agent.sendToContentAgent(command, tabId);
      },

      snapshot(options?: { selector?: string; maxDepth?: number }): Promise<Response> {
        return agent.sendToContentAgent({
          id: genId(),
          action: 'snapshot',
          ...options,
        } as Command, tabId);
      },

      click(selector: string): Promise<Response> {
        return agent.sendToContentAgent({
          id: genId(),
          action: 'click',
          selector,
        } as Command, tabId);
      },

      fill(selector: string, value: string): Promise<Response> {
        return agent.sendToContentAgent({
          id: genId(),
          action: 'fill',
          selector,
          value,
        } as Command, tabId);
      },

      type(selector: string, text: string, options?: { clear?: boolean }): Promise<Response> {
        return agent.sendToContentAgent({
          id: genId(),
          action: 'type',
          selector,
          text,
          ...options,
        } as Command, tabId);
      },

      getText(selector: string): Promise<Response> {
        return agent.sendToContentAgent({
          id: genId(),
          action: 'getText',
          selector,
        } as Command, tabId);
      },

      isVisible(selector: string): Promise<Response> {
        return agent.sendToContentAgent({
          id: genId(),
          action: 'isVisible',
          selector,
        } as Command, tabId);
      },
    };
  }

  // ============================================================================
  // TAB MANAGEMENT
  // ============================================================================

  /**
   * Get the currently active tab (only if in session)
   */
  async getActiveTab(): Promise<ChromeTab | null> {
    const sessionGroupId = this.sessionManager.getActiveSessionGroupId();

    // If no session, return null
    if (sessionGroupId === null) {
      return null;
    }

    // Get active tab and verify it's in the session
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        // Only return if it's in the session group
        if (activeTab && activeTab.groupId === sessionGroupId) {
          resolve(activeTab);
        } else {
          resolve(null);
        }
      });
    });
  }

  /**
   * List all tabs (only in session group)
   */
  async listTabs(): Promise<TabInfo[]> {
    // Get active session group ID
    const sessionGroupId = this.sessionManager.getActiveSessionGroupId();

    // Session is required
    if (sessionGroupId === null) {
      throw new Error('No active session. Create a session first to manage tabs.');
    }

    // Only return tabs in the session group
    const tabs = await new Promise<ChromeTab[]>((resolve) => {
      chrome.tabs.query({ groupId: sessionGroupId }, (t) => resolve(t));
    });

    return tabs.map((t) => ({
      id: t.id!,
      url: t.url,
      title: t.title,
      active: t.active,
      index: t.index,
    }));
  }

  /**
   * Create a new tab (only in session group)
   */
  async newTab(options?: { url?: string; active?: boolean }): Promise<TabInfo> {
    // Require active session
    const sessionGroupId = this.sessionManager.getActiveSessionGroupId();
    if (sessionGroupId === null) {
      throw new Error('No active session. Create a session first to manage tabs.');
    }

    const tab = await new Promise<ChromeTab>((resolve) => {
      chrome.tabs.create(
        { url: options?.url, active: options?.active ?? true },
        (t) => resolve(t)
      );
    });

    if (options?.url) {
      await this.waitForTabLoad(tab.id!);
    }

    if (options?.active !== false) {
      this.activeTabId = tab.id!;
    }

    // Add to active session
    if (tab.id) {
      const added = await this.sessionManager.addTabToActiveSession(tab.id);
      if (!added) {
        // If we couldn't add to session, close the tab
        await chrome.tabs.remove(tab.id);
        throw new Error('Failed to add new tab to session');
      }
    }

    return {
      id: tab.id!,
      url: tab.url,
      title: tab.title,
      active: tab.active,
      index: tab.index,
    };
  }

  /**
   * Check if a tab is in the active session
   */
  private async isTabInSession(tabId: number): Promise<boolean> {
    const sessionGroupId = this.sessionManager.getActiveSessionGroupId();

    // Session is required - no operations allowed without it
    if (sessionGroupId === null) {
      throw new Error('No active session. Create a session first to manage tabs.');
    }

    // Check if tab is in the session group
    const tab = await chrome.tabs.get(tabId);
    return tab.groupId === sessionGroupId;
  }

  /**
   * Close a tab (only if in session)
   */
  async closeTab(tabId?: number): Promise<void> {
    const targetId = tabId ?? this.activeTabId;
    if (!targetId) throw new Error('No tab to close');

    // Validate tab is in session
    const inSession = await this.isTabInSession(targetId);
    if (!inSession) {
      throw new Error('Cannot close tab: tab is not in the active session');
    }

    await new Promise<void>((resolve) => {
      chrome.tabs.remove(targetId, () => resolve());
    });

    // Update active tab if we closed the current one
    if (targetId === this.activeTabId) {
      const tab = await this.getActiveTab();
      this.activeTabId = tab?.id ?? null;
    }
  }

  /**
   * Switch to a tab (only if in session)
   */
  async switchTab(tabId: number): Promise<void> {
    // Validate tab is in session
    const inSession = await this.isTabInSession(tabId);
    if (!inSession) {
      throw new Error('Cannot switch to tab: tab is not in the active session');
    }

    await new Promise<void>((resolve) => {
      chrome.tabs.update(tabId, { active: true }, () => resolve());
    });
    this.activeTabId = tabId;
  }

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  /**
   * Navigate to a URL (only in session tabs)
   */
  async navigate(url: string, options?: { waitUntil?: 'load' | 'domcontentloaded' }): Promise<void> {
    const tabId = this.activeTabId ?? (await this.getActiveTab())?.id;
    if (!tabId) throw new Error('No active tab');

    // Validate tab is in session
    const inSession = await this.isTabInSession(tabId);
    if (!inSession) {
      throw new Error('Cannot navigate: tab is not in the active session');
    }

    await new Promise<void>((resolve) => {
      chrome.tabs.update(tabId, { url }, () => resolve());
    });

    if (options?.waitUntil) {
      await this.waitForTabLoad(tabId);

      // Clear refs and highlights after navigation completes
      try {
        await this.sendToContentAgent({
          id: `nav_clear_${Date.now()}`,
          action: 'clearHighlight'
        }, tabId);
      } catch (error) {
        // Ignore errors - content script might not be ready yet
        console.log('[BackgroundAgent] Failed to clear highlights after navigation:', error);
      }
    }
  }

  /**
   * Go back in history
   */
  async back(): Promise<void> {
    const tabId = this.activeTabId ?? (await this.getActiveTab())?.id;
    if (!tabId) throw new Error('No active tab');

    await new Promise<void>((resolve) => {
      chrome.tabs.goBack(tabId, () => resolve());
    });
  }

  /**
   * Go forward in history
   */
  async forward(): Promise<void> {
    const tabId = this.activeTabId ?? (await this.getActiveTab())?.id;
    if (!tabId) throw new Error('No active tab');

    await new Promise<void>((resolve) => {
      chrome.tabs.goForward(tabId, () => resolve());
    });
  }

  /**
   * Reload the current page
   */
  async reload(options?: { bypassCache?: boolean }): Promise<void> {
    const tabId = this.activeTabId ?? (await this.getActiveTab())?.id;
    if (!tabId) throw new Error('No active tab');

    await new Promise<void>((resolve) => {
      chrome.tabs.reload(tabId, { bypassCache: options?.bypassCache }, () => resolve());
    });

    await this.waitForTabLoad(tabId);
  }

  /**
   * Get the current URL
   */
  async getUrl(): Promise<string> {
    const tab = await this.getActiveTab();
    return tab?.url || '';
  }

  /**
   * Get the page title
   */
  async getTitle(): Promise<string> {
    const tab = await this.getActiveTab();
    return tab?.title || '';
  }

  // ============================================================================
  // SCREENSHOTS
  // ============================================================================

  /**
   * Capture a screenshot of the visible tab
   */
  async screenshot(options?: { format?: 'png' | 'jpeg'; quality?: number }): Promise<string> {
    const format = options?.format || 'png';
    const quality = options?.quality;

    const dataUrl = await new Promise<string>((resolve, reject) => {
      chrome.tabs.captureVisibleTab(
        { format, quality },
        (url) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(url);
          }
        }
      );
    });

    // Extract base64 data from data URL
    return dataUrl.split(',')[1];
  }

  // ============================================================================
  // COMMAND EXECUTION
  // ============================================================================

  /**
   * Execute a command - routes to appropriate handler
   *
   * Browser-level commands (navigate, screenshot, tabs) are handled here.
   * DOM-level commands are forwarded to the ContentAgent in the target tab.
   *
   * @param command - The command to execute
   * @param options - Optional settings including target tabId
   *
   * @example Default (active tab)
   * ```typescript
   * await browser.execute({ id: '1', action: 'snapshot' });
   * ```
   *
   * @example Specific tab
   * ```typescript
   * await browser.execute({ id: '1', action: 'snapshot' }, { tabId: 123 });
   * ```
   */
  async execute(command: Command, options?: { tabId?: number }): Promise<Response> {
    try {
      // Extension commands are handled directly by BrowserAgent
      if (this.isExtensionCommand(command)) {
        return this.executeExtensionCommand(command);
      }

      // DOM commands are forwarded to ContentAgent in the target tab
      return this.sendToContentAgent(command, options?.tabId);
    } catch (error) {
      return {
        id: command.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Send a command to the ContentAgent in a specific tab
   */
  async sendToContentAgent(command: Command, tabId?: number): Promise<Response> {
    const targetTabId = tabId ?? this.activeTabId ?? (await this.getActiveTab())?.id;

    if (!targetTabId) {
      return {
        id: command.id,
        success: false,
        error: 'No active tab for DOM command',
      };
    }

    // Try sending with automatic retry and recovery
    return this.sendMessageWithRetry(targetTabId, command);
  }

  /**
   * Send message with automatic content script re-injection on failure
   */
  private async sendMessageWithRetry(
    tabId: number,
    command: Command,
    retries = 1
  ): Promise<Response> {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(
        tabId,
        { type: 'btcp:command', command } satisfies ExtensionMessage,
        { frameId: 0 }, // Target only the main frame, not iframes
        async (response) => {
          if (chrome.runtime.lastError) {
            // Content script not responding - try re-injection
            if (retries > 0) {
              console.log(`[Recovery] Re-injecting content script into tab ${tabId}`);
              const success = await this.reinjectContentScript(tabId);

              if (success) {
                // Wait briefly for content script to initialize
                await new Promise(r => setTimeout(r, 500));
                // Retry the command
                resolve(this.sendMessageWithRetry(tabId, command, retries - 1));
                return;
              }
            }

            resolve({
              id: command.id,
              success: false,
              error: chrome.runtime.lastError.message || 'Failed to send message to tab',
            });
          } else {
            const resp = response as ExtensionResponse;
            if (resp.type === 'btcp:response') {
              resolve(resp.response);
            } else {
              resolve({
                id: command.id,
                success: false,
                error: 'Invalid response type',
              });
            }
          }
        }
      );
    });
  }

  /**
   * Re-inject content script into a tab (for recovery from frozen state)
   */
  private async reinjectContentScript(tabId: number): Promise<boolean> {
    try {
      // Check if tab is ready for injection
      const tab = await chrome.tabs.get(tabId);
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        return false; // Can't inject into chrome:// or extension pages
      }

      // Execute content script
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js'],
      });

      console.log(`[Recovery] Successfully re-injected content script into tab ${tabId}`);
      return true;
    } catch (error) {
      console.error(`[Recovery] Failed to re-inject content script:`, error);
      return false;
    }
  }

  /**
   * Start heartbeat to monitor session tabs
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.pingSessionTabs();
    }, this.HEARTBEAT_INTERVAL) as unknown as number;
  }

  /**
   * Stop heartbeat (for cleanup)
   * Note: Currently not called as service workers are terminated by Chrome
   * Could be used if explicit cleanup is needed in the future
   */
  // @ts-expect-error - Unused but kept for potential future use
  private _stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Ping all session tabs to check health
   */
  private async pingSessionTabs(): Promise<void> {
    try {
      const tabs = await this.listTabs().catch(() => []);

      for (const tab of tabs) {
        chrome.tabs.sendMessage(
          tab.id,
          { type: 'btcp:ping' } satisfies ExtensionMessage,
          { frameId: 0 }, // Target only the main frame, not iframes
          (response) => {
            if (chrome.runtime.lastError) {
              console.log(`[Heartbeat] Tab ${tab.id} unresponsive, will re-inject on next command`);
            } else {
              const resp = response as ExtensionResponse;
              if (resp.type === 'btcp:pong' && !resp.ready) {
                console.log(`[Heartbeat] Tab ${tab.id} content script not ready`);
              }
            }
          }
        );
      }
    } catch (error) {
      // Silently ignore errors during heartbeat (e.g., no active session)
    }
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private isExtensionCommand(command: Command): command is ExtensionCommand {
    const extensionActions = [
      'navigate', 'back', 'forward', 'reload',
      'getUrl', 'getTitle', 'screenshot',
      'tabNew', 'tabClose', 'tabSwitch', 'tabList',
      'groupCreate', 'groupUpdate', 'groupDelete', 'groupList',
      'groupAddTabs', 'groupRemoveTabs', 'groupGet',
      'sessionGetCurrent', 'popupInitialize',
    ];
    return extensionActions.includes(command.action);
  }

  private async executeExtensionCommand(command: ExtensionCommand): Promise<Response> {
    switch (command.action) {
      case 'navigate':
        await this.navigate(command.url, { waitUntil: command.waitUntil });
        return { id: command.id, success: true, data: { url: command.url } };

      case 'back':
        await this.back();
        return { id: command.id, success: true, data: { navigated: 'back' } };

      case 'forward':
        await this.forward();
        return { id: command.id, success: true, data: { navigated: 'forward' } };

      case 'reload':
        await this.reload({ bypassCache: command.bypassCache });
        return { id: command.id, success: true, data: { reloaded: true } };

      case 'getUrl': {
        const url = await this.getUrl();
        return { id: command.id, success: true, data: { url } };
      }

      case 'getTitle': {
        const title = await this.getTitle();
        return { id: command.id, success: true, data: { title } };
      }

      case 'screenshot': {
        const screenshot = await this.screenshot({
          format: command.format,
          quality: command.quality,
        });
        return { id: command.id, success: true, data: { screenshot, format: command.format || 'png' } };
      }

      case 'tabNew': {
        const tab = await this.newTab({ url: command.url, active: command.active });
        return { id: command.id, success: true, data: { tabId: tab.id, url: tab.url } };
      }

      case 'tabClose':
        await this.closeTab(command.tabId);
        return { id: command.id, success: true, data: { closed: command.tabId ?? this.activeTabId } };

      case 'tabSwitch':
        await this.switchTab(command.tabId);
        return { id: command.id, success: true, data: { switched: command.tabId } };

      case 'tabList': {
        const tabs = await this.listTabs();
        return { id: command.id, success: true, data: { tabs } };
      }

      case 'groupCreate': {
        const group = await this.sessionManager.createGroup({
          tabIds: command.tabIds,
          title: command.title,
          color: command.color,
          collapsed: command.collapsed,
        });
        return { id: command.id, success: true, data: { group } };
      }

      case 'groupUpdate': {
        const group = await this.sessionManager.updateGroup(command.groupId, {
          title: command.title,
          color: command.color,
          collapsed: command.collapsed,
        });
        return { id: command.id, success: true, data: { group } };
      }

      case 'groupDelete':
        await this.sessionManager.deleteGroup(command.groupId);
        return { id: command.id, success: true, data: { deleted: command.groupId } };

      case 'groupList': {
        const groups = await this.sessionManager.listGroups();
        return { id: command.id, success: true, data: { groups } };
      }

      case 'groupAddTabs':
        await this.sessionManager.addTabsToGroup(command.groupId, command.tabIds);
        return { id: command.id, success: true, data: { addedTabs: command.tabIds } };

      case 'groupRemoveTabs':
        await this.sessionManager.removeTabsFromGroup(command.tabIds);
        return { id: command.id, success: true, data: { removedTabs: command.tabIds } };

      case 'groupGet': {
        const group = await this.sessionManager.getGroup(command.groupId);
        return { id: command.id, success: true, data: { group } };
      }

      case 'sessionGetCurrent': {
        const session = await this.sessionManager.getCurrentSession();
        return { id: command.id, success: true, data: { session } };
      }

      case 'popupInitialize': {
        console.log('[BackgroundAgent] Popup initializing, checking for session reconnection...');

        // Check if we have a stored session but no active connection
        const sessionGroupId = this.sessionManager.getActiveSessionGroupId();

        if (sessionGroupId === null) {
          // Try to reconnect from storage
          const result = await chrome.storage.session.get('btcp_active_session');
          const stored = result['btcp_active_session'] as { groupId?: number } | undefined;

          if (stored?.groupId) {
            console.log('[BackgroundAgent] Found stored session, attempting reconnection...');
            const reconnected = await this.sessionManager.reconnectSession(stored.groupId);

            return {
              id: command.id,
              success: true,
              data: { initialized: true, reconnected },
            };
          }
        }

        return { id: command.id, success: true, data: { initialized: true, reconnected: false } };
      }

      default:
        throw new Error(`Unknown extension action: ${(command as ExtensionCommand).action}`);
    }
  }

  private waitForTabLoad(tabId: number, timeout = 30000): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const checkTab = () => {
        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (tab.status === 'complete') {
            resolve();
            return;
          }

          if (Date.now() - startTime > timeout) {
            reject(new Error('Tab load timeout'));
            return;
          }

          setTimeout(checkTab, 100);
        });
      };

      checkTab();
    });
  }
}

// ============================================================================
// MESSAGE LISTENER SETUP
// ============================================================================

// Singleton instance for message handling
let backgroundAgent: BackgroundAgent | null = null;

/**
 * Get or create the BackgroundAgent singleton
 */
export function getBackgroundAgent(): BackgroundAgent {
  if (!backgroundAgent) {
    backgroundAgent = new BackgroundAgent();
  }
  return backgroundAgent;
}

/**
 * @deprecated Use getBackgroundAgent instead
 */
export const getBrowserAgent = getBackgroundAgent;

/**
 * Set up the message listener for the background script
 * Call this once in your background.ts to enable command routing
 */
export function setupMessageListener(): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const msg = message as ExtensionMessage;

    if (msg.type !== 'btcp:command') {
      return false;
    }

    const agent = getBackgroundAgent();

    // Execute the command (BackgroundAgent handles routing to correct tab)
    agent.execute(msg.command)
      .then((response) => {
        sendResponse({ type: 'btcp:response', response } satisfies ExtensionResponse);
      })
      .catch((error) => {
        sendResponse({
          type: 'btcp:response',
          response: {
            id: msg.command.id,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          },
        } satisfies ExtensionResponse);
      });

    return true; // Keep channel open for async response
  });
}

// Legacy exports for backwards compatibility
export const handleCommand = (command: Command, _tabId?: number) =>
  getBackgroundAgent().execute(command);

export const executeExtensionCommand = (command: ExtensionCommand) =>
  getBackgroundAgent().execute(command);

export const sendToContentScript = (_tabId: number, command: Command) =>
  getBackgroundAgent().sendToContentAgent(command, _tabId);

/**
 * @deprecated Use BackgroundAgent instead
 */
export const BrowserAgent = BackgroundAgent;
