/**
 * Test script to verify that .* wildcard pattern works correctly
 * This demonstrates the issue you reported and confirms it's fixed
 */

import { JSDOM } from 'jsdom';
import { createSnapshot, createRefMap } from './packages/core/dist/index.js';

// Create a simple HTML page
const html = `
<!DOCTYPE html>
<html>
<body>
  <button>Submit</button>
  <button>Cancel</button>
  <a href="/home">Home</a>
  <input type="text" placeholder="Email">
</body>
</html>
`;

const dom = new JSDOM(html);
const { document, window } = dom.window;

// Make window global for the snapshot code
global.window = window;

console.log('Testing .* wildcard pattern...\n');

// Test 1: Plain .* should match everything
console.log('Test 1: Plain .* pattern');
console.log('='.repeat(50));
const refMap1 = createRefMap();
const snapshot1 = createSnapshot(document, refMap1, { grep: '.*' });
console.log(snapshot1.tree);
console.log('\n');

// Test 2: No grep filter for comparison
console.log('Test 2: No grep filter (for comparison)');
console.log('='.repeat(50));
const refMap2 = createRefMap();
const snapshot2 = createSnapshot(document, refMap2);
console.log(snapshot2.tree);
console.log('\n');

// Test 3: Specific pattern
console.log('Test 3: Pattern "BUTTON.*" ');
console.log('='.repeat(50));
const refMap3 = createRefMap();
const snapshot3 = createSnapshot(document, refMap3, { grep: 'BUTTON.*' });
console.log(snapshot3.tree);
console.log('\n');

// Verify results
const snapshot1Lines = snapshot1.tree.split('\n').filter(line => line.includes('@ref:'));
const snapshot2Lines = snapshot2.tree.split('\n').filter(line => line.includes('@ref:'));

console.log('Results:');
console.log('='.repeat(50));
console.log(`With .* grep: ${snapshot1Lines.length} elements`);
console.log(`Without grep: ${snapshot2Lines.length} elements`);

if (snapshot1Lines.length === snapshot2Lines.length) {
  console.log('\n✅ SUCCESS: .* pattern matches all elements as expected!');
} else {
  console.log('\n❌ FAILURE: .* pattern does not match all elements!');
  console.log(`Expected ${snapshot2Lines.length}, got ${snapshot1Lines.length}`);
}
