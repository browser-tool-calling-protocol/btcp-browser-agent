# ✅ Error Fixed: "Tabs can only be moved to and from normal windows"

## What Was the Problem?

The error occurred because:
1. The extension was trying to get the "current window" using `chrome.windows.getCurrent()`
2. When called from a popup, this returns the **popup window**, not the main browser window
3. Chrome only allows tab grouping in **normal windows**, not popup/devtools/app windows

## The Fix

Changed `session-manager.ts` to:
1. Find which window the target tab belongs to
2. Verify it's a "normal" window type
3. Use that window's ID for group creation
4. Provide clear error messages if window type is wrong

## How to Test Now

### Step 1: Reload Extension
```bash
# Go to: chrome://extensions
# Find: BTCP Browser Agent
# Click the refresh icon (or remove and re-add)
```

### Step 2: Proper Test Setup
1. **Open a regular browser window** (if you don't have one)
2. **Open a regular website** in a tab (e.g., https://example.com)
   - NOT chrome:// pages
   - NOT extension pages
   - NOT devtools
3. **Make sure that tab is active** (click on it to focus)
4. **Then click the extension icon** in the toolbar
5. **Click "Start New Session"**

### Step 3: Expected Result

✅ **Success looks like:**
```
[SessionManager] createGroup called with options: {}
[SessionManager] No tabIds provided, getting active tab...
[SessionManager] Active tab: {id: 123, url: "https://example.com", ...}
[SessionManager] Creating group with tabs: [123]
[SessionManager] Group created with ID: 456
[SessionManager] Group updated with title: BTCP Session 1
```

✅ **Visual confirmation:**
- Your active tab gets a **blue border/group indicator**
- The tab shows group label: **"BTCP Session 1"**
- Popup updates to show session info

## Common Mistakes to Avoid

### ❌ Wrong: Opening popup in a popup window
**Don't:** Open extension in its own window

**Do:** Use the extension icon in the main browser toolbar

### ❌ Wrong: Testing on chrome:// pages
**Don't:** Have chrome://extensions as active tab

**Do:** Have a real website (https://...) as active tab

### ❌ Wrong: Using DevTools window
**Don't:** Have DevTools undocked as separate window

**Do:** Keep DevTools docked or use regular browser window

## Verification Test

Run this in the **Background Service Worker Console**:

```javascript
// Check window types
chrome.windows.getAll({ populate: true }, (windows) => {
  windows.forEach(w => {
    console.log(`Window ${w.id}:`, {
      type: w.type,
      focused: w.focused,
      tabs: w.tabs?.length || 0,
      tabTitles: w.tabs?.map(t => t.title)
    });
  });
});

// This should show at least one window with type: "normal"
```

## Still Not Working?

If you still get errors, provide:

1. **Error message** (exact text from console)
2. **Window type** (from verification test above)
3. **Active tab URL** (what page are you on?)
4. **How you opened the extension** (toolbar icon? right-click?)

## Next Steps After Fix Works

Once "Start New Session" works:

1. ✅ **Test "New Tab" button** - should auto-join the session
2. ✅ **Test "Close Session" button** - should close all tabs in group
3. ✅ **Test multiple tabs** - create several tabs, verify they all join
4. ✅ **Test session persistence** - session should exist until you close it

## Technical Details

The key change in `session-manager.ts`:

```typescript
// OLD (broken):
const groupId = await chrome.tabs.group({
  tabIds: targetTabIds,
  createProperties: {
    windowId: (await chrome.windows.getCurrent()).id,  // ❌ Returns popup window!
  },
});

// NEW (fixed):
const tabs = await chrome.tabs.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
const targetTab = tabs.find(t => targetTabIds.includes(t.id!));
const window = await chrome.windows.get(targetTab.windowId);

if (window.type !== 'normal') {
  throw new Error(`Tabs can only be grouped in normal windows`);
}

const groupId = await chrome.tabs.group({
  tabIds: targetTabIds,
  createProperties: {
    windowId: targetTab.windowId,  // ✅ Uses tab's actual window!
  },
});
```

## Build Version

This fix is included in the build dated: **2026-01-16**

Make sure you rebuild and reload:
```bash
npm run build
# Then reload extension in chrome://extensions
```
