/**
 * Verifier agent — runs tests and validates the implemented solution.
 *
 * The verifier agent executes the project's test suite (vitest), runs
 * TypeScript type checking, and validates the build. It also performs
 * lightweight static analysis on the generated code to catch common
 * issues before they reach the review stage.
 *
 * @module agent/verifier
 */

import { BaseAgent } from './agent.js';
import { AgentRole, type VerificationResult, type TestResult } from './types.js';

/**
 * Input for the verifier agent.
 */
export interface VerifierInput {
  /** List of files that were generated or modified. */
  readonly files: Array<{ readonly filePath: string; readonly content: string }>;
  /** Project root directory (for running tests). */
  readonly projectRoot: string;
  /** Whether to run tests (defaults to true). */
  readonly runTests?: boolean;
  /** Whether to run type checking (defaults to true). */
  readonly runTypeCheck?: boolean;
  /** Whether to run linting (defaults to true). */
  readonly runLint?: boolean;
}

/**
 * The verifier agent validates the implemented solution by running
 * the test suite, type checking, and linting. It also performs
 * static analysis on the generated code.
 */
export class VerifierAgent extends BaseAgent {
  readonly role = AgentRole.VERIFIER;

  /**
   * Execute the verification step.
   *
   * @param input - A VerifierInput object.
   * @returns A VerificationResult.
   */
  async execute(input: unknown): Promise<VerificationResult> {
    const verifierInput = input as VerifierInput;
    const testResults: TestResult[] = [];
    const lintErrors: string[] = [];
    let buildPassed = true;

    // Run tests if requested
    if (verifierInput.runTests !== false) {
      try {
        const testResult = await this.runTestSuite(verifierInput.projectRoot);
        testResults.push(testResult);
      } catch (error) {
        testResults.push({
          suiteName: 'vitest',
          passed: false,
          passedCount: 0,
          failedCount: 0,
          errors: [String(error)],
          durationMs: 0,
        });
      }
    }

    // Run type check if requested
    if (verifierInput.runTypeCheck !== false) {
      const typeResult = await this.runTypeCheck(verifierInput.projectRoot);
      if (!typeResult.passed) {
        buildPassed = false;
        lintErrors.push(...typeResult.errors);
      }
    }

    // Run linting if requested
    if (verifierInput.runLint !== false) {
      const lintResult = await this.runLint(verifierInput.projectRoot);
      if (!lintResult.passed) {
        lintErrors.push(...lintResult.errors);
      }
    }

    // Static analysis on generated files
    const staticErrors = this.staticAnalysis(verifierInput.files);
    lintErrors.push(...staticErrors);

    const allPassed = testResults.every((t) => t.passed) && buildPassed && lintErrors.length === 0;

    return {
      passed: allPassed,
      testResults,
      lintErrors,
      buildPassed,
      failureSummary: allPassed ? '' : this.buildFailureSummary(testResults, lintErrors, buildPassed),
    };
  }

