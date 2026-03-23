/**
 * SolFoundry Program Testing Framework - Fuzz Testing
 * 
 * 模糊测试引擎，自动生成边界条件和随机输入
 */

import { FuzzConfig, FuzzInput } from './types';

export class FuzzEngine {
  private config: FuzzConfig;
  private seed: number;
  private failures: Array<{ input: any; error: Error }> = [];

  constructor(config: FuzzConfig) {
    this.config = {
      iterations: 1000,
      shrink: true,
      ...config,
    };
    this.seed = config.seed ?? Math.floor(Math.random() * 1000000);
  }

  async run(testFn: (input: any) => Promise<void> | void): Promise<FuzzReport> {
    console.log(`\n🎲 Starting fuzz testing with seed: ${this.seed}`);
    console.log(`   Iterations: ${this.config.iterations}`);

    let passed = 0;
    let failed = 0;

    for (let i = 0; i < this.config.iterations; i++) {
      const input = this.generateInput(this.config.inputs);

      try {
        await testFn(input);
        passed++;
      } catch (error) {
        failed++;
        this.failures.push({ input, error: error as Error });

        if (this.config.shrink) {
          const shrunk = await this.shrink(input, testFn);
          if (shrunk) {
            this.failures[this.failures.length - 1].input = shrunk;
          }
        }

        if (failed >= 5) {
          console.log(`\n⚠️  Stopped after ${failed} failures`);
          break;
        }
      }

      if ((i + 1) % 100 === 0) {
        console.log(`   Progress: ${i + 1}/${this.config.iterations}`);
      }
    }

    return {
      passed,
      failed,
      total: this.config.iterations,
      failures: this.failures,
      seed: this.seed,
    };
  }

  private generateInput(inputs: Record<string, FuzzInput>): any {
    const result: any = {};

    for (const [key, config] of Object.entries(inputs)) {
      result[key] = this.generateValue(config);
    }

    return result;
  }

  private generateValue(config: FuzzInput): any {
    switch (config.type) {
      case 'u8':
        return this.randomInt(0, 255);
      case 'u16':
        return this.randomInt(0, 65535);
      case 'u32':
        return this.randomInt(0, 4294967295);
      case 'u64':
        return this.randomBigInt(0n, BigInt(config.max ?? '18446744073709551615'));
      case 'i8':
        return this.randomInt(-128, 127);
      case 'i16':
        return this.randomInt(-32768, 32767);
      case 'i32':
        return this.randomInt(-2147483648, 2147483647);
      case 'i64':
        return this.randomBigInt(
          BigInt(config.min ?? '-9223372036854775808'),
          BigInt(config.max ?? '9223372036854775807')
        );
      case 'publicKey':
        return this.generatePublicKey();
      case 'string':
        return this.generateString(config.length ?? this.randomInt(0, 100));
      case 'bytes':
        return this.generateBytes(config.length ?? this.randomInt(0, 1000));
      default:
        throw new Error(`Unknown type: ${(config as any).type}`);
    }
  }

  private randomInt(min: number, max: number): number {
    // 包含边界值测试
    if (this.random() < 0.1) {
      return this.random() < 0.5 ? min : max;
    }
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  private randomBigInt(min: bigint, max: bigint): bigint {
    if (this.random() < 0.1) {
      return this.random() < 0.5 ? min : max;
    }
    const range = max - min + 1n;
    return min + (BigInt(Math.floor(this.random() * Number(range))) % range);
  }

  private generatePublicKey(): string {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = this.randomInt(0, 255);
    }
    return Buffer.from(bytes).toString('base58');
  }

  private generateString(length: number): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(this.randomInt(0, chars.length - 1));
    }
    return result;
  }

  private generateBytes(length: number): Buffer {
    const bytes = Buffer.alloc(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = this.randomInt(0, 255);
    }
    return bytes;
  }

  private async shrink(input: any, testFn: (input: any) => Promise<void>): Promise<any> {
    // 简化的 shrink 算法 - 尝试减小输入值
    const shrunk = { ...input };
    let improved = false;

    for (const key of Object.keys(input)) {
      const value = input[key];
      
      if (typeof value === 'number' && value > 0) {
        const smaller = Math.max(0, Math.floor(value / 2));
        try {
          const testInput = { ...shrunk, [key]: smaller };
          await testFn(testInput);
        } catch {
          shrunk[key] = smaller;
          improved = true;
        }
      }
    }

    return improved ? shrunk : null;
  }

  private random(): number {
    // 简单的 LCG 随机数生成器
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }
}

export interface FuzzReport {
  passed: number;
  failed: number;
  total: number;
  failures: Array<{ input: any; error: Error }>;
  seed: number;
}

export function fuzz(
  name: string,
  testFn: (input: any) => Promise<void> | void,
  config: FuzzConfig
): void {
  const engine = new FuzzEngine(config);

  console.log(`\n🔬 Fuzz Test: ${name}`);
  
  engine.run(testFn).then(report => {
    console.log('\n📊 Fuzz Report:');
    console.log(`   Passed: ${report.passed}/${report.total}`);
    console.log(`   Failed: ${report.failed}`);
    console.log(`   Seed: ${report.seed}`);

    if (report.failures.length > 0) {
      console.log('\n❌ Failures:');
      for (const failure of report.failures) {
        console.log(`   Input: ${JSON.stringify(failure.input, null, 2)}`);
        console.log(`   Error: ${failure.error.message}`);
      }
    }
  });
}

// 边界值生成器
export const BoundaryValues = {
  u8: [0, 1, 127, 128, 254, 255],
  u16: [0, 1, 255, 256, 32767, 32768, 65534, 65535],
  u32: [0, 1, 255, 256, 65535, 65536, 2147483647, 2147483648, 4294967294, 4294967295],
  i8: [-128, -127, -1, 0, 1, 126, 127],
  i16: [-32768, -32767, -256, -255, -1, 0, 1, 255, 256, 32766, 32767],
  i32: [-2147483648, -2147483647, -65536, -65535, -1, 0, 1, 65535, 65536, 2147483646, 2147483647],
};
