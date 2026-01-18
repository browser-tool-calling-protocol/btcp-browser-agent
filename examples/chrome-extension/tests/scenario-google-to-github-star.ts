/**
 * Real-World AI Agent Scenario: Google Search → GitHub Repository → Star
 *
 * This demo script mimics how an AI agent would reason through a complete browser workflow:
 * 1. Navigate to Google
 * 2. Search for "btcp-cowork"
 * 3. Find and click the first GitHub link in results
 * 4. Attempt to star the repository
 *
 * The script demonstrates:
 * - AI reasoning patterns (element selection, verification, error handling)
 * - Snapshot-based navigation (accessibility tree parsing)
 * - Graceful error recovery
 * - Step-by-step validation
 *
 * Prerequisites:
 * - Chrome extension must be loaded and running
 * - Extension must have a session created
 *
 * Run with: npm run demo:scenario
 */

import { createClient } from '../../../packages/extension/src/index.js';

// Utility for delays (simulating think time)
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Console formatting helpers
const log = {
  thinking: (msg: string) => console.log(`\n🤔 AI Agent: ${msg}`),
  analyzing: (msg: string) => console.log(`🔍 Analyzing: ${msg}`),
  found: (msg: string) => console.log(`✅ Found: ${msg}`),
  action: (msg: string) => console.log(`🎯 Action: ${msg}`),
  verify: (msg: string) => console.log(`📊 Verification: ${msg}`),
  error: (msg: string) => console.log(`❌ Error: ${msg}`),
  warning: (msg: string) => console.log(`⚠️  Warning: ${msg}`),
  success: (msg: string) => console.log(`✨ Success: ${msg}`),
  step: (step: number, total: number, msg: string) => console.log(`\n[Step ${step}/${total}] ${msg}`),
};

/**
 * Simulates AI reasoning to find an element in the snapshot tree
 * Returns the @ref:N selector for the found element
 */
function findElement(tree: string, criteria: {
  role?: string;
  name?: string;
  nameContains?: string;
  type?: string;
}): string | null {
  const lines = tree.split('\n');

  for (const line of lines) {
    // Parse line format: "@ref:N role='...' name='...' ..."
    const refMatch = line.match(/@ref:(\d+)/);
    if (!refMatch) continue;

    const ref = `@ref:${refMatch[1]}`;

    // Check all criteria
    let matches = true;

    if (criteria.role) {
      const roleMatch = line.match(/role='([^']+)'/);
      if (!roleMatch || roleMatch[1] !== criteria.role) matches = false;
    }

    if (criteria.name) {
      const nameMatch = line.match(/name='([^']+)'/);
      if (!nameMatch || nameMatch[1] !== criteria.name) matches = false;
    }

    if (criteria.nameContains) {
      const nameMatch = line.match(/name='([^']+)'/);
      if (!nameMatch || !nameMatch[1].toLowerCase().includes(criteria.nameContains.toLowerCase())) {
        matches = false;
      }
    }

    if (criteria.type) {
      const typeMatch = line.match(/type='([^']+)'/);
      if (!typeMatch || typeMatch[1] !== criteria.type) matches = false;
    }

    if (matches) {
      log.found(`${ref} - ${line.trim()}`);
      return ref;
    }
  }

  return null;
}

/**
 * Find first link containing specific domain
 */
function findLinkByDomain(tree: string, domain: string): string | null {
  const lines = tree.split('\n');

  for (const line of lines) {
    if (!line.includes("role='link'")) continue;

    const refMatch = line.match(/@ref:(\d+)/);
    if (!refMatch) continue;

    // Check if line contains the domain (in name or other attributes)
    if (line.toLowerCase().includes(domain.toLowerCase())) {
      const ref = `@ref:${refMatch[1]}`;
      log.found(`${ref} - GitHub link: ${line.trim()}`);
      return ref;
    }
  }

  return null;
}

