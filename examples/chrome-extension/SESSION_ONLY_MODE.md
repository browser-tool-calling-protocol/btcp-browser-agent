# Session-Only Mode

## Overview

The BTCP Browser Agent **only manages tabs within its session/tab group**. No operations are allowed outside of a session.

## Key Principle

**Session is Required** - All operations require an active session:

- ❌ Cannot list tabs without a session
- ❌ Cannot create tabs without a session
- ❌ Cannot navigate without a session
- ❌ Cannot perform DOM operations without a session
- ✅ Must create session first, then all operations work within that session

## How It Works

### 1. Session Must Be Created First

```javascript
// Create a session to start working
await client.groupCreate({ title: "BTCP Session 1" });

// Now all operations work (scoped to session)
await client.tabNew({ url: "https://example.com" });
await client.listTabs(); // Only session tabs
```

### 2. Without Session = Error

```javascript
// Try to list tabs without session
await client.listTabs();
// ❌ Error: "No active session. Create a session first to manage tabs."

// Try to create tab without session
await client.tabNew({ url: "https://example.com" });
// ❌ Error: "No active session. Create a session first to manage tabs."
```

### 3. Operations Are Session-Scoped

Once a session exists, all operations only affect tabs in that session:

```javascript
// Create session with tab A
await client.groupCreate(); // Tab A joins session

// Create new tabs (auto-added to session)
await client.tabNew({ url: "https://example.com" }); // Tab B
await client.tabNew({ url: "https://github.com" }); // Tab C

// List tabs (only shows A, B, C)
const tabs = await client.listTabs(); // [A, B, C]

// User manually opens Tab D outside session

// Try to list tabs (still only shows session tabs)
const tabs2 = await client.listTabs(); // [A, B, C] - no Tab D

// Try to access Tab D
await client.switchTab(tabD.id);
// ❌ Error: "Cannot switch to tab: tab is not in the active session"
```

## Implementation Details

### Session Requirement Check

Every operation checks for active session:

```typescript
async listTabs(): Promise<TabInfo[]> {
  const sessionGroupId = this.sessionManager.getActiveSessionGroupId();

  // Session is required
  if (sessionGroupId === null) {
    throw new Error('No active session. Create a session first.');
  }

  // Only query tabs in the session group
  const tabs = await chrome.tabs.query({ groupId: sessionGroupId });
  return tabs.map(mapToTabInfo);
}
```

### Tab Validation

Operations validate tab membership:

```typescript
private async isTabInSession(tabId: number): Promise<boolean> {
  const sessionGroupId = this.sessionManager.getActiveSessionGroupId();

  // Session required
  if (sessionGroupId === null) {
    throw new Error('No active session.');
  }

  // Check if tab is in session
  const tab = await chrome.tabs.get(tabId);
  return tab.groupId === sessionGroupId;
}
```

### New Tab Creation

New tabs are automatically added to session:

```typescript
async newTab(options?: { url?: string }): Promise<TabInfo> {
  // Check session exists
  if (!this.sessionManager.getActiveSessionGroupId()) {
    throw new Error('No active session.');
  }

  // Create tab
  const tab = await chrome.tabs.create({ url: options?.url });

  // Add to session
  const added = await this.sessionManager.addTabToActiveSession(tab.id);
  if (!added) {
    // Cleanup if failed
    await chrome.tabs.remove(tab.id);
    throw new Error('Failed to add tab to session');
  }

  return mapToTabInfo(tab);
}
```

## Usage Example

### Complete Workflow

```javascript
// 1. Create session (required first step)
await client.groupCreate({ title: "Work Session" });
// Current tab joins blue group "Work Session"

// 2. Now can create tabs (auto-added to session)
await client.tabNew({ url: "https://example.com" });
await client.tabNew({ url: "https://github.com" });

// 3. List tabs (only shows session tabs)
const tabs = await client.listTabs();
console.log(tabs.length); // 3 tabs

// 4. Navigate, interact (only session tabs)
await client.navigate("https://newsite.com");
await client.click("#button");
await client.fill("#input", "value");

// 5. Close session (closes all tabs)
const session = await client.sessionGetCurrent();
await client.groupDelete(session.groupId);
```

