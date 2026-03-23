/**
 * SolFoundry Program Testing Framework
 * 
 * 完整的 Solana 程序测试解决方案
 * 单元测试 | 集成测试 | 模糊测试 | 覆盖率报告
 */

// 核心测试运行器
export {
  TestRunner,
  describe,
  it,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  runTests,
  createRunner,
} from './runner';

// 断言库
export { expect, assert, fail, AssertionError } from './assert';
export type { Expect } from './assert';

// Mock & Stub 工具
export {
  Mock,
  createMock,
  createStub,
  createSpy,
  MockVerifier,
} from './mock';
export type { MockMethod, Spy } from './mock';

// 模糊测试
export { fuzz, FuzzEngine, BoundaryValues } from './fuzz';
export type { FuzzReport, FuzzConfig, FuzzInput } from './fuzz';

// 覆盖率追踪
export {
  CoverageTracker,
  getCoverageTracker,
  enableCoverage,
  disableCoverage,
} from './coverage';
export type { CoverageReport, CoverageInfo } from './coverage';

// 类型定义
export type {
  TestCase,
  TestSuite,
  TestResult,
  RunnerConfig,
  AssertResult,
} from './types';

// 版本信息
export const VERSION = '1.0.0';

/**
 * 快速开始示例
 * 
 * ```typescript
 * import { describe, it, expect, runTests } from '@solfoundry/testing';
 * 
 * describe('MyProgram', () => {
 *   it('should work correctly', async () => {
 *     const result = await myFunction();
 *     expect(result).toBe(true);
 *   });
 * });
 * 
 * runTests();
 * ```
 */