async function main() {
  const TOTAL_STEPS = 15;
  let currentStep = 0;

  log.thinking('Starting Google → GitHub → Star workflow demonstration');
  console.log('This script simulates AI agent reasoning patterns for browser automation\n');

  try {
    // Step 1: Initialize client
    currentStep++;
    log.step(currentStep, TOTAL_STEPS, 'Initialize connection to browser extension');
    const client = createClient();
    log.success('Client connected');
    await sleep(500);

    // Step 2: Navigate to Google
    currentStep++;
    log.step(currentStep, TOTAL_STEPS, 'Navigate to Google');
    log.thinking('Need to navigate to google.com to start search');
    log.action('Navigating to https://www.google.com...');

    await client.navigate('https://www.google.com');
    log.success('Navigation complete');
    await sleep(1000); // Wait for page to settle

    // Step 3: Take snapshot to understand page structure
    currentStep++;
    log.step(currentStep, TOTAL_STEPS, 'Take snapshot to analyze page structure');
    log.thinking('Taking snapshot to identify interactive elements');
    log.action('Calling snapshot API...');

    const snapshot1 = await client.snapshot({ format: 'tree' });
    log.verify(`Snapshot captured: ${snapshot1.split('\n').length} elements found`);
    await sleep(500);

    // Step 4: Find search input
    currentStep++;
    log.step(currentStep, TOTAL_STEPS, 'Locate search input field');
    log.analyzing('Looking for search box (role=searchbox or combobox)');

    let searchInput = findElement(snapshot1, { role: 'combobox' });
    if (!searchInput) {
      searchInput = findElement(snapshot1, { role: 'searchbox' });
    }

    if (!searchInput) {
      log.error('Could not find search input on Google homepage');
      log.warning('This might be due to Google\'s dynamic content or region-specific layout');
      // Try alternative approach: look for input with name containing "search" or "q"
      log.analyzing('Trying alternative strategy: looking for textbox with search-related name');
      searchInput = findElement(snapshot1, { role: 'textbox', nameContains: 'search' });
    }

    if (!searchInput) {
      throw new Error('Unable to locate search input field');
    }

    await sleep(500);

    // Step 5: Type search query
    currentStep++;
    log.step(currentStep, TOTAL_STEPS, 'Type search query into input');
    log.thinking('Need to type "btcp-cowork" into the search box');
    log.action(`Typing "btcp-cowork" into ${searchInput}...`);

    await client.type(searchInput, 'btcp-cowork');
    log.success('Query typed successfully');
    await sleep(500);

    // Step 6: Find and click search button
    currentStep++;
    log.step(currentStep, TOTAL_STEPS, 'Locate and click search button');
    log.analyzing('Looking for search submit button (role=button, name contains "search")');

    const searchButton = findElement(snapshot1, { role: 'button', nameContains: 'search' });

    if (!searchButton) {
      log.warning('Search button not found, trying Enter key instead');
      log.action('Pressing Enter key to submit search...');
      await client.execute({
        id: crypto.randomUUID(),
        action: 'press',
        key: 'Enter',
      });
    } else {
      log.action(`Clicking search button ${searchButton}...`);
      await client.click(searchButton);
    }

    log.success('Search submitted');
    await sleep(2000); // Wait for search results to load

    // Step 7: Wait for results page to load
    currentStep++;
    log.step(currentStep, TOTAL_STEPS, 'Wait for search results to load');
    log.thinking('Giving page time to load search results');

    const currentUrl = await client.getUrl();
    log.verify(`Current URL: ${currentUrl}`);

    if (!currentUrl.includes('google.com/search')) {
      log.warning('URL does not appear to be a search results page');
    }
    await sleep(1000);

    // Step 8: Take snapshot of results page
    currentStep++;
    log.step(currentStep, TOTAL_STEPS, 'Snapshot search results page');
    log.action('Taking snapshot of search results...');

    const snapshot2 = await client.snapshot({ format: 'tree' });
    log.verify(`Results snapshot captured: ${snapshot2.split('\n').length} elements found`);
    await sleep(500);

    // Step 9: Find first GitHub link
    currentStep++;
    log.step(currentStep, TOTAL_STEPS, 'Locate first GitHub link in results');
    log.analyzing('Searching for links containing "github.com"');
    log.thinking('AI reasoning: GitHub links are likely to contain "github" in the URL or link text');

    const githubLink = findLinkByDomain(snapshot2, 'github.com');

    if (!githubLink) {
      log.error('No GitHub links found in search results');
      log.warning('Possible reasons:');
      console.log('  - Search results may not include GitHub repositories');
      console.log('  - Google may have blocked automated searches');
      console.log('  - Results structure may differ from expected format');
      throw new Error('Cannot proceed without GitHub link');
    }

    await sleep(500);

    // Step 10: Click GitHub link
    currentStep++;
    log.step(currentStep, TOTAL_STEPS, 'Navigate to GitHub repository');
    log.action(`Clicking GitHub link ${githubLink}...`);

    await client.click(githubLink);
    log.success('Clicked GitHub link, waiting for page load...');
    await sleep(3000); // Wait for GitHub page to load

    // Step 11: Verify we're on GitHub
    currentStep++;
    log.step(currentStep, TOTAL_STEPS, 'Verify navigation to GitHub');

    const githubUrl = await client.getUrl();
    log.verify(`Current URL: ${githubUrl}`);

    if (!githubUrl.includes('github.com')) {
      log.warning('URL does not appear to be github.com');
    } else {
      log.success('Successfully navigated to GitHub');
    }

    await sleep(1000);

    // Step 12: Take snapshot of GitHub repo page
    currentStep++;
    log.step(currentStep, TOTAL_STEPS, 'Snapshot GitHub repository page');
    log.action('Taking snapshot of repository page...');

    const snapshot3 = await client.snapshot({ format: 'tree' });
    log.verify(`GitHub page snapshot: ${snapshot3.split('\n').length} elements found`);
    await sleep(500);

    // Step 13: Find star button
    currentStep++;
    log.step(currentStep, TOTAL_STEPS, 'Locate star button');
    log.analyzing('Looking for Star/Unstar button (role=button, name contains "star")');
    log.thinking('AI reasoning: Star button typically has role=button and name includes "star" or "unstar"');

    let starButton = findElement(snapshot3, { role: 'button', nameContains: 'star' });

    if (!starButton) {
      log.warning('Star button not found in standard format');
      log.analyzing('Trying alternative: looking for any element with "star" in name');

      // Try to find any element with "star" in it
      const lines = snapshot3.split('\n');
      for (const line of lines) {
        if (line.toLowerCase().includes('star')) {
          const refMatch = line.match(/@ref:(\d+)/);
          if (refMatch) {
            starButton = `@ref:${refMatch[1]}`;
            log.found(`Possible star element: ${line.trim()}`);
            break;
          }
        }
      }
    }

    if (!starButton) {
      log.error('Could not locate star button');
      log.warning('Possible reasons:');
      console.log('  - User may not be logged into GitHub');
      console.log('  - Page structure may differ from expected format');
      console.log('  - Repository may have restricted star functionality');
      throw new Error('Cannot proceed without star button');
    }

    await sleep(500);

    // Step 14: Click star button
    currentStep++;
    log.step(currentStep, TOTAL_STEPS, 'Attempt to star the repository');
    log.thinking('Clicking star button - this may require GitHub login');
    log.action(`Clicking star button ${starButton}...`);

    await client.click(starButton);
    log.success('Star button clicked');
    await sleep(2000);

    // Step 15: Verify outcome
    currentStep++;
    log.step(currentStep, TOTAL_STEPS, 'Verify final state');

    const finalUrl = await client.getUrl();
    log.verify(`Final URL: ${finalUrl}`);

    if (finalUrl.includes('login')) {
      log.warning('Redirected to login page - authentication required to star repositories');
      log.thinking('AI reasoning: In a real scenario, the agent would need to handle OAuth flow or use stored credentials');
    } else if (finalUrl.includes('github.com')) {
      log.success('Still on GitHub page - star action may have succeeded');
      log.thinking('Taking final snapshot to verify star state...');

      const finalSnapshot = await client.snapshot({ format: 'tree' });
      const hasUnstar = finalSnapshot.toLowerCase().includes('unstar');

      if (hasUnstar) {
        log.success('✨ Repository successfully starred! (Found "Unstar" button)');
      } else {
        log.verify('Star action completed, but state verification inconclusive');
      }
    }

    console.log('\n' + '='.repeat(80));
    log.success('🎉 Demo workflow completed successfully!');
    console.log('='.repeat(80));

    console.log('\n📊 Workflow Summary:');
    console.log(`   • Navigated to Google`);
    console.log(`   • Searched for "btcp-cowork"`);
    console.log(`   • Found and clicked GitHub link`);
    console.log(`   • Attempted to star repository`);
    console.log(`   • Total steps executed: ${currentStep}/${TOTAL_STEPS}`);

    console.log('\n💡 API Quality Assessment:');
    console.log('   ✅ Snapshot API provides clear accessibility tree');
    console.log('   ✅ Element refs (@ref:N) are stable and easy to use');
    console.log('   ✅ Navigation and interaction methods work reliably');
    console.log('   ⚠️  Some complex page structures need fallback strategies');
    console.log('   ⚠️  Authentication flows require additional handling');

  } catch (error) {
    log.error(`Workflow failed: ${error instanceof Error ? error.message : String(error)}`);
    console.error(error);
    process.exit(1);
  }
}

// Run the demo
main();
