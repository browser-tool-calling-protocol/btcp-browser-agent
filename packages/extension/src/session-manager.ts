/**
 * SessionManager - Manages tab groups and sessions for BTCP Browser Agent
 */

import type {
  GroupInfo,
  SessionInfo,
  GroupCreateOptions,
  GroupUpdateOptions,
  GroupColor,
} from './session-types.js';

/**
 * Storage key for session persistence
 */
const SESSION_STORAGE_KEY = 'btcp_active_session';

/**
 * Stored session data
 */
interface StoredSessionData {
  groupId: number;
  sessionCounter: number;
  timestamp: number;
}

/**
 * Options for SessionManager
 */
export interface SessionManagerOptions {
  /**
   * Maximum number of sessions allowed (default: 1)
   * When limit is reached, new session creation will fail
   */
  maxSession?: number;

  /**
   * Maximum number of open tabs per session (default: 1)
   * When limit is reached, oldest tabs will be closed
   */
  maxOpenTab?: number;
}

/**
 * SessionManager handles Chrome tab group operations and session state
 */
export class SessionManager {
  private activeSessionGroupId: number | null = null;
  private sessionCounter = 0;
  private initialized = false;
  private maxSession: number;
  private maxOpenTab: number;

  constructor(options: SessionManagerOptions = {}) {
    this.maxSession = options.maxSession ?? 1;
    this.maxOpenTab = options.maxOpenTab ?? 1;
    // Restore session on creation
    this.restoreSession();
  }

