/**
 * SolFoundry Program Testing Framework - Type Definitions
 */

// 测试用例定义
export interface TestCase {
  name: string;
  fn: () => Promise<void> | void;
  timeout?: number;
  skip?: boolean;
  only?: boolean;
}

// 测试套件定义
export interface TestSuite {
  name: string;
  tests: TestCase[];
  suites: TestSuite[];
  beforeAll?: () => Promise<void> | void;
  afterAll?: () => Promise<void> | void;
  beforeEach?: () => Promise<void> | void;
  afterEach?: () => Promise<void> | void;
}

// 测试结果
export interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: Error;
  children: TestResult[];
}

// 覆盖率信息
export interface CoverageInfo {
  file: string;
  lines: {
    total: number;
    covered: number;
    uncovered: number[];
  };
  functions: {
    total: number;
    covered: number;
  };
  branches: {
    total: number;
    covered: number;
  };
  percentage: number;
}

// 模糊测试配置
export interface FuzzConfig {
  iterations: number;
  seed?: number;
  inputs: Record<string, FuzzInput>;
  shrink?: boolean;
}

export interface FuzzInput {
  type: 'u8' | 'u16' | 'u32' | 'u64' | 'i8' | 'i16' | 'i32' | 'i64' | 'publicKey' | 'string' | 'bytes';
  min?: number;
  max?: number;
  length?: number;
}

// Mock 配置
export interface MockConfig<T> {
  implementation?: Partial<T>;
  calls?: MockCall[];
  returns?: any[];
  throws?: Error[];
}

export interface MockCall {
  methodName: string;
  args: any[];
  result?: any;
  error?: Error;
}

// 测试运行器配置
export interface RunnerConfig {
  timeout: number;
  parallel: boolean;
  maxWorkers: number;
  coverage: boolean;
  reporter: 'spec' | 'dot' | 'json' | 'junit';
  bail?: boolean;
  grep?: string;
}

// 断言结果
export interface AssertResult {
  passed: boolean;
  message?: string;
}
