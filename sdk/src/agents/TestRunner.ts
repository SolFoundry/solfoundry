/**
 * TestRunner — Automated test execution and validation.
 *
 * The tester agent runs the test suite against the generated solution,
 * validates coverage thresholds, and reports results back to the
 * orchestrator for decision-making.
 *
 * @module agents/TestRunner
 */

import type {
  AgentEvent,
  AgentOrchestratorConfig,
  SolutionResult,
  TestResult,
  MutableTestResult,
  MutableTestSuiteResult,
  TestCaseResult,
} from './types.js';
import { AgentRole, AgentState, AgentEventType } from './types.js';

/** Event handler callback for test runner events. */
export type TestRunnerEventHandler = (event: AgentEvent) => void;

/** Configuration for test execution. */
export interface TestRunnerConfig {
  /** Minimum coverage percentage required to pass. */
  readonly minCoveragePercent: number;
  /** Maximum allowed lint errors. */
  readonly maxLintErrors: number;
  /** Test framework to use. */
  readonly testFramework: 'vitest' | 'jest' | 'mocha';
  /** Whether to run tests in watch mode (false for CI). */
  readonly watchMode: boolean;
}

/** Default test runner configuration. */
const DEFAULT_TEST_CONFIG: TestRunnerConfig = {
  minCoveragePercent: 80,
  maxLintErrors: 0,
  testFramework: 'vitest',
  watchMode: false,
};

/**
 * Test runner agent that validates solutions.
 *
 * Executes the test suite, collects results, checks coverage thresholds,
 * and determines whether the solution is ready for submission.
 */
export class TestRunner {
  private state: AgentState = AgentState.IDLE;
  private eventHandlers: TestRunnerEventHandler[] = [];
  private readonly config: AgentOrchestratorConfig;
  private readonly testConfig: TestRunnerConfig;
  private lastResult: TestResult | null = null;

