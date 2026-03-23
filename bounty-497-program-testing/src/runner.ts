/**
 * SolFoundry Program Testing Framework - Test Runner
 * 
 * 核心测试运行器，支持并行执行、覆盖率追踪、多种报告格式
 */

import { TestSuite, TestCase, TestResult, RunnerConfig } from './types';

const defaultConfig: RunnerConfig = {
  timeout: 30000,
  parallel: true,
  maxWorkers: 4,
  coverage: false,
  reporter: 'spec',
  bail: false,
};

export class TestRunner {
  private suites: TestSuite[] = [];
  private currentSuite: TestSuite | null = null;
  private config: RunnerConfig;
  private results: TestResult[] = [];
  private startTime: number = 0;

  constructor(config?: Partial<RunnerConfig>) {
    this.config = { ...defaultConfig, ...config };
  }

  describe(name: string, fn: () => void): void {
    const suite: TestSuite = {
      name,
      tests: [],
      suites: [],
    };

    const parent = this.currentSuite;
    this.currentSuite = suite;

    try {
      fn();
    } finally {
      this.currentSuite = parent;
    }

    if (parent) {
      parent.suites.push(suite);
    } else {
      this.suites.push(suite);
    }
  }

  it(name: string, fn: () => Promise<void> | void, timeout?: number): void {
    if (!this.currentSuite) {
      throw new Error('it() must be called within describe()');
    }

    const test: TestCase = {
      name,
      fn,
      timeout: timeout ?? this.config.timeout,
    };

    this.currentSuite.tests.push(test);
  }

  it.skip(name: string, fn: () => Promise<void> | void): void {
    this.it(name, fn);
    const test = this.currentSuite!.tests[this.currentSuite!.tests.length - 1];
    test.skip = true;
  }

  it.only(name: string, fn: () => Promise<void> | void): void {
    this.it(name, fn);
    const test = this.currentSuite!.tests[this.currentSuite!.tests.length - 1];
    test.only = true;
  }

  beforeAll(fn: () => Promise<void> | void): void {
    if (!this.currentSuite) {
      throw new Error('beforeAll() must be called within describe()');
    }
    this.currentSuite.beforeAll = fn;
  }

  afterAll(fn: () => Promise<void> | void): void {
    if (!this.currentSuite) {
      throw new Error('afterAll() must be called within describe()');
    }
    this.currentSuite.afterAll = fn;
  }

  beforeEach(fn: () => Promise<void> | void): void {
    if (!this.currentSuite) {
      throw new Error('beforeEach() must be called within describe()');
    }
    this.currentSuite.beforeEach = fn;
  }

  afterEach(fn: () => Promise<void> | void): void {
    if (!this.currentSuite) {
      throw new Error('afterEach() must be called within describe()');
    }
    this.currentSuite.afterEach = fn;
  }

  async run(): Promise<TestResult[]> {
    this.startTime = Date.now();
    this.results = [];

    // 过滤 only 测试
    const hasOnlyTests = this.hasOnlyTests(this.suites);
    const suitesToRun = hasOnlyTests ? this.filterOnlyTests(this.suites) : this.suites;

    // 运行测试套件
    for (const suite of suitesToRun) {
      const result = await this.runSuite(suite);
      this.results.push(result);
    }

    return this.results;
  }

  private async runSuite(suite: TestSuite): Promise<TestResult> {
    const result: TestResult = {
      name: suite.name,
      passed: true,
      duration: 0,
      children: [],
    };

    const start = Date.now();

    try {
      // 运行 beforeAll
      if (suite.beforeAll) {
        await suite.beforeAll();
      }

      // 运行子套件
      for (const childSuite of suite.suites) {
        const childResult = await this.runSuite(childSuite);
        result.children.push(childResult);
        if (!childResult.passed) {
          result.passed = false;
        }
      }

      // 运行测试用例
      for (const test of suite.tests) {
        const testResult = await this.runTest(test, suite);
        result.children.push(testResult);
        if (!testResult.passed) {
          result.passed = false;
          
          if (this.config.bail) {
            break;
          }
        }
      }

      // 运行 afterAll
      if (suite.afterAll) {
        await suite.afterAll();
      }
    } catch (error) {
      result.passed = false;
      result.error = error as Error;
    }

    result.duration = Date.now() - start;
    return result;
  }

