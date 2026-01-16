# Quick Test: Session Debugging

## 1. Load Extension (Fresh Start)

```bash
# Location: chrome://extensions
# 1. Remove old version if exists
# 2. Click "Load unpacked"
# 3. Select: /Users/minh/Documents/btcp/btcp-browser-agent/examples/chrome-extension/dist
```

## 2. Open Background Console

1. In `chrome://extensions`, find **BTCP Browser Agent**
2. Click **service worker** (under "Inspect views")
3. This opens the background script DevTools

## 3. Run This Test in Background Console

Copy and paste this entire block:

```javascript
console.log('=== BTCP Session Debug Test ===');

// Test 1: Check API availability
console.log('1. Chrome APIs:');
console.log('  - chrome.tabs:', typeof chrome.tabs);
console.log('  - chrome.tabGroups:', typeof chrome.tabGroups);
console.log('  - chrome.windows:', typeof chrome.windows);

// Test 2: Check SessionManager
console.log('\n2. SessionManager:');
console.log('  - SessionManager class:', typeof SessionManager);

// Test 3: Check BackgroundAgent
console.log('\n3. BackgroundAgent:');
const agent = getBackgroundAgent();
console.log('  - Agent exists:', !!agent);
console.log('  - Has sessionManager:', !!agent?.sessionManager);

// Test 4: Check tabs
console.log('\n4. Current tabs:');
chrome.tabs.query({}, (tabs) => {
  console.log('  - Total tabs:', tabs.length);
  console.log('  - Active tabs:', tabs.filter(t => t.active).length);
  const activeTab = tabs.find(t => t.active);
  if (activeTab) {
    console.log('  - Active tab ID:', activeTab.id);
    console.log('  - Active tab URL:', activeTab.url);
  }
});

// Test 5: Try creating session
console.log('\n5. Attempting to create session...');
if (agent?.sessionManager) {
  agent.sessionManager.createGroup({ title: 'Test Session' })
    .then(group => {
      console.log('✅ SUCCESS! Group created:');
      console.log('  - ID:', group.id);
      console.log('  - Title:', group.title);
      console.log('  - Color:', group.color);
      return chrome.tabs.query({ groupId: group.id });
    })
    .then(tabs => {
      console.log('  - Tabs in group:', tabs.length);
      console.log('\n🎉 Session working! Check your tabs for a blue group.');
    })
    .catch(err => {
      console.error('❌ FAILED! Error:', err.message);
      console.error('   Stack:', err.stack);
    });
} else {
  console.error('❌ SessionManager not available!');
}
```

## 4. What to Look For

### SUCCESS looks like:
```
=== BTCP Session Debug Test ===
1. Chrome APIs:
  - chrome.tabs: object
  - chrome.tabGroups: object
  - chrome.windows: object

2. SessionManager:
  - SessionManager class: function

3. BackgroundAgent:
  - Agent exists: true
  - Has sessionManager: true

4. Current tabs:
  - Total tabs: 3
  - Active tabs: 1
  - Active tab ID: 123
  - Active tab URL: https://example.com/

5. Attempting to create session...
[SessionManager] createGroup called with options: {title: "Test Session"}
[SessionManager] No tabIds provided, getting active tab...
[SessionManager] Active tab: {id: 123, ...}
[SessionManager] Creating group with tabs: [123]
[SessionManager] Group created with ID: 456
[SessionManager] Group updated with title: Test Session
[SessionManager] Group info: {id: 456, title: "Test Session", ...}
✅ SUCCESS! Group created:
  - ID: 456
  - Title: Test Session
  - Color: blue
  - Tabs in group: 1

🎉 Session working! Check your tabs for a blue group.
```

### FAILURE might show:
```
❌ FAILED! Error: No active tab available to create session
```
**Fix:** Open a regular webpage (not chrome:// page)

```
  - chrome.tabGroups: undefined
```
**Fix:** Update Chrome to version 89+

```
❌ SessionManager not available!
```
**Fix:** Extension not built correctly, run: `npm run build`

## 5. Test from Popup

If background test works, test the popup:

1. Click extension icon
2. Right-click in popup → Inspect
3. In popup console, run:

```javascript
// Quick popup test
const client = createClient();
client.groupCreate({ title: 'Popup Test' })
  .then(result => console.log('✅ Popup works:', result))
  .catch(err => console.error('❌ Popup failed:', err));
```

## 6. Common Issues Found

### Issue: "Cannot group extension page tabs"
**Symptom:** Error when popup tries to group itself
**Solution:** Make sure the ACTIVE tab is a regular webpage, not the popup or chrome:// page

### Issue: "activeTab is undefined"
**Symptom:** No tab found to add to group
**Solution:**
1. Click on a regular webpage tab FIRST
2. THEN open the extension popup
3. Try creating session

### Issue: "chrome.tabGroups is not defined"
**Symptom:** API not available
**Solution:**
1. Check Chrome version: `chrome://version`
2. Needs Chrome 89 or higher
3. Update Chrome if needed

## 7. Next Steps Based on Results

**If Test 5 succeeds but popup fails:**
→ Check popup console for errors
→ Verify popup.js has client.groupCreate method
→ Check communication between popup and background

**If Test 5 fails with "No active tab":**
→ Open a website in a tab
→ Click on that tab (make it active)
→ Run test again

**If SessionManager not found:**
→ Rebuild: `npm run build` in project root
→ Rebuild: `npm run build` in examples/chrome-extension
→ Reload extension

**If everything works in test but not in UI:**
→ Check popup console for JavaScript errors
→ Verify button event listeners attached
→ Check if updateSessionUI() is being called
