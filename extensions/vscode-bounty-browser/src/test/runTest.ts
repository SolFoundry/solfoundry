/**
 * Test runner for the SolFoundry Bounty Browser extension.
 * Uses Node.js built-in test runner.
 */

import * as path from 'path';
import * as fs from 'fs';

/**
 * Discover and run all test files.
 * This is a simple test runner that loads and executes test modules.
 */
export function run(): Promise<void> {
  const testsRoot = path.resolve(__dirname, '..');

  return new Promise((resolve, reject) => {
    const testFiles: string[] = [];

    function discover(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          discover(fullPath);
        } else if (entry.name.endsWith('.test.js') && !entry.name.includes('runTest')) {
          testFiles.push(fullPath);
        }
      }
    }

    discover(testsRoot);

    if (testFiles.length === 0) {
      console.log('No test files found.');
      resolve();
      return;
    }

    console.log(`Found ${testFiles.length} test file(s):`);
    testFiles.forEach((f) => console.log(`  - ${path.relative(testsRoot, f)}`));

    // Load and run each test module
    let failures = 0;
    for (const file of testFiles) {
      try {
        // Clear module cache to allow re-running
        delete require.cache[require.resolve(file)];
        require(file);
      } catch (err) {
        console.error(`Error loading ${path.relative(testsRoot, file)}:`, err);
        failures++;
      }
    }

    if (failures > 0) {
      reject(new Error(`${failures} test file(s) failed to load.`));
    } else {
      resolve();
    }
  });
}