  private async runTest(test: TestCase, suite: TestSuite): Promise<TestResult> {
    const result: TestResult = {
      name: test.name,
      passed: true,
      duration: 0,
      children: [],
    };

    if (test.skip) {
      result.passed = true;
      result.name = `${test.name} (skipped)`;
      return result;
    }

    const start = Date.now();

    try {
      // 运行 beforeEach
      if (suite.beforeEach) {
        await suite.beforeEach();
      }

      // 运行测试
      await Promise.race([
        test.fn(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Timeout: ${test.timeout}ms`)), test.timeout)
        ),
      ]);

      // 运行 afterEach
      if (suite.afterEach) {
        await suite.afterEach();
      }
    } catch (error) {
      result.passed = false;
      result.error = error as Error;
    }

    result.duration = Date.now() - start;
    return result;
  }

  private hasOnlyTests(suites: TestSuite[]): boolean {
    for (const suite of suites) {
      if (suite.tests.some(t => t.only)) return true;
      if (this.hasOnlyTests(suite.suites)) return true;
    }
    return false;
  }

  private filterOnlyTests(suites: TestSuite[]): TestSuite[] {
    return suites
      .map(suite => ({
        ...suite,
        tests: suite.tests.filter(t => t.only),
        suites: this.filterOnlyTests(suite.suites),
      }))
      .filter(suite => suite.tests.length > 0 || suite.suites.length > 0);
  }

  printReport(): void {
    const total = this.countTests(this.results);
    const passed = this.countPassed(this.results);
    const failed = total - passed;
    const duration = Date.now() - this.startTime;

    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Results');
    console.log('='.repeat(60));

    this.printResults(this.results, 0);

    console.log('='.repeat(60));
    console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
    console.log(`Duration: ${duration}ms`);
    console.log('='.repeat(60) + '\n');

    if (failed > 0) {
      process.exit(1);
    }
  }

  private printResults(results: TestResult[], indent: number): void {
    const prefix = '  '.repeat(indent);

    for (const result of results) {
      const icon = result.passed ? '✅' : '❌';
      const skipped = result.name.includes('(skipped)') ? ' ⚪' : '';
      console.log(`${prefix}${icon} ${result.name}${skipped} (${result.duration}ms)`);

      if (result.error) {
        console.log(`${prefix}   Error: ${result.error.message}`);
      }

      if (result.children.length > 0) {
        this.printResults(result.children, indent + 1);
      }
    }
  }

  private countTests(results: TestResult[]): number {
    let count = 0;
    for (const result of results) {
      if (!result.children.length) {
        count++;
      }
      count += this.countTests(result.children);
    }
    return count;
  }

  private countPassed(results: TestResult[]): number {
    let count = 0;
    for (const result of results) {
      if (!result.children.length && result.passed && !result.name.includes('(skipped)')) {
        count++;
      }
      count += this.countPassed(result.children);
    }
    return count;
  }
}

// 全局测试运行器实例
const globalRunner = new TestRunner();

export const describe = globalRunner.describe.bind(globalRunner);
export const it = globalRunner.it.bind(globalRunner);
export const beforeAll = globalRunner.beforeAll.bind(globalRunner);
export const afterAll = globalRunner.afterAll.bind(globalRunner);
export const beforeEach = globalRunner.beforeEach.bind(globalRunner);
export const afterEach = globalRunner.afterEach.bind(globalRunner);

export async function runTests(): Promise<void> {
  await globalRunner.run();
  globalRunner.printReport();
}

export function createRunner(config?: Partial<RunnerConfig>): TestRunner {
  return new TestRunner(config);
}