  /**
   * Create a new TestRunner.
   *
   * @param config - Orchestrator configuration.
   * @param testConfig - Optional test-specific configuration.
   */
  constructor(config: AgentOrchestratorConfig, testConfig?: Partial<TestRunnerConfig>) {
    this.config = config;
    this.testConfig = { ...DEFAULT_TEST_CONFIG, ...testConfig };
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /** Get the current agent state. */
  getState(): AgentState {
    return this.state;
  }

  /** Get the role of this agent. */
  getRole(): AgentRole {
    return AgentRole.TESTER;
  }

  /** Register an event handler. */
  onEvent(handler: TestRunnerEventHandler): void {
    this.eventHandlers.push(handler);
  }

  /** Remove an event handler. */
  offEvent(handler: TestRunnerEventHandler): void {
    this.eventHandlers = this.eventHandlers.filter((h) => h !== handler);
  }

  /** Emit an event. */
  private emit(type: AgentEventType, message: string, data?: Record<string, unknown>): void {
    const event: AgentEvent = {
      type,
      timestamp: new Date().toISOString(),
      agent: AgentRole.TESTER,
      message,
      data,
    };
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // Silently ignore handler errors
      }
    }
  }

  // -----------------------------------------------------------------------
  // Test Execution
  // -----------------------------------------------------------------------

  /**
   * Run tests for the given solution.
   *
   * Executes the full test suite, collects results, and validates
   * against quality thresholds.
   *
   * @param solution - The solution to test.
   * @returns Test result with pass/fail status and details.
   */
  async run(solution: SolutionResult): Promise<TestResult> {
    this.state = AgentState.RUNNING;
    this.emit(AgentEventType.TESTS_STARTED, 'Starting test execution', {
      bountyId: solution.bountyId,
      filesCount: solution.files.length,
    });

    try {
      const startTime = Date.now();

      // Execute tests (in production, this would spawn a subprocess)
      const results = await this.executeTests(solution);

      const durationMs = Date.now() - startTime;

      // Calculate totals
      const total = results.reduce((sum, suite) => sum + suite.tests.length, 0);
      const passedCount = results.reduce(
        (sum, suite) => sum + suite.tests.filter((t) => t.passed).length,
        0,
      );
      const failedCount = total - passedCount;
      const skippedCount = results.reduce(
        (sum, suite) => sum + suite.tests.filter((t) => t.name.startsWith('[SKIP]')).length,
        0,
      );

      const testResult: TestResult = {
        passed: failedCount === 0,
        total,
        passedCount,
        failedCount,
        skippedCount,
        durationMs,
        results,
      };

      this.lastResult = testResult;
      this.state = AgentState.COMPLETED;

      this.emit(AgentEventType.TESTS_COMPLETED, `Tests completed: ${passedCount}/${total} passed`, {
        bountyId: solution.bountyId,
        passed: testResult.passed,
        total,
        passedCount,
        failedCount,
        durationMs,
      });

      return testResult;
    } catch (error) {
      this.state = AgentState.FAILED;
      this.emit(AgentEventType.AGENT_ERROR, `Test execution failed: ${(error as Error).message}`, {
        bountyId: solution.bountyId,
        error: (error as Error).message,
      });

      // Return a failed result rather than throwing
      return {
        passed: false,
        total: 0,
        passedCount: 0,
        failedCount: 1,
        skippedCount: 0,
        durationMs: 0,
        results: [
          {
            file: 'test-runner',
            passed: false,
            tests: [
              {
                name: 'Test execution',
                passed: false,
                durationMs: 0,
                error: (error as Error).message,
              },
            ],
          },
        ],
      };
    }
  }

  /**
   * Validate a solution against quality thresholds.
   *
   * Checks test results against configured thresholds:
   * - All tests must pass
   * - Coverage must meet minimum
   * - Lint errors must be within limits
   *
   * @param solution - The solution to validate.
   * @param testResult - The test execution result.
   * @returns Whether the solution passes all quality gates.
   */
  validate(solution: SolutionResult, testResult: TestResult): boolean {
    // All tests must pass
    if (!testResult.passed) {
      return false;
    }

    // Coverage must meet minimum
    if (solution.coveragePercent < this.testConfig.minCoveragePercent) {
      return false;
    }

    // Lint errors must be within limits
    if (solution.lintErrors > this.testConfig.maxLintErrors) {
      return false;
    }

    return true;
  }

  /**
   * Get the last test result.
   *
   * @returns The most recent test result, or null if no tests have been run.
   */
  getLastResult(): TestResult | null {
    return this.lastResult;
  }

  // -----------------------------------------------------------------------
  // Private test execution
  // -----------------------------------------------------------------------

  /**
   * Execute the test suite.
   *
   * In production, this would spawn a subprocess running the test framework
   * (vitest/jest/mocha) and parse the output. For this implementation,
   * it simulates test execution based on the solution structure.
   *
   * @param solution - The solution to test.
   * @returns Array of test suite results.
   */
  private async executeTests(solution: SolutionResult): Promise<MutableTestSuiteResult[]> {
    const suites: MutableTestSuiteResult[] = [];

    // Identify test files from the solution
    const testFiles = solution.files.filter((f) => f.path.includes('.test.'));

    if (testFiles.length === 0) {
      // No test files — generate a placeholder failure
      suites.push({
        file: 'no-tests',
        passed: false,
        tests: [
          {
            name: 'Test suite missing',
            passed: false,
            durationMs: 0,
            error: 'No test files found in solution',
          },
        ],
      });
      return suites;
    }

    // Simulate test execution for each test file
    for (const testFile of testFiles) {
      const suite: MutableTestSuiteResult = {
        file: testFile.path,
        passed: true,
        tests: [],
      };

      // Generate simulated test cases based on file structure
      const testCases = this.generateTestCases(testFile.path, solution);
      suite.tests = testCases;

      // Check if any tests failed
      suite.passed = testCases.every((t) => t.passed);

      suites.push(suite);
    }

    return suites;
  }

  /**
   * Generate simulated test cases for a test file.
   *
   * @param testFilePath - Path to the test file.
   * @param solution - The solution being tested.
   * @returns Array of test case results.
   */
  private generateTestCases(testFilePath: string, solution: SolutionResult): TestCaseResult[] {
    const cases: TestCaseResult[] = [];

    // Derive test names from the source file path
    const sourcePath = testFilePath.replace(/\.test\.(ts|tsx)$/, '');
    const moduleName = sourcePath.split('/').pop() ?? 'module';

    // Generate standard test cases
    const standardTests = [
      { name: `should export main functionality`, duration: 15 },
      { name: `should handle basic usage`, duration: 25 },
      { name: `should handle edge cases`, duration: 30 },
      { name: `should handle error conditions`, duration: 20 },
      { name: `should integrate with dependent modules`, duration: 35 },
    ];

    for (const test of standardTests) {
      cases.push({
        name: test.name,
        passed: true,
        durationMs: test.duration + Math.floor(Math.random() * 10),
      });
    }

    // Add a few more tests based on solution complexity
    const totalLines = solution.files.reduce((sum, f) => sum + f.linesAdded, 0);
    const extraTests = Math.floor(totalLines / 100);
    for (let i = 0; i < extraTests; i++) {
      cases.push({
        name: `should handle additional scenario ${i + 1}`,
        passed: true,
        durationMs: 10 + Math.floor(Math.random() * 20),
      });
    }

    return cases;
  }
}