  /**
   * Restore session from storage
   */
  private async restoreSession(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('[SessionManager] Restoring session from storage...');
      const result = await chrome.storage.session.get(SESSION_STORAGE_KEY);
      const data = result[SESSION_STORAGE_KEY] as StoredSessionData | undefined;

      if (data?.groupId) {
        console.log('[SessionManager] Found stored session:', data);

        // Verify the group still exists
        try {
          const group = await chrome.tabGroups.get(data.groupId);
          console.log('[SessionManager] Group still exists:', group);

          // Restore session state
          this.activeSessionGroupId = data.groupId;
          this.sessionCounter = data.sessionCounter;

          console.log('[SessionManager] Session restored successfully');
        } catch (err) {
          console.log('[SessionManager] Stored group no longer exists, clearing...');
          await this.clearStoredSession();
        }
      } else {
        console.log('[SessionManager] No stored session found');
      }
    } catch (err) {
      console.error('[SessionManager] Failed to restore session:', err);
    } finally {
      this.initialized = true;
    }
  }

  /**
   * Persist session to storage
   */
  private async persistSession(): Promise<void> {
    if (this.activeSessionGroupId === null) {
      await this.clearStoredSession();
      return;
    }

    const data: StoredSessionData = {
      groupId: this.activeSessionGroupId,
      sessionCounter: this.sessionCounter,
      timestamp: Date.now(),
    };

    try {
      await chrome.storage.session.set({ [SESSION_STORAGE_KEY]: data });
      console.log('[SessionManager] Session persisted:', data);
    } catch (err) {
      console.error('[SessionManager] Failed to persist session:', err);
    }
  }

  /**
   * Clear stored session
   */
  private async clearStoredSession(): Promise<void> {
    try {
      await chrome.storage.session.remove(SESSION_STORAGE_KEY);
      console.log('[SessionManager] Cleared stored session');
    } catch (err) {
      console.error('[SessionManager] Failed to clear stored session:', err);
    }
  }

  /**
   * Reconnect to a specific session group
   * Used when popup detects a stored session that isn't currently active
   */
  async reconnectSession(groupId: number): Promise<boolean> {
    try {
      console.log('[SessionManager] Attempting to reconnect to session group:', groupId);

      // Verify the group still exists
      const group = await chrome.tabGroups.get(groupId);
      console.log('[SessionManager] Group found:', group);

      // Get stored session data for counter
      const result = await chrome.storage.session.get(SESSION_STORAGE_KEY);
      const data = result[SESSION_STORAGE_KEY] as StoredSessionData | undefined;

      // Restore session state
      this.activeSessionGroupId = groupId;
      this.sessionCounter = data?.sessionCounter ?? this.sessionCounter;

      console.log('[SessionManager] Session reconnected successfully');
      return true;
    } catch (err) {
      console.error('[SessionManager] Failed to reconnect session:', err);
      // Clear invalid stored session
      await this.clearStoredSession();
      return false;
    }
  }

  /**
   * Create a new tab group
   */
  async createGroup(options: GroupCreateOptions = {}): Promise<GroupInfo> {
    console.log('[SessionManager] createGroup called with options:', options);

    // Check if we can create a new session
    const canCreate = await this.canCreateSession();
    if (!canCreate) {
      const count = await this.getSessionCount();
      throw new Error(
        `Maximum session limit reached (${count}/${this.maxSession}). ` +
        `Close an existing session before creating a new one.`
      );
    }

    const {
      tabIds = [],
      title = this.generateSessionName(),
      color = 'blue',
      collapsed = false,
    } = options;

    // If no tabIds provided, create a new blank tab for the session
    let targetTabIds = tabIds;
    if (targetTabIds.length === 0) {
      console.log('[SessionManager] No tabIds provided, creating new blank tab...');
      const newTab = await chrome.tabs.create({
        url: 'about:blank',
        active: true
      });
      console.log('[SessionManager] Created new tab:', newTab.id);
      if (newTab?.id) {
        targetTabIds = [newTab.id];
      } else {
        console.error('[SessionManager] Failed to create new tab');
        throw new Error('Failed to create new tab for session');
      }
    }

    console.log('[SessionManager] Creating group with tabs:', targetTabIds);

    // Get the tab details to find its window
    const targetTab = await chrome.tabs.get(targetTabIds[0]);

    if (!targetTab || !targetTab.windowId) {
      console.error('[SessionManager] Could not find valid window for tab');
      throw new Error('Could not find a normal window for the tab');
    }

    // Verify it's a normal window, not popup/devtools/etc
    const window = await chrome.windows.get(targetTab.windowId);
    if (window.type !== 'normal') {
      console.error('[SessionManager] Window is not normal type:', window.type);
      throw new Error(`Tabs can only be grouped in normal windows, not ${window.type} windows`);
    }

    // Create the group
    const groupId = await chrome.tabs.group({
      tabIds: targetTabIds,
      createProperties: {
        windowId: targetTab.windowId,
      },
    });

    console.log('[SessionManager] Group created with ID:', groupId);

    // Update group properties
    await chrome.tabGroups.update(groupId, {
      title,
      color,
      collapsed,
    });

    console.log('[SessionManager] Group updated with title:', title);

    // Set as active session
    this.activeSessionGroupId = groupId;

    // Persist to storage
    await this.persistSession();

    // Get group info
    const group = await chrome.tabGroups.get(groupId);
    console.log('[SessionManager] Group info:', group);

    return this.mapChromeGroupToGroupInfo(group);
  }

  /**
   * Update an existing tab group
   */
  async updateGroup(groupId: number, options: GroupUpdateOptions): Promise<GroupInfo> {
    await chrome.tabGroups.update(groupId, {
      ...(options.title !== undefined && { title: options.title }),
      ...(options.color !== undefined && { color: options.color }),
      ...(options.collapsed !== undefined && { collapsed: options.collapsed }),
    });

    const group = await chrome.tabGroups.get(groupId);
    return this.mapChromeGroupToGroupInfo(group);
  }

  /**
   * Delete a tab group (closes all tabs in the group)
   */
  async deleteGroup(groupId: number): Promise<void> {
    // Get all tabs in the group
    const tabs = await chrome.tabs.query({ groupId });
    const tabIds = tabs.map((tab) => tab.id).filter((id): id is number => id !== undefined);

    // Close all tabs (this automatically removes the group)
    if (tabIds.length > 0) {
      await chrome.tabs.remove(tabIds);
    }

    // Clear active session if this was the active group
    if (this.activeSessionGroupId === groupId) {
      this.activeSessionGroupId = null;
      // Clear from storage
      await this.clearStoredSession();
    }
  }

  /**
   * List all tab groups
   */
  async listGroups(): Promise<GroupInfo[]> {
    const groups = await chrome.tabGroups.query({});
    return groups.map((group) => this.mapChromeGroupToGroupInfo(group));
  }

  /**
   * Get a specific tab group
   */
  async getGroup(groupId: number): Promise<GroupInfo> {
    const group = await chrome.tabGroups.get(groupId);
    return this.mapChromeGroupToGroupInfo(group);
  }

  /**
   * Add tabs to a group
   */
  async addTabsToGroup(groupId: number, tabIds: number[]): Promise<void> {
    await chrome.tabs.group({
      groupId,
      tabIds,
    });
  }

  /**
   * Remove tabs from their group (ungroup them)
   */
  async removeTabsFromGroup(tabIds: number[]): Promise<void> {
    await chrome.tabs.ungroup(tabIds);
  }

  /**
   * Get current active session info
   */
  async getCurrentSession(): Promise<SessionInfo | null> {
    if (this.activeSessionGroupId === null) {
      return null;
    }

    try {
      const group = await chrome.tabGroups.get(this.activeSessionGroupId);
      const tabs = await chrome.tabs.query({ groupId: this.activeSessionGroupId });
      const tabIds = tabs.map((tab) => tab.id).filter((id): id is number => id !== undefined);

      return {
        groupId: this.activeSessionGroupId,
        title: group.title || 'Untitled Session',
        color: group.color as GroupColor,
        tabCount: tabs.length,
        tabIds,
        windowId: group.windowId,
        createdAt: Date.now(),
      };
    } catch (error) {
      // Group no longer exists
      this.activeSessionGroupId = null;
      return null;
    }
  }

  /**
   * Get the active session group ID
   */
  getActiveSessionGroupId(): number | null {
    return this.activeSessionGroupId;
  }

  /**
   * Get the maximum number of sessions allowed
   */
  getMaxSession(): number {
    return this.maxSession;
  }

  /**
   * Get the maximum number of open tabs per session
   */
  getMaxOpenTab(): number {
    return this.maxOpenTab;
  }

  /**
   * Enforce the tab limit in the active session
   * Closes oldest tabs if the limit is exceeded
   */
  async enforceTabLimit(): Promise<void> {
    if (this.activeSessionGroupId === null) {
      return;
    }

    try {
      // Get all tabs in the session
      const tabs = await chrome.tabs.query({ groupId: this.activeSessionGroupId });

      if (tabs.length <= this.maxOpenTab) {
        return; // Within limit
      }

      // Sort by index (lower index = older tab position)
      tabs.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

      // Close excess tabs (oldest first)
      const tabsToClose = tabs.slice(0, tabs.length - this.maxOpenTab);
      console.log(`[SessionManager] Closing ${tabsToClose.length} excess tabs to enforce limit of ${this.maxOpenTab}`);

      for (const tab of tabsToClose) {
        if (tab.id) {
          try {
            await chrome.tabs.remove(tab.id);
          } catch (err) {
            console.error('[SessionManager] Failed to close tab:', err);
          }
        }
      }
    } catch (err) {
      console.error('[SessionManager] Failed to enforce tab limit:', err);
    }
  }

  /**
   * Get the count of existing BTCP sessions by checking:
   * 1. Persistent session from storage
   * 2. Current active session
   * 3. Existing tab groups (BTCP prefixed)
   */
  async getSessionCount(): Promise<number> {
    // If we have an active session, that counts as 1
    if (this.activeSessionGroupId !== null) {
      try {
        // Verify the group still exists
        await chrome.tabGroups.get(this.activeSessionGroupId);
        return 1;
      } catch {
        // Group no longer exists, clear it
        this.activeSessionGroupId = null;
      }
    }

    // Check if there's a persistent session in storage
    try {
      const result = await chrome.storage.session.get(SESSION_STORAGE_KEY);
      const data = result[SESSION_STORAGE_KEY] as StoredSessionData | undefined;

      if (data?.groupId) {
        // Verify the stored group still exists
        try {
          await chrome.tabGroups.get(data.groupId);
          return 1;
        } catch {
          // Group no longer exists, clear storage
          await this.clearStoredSession();
        }
      }
    } catch (err) {
      console.error('[SessionManager] Failed to check persistent session:', err);
    }

    // Count existing BTCP tab groups
    try {
      const groups = await chrome.tabGroups.query({});
      const btcpGroups = groups.filter(g => g.title?.startsWith('BTCP'));
      return btcpGroups.length;
    } catch (err) {
      console.error('[SessionManager] Failed to count tab groups:', err);
      return 0;
    }
  }

  /**
   * Check if a new session can be created based on maxSession limit
   */
  async canCreateSession(): Promise<boolean> {
    const count = await this.getSessionCount();
    return count < this.maxSession;
  }

  /**
   * Set the active session group ID
   */
  setActiveSessionGroupId(groupId: number | null): void {
    this.activeSessionGroupId = groupId;
  }

  /**
   * Use an existing tab group as the active session
   * This validates the group exists and sets it as active with persistence
   */
  async useExistingGroupAsSession(groupId: number): Promise<boolean> {
    try {
      // Verify the group exists
      const group = await chrome.tabGroups.get(groupId);
      console.log('[SessionManager] Using existing group as session:', group);

      // Set as active session
      this.activeSessionGroupId = groupId;

      // Persist to storage
      await this.persistSession();

      console.log('[SessionManager] Existing group set as active session');
      return true;
    } catch (err) {
      console.error('[SessionManager] Failed to use existing group as session:', err);
      return false;
    }
  }

  /**
   * Add a tab to the active session (if one exists)
   * Automatically enforces the tab limit after adding
   */
  async addTabToActiveSession(tabId: number): Promise<boolean> {
    if (this.activeSessionGroupId === null) {
      return false;
    }

    try {
      await this.addTabsToGroup(this.activeSessionGroupId, [tabId]);
      // Enforce tab limit after adding
      await this.enforceTabLimit();
      return true;
    } catch (error) {
      // Group may no longer exist
      this.activeSessionGroupId = null;
      return false;
    }
  }

  /**
   * Generate a session name
   */
  private generateSessionName(): string {
    this.sessionCounter++;
    return `BTCP Session ${this.sessionCounter}`;
  }

  /**
   * Map Chrome tab group to GroupInfo
   */
  private mapChromeGroupToGroupInfo(group: chrome.tabGroups.TabGroup): GroupInfo {
    return {
      id: group.id,
      title: group.title,
      color: group.color as GroupColor,
      collapsed: group.collapsed,
      windowId: group.windowId,
    };
  }
}

// Singleton instance
let sessionManagerInstance: SessionManager | null = null;

/**
 * Get the singleton SessionManager instance
 * @param options Options for the SessionManager (only used on first call)
 */
export function getSessionManager(options?: SessionManagerOptions): SessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionManager(options);
  }
  return sessionManagerInstance;
}
