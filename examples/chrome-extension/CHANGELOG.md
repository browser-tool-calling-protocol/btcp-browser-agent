# Changelog

## Latest Changes

### Session Management with Auto-Created Blank Tab

**What Changed:**
- When you click "Start New Session", it now **creates a new blank tab** and adds it to the session
- Previously used the current active tab, which could interrupt your workflow
- The new blank tab is ready for automation without affecting existing tabs

**Why:**
- Clean slate for each session
- Doesn't interfere with tabs you already have open
- Clear starting point for automation

**How It Works:**
```javascript
// User clicks "Start New Session"
await client.groupCreate({ title: "BTCP Session 1" });

// This now:
// 1. Creates a new blank tab (about:blank)
// 2. Adds it to a blue tab group labeled "BTCP Session 1"
// 3. Makes it the active tab
// 4. Ready for navigation/automation
```

**User Experience:**
1. Click "Start New Session"
2. New blank tab opens in a blue group
3. All subsequent operations work in this session
4. Your existing tabs remain untouched

### Session-Only Mode

**What Changed:**
- Extension **only manages tabs within its session/tab group**
- All operations require an active session
- No operations allowed outside the session

**Operations Affected:**
- `listTabs()` - Only shows session tabs
- `tabNew()` - Only creates in session
- `closeTab()` - Only closes session tabs
- `switchTab()` - Only switches to session tabs
- `navigate()` - Only navigates session tabs
- All DOM operations - Only in session tabs

**Error Messages:**
Without a session:
```
Error: "No active session. Create a session first to manage tabs."
```

Trying to access outside tabs:
```
Error: "Cannot switch to tab: tab is not in the active session"
```

**Benefits:**
- ✅ Better security and isolation
- ✅ Clear visual boundaries (tab groups)
- ✅ Explicit user consent required
- ✅ Protects personal tabs from automation
- ✅ Clean separation of contexts

## Testing the Changes

### Test 1: New Blank Tab on Session Start
```
1. Open extension popup
2. Click "Start New Session"
3. Expected: New blank tab opens in blue group
4. Verify: Tab shows "about:blank" URL
5. Verify: Tab group labeled "BTCP Session 1"
```

### Test 2: Session Isolation
```
1. Have 3 regular tabs open (A, B, C)
2. Start new session → new blank tab D in group
3. Click "List Tabs" → should only show tab D
4. Create new tab → should join session with D
5. Tabs A, B, C remain untouched
```

### Test 3: Operations Require Session
```
1. Open popup without starting session
2. Click "List Tabs" → Error shown
3. Click "New Tab" → Error shown
4. Start session → Operations now work
```

## Migration Guide

### Before
```javascript
// Extension used current active tab
await client.groupCreate();
// Your current tab got grouped

// Could access any tab
const tabs = await client.listTabs(); // All tabs
```

### After
```javascript
// Extension creates new blank tab
await client.groupCreate();
// New blank tab created in group
// Your existing tabs untouched

// Only session tabs accessible
const tabs = await client.listTabs(); // Only session tabs
```

### If You Want to Group Existing Tab
```javascript
// Get tab you want to add
const targetTab = await chrome.tabs.get(tabId);

// Create session with that tab
await client.groupCreate({ tabIds: [targetTab.id] });

// Or add to existing session
const session = await client.sessionGetCurrent();
await client.groupAddTabs(session.groupId, [targetTab.id]);
```

## Visual Guide

### Session Start Flow

**Before:**
```
Browser tabs: [Gmail] [GitHub] [YouTube*]
                                    ↑ active
User clicks "Start New Session"
Result: [Gmail] [GitHub] [(YouTube* in blue group)]
                          ↑ YouTube grouped, disrupts workflow
```

**After:**
```
Browser tabs: [Gmail] [GitHub] [YouTube]
User clicks "Start New Session"
Result: [Gmail] [GitHub] [YouTube] [(blank* in blue group)]
                                      ↑ New tab, clean slate
```

### Session Isolation

```
Before session:
[Tab A] [Tab B] [Tab C] [Tab D] [Tab E]
  ↑ Extension could access all tabs

After session:
[Tab A] [Tab B] [Tab C] | [Session: Tab D] [Tab E*]
                         ↑ Blue group boundary
                           Extension only accesses D and E
```

## Breaking Changes

### 1. Session Required
**Before:** Could use extension without session
**After:** Must create session first

**Fix:** Always call `groupCreate()` before other operations

### 2. No Universal Tab Access
**Before:** Could access any tab in window
**After:** Can only access tabs in session

**Fix:** Add tabs to session explicitly or create new tabs via extension

### 3. Active Tab Behavior
**Before:** Session used current active tab
**After:** Session creates new blank tab

**Fix:** If you need to add existing tab, use `groupCreate({ tabIds: [existingTabId] })`

## Rollback

If you need the old behavior, you can modify the source:

**Remove session requirement:**
In `background.ts`, change validation:
```typescript
if (sessionGroupId === null) {
  return true; // Allow without session
}
```

**Use current tab instead of new:**
In `session-manager.ts`, revert to:
```typescript
const [activeTab] = await chrome.tabs.query({ active: true });
targetTabIds = [activeTab.id];
```

## Version Info

- **Build Date:** 2026-01-16
- **Session Manager:** Creates blank tab by default
- **Access Mode:** Session-only (no universal access)
- **Backward Compatible:** No (requires session for all operations)
