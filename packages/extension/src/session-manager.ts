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
 * SessionManager handles Chrome tab group operations and session state
 */
export class SessionManager {
  private activeSessionGroupId: number | null = null;
  private sessionCounter = 0;

  /**
   * Create a new tab group
   */
  async createGroup(options: GroupCreateOptions = {}): Promise<GroupInfo> {
    console.log('[SessionManager] createGroup called with options:', options);

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

    // Get the window for the tab (must be a normal window)
    const tabs = await chrome.tabs.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
    const targetTab = tabs.find(t => targetTabIds.includes(t.id!));

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
   * Set the active session group ID
   */
  setActiveSessionGroupId(groupId: number | null): void {
    this.activeSessionGroupId = groupId;
  }

  /**
   * Add a tab to the active session (if one exists)
   */
  async addTabToActiveSession(tabId: number): Promise<boolean> {
    if (this.activeSessionGroupId === null) {
      return false;
    }

    try {
      await this.addTabsToGroup(this.activeSessionGroupId, [tabId]);
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
 */
export function getSessionManager(): SessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionManager();
  }
  return sessionManagerInstance;
}
