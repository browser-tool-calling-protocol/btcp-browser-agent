# Chrome Extension Scenario Tests

This directory contains demonstration scripts that showcase how AI agents would interact with the BTCP Browser Agent API in real-world scenarios.

## Available Scenarios

### 1. Google Search → GitHub Star (`scenario-google-to-github-star.ts`)

A complete workflow demonstrating AI agent reasoning patterns:

**Workflow:**
1. Navigate to Google
2. Search for "btcp-cowork"
3. Find and click the first GitHub link in results
4. Navigate to the repository
5. Attempt to star the repository

**What it demonstrates:**
- AI reasoning simulation with detailed logging
- Snapshot-based page understanding
- Element selection strategies using accessibility tree
- Error recovery with fallback approaches
- Multi-step navigation and validation
- Authentication gate detection

## Running the Scenarios

### Prerequisites

1. **Install Dependencies**
   ```bash
   cd examples/chrome-extension
   npm install
   ```

2. **Build the Extension**
   ```bash
   npm run build
   ```

3. **Load Extension in Chrome**
   - Open Chrome and navigate to `chrome://extensions`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `examples/chrome-extension/dist/` directory

4. **Create a Session**
   - Click the extension icon in Chrome toolbar
   - Click "Start Session" button
   - A new tab group will be created

### Running the Demo

With the extension loaded and a session active:

```bash
cd examples/chrome-extension
npm run demo:scenario
```

### Expected Output

The script will output detailed logs showing AI reasoning at each step:

```
🤔 AI Agent: Starting Google → GitHub → Star workflow demonstration

[Step 1/15] Initialize connection to browser extension
✨ Success: Client connected

[Step 2/15] Navigate to Google
🤔 AI Agent: Need to navigate to google.com to start search
🎯 Action: Navigating to https://www.google.com...
✅ Navigation complete

[Step 3/15] Take snapshot to analyze page structure
🤔 AI Agent: Taking snapshot to identify interactive elements
🎯 Action: Calling snapshot API...
📊 Verification: Snapshot captured: 156 elements found

[Step 4/15] Locate search input field
🔍 Analyzing: Looking for search box (role=searchbox or combobox)
✅ Found: @ref:12 - role='combobox' name='Search'

...
```

## Understanding the Output

The demo uses emoji prefixes to indicate different types of information:

- 🤔 **Thinking**: AI agent's reasoning process
- 🔍 **Analyzing**: Element search criteria
- ✅ **Found**: Successfully located element
- 🎯 **Action**: Executing a command
- 📊 **Verification**: Validating results
- ❌ **Error**: Something went wrong
- ⚠️ **Warning**: Non-critical issue or fallback triggered
- ✨ **Success**: Step completed successfully

## Common Issues

### "Could not find search input"

Google's page structure varies by region and personalization. The script includes fallback strategies, but may need adjustment for your specific Google layout.

**Solution**: The script will try multiple approaches automatically. Check the logs to see which strategy worked.

### "No GitHub links found in search results"

This can happen if:
- Google blocks automated searches
- Search results don't include GitHub repositories
- Results are personalized differently

**Solution**: Try running the script again, or manually verify that searching "btcp-cowork" on Google returns GitHub results.

### "Redirected to login page"

GitHub requires authentication to star repositories.

**Solution**: This is expected behavior. The script will detect the login redirect and explain the situation. In a real AI agent, this would trigger an OAuth flow or use stored credentials.

### "Error: connect ECONNREFUSED"

The extension is not running or no session is active.

**Solution**:
1. Verify the extension is loaded in Chrome
2. Click the extension icon
3. Click "Start Session"
4. Run the script again

## API Quality Insights

This scenario helps evaluate the BTCP API for AI agent use cases:

### Strengths
✅ **Clear accessibility tree**: Snapshot provides semantic element information
✅ **Stable references**: `@ref:N` selectors work reliably within a session
✅ **Simple API**: Navigation and interaction methods are intuitive
✅ **Error messages**: Informative feedback when operations fail

### Areas for Improvement
⚠️ **Complex pages**: Some dynamic content needs multiple snapshot strategies
⚠️ **Authentication**: OAuth flows require additional handling
⚠️ **Timing**: Some actions need explicit wait times (could use smart waiting)
⚠️ **Ref invalidation**: References become stale after navigation (expected, but needs handling)

## Writing Your Own Scenarios

To create a new scenario test:

1. **Create a new file** in this directory (e.g., `scenario-form-filling.ts`)

2. **Import the client**:
   ```typescript
   import { createClient } from '../../../packages/extension/src/index.js';
   ```

3. **Structure your workflow**:
   ```typescript
   async function main() {
     const client = createClient();

     // Step 1: Navigate
     await client.navigate('https://example.com');

     // Step 2: Understand page
     const snapshot = await client.snapshot({ format: 'tree' });

     // Step 3: Find and interact with elements
     const button = findElement(snapshot.tree, { role: 'button', name: 'Submit' });
     await client.click(button);

     // Step 4: Verify outcome
     const newUrl = await client.getUrl();
     console.log('Success:', newUrl.includes('success'));
   }

   main();
   ```

4. **Add logging** to show AI reasoning at each step

5. **Add to package.json**:
   ```json
   "scripts": {
     "demo:your-scenario": "tsx tests/scenario-your-name.ts"
   }
   ```

## Contributing

When adding new scenarios, please:
- Include detailed AI reasoning logs
- Handle errors gracefully with fallbacks
- Document what the scenario tests/demonstrates
- Update this README with usage instructions
- Consider edge cases and authentication requirements

## Further Reading

- [BTCP API Documentation](../../CLAUDE.md)
- [Extension Architecture](../../../packages/extension/README.md)
- [Core Actions Reference](../../../packages/core/README.md)
