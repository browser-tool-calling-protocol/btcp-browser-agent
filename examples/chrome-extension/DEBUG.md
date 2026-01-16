# Debugging Guide: Start Session Not Working

## Step 1: Load the Extension

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Navigate to: `/Users/minh/Documents/btcp/btcp-browser-agent/examples/chrome-extension/dist/`
5. Select the `dist` folder and click **Select**

## Step 2: Check Extension Loaded

You should see:
- **BTCP Browser Agent** card in the extensions list
- No errors shown in the extension card
- Extension icon appears in the Chrome toolbar

If you see errors, note them and check Step 3.

## Step 3: Check for Permission Errors

### View Background Service Worker Logs:
1. On the extension card, click **service worker** link (under "Inspect views")
2. This opens DevTools for the background script
3. Check Console tab for errors

**Common errors:**
- `chrome.tabGroups is not defined` → Permission missing
- `SessionManager is not a constructor` → Build issue
- `Failed to execute 'group'` → Invalid tab IDs

### Check Console Output:
Look for these messages when extension loads:
- No errors = Good ✅
- Red errors = Problem ❌

## Step 4: Test the Popup

1. Click the extension icon in Chrome toolbar
2. Popup should open showing:
   - **Session** section at top
   - "No active session" (gray)
   - "Start New Session" button (blue)
   - Quick Actions section below

3. **Open popup DevTools:**
   - Right-click anywhere in the popup
   - Select **Inspect**
   - Go to **Console** tab

## Step 5: Test Start Session Button

### Click "Start New Session" button and watch for:

**In Popup Console (DevTools):**
```
[timestamp]
Starting new session...
```

Then either:
```javascript
// Success:
{
  "created": "BTCP Session 1",
  "groupId": 123
}

// Or Error:
Error: [error message here]
```

**In Background Service Worker Console:**
Look for command execution logs or errors.

## Step 6: Common Issues & Solutions

### Issue 1: "chrome.tabGroups is undefined"
**Cause:** Permission not granted
**Fix:**
1. Open `manifest.json`
2. Verify `"tabGroups"` is in `"permissions"` array
3. Rebuild: `npm run build`
4. Reload extension in `chrome://extensions`

### Issue 2: "No active tab for DOM command"
**Cause:** Extension needs an active tab to create group
**Fix:**
1. Make sure you have at least one tab open
2. Click on a regular webpage tab (not chrome:// pages)
3. Then click extension icon and try again

### Issue 3: "Failed to execute 'group' on 'tabs'"
**Cause:** Invalid tab ID or tab already closed
**Fix:**
1. Open a new tab first
2. Navigate to a regular website (e.g., example.com)
3. Then try creating session

### Issue 4: Button click does nothing
**Cause:** JavaScript error in popup
**Fix:**
1. Check popup console for errors (see Step 4)
2. Common errors:
   - `client.groupCreate is not a function` → Rebuild needed
   - `btnStartSession is null` → HTML/JS mismatch
   - `Cannot read property 'group'` → API response issue

### Issue 5: "SessionManager is not a constructor"
**Cause:** session-manager.js not properly built/imported
**Fix:**
```bash
# Rebuild the packages
cd /Users/minh/Documents/btcp/btcp-browser-agent
npm run build
cd examples/chrome-extension
npm run build
```
Then reload extension.

## Step 7: Manual Console Testing

### Test in Background Service Worker Console:
```javascript
// Get background agent
const agent = globalThis.__backgroundAgent;

// Test session manager
agent.sessionManager.createGroup({ title: "Test Session" })
  .then(group => console.log("Created:", group))
  .catch(err => console.error("Error:", err));
```

### Test in Popup Console:
```javascript
// Get client
const client = createClient();

// Test group creation
client.groupCreate({ title: "Test Session" })
  .then(result => console.log("Result:", result))
  .catch(err => console.error("Error:", err));
```

## Step 8: Check Tab Groups API

Test if Chrome supports tab groups:
```javascript
// In any console:
console.log(chrome.tabGroups);
// Should show: Object with methods like 'group', 'update', 'query'
// If undefined: Chrome version too old or API not available
```

**Minimum Chrome version:** 89+ (tab groups API)

## Step 9: Verify Session Creation Manually

After clicking "Start New Session":

1. **Check tabs in browser:**
   - Do you see a blue colored tab group?
   - Is there a label like "BTCP Session 1"?

2. **If no group visible:**
   - SessionManager may have created group but no tabs in it
   - Try clicking "New Tab" button
   - New tab should appear in a blue group

## Step 10: Full Debug Flow

Run this complete test in **Background Service Worker Console**:

```javascript
// 1. Check SessionManager exists
console.log("SessionManager:", globalThis.SessionManager);

// 2. Check background agent has session manager
const agent = globalThis.__backgroundAgent || getBackgroundAgent();
console.log("Agent has sessionManager:", !!agent.sessionManager);

// 3. Try creating a group directly
agent.sessionManager.createGroup({ title: "Debug Test" })
  .then(group => {
    console.log("✅ Group created:", group);
    return chrome.tabs.query({ groupId: group.id });
  })
  .then(tabs => {
    console.log("✅ Tabs in group:", tabs.length);
  })
  .catch(err => {
    console.error("❌ Error:", err);
    console.error("Stack:", err.stack);
  });
```

## Step 11: Collect Debug Info

If still not working, collect this info:

```javascript
// Run in Background Service Worker Console:
{
  chromeVersion: navigator.userAgent.match(/Chrome\/(\d+)/)?.[1],
  tabGroupsAPI: typeof chrome.tabGroups,
  sessionManagerLoaded: typeof SessionManager !== 'undefined',
  backgroundAgent: typeof getBackgroundAgent !== 'undefined',
  activeTabs: await chrome.tabs.query({ active: true }),
  allGroups: await chrome.tabGroups.query({})
}
```

## Quick Fix Checklist

- [ ] Extension loaded without errors
- [ ] Developer mode enabled
- [ ] `tabGroups` permission in manifest
- [ ] At least one regular tab open (not chrome://)
- [ ] Background service worker console has no errors
- [ ] Popup console has no errors
- [ ] Chrome version 89 or higher
- [ ] Extension reloaded after rebuild

## Getting More Help

If still stuck, provide:
1. Chrome version
2. Console errors from both background and popup
3. Result of Step 10 debug flow
4. Screenshot of extension popup
5. Output of Step 11 debug info
