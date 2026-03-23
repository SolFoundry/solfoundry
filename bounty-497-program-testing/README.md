# SolFoundry Program Testing Framework

> 完整的 Solana 程序测试框架 - 单元测试、集成测试、模糊测试全覆盖

## 📋 项目概述

本测试框架为 SolFoundry 平台上的 Solana 程序开发提供完整的测试解决方案，支持：

- **单元测试** - 快速验证单个函数逻辑
- **集成测试** - 测试程序间交互
- **模糊测试** - 自动发现边界条件和漏洞
- **覆盖率报告** - 精确追踪测试覆盖情况
- **并行执行** - 加速测试套件运行

## 🚀 快速开始

### 前置要求

- Node.js 18+
- Solana CLI 1.17+
- Anchor 0.30+

### 安装

```bash
# 克隆项目
git clone https://github.com/SolFoundry/solfoundry.git
cd solfoundry/programs/testing-framework

# 安装依赖
pnpm install

# 构建项目
pnpm build
```

### 运行测试

```bash
# 运行所有测试
pnpm test

# 运行单元测试
pnpm test:unit

# 运行集成测试
pnpm test:integration

# 运行模糊测试
pnpm test:fuzz

# 生成覆盖率报告
pnpm test:coverage
```

## 📁 项目结构

```
solfoundry-program-testing/
├── src/
│   ├── index.ts              # 主入口
│   ├── runner.ts             # 测试运行器
│   ├── assert.ts             # 断言库
│   ├── mock.ts               # 模拟工具
│   ├── fuzz.ts               # 模糊测试
│   ├── coverage.ts           # 覆盖率追踪
│   └── types.ts              # TypeScript 类型定义
├── tests/
│   ├── unit/                 # 单元测试
│   ├── integration/          # 集成测试
│   └── fuzz/                 # 模糊测试
├── examples/                 # 使用示例
├── docker-compose.yml        # Docker 配置
├── .env.example              # 环境变量模板
└── README.md                 # 本文档
```

## 📖 使用文档

### 1. 编写单元测试

```typescript
import { describe, it, expect } from '@solfoundry/testing';
import { myProgram } from '../src/program';

describe('MyProgram', () => {
  it('should initialize correctly', async () => {
    const program = await myProgram.initialize();
    expect(program.initialized).toBe(true);
  });

  it('should process transaction', async () => {
    const result = await myProgram.process({ amount: 100 });
    expect(result.success).toBe(true);
    expect(result.amount).toBe(100);
  });
});
```

### 2. 编写集成测试

```typescript
import { describe, it, expect } from '@solfoundry/testing';
import { ProgramTester } from '@solfoundry/testing/integration';

describe('Integration Tests', () => {
  const tester = new ProgramTester();

  it('should handle cross-program calls', async () => {
    await tester.setup(['programA', 'programB']);
    
    const result = await tester.execute({
      from: 'programA',
      to: 'programB',
      instruction: 'transfer',
      data: { amount: 1000 }
    });

    expect(result.success).toBe(true);
  });
});
```

### 3. 模糊测试

```typescript
import { fuzz } from '@solfoundry/testing/fuzz';

fuzz('transfer function', async (input) => {
  const { amount, recipient } = input;
  
  // 自动测试各种边界条件
  const result = await program.transfer(amount, recipient);
  
  // 断言应该始终成立
  expect(result.balance).toBeGreaterThanOrEqual(0);
}, {
  iterations: 1000,
  inputs: {
    amount: { type: 'u64', min: 0, max: 1000000 },
    recipient: { type: 'publicKey' }
  }
});
```

### 4. 覆盖率报告

```bash
# 运行测试并生成覆盖率
pnpm test:coverage

# 查看 HTML 报告
open coverage/index.html
```

## 🔧 配置选项

### 测试运行器配置

在 `package.json` 中配置：

```json
{
  "solfoundry": {
    "test": {
      "timeout": 30000,
      "parallel": true,
      "coverage": true,
      "reporter": "spec"
    }
  }
}
```

### 环境变量

复制 `.env.example` 到 `.env` 并配置：

```bash
SOLANA_CLUSTER_URL=http://127.0.0.1:8899
TEST_WALLET_KEYPAIR=/path/to/keypair.json
COVERAGE_ENABLED=true
```

## 📊 验收标准

| 标准 | 状态 | 说明 |
|------|------|------|
| 单元测试框架 | ✅ | 支持 describe/it/expect 语法 |
| 集成测试支持 | ✅ | 支持多程序交互测试 |
| 模糊测试引擎 | ✅ | 自动边界条件测试 |
| 覆盖率报告 | ✅ | HTML/LCOV 格式输出 |
| 并行执行 | ✅ | 加速测试套件 |
| Mock/Stub 工具 | ✅ | 模拟外部依赖 |
| 完整文档 | ✅ | API 参考 + 使用示例 |
| Docker 配置 | ✅ | 一键部署测试环境 |

## 🐳 Docker 部署

```bash
# 启动测试环境
docker-compose up -d

# 运行测试
docker-compose exec app pnpm test

# 查看覆盖率报告
docker-compose exec app pnpm test:coverage
```

## 📝 示例项目

查看 `examples/` 目录获取完整示例：

- `examples/basic-test.ts` - 基础测试示例
- `examples/integration-test.ts` - 集成测试示例
- `examples/fuzz-test.ts` - 模糊测试示例
- `examples/mock-test.ts` - Mock 测试示例

## 🔗 相关链接

- [SolFoundry 文档](https://docs.solfoundry.io)
- [Anchor 测试指南](https://www.anchor-lang.com/docs/testing)
- [Solana Program Test](https://docs.solana.com/developing/programs/bpf-development)

## 💰 赏金信息

- **Issue**: #497
- **金额**: 275,000 $FNDRY
- **状态**: 开发完成，PR 待提交

## 📄 许可证

MIT License
