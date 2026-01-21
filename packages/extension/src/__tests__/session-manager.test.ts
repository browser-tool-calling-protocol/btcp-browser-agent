/**
 * @btcp/extension - SessionManager tests
 *
 * Tests for the SessionManager class that handles Chrome tab group
 * operations and session state persistence.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Chrome API
const mockChrome = {
  tabs: {
    query: vi.fn(),
    create: vi.fn(),
    get: vi.fn(),
    remove: vi.fn(),
    group: vi.fn(),
    ungroup: vi.fn(),
  },
  tabGroups: {
    get: vi.fn(),
    update: vi.fn(),
    query: vi.fn(),
  },
  windows: {
    get: vi.fn(),
  },
  storage: {
    session: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
  },
};

// Expose mock as global chrome
(globalThis as unknown as { chrome: typeof mockChrome }).chrome = mockChrome;

// Now import the module (after chrome is mocked)
import { SessionManager, getSessionManager } from '../session-manager.js';

describe('SessionManager', () => {
  let manager: SessionManager;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockChrome.storage.session.get.mockResolvedValue({});
    mockChrome.storage.session.set.mockResolvedValue(undefined);
    mockChrome.storage.session.remove.mockResolvedValue(undefined);

    mockChrome.tabs.query.mockResolvedValue([]);
    mockChrome.tabs.create.mockResolvedValue({ id: 1, windowId: 1 });
    mockChrome.tabs.get.mockResolvedValue({ id: 1, windowId: 1 });
    mockChrome.tabs.remove.mockResolvedValue(undefined);
    mockChrome.tabs.group.mockResolvedValue(100);
    mockChrome.tabs.ungroup.mockResolvedValue(undefined);

    mockChrome.tabGroups.get.mockResolvedValue({
      id: 100,
      title: 'BTCP Session 1',
      color: 'blue',
      collapsed: false,
      windowId: 1,
    });
    mockChrome.tabGroups.update.mockResolvedValue({});
    mockChrome.tabGroups.query.mockResolvedValue([]);

    mockChrome.windows.get.mockResolvedValue({ type: 'normal', id: 1 });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create an instance with default options', () => {
      manager = new SessionManager();
      expect(manager).toBeDefined();
      expect(manager.getMaxSession()).toBe(1);
      expect(manager.getMaxOpenTab()).toBe(1);
    });

    it('should accept custom options', () => {
      manager = new SessionManager({ maxSession: 3, maxOpenTab: 5 });
      expect(manager.getMaxSession()).toBe(3);
      expect(manager.getMaxOpenTab()).toBe(5);
    });

    it('should attempt to restore session from storage on creation', async () => {
      mockChrome.storage.session.get.mockResolvedValue({
        btcp_active_session: { groupId: 100, sessionCounter: 1, timestamp: Date.now() },
      });

      manager = new SessionManager();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockChrome.storage.session.get).toHaveBeenCalledWith('btcp_active_session');
    });
  });

  describe('getActiveSessionGroupId', () => {
    it('should return null when no active session', () => {
      manager = new SessionManager();
      expect(manager.getActiveSessionGroupId()).toBeNull();
    });

    it('should return group ID when session is active', async () => {
      mockChrome.storage.session.get.mockResolvedValue({
        btcp_active_session: { groupId: 100, sessionCounter: 1, timestamp: Date.now() },
      });

      manager = new SessionManager();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(manager.getActiveSessionGroupId()).toBe(100);
    });
  });

  describe('setActiveSessionGroupId', () => {
    it('should set the active session group ID', () => {
      manager = new SessionManager();
      manager.setActiveSessionGroupId(200);
      expect(manager.getActiveSessionGroupId()).toBe(200);
    });

    it('should allow setting to null', () => {
      manager = new SessionManager();
      manager.setActiveSessionGroupId(200);
      manager.setActiveSessionGroupId(null);
      expect(manager.getActiveSessionGroupId()).toBeNull();
    });
  });

  describe('createGroup', () => {
    beforeEach(() => {
      manager = new SessionManager();
    });

    it('should create a new tab group', async () => {
      const group = await manager.createGroup({
        title: 'Test Session',
        color: 'red',
      });

      expect(group).toBeDefined();
      expect(group.id).toBe(100);
      expect(mockChrome.tabs.create).toHaveBeenCalled();
      expect(mockChrome.tabs.group).toHaveBeenCalled();
      expect(mockChrome.tabGroups.update).toHaveBeenCalled();
    });

    it('should create blank tab when no tabIds provided', async () => {
      await manager.createGroup();

      expect(mockChrome.tabs.create).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'about:blank', active: true })
      );
    });

    it('should use provided tabIds', async () => {
      await manager.createGroup({ tabIds: [1, 2, 3] });

      expect(mockChrome.tabs.create).not.toHaveBeenCalled();
      expect(mockChrome.tabs.group).toHaveBeenCalledWith(
        expect.objectContaining({ tabIds: [1, 2, 3] })
      );
    });

    it('should persist session after creation', async () => {
      await manager.createGroup({ title: 'Test' });

      expect(mockChrome.storage.session.set).toHaveBeenCalledWith(
        expect.objectContaining({
          btcp_active_session: expect.objectContaining({
            groupId: 100,
          }),
        })
      );
    });

    it('should throw error when max sessions reached', async () => {
      // Mock existing BTCP group
      mockChrome.tabGroups.query.mockResolvedValue([
        { id: 99, title: 'BTCP Session 1' },
      ]);

      manager = new SessionManager({ maxSession: 1 });

      await expect(manager.createGroup()).rejects.toThrow('Maximum session limit reached');
    });

    it('should throw error for non-normal window', async () => {
      mockChrome.windows.get.mockResolvedValue({ type: 'popup', id: 1 });

      await expect(manager.createGroup({ tabIds: [1] })).rejects.toThrow(
        'Tabs can only be grouped in normal windows'
      );
    });
  });

  describe('updateGroup', () => {
    beforeEach(async () => {
      manager = new SessionManager();
      await manager.createGroup();
    });

    it('should update group properties', async () => {
      await manager.updateGroup(100, {
        title: 'Updated Title',
        color: 'green',
        collapsed: true,
      });

      expect(mockChrome.tabGroups.update).toHaveBeenCalledWith(
        100,
        expect.objectContaining({
          title: 'Updated Title',
          color: 'green',
          collapsed: true,
        })
      );
    });
  });

  describe('deleteGroup', () => {
    beforeEach(async () => {
      manager = new SessionManager();
      await manager.createGroup();
    });

    it('should close all tabs in the group', async () => {
      mockChrome.tabs.query.mockResolvedValue([
        { id: 1 },
        { id: 2 },
      ]);

      await manager.deleteGroup(100);

      expect(mockChrome.tabs.remove).toHaveBeenCalledWith([1, 2]);
    });

    it('should clear active session if deleting active group', async () => {
      mockChrome.tabs.query.mockResolvedValue([{ id: 1 }]);

      await manager.deleteGroup(100);

      expect(manager.getActiveSessionGroupId()).toBeNull();
      expect(mockChrome.storage.session.remove).toHaveBeenCalled();
    });

    it('should not clear active session if deleting different group', async () => {
      mockChrome.tabs.query.mockResolvedValue([{ id: 1 }]);

      await manager.deleteGroup(999);

      expect(manager.getActiveSessionGroupId()).toBe(100);
    });
  });

  describe('listGroups', () => {
    it('should return all tab groups', async () => {
      mockChrome.tabGroups.query.mockResolvedValue([
        { id: 100, title: 'Group 1', color: 'blue', collapsed: false, windowId: 1 },
        { id: 200, title: 'Group 2', color: 'red', collapsed: true, windowId: 1 },
      ]);

      manager = new SessionManager();
      const groups = await manager.listGroups();

      expect(groups).toHaveLength(2);
      expect(groups[0].id).toBe(100);
      expect(groups[1].id).toBe(200);
    });
  });

  describe('getGroup', () => {
    it('should return a specific group', async () => {
      manager = new SessionManager();
      const group = await manager.getGroup(100);

      expect(group.id).toBe(100);
      expect(group.title).toBe('BTCP Session 1');
    });
  });

  describe('addTabsToGroup', () => {
    it('should add tabs to a group', async () => {
      manager = new SessionManager();
      await manager.addTabsToGroup(100, [1, 2, 3]);

      expect(mockChrome.tabs.group).toHaveBeenCalledWith({
        groupId: 100,
        tabIds: [1, 2, 3],
      });
    });
  });

  describe('removeTabsFromGroup', () => {
    it('should ungroup tabs', async () => {
      manager = new SessionManager();
      await manager.removeTabsFromGroup([1, 2]);

      expect(mockChrome.tabs.ungroup).toHaveBeenCalledWith([1, 2]);
    });
  });

  describe('getCurrentSession', () => {
    it('should return null when no active session', async () => {
      manager = new SessionManager();
      const session = await manager.getCurrentSession();
      expect(session).toBeNull();
    });

    it('should return session info when active', async () => {
      mockChrome.storage.session.get.mockResolvedValue({
        btcp_active_session: { groupId: 100, sessionCounter: 1, timestamp: Date.now() },
      });
      mockChrome.tabs.query.mockResolvedValue([
        { id: 1 },
        { id: 2 },
      ]);

      manager = new SessionManager();
      await new Promise(resolve => setTimeout(resolve, 50));

      const session = await manager.getCurrentSession();

      expect(session).not.toBeNull();
      expect(session?.groupId).toBe(100);
      expect(session?.tabCount).toBe(2);
      expect(session?.tabIds).toEqual([1, 2]);
    });

    it('should clear session if group no longer exists', async () => {
      mockChrome.storage.session.get.mockResolvedValue({
        btcp_active_session: { groupId: 100, sessionCounter: 1, timestamp: Date.now() },
      });

      manager = new SessionManager();
      await new Promise(resolve => setTimeout(resolve, 50));

      // Now make group not exist
      mockChrome.tabGroups.get.mockRejectedValue(new Error('Group not found'));

      const session = await manager.getCurrentSession();

      expect(session).toBeNull();
      expect(manager.getActiveSessionGroupId()).toBeNull();
    });
  });

  describe('reconnectSession', () => {
    it('should reconnect to existing group', async () => {
      manager = new SessionManager();
      const result = await manager.reconnectSession(100);

      expect(result).toBe(true);
      expect(manager.getActiveSessionGroupId()).toBe(100);
    });

    it('should fail and clear storage if group does not exist', async () => {
      mockChrome.tabGroups.get.mockRejectedValue(new Error('Group not found'));

      manager = new SessionManager();
      const result = await manager.reconnectSession(999);

      expect(result).toBe(false);
      expect(mockChrome.storage.session.remove).toHaveBeenCalled();
    });
  });

  describe('useExistingGroupAsSession', () => {
    it('should set existing group as active session', async () => {
      manager = new SessionManager();
      const result = await manager.useExistingGroupAsSession(200);

      expect(result).toBe(true);
      expect(manager.getActiveSessionGroupId()).toBe(200);
      expect(mockChrome.storage.session.set).toHaveBeenCalled();
    });

    it('should return false if group does not exist', async () => {
      mockChrome.tabGroups.get.mockRejectedValue(new Error('Group not found'));

      manager = new SessionManager();
      const result = await manager.useExistingGroupAsSession(999);

      expect(result).toBe(false);
    });
  });

  describe('addTabToActiveSession', () => {
    it('should add tab to active session', async () => {
      mockChrome.storage.session.get.mockResolvedValue({
        btcp_active_session: { groupId: 100, sessionCounter: 1, timestamp: Date.now() },
      });
      mockChrome.tabs.query.mockResolvedValue([{ id: 1 }]);

      manager = new SessionManager();
      await new Promise(resolve => setTimeout(resolve, 50));

      const result = await manager.addTabToActiveSession(5);

      expect(result).toBe(true);
      expect(mockChrome.tabs.group).toHaveBeenCalledWith({
        groupId: 100,
        tabIds: [5],
      });
    });

    it('should return false when no active session', async () => {
      manager = new SessionManager();
      const result = await manager.addTabToActiveSession(5);

      expect(result).toBe(false);
    });
  });

  describe('enforceTabLimit', () => {
    it('should close excess tabs when limit exceeded', async () => {
      mockChrome.storage.session.get.mockResolvedValue({
        btcp_active_session: { groupId: 100, sessionCounter: 1, timestamp: Date.now() },
      });
      mockChrome.tabs.query.mockResolvedValue([
        { id: 1, index: 0 },
        { id: 2, index: 1 },
        { id: 3, index: 2 },
      ]);

      manager = new SessionManager({ maxOpenTab: 2 });
      await new Promise(resolve => setTimeout(resolve, 50));

      await manager.enforceTabLimit();

      // Should close the oldest tab (index 0)
      expect(mockChrome.tabs.remove).toHaveBeenCalledWith(1);
    });

    it('should do nothing when within limit', async () => {
      mockChrome.storage.session.get.mockResolvedValue({
        btcp_active_session: { groupId: 100, sessionCounter: 1, timestamp: Date.now() },
      });
      mockChrome.tabs.query.mockResolvedValue([
        { id: 1, index: 0 },
        { id: 2, index: 1 },
      ]);

      manager = new SessionManager({ maxOpenTab: 5 });
      await new Promise(resolve => setTimeout(resolve, 50));

      await manager.enforceTabLimit();

      expect(mockChrome.tabs.remove).not.toHaveBeenCalled();
    });

    it('should do nothing when no active session', async () => {
      manager = new SessionManager();
      await manager.enforceTabLimit();

      expect(mockChrome.tabs.query).not.toHaveBeenCalled();
    });
  });

  describe('getSessionCount', () => {
    it('should return 1 when active session exists', async () => {
      mockChrome.storage.session.get.mockResolvedValue({
        btcp_active_session: { groupId: 100, sessionCounter: 1, timestamp: Date.now() },
      });

      manager = new SessionManager();
      await new Promise(resolve => setTimeout(resolve, 50));

      const count = await manager.getSessionCount();
      expect(count).toBe(1);
    });

    it('should return 0 when no sessions exist', async () => {
      mockChrome.tabGroups.query.mockResolvedValue([]);

      manager = new SessionManager();
      const count = await manager.getSessionCount();

      expect(count).toBe(0);
    });

    it('should count BTCP tab groups', async () => {
      mockChrome.tabGroups.query.mockResolvedValue([
        { id: 1, title: 'BTCP Session 1' },
        { id: 2, title: 'BTCP Session 2' },
        { id: 3, title: 'Other Group' },
      ]);

      manager = new SessionManager();
      const count = await manager.getSessionCount();

      expect(count).toBe(2);
    });
  });

  describe('canCreateSession', () => {
    it('should return true when under limit', async () => {
      mockChrome.tabGroups.query.mockResolvedValue([]);

      manager = new SessionManager({ maxSession: 2 });
      const canCreate = await manager.canCreateSession();

      expect(canCreate).toBe(true);
    });

    it('should return false when at limit', async () => {
      mockChrome.tabGroups.query.mockResolvedValue([
        { id: 1, title: 'BTCP Session 1' },
      ]);

      manager = new SessionManager({ maxSession: 1 });
      const canCreate = await manager.canCreateSession();

      expect(canCreate).toBe(false);
    });
  });
});

describe('getSessionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.storage.session.get.mockResolvedValue({});
  });

  it('should return a singleton instance', () => {
    const manager1 = getSessionManager();
    const manager2 = getSessionManager();
    expect(manager1).toBe(manager2);
  });
});