### Error Handling

```javascript
try {
  // Try operation without session
  await client.listTabs();
} catch (err) {
  if (err.message.includes('No active session')) {
    // Create session first
    await client.groupCreate();

    // Now retry
    const tabs = await client.listTabs();
  }
}
```

## Benefits

### 1. Security & Isolation
- Extension cannot access tabs outside its scope
- User's personal tabs are protected
- Clear boundaries enforced by code

### 2. Explicit Consent
- User must explicitly create session
- Visual indicator (tab group color/label)
- No accidental access to unrelated tabs

### 3. Clean Separation
- Each session is independent
- Easy to manage multiple workflows
- Clear visual organization

### 4. Predictable Behavior
- All operations scoped to one group
- No ambiguity about which tabs are managed
- Consistent error messages

## Visual Indicators

### Chrome Tab Groups
- Session tabs have **colored border** (e.g., blue)
- Group label shows session name (e.g., "BTCP Session 1")
- Can collapse/expand the group
- Easy to see which tabs are in scope

### Extension Popup
- Shows session status (active/inactive)
- Displays session name and tab count
- Info: "Extension only manages tabs within the active session"
- Buttons disabled when no session

## Comparison

### Before (Universal Access)
```javascript
// Could access any tab
const allTabs = await client.listTabs(); // All tabs in window

// Could navigate any tab
await client.switchTab(anyTabId); // Works

// Could close any tab
await client.tabClose(anyTabId); // Works
```

### After (Session-Only)
```javascript
// Must create session first
await client.groupCreate();

// Only session tabs
const sessionTabs = await client.listTabs(); // Only grouped tabs

// Only session tabs accessible
await client.switchTab(sessionTabId); // ✅ Works
await client.switchTab(outsideTabId); // ❌ Error

// Only session tabs closable
await client.tabClose(sessionTabId); // ✅ Works
await client.tabClose(outsideTabId); // ❌ Error
```

## FAQ

**Q: Can I use the extension without creating a session?**
A: No. Session creation is required for all operations.

**Q: What if I manually move a tab out of the session group?**
A: The extension immediately loses access to that tab.

**Q: Can I manually add tabs to the session?**
A: Yes! Drag any tab into the session group, and it becomes accessible.

**Q: What happens if the session group is deleted?**
A: All operations will fail until a new session is created.

**Q: Can operations work across multiple sessions?**
A: No. Only one active session at a time, and operations are scoped to it.

**Q: Why is session required?**
A: Security, isolation, and explicit user consent. The extension should only manage what the user explicitly adds to the session.

## Testing

### Test Session Requirement

```javascript
// 1. Try without session (should fail)
try {
  await client.listTabs();
  console.error('❌ Should have failed');
} catch (err) {
  console.log('✅ Correctly requires session:', err.message);
}

// 2. Create session
await client.groupCreate({ title: "Test" });

// 3. Operations now work
const tabs = await client.listTabs();
console.log('✅ Session allows operations:', tabs.length);

// 4. Try accessing outside tab (should fail)
// (manually open tab outside session first)
try {
  await client.switchTab(outsideTabId);
  console.error('❌ Should have blocked outside tab');
} catch (err) {
  console.log('✅ Correctly blocks outside tab:', err.message);
}
```

## Summary

**Core Principle**: Session-first, session-only

- ✅ Session required for all operations
- ✅ All operations scoped to session tabs only
- ✅ Clear errors when session missing
- ✅ Visual boundaries via tab groups
- ✅ Explicit user consent required
- ✅ Maximum security and isolation

The extension is now a **pure session manager** - it only works within the boundaries of its explicitly created session.