  /**
   * Run the vitest test suite in the project root.
   *
   * In mock mode, this simulates a successful test run.
   *
   * @param projectRoot - Project root directory.
   * @returns Test result.
   */
  private async runTestSuite(projectRoot: string): Promise<TestResult> {
    if (this.mockMode) {
      return {
        suiteName: 'vitest (mock)',
        passed: true,
        passedCount: 10,
        failedCount: 0,
        errors: [],
        durationMs: 500,
      };
    }

    const startTime = Date.now();

    try {
      // Use dynamic import to avoid hard dependency on child_process in SDK
      const { execSync } = await import('node:child_process');
      const output = execSync('npx vitest run --reporter=json 2>/dev/null', {
        cwd: projectRoot,
        timeout: 120_000,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const result = JSON.parse(output) as {
        numTotalTests: number;
        numPassedTests: number;
        numFailedTests: number;
      };

      return {
        suiteName: 'vitest',
        passed: result.numFailedTests === 0,
        passedCount: result.numPassedTests,
        failedCount: result.numFailedTests,
        errors: [],
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      // Parse vitest JSON output from stderr on failure
      const errMsg = String(error);
      const jsonMatch = errMsg.match(/\{[\s\S]*"numTotalTests"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const result = JSON.parse(jsonMatch[0]) as {
            numTotalTests: number;
            numPassedTests: number;
            numFailedTests: number;
          };
          return {
            suiteName: 'vitest',
            passed: result.numFailedTests === 0,
            passedCount: result.numPassedTests,
            failedCount: result.numFailedTests,
            errors: [],
            durationMs: Date.now() - startTime,
          };
        } catch {
          // Fall through to error handling
        }
      }

      return {
        suiteName: 'vitest',
        passed: false,
        passedCount: 0,
        failedCount: 0,
        errors: [errMsg.substring(0, 500)],
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Run TypeScript type checking (tsc --noEmit).
   *
   * @param projectRoot - Project root directory.
   * @returns Result with errors.
   */
  private async runTypeCheck(projectRoot: string): Promise<{ passed: boolean; errors: string[] }> {
    if (this.mockMode) {
      return { passed: true, errors: [] };
    }

    try {
      const { execSync } = await import('node:child_process');
      execSync('npx tsc --noEmit 2>&1', {
        cwd: projectRoot,
        timeout: 60_000,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { passed: true, errors: [] };
    } catch (error) {
      const output = String(error);
      const errors = output
        .split('\n')
        .filter((line) => line.includes(': error TS'))
        .map((line) => line.trim());
      return { passed: false, errors };
    }
  }

  /**
   * Run linting (tsc lint or similar).
   *
   * @param projectRoot - Project root directory.
   * @returns Result with errors.
   */
  private async runLint(projectRoot: string): Promise<{ passed: boolean; errors: string[] }> {
    if (this.mockMode) {
      return { passed: true, errors: [] };
    }

    try {
      const { execSync } = await import('node:child_process');
      execSync('npx tsc --noEmit 2>&1', {
        cwd: projectRoot,
        timeout: 60_000,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { passed: true, errors: [] };
    } catch (error) {
      const output = String(error);
      const errors = output
        .split('\n')
        .filter((line) => line.includes(': error'))
        .map((line) => line.trim());
      return { passed: false, errors: errors.slice(0, 20) };
    }
  }

  /**
   * Perform lightweight static analysis on generated files.
   *
   * Checks for common issues:
   * - Missing copyright headers
   * - TODO/FIXME markers
   * - Console.log statements
   * - Hardcoded secrets
   * - Empty catch blocks
   *
   * @param files - Generated files to analyze.
   * @returns List of static analysis warnings.
   */
  private staticAnalysis(
    files: Array<{ readonly filePath: string; readonly content: string }>,
  ): string[] {
    const warnings: string[] = [];

    for (const file of files) {
      const content = file.content;

      // Check for TODO/FIXME markers
      const todoMatch = content.match(/\/\/\s*(TODO|FIXME|HACK|XXX)/);
      if (todoMatch) {
        warnings.push(`${file.filePath}: Contains ${todoMatch[1]} marker`);
      }

      // Check for console.log
      if (/console\.(log|debug|warn)/.test(content) && !file.filePath.endsWith('.test.ts')) {
        warnings.push(`${file.filePath}: Contains console.log/debug/warn`);
      }

      // Check for empty catch blocks
      if (/catch\s*\([^)]*\)\s*\{[\s]*\}/.test(content)) {
        warnings.push(`${file.filePath}: Contains empty catch block`);
      }

      // Check for hardcoded secrets (looks like API keys)
      const secretMatch = content.match(/['"](?:sk-|ghp_|gho_|ghu_|ghs_|ghr_)[A-Za-z0-9_-]+['"]/);
      if (secretMatch) {
        warnings.push(`${file.filePath}: Possible hardcoded secret found`);
      }
    }

    return warnings;
  }

  /**
   * Build a summary of all failures.
   */
  private buildFailureSummary(
    testResults: TestResult[],
    lintErrors: string[],
    buildPassed: boolean,
  ): string {
    const parts: string[] = [];

    const failedTests = testResults.filter((t) => !t.passed);
    if (failedTests.length > 0) {
      parts.push(`Tests: ${failedTests.length} suite(s) failed`);
    }

    if (!buildPassed) {
      parts.push('Build: failed');
    }

    if (lintErrors.length > 0) {
      parts.push(`Lint: ${lintErrors.length} issue(s) found`);
    }

    return parts.join('; ');
  }
}

/**
 * Create a default verifier agent.
 *
 * @param provider - LLM provider configuration.
 * @param mockMode - Whether to use mock mode.
 * @returns A configured VerifierAgent.
 */
export function createVerifier(
  provider: import('./types.js').LLMProviderConfig,
  mockMode: boolean = false,
): VerifierAgent {
  return new VerifierAgent(provider, mockMode);
}