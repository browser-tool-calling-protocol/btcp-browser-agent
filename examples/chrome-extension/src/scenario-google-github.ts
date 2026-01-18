/**
 * Google → GitHub → Star Scenario
 * AI Agent workflow demonstration that can be run from the popup
 */

import type { Client } from '../../../packages/extension/src/index.js';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface LogCallback {
  (message: string, type?: 'info' | 'success' | 'error' | 'warning'): void;
}

/**
 * Find an element in the snapshot tree based on criteria
 * Snapshot format: "- ROLE "label" [attributes] [@ref:N]"
 */
function findElement(tree: string, criteria: {
  role?: string;
  name?: string;
  nameContains?: string;
  type?: string;
}): string | null {
  const lines = tree.split('\n');

  for (const line of lines) {
    const refMatch = line.match(/@ref:(\d+)/);
    if (!refMatch) continue;

    const ref = `@ref:${refMatch[1]}`;
    let matches = true;

    // Match role (uppercase in snapshot: BUTTON, TEXTBOX, LINK, etc.)
    if (criteria.role) {
      const roleUpper = criteria.role.toUpperCase();
      if (!line.includes(roleUpper)) matches = false;
    }

    // Match exact name in quotes: "Search"
    if (criteria.name) {
      const namePattern = `"${criteria.name}"`;
      if (!line.includes(namePattern)) matches = false;
    }

    // Match name contains (case-insensitive)
    if (criteria.nameContains) {
      const quotedTextMatch = line.match(/"([^"]+)"/);
      if (!quotedTextMatch || !quotedTextMatch[1].toLowerCase().includes(criteria.nameContains.toLowerCase())) {
        matches = false;
      }
    }

    // Match type attribute: [type=search]
    if (criteria.type) {
      const typePattern = `type=${criteria.type}`;
      if (!line.includes(typePattern)) matches = false;
    }

    if (matches) return ref;
  }

  return null;
}

/**
 * Find first link containing specific domain
 * Looks for LINK role with domain in the line
 */
function findLinkByDomain(tree: string, domain: string): string | null {
  const lines = tree.split('\n');

  for (const line of lines) {
    // Check for LINK role (uppercase in snapshot)
    if (!line.includes("LINK")) continue;

    const refMatch = line.match(/@ref:(\d+)/);
    if (!refMatch) continue;

    // Check if domain appears anywhere in the line (case-insensitive)
    if (line.toLowerCase().includes(domain.toLowerCase())) {
      return `@ref:${refMatch[1]}`;
    }
  }

  return null;
}

/**
 * Run the Google → GitHub → Star scenario
 */
export async function runGoogleGithubScenario(client: Client, log: LogCallback): Promise<void> {
  const TOTAL_STEPS = 15;
  let currentStep = 0;

  try {
    // Step 1: Navigate to Google
    currentStep++;
    log(`[${currentStep}/${TOTAL_STEPS}] Navigating to Google...`, 'info');
    await client.navigate('https://www.google.com');
    log('✅ Loaded Google', 'success');
    await sleep(1500);

    // Step 2: Take snapshot
    currentStep++;
    log(`[${currentStep}/${TOTAL_STEPS}] 🤔 Taking snapshot to analyze page...`, 'info');
    const snapshot1 = await client.snapshot({ format: 'tree' });
    log(`✅ Found ${snapshot1.split('\n').length} elements`, 'success');
    log(`\n📸 SNAPSHOT (Google Homepage - first 30 lines):\n${snapshot1.split('\n').slice(0, 30).join('\n')}\n... (${snapshot1.split('\n').length - 30} more lines)`, 'info');
    await sleep(500);

    // Step 3: Find search input
    currentStep++;
    log(`[${currentStep}/${TOTAL_STEPS}] 🔍 Analyzing snapshot for search box...`, 'info');
    log(`💭 Thinking: Trying role=combobox first...`, 'info');
    let searchInput = findElement(snapshot1, { role: 'combobox' });
    if (!searchInput) {
      log(`💭 Thinking: Not found. Trying role=searchbox...`, 'info');
      searchInput = findElement(snapshot1, { role: 'searchbox' });
    }
    if (!searchInput) {
      log(`💭 Thinking: Not found. Trying textbox with "search" in name...`, 'info');
      searchInput = findElement(snapshot1, { role: 'textbox', nameContains: 'search' });
    }

    if (!searchInput) {
      throw new Error('Could not find search input');
    }
    log(`✅ Found search box: ${searchInput}`, 'success');
    await sleep(500);

    // Step 4: Type search query
    currentStep++;
    log(`[${currentStep}/${TOTAL_STEPS}] Typing "btcp-cowork"...`, 'info');
    await client.type(searchInput, 'btcp-cowork');
    log('✅ Query typed', 'success');
    await sleep(500);

    // Step 5: Submit search
    currentStep++;
    log(`[${currentStep}/${TOTAL_STEPS}] Submitting search...`, 'info');
    log(`💭 Thinking: Looking for Google Search button...`, 'info');

    // Look for the actual "Google Search" button
    const searchButton = findElement(snapshot1, { role: 'button', name: 'Google Search' });

    if (!searchButton) {
      log('⚠️ Google Search button not found, trying Enter key...', 'warning');
      // Click the search input first to ensure focus
      await client.click(searchInput);
      await sleep(300);
      await client.execute({
        id: crypto.randomUUID(),
        action: 'press',
        key: 'Enter',
      });
    } else {
      log(`💭 Thinking: Found button ${searchButton}, clicking it...`, 'info');
      await client.click(searchButton);
    }
    log('✅ Search submitted', 'success');
    await sleep(3000); // Increased wait time for results to load

    // Step 6: Wait and verify results loaded
    currentStep++;
    log(`[${currentStep}/${TOTAL_STEPS}] Checking results page...`, 'info');
    const currentUrl = await client.getUrl();
    if (!currentUrl.includes('google.com/search')) {
      log('⚠️ URL may not be results page', 'warning');
    } else {
      log('✅ On results page', 'success');
    }
    await sleep(1000);

    // Step 7: Take snapshot of results
    currentStep++;
    log(`[${currentStep}/${TOTAL_STEPS}] 🤔 Taking snapshot of search results...`, 'info');
    const snapshot2 = await client.snapshot({ format: 'tree' });
    log(`✅ Found ${snapshot2.split('\n').length} elements`, 'success');

    // Show links found in snapshot
    const linkLines = snapshot2.split('\n').filter(line => line.includes('LINK') && line.includes('@ref:'));
    log(`\n📸 SNAPSHOT (Links found - first 10):\n${linkLines.slice(0, 10).join('\n')}`, 'info');
    await sleep(500);

    // Step 8: Find GitHub/BTCP link
    currentStep++;
    log(`[${currentStep}/${TOTAL_STEPS}] 🔍 Searching for BTCP repository link...`, 'info');
    log(`💭 Thinking: Scanning ${linkLines.length} links...`, 'info');

    // Try to find browser-tool-calling-protocol link first
    let githubLink = findLinkByDomain(snapshot2, 'browser-tool-calling-protocol');

    if (!githubLink) {
      log(`💭 Thinking: No BTCP link found, trying github.com...`, 'info');
      githubLink = findLinkByDomain(snapshot2, 'github.com');
    }

    if (!githubLink) {
      // Fallback: try to find first search result (skip navigation links)
      log(`💭 Thinking: Trying first search result...`, 'info');
      const lines = snapshot2.split('\n');
      for (const line of lines) {
        // Skip navigation links (Images, Videos, News, etc.)
        if (line.includes('LINK') && !line.includes('Images') && !line.includes('Videos') &&
            !line.includes('News') && !line.includes('Shopping') && !line.includes('AI Mode')) {
          const refMatch = line.match(/@ref:(\d+)/);
          if (refMatch && parseInt(refMatch[1]) >= 18) { // Start from ref:18 which is first result
            githubLink = `@ref:${refMatch[1]}`;
            log(`💭 Thinking: Found first result: ${line.substring(0, 80)}...`, 'info');
            break;
          }
        }
      }
    }

    if (!githubLink) {
      throw new Error('No GitHub links found in results');
    }
    log(`✅ Found link: ${githubLink}`, 'success');
    await sleep(500);

    // Step 9: Click GitHub link
    currentStep++;
    log(`[${currentStep}/${TOTAL_STEPS}] Navigating to GitHub...`, 'info');
    await client.click(githubLink);
    log('✅ Clicked link', 'success');
    await sleep(3000);

    // Step 10: Verify on GitHub
    currentStep++;
    log(`[${currentStep}/${TOTAL_STEPS}] Verifying GitHub page...`, 'info');
    const githubUrl = await client.getUrl();
    if (!githubUrl.includes('github.com')) {
      log('⚠️ May not be on GitHub', 'warning');
    } else {
      log('✅ On GitHub repository page', 'success');
    }
    await sleep(1000);

    // Step 11: Initial encounter & assessment
    currentStep++;
    log(`[${currentStep}/${TOTAL_STEPS}] 🤔 Taking snapshot to understand page structure...`, 'info');
    const snapshot3 = await client.snapshot({ format: 'tree' });
    const totalLines = snapshot3.split('\n').length;
    const snapshotHeader = snapshot3.split('\n').find(line => line.startsWith('SNAPSHOT:')) || '';
    const refsMatch = snapshotHeader.match(/refs=(\d+)/);
    const totalRefs = refsMatch ? parseInt(refsMatch[1]) : 0;

    log(`📸 Snapshot captured: ${totalLines} lines, ${totalRefs} interactive elements`, 'success');
    log(`💭 Thinking: This is a large page - processing all ${totalRefs} elements would be inefficient`, 'info');
    log(`💭 Thinking: Strategy: Preview first 100 lines to understand page structure`, 'info');

    const preview = snapshot3.split('\n').slice(0, 100).join('\n');
    log(`\n📸 PREVIEW (first 100 lines):\n${preview}`, 'info');
    await sleep(1000);

    // Step 12: Strategic analysis
    currentStep++;
    log(`[${currentStep}/${TOTAL_STEPS}] 🧠 Analyzing preview for patterns...`, 'info');
    log(`💭 Thinking: I see BUTTON elements, LINK elements, navigation structure`, 'info');
    log(`💭 Thinking: My goal: Find star button`, 'info');
    log(`💭 Thinking: Question: Does "star" appear in the preview?`, 'info');

    const hasStarInPreview = preview.toLowerCase().includes('star');
    if (hasStarInPreview) {
      log(`💭 Thinking: Result: Yes, star references found in preview`, 'success');
    } else {
      log(`💭 Thinking: Result: No star in preview - need to search full page`, 'info');
    }
    await sleep(500);

    // Step 13: Formulate filtering strategy
    currentStep++;
    log(`[${currentStep}/${TOTAL_STEPS}] 🎯 Decision point - How to narrow down to star button?`, 'info');
    log(`💭 Thinking: Option A: Use grep filter for "star" keyword → Fast, targeted`, 'info');
    log(`💭 Thinking: Option B: Use role=button filter → Gets all buttons, still large`, 'info');
    log(`💭 Thinking: Option C: Combine filters: grep="star" + analyze results`, 'info');
    log(`💭 Thinking: Choosing Option A: grep filter is most efficient`, 'success');
    log(`💭 Thinking: Executing: snapshot({ grep: { pattern: 'star', ignoreCase: true } })`, 'info');
    await sleep(500);

    // Step 14: Execute filtered snapshot
    currentStep++;
    log(`[${currentStep}/${TOTAL_STEPS}] 🔍 Taking filtered snapshot with grep="star"...`, 'info');
    const filteredSnapshot = await client.snapshot({
      format: 'tree',
      grep: { pattern: 'star', ignoreCase: true }
    });

    const filteredLines = filteredSnapshot.split('\n').filter(line => line.includes('@ref:'));
    log(`✅ Filtered snapshot: ${filteredLines.length} matching elements (reduced from ${totalRefs} refs)`, 'success');
    log(`\n📸 FILTERED RESULTS:\n${filteredLines.join('\n')}`, 'info');
    await sleep(1000);

    // Step 15: Intelligent element selection
    currentStep++;
    log(`[${currentStep}/${TOTAL_STEPS}] 🧩 Analyzing filtered results...`, 'info');
    log(`💭 Thinking: The grep filter returned ${filteredLines.length} elements with "star"`, 'info');
    log(`💭 Thinking: Now I need to identify which one is the star action button`, 'info');

    // Analyze what grep returned - purely use the filtered snapshot
    log(`💭 Thinking: Examining each filtered element:`, 'info');
    for (const line of filteredLines.slice(0, 5)) {
      log(`  ${line}`, 'info');
    }
    if (filteredLines.length > 5) {
      log(`  ... and ${filteredLines.length - 5} more`, 'info');
    }

    // Use findElement helper on the already-filtered snapshot
    log(`💭 Thinking: Using findElement to locate button with "star" in name`, 'info');
    let starButton = findElement(filteredSnapshot, { role: 'button', nameContains: 'star' });

    // Check if we found "Unstar" instead (means already starred)
    const hasUnstar = filteredSnapshot.toLowerCase().includes('"unstar"');

    if (hasUnstar) {
      log(`💭 Thinking: Found "Unstar" button → repo already starred`, 'info');
      log(`⚠️ Repository already starred (Unstar button present)`, 'warning');
      log(`ℹ️ Scenario completed - repo is already starred`, 'info');
      starButton = findElement(filteredSnapshot, { role: 'button', nameContains: 'unstar' });
    } else if (starButton) {
      log(`💭 Thinking: Found "Star" button → need to click it to star`, 'success');
      log(`💭 Thinking: Decision: Click ${starButton} "Star" button`, 'success');
    }

    if (!starButton) {
      log('⚠️ Could not find star button (may need login)', 'warning');
      log('ℹ️ Scenario completed up to GitHub navigation', 'info');
      return;
    }

    log(`✅ Selected element: ${starButton}`, 'success');
    await sleep(500);

    // Step 16: Execute action (only if not already starred)
    if (!hasUnstar) {
      currentStep++;
      log(`[${currentStep}/${TOTAL_STEPS}] 🎯 Clicking star button...`, 'info');
      await client.click(starButton);
      log('✅ Star button clicked', 'success');
      log('⏳ Waiting for UI update...', 'info');
      await sleep(2000);
    } else {
      currentStep++;
      log(`[${currentStep}/${TOTAL_STEPS}] ⏭️ Skipping star action (already starred)`, 'info');
    }

    // Step 17: Verification
    currentStep++;
    log(`[${currentStep}/${TOTAL_STEPS}] 🔍 Verifying action succeeded...`, 'info');
    log(`💭 Thinking: Taking verification snapshot with grep="star"...`, 'info');

    const finalUrl = await client.getUrl();
    if (finalUrl.includes('login')) {
      log('⚠️ Redirected to login - authentication required', 'warning');
      log('ℹ️ In production, agent would handle OAuth flow', 'info');
    } else {
      const verifySnapshot = await client.snapshot({
        format: 'tree',
        grep: { pattern: 'star', ignoreCase: true }
      });

      const hasUnstar = verifySnapshot.toLowerCase().includes('"unstar"');
      log(`💭 Thinking: Checking if "Unstar" now appears (indicates starring succeeded)`, 'info');

      if (hasUnstar) {
        log('✅ Success! Button changed from "Star" to "Unstar"', 'success');
        log('🎉 Repository successfully starred!', 'success');
      } else {
        log('✅ Star action completed', 'success');
      }
    }

    currentStep++;
    log(`[${currentStep}/${TOTAL_STEPS}] ✨ Scenario complete!`, 'success');
    log('───────────────────────────', 'info');
    log('Summary:', 'info');
    log('• Searched Google for "btcp-cowork"', 'info');
    log('• Found and clicked GitHub link', 'info');
    log('• Navigated to repository', 'info');
    log('• Attempted to star repository', 'info');
    log('───────────────────────────', 'info');

  } catch (error) {
    log(`❌ Scenario failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
    throw error;
  }
}
