# SolFoundry CLI 使用示例

## 快速开始

### 1. 安装

```bash
pip install solfoundry-cli
```

### 2. 配置

```bash
# 交互式配置
sf config init

# 或设置环境变量
export SOLFOUNDRY_API_KEY=your_api_key
export SOLFOUNDRY_API_URL=https://api.solfoundry.io
```

### 3. 验证安装

```bash
sf --version
sf quickstart
```

## 常用命令示例

### 浏览 Bounty

```bash
# 查看所有 bounty
sf bounties list

# 查看 T2 层级 bounty
sf bounties list --tier t2

# 查看开放的 bounty
sf bounties list --status open

# 查看后端类 bounty
sf bounties list --category backend

# 组合过滤
sf bounties list --tier t2 --status open --category backend

# JSON 格式输出（适合脚本处理）
sf bounties list --json

# 搜索 bounty
sf bounties search "CLI"
sf bounties search "frontend"
```

### 查看 Bounty 详情

```bash
# 查看特定 bounty
sf bounty get 511

# JSON 格式
sf bounty get 511 --json
```

### 认领 Bounty

```bash
# 认领 bounty（会提示确认）
sf bounty claim 511

# 跳过确认
sf bounty claim 511 --yes
```

### 提交作品

```bash
# 提交 PR
sf bounty submit 511 --pr https://github.com/solfoundry/solfoundry/pull/123

# 跳过确认
sf bounty submit 511 --pr https://github.com/solfoundry/solfoundry/pull/123 --yes
```

### 查看个人状态

```bash
# 查看状态
sf status

# JSON 格式
sf status --json
```

### 管理 Submission

```bash
# 查看某 bounty 的所有提交
sf submissions list --bounty 511

# JSON 格式
sf submissions list --bounty 511 --json

# 评审提交
sf submissions review 123 --score 8.5 --comment "Excellent work!"

# 投票
sf submissions vote 123 --upvote
sf submissions vote 123 --downvote

# 分发奖励
sf submissions distribute 123
sf submissions distribute 123 --yes  # 跳过确认
```

### 配置管理

```bash
# 查看当前配置
sf config show

# 设置 API key
sf config set api_key your_api_key

# 设置 API URL
sf config set api_url https://api.solfoundry.io

# 设置默认输出格式
sf config set output_format json

# 设置默认层级
sf config set default_tier t2
```

## 自动化脚本示例

### Bash 脚本：监控高价值 Bounty

```bash
#!/bin/bash

# 监控 T2 层级、奖励超过 200k 的开放 bounty
sf bounties list --tier t2 --status open --json | \
  jq '.[] | select(.reward > 200000) | "\(.id): \(.title) - \(.reward) \(.reward_token)"'
```

### Python 脚本：自动认领符合条件的 Bounty

```python
#!/usr/bin/env python3
import subprocess
import json

# 获取所有开放的 T2 bounty
result = subprocess.run(
    ['sf', 'bounties', 'list', '--tier', 't2', '--status', 'open', '--json'],
    capture_output=True, text=True
)

bounties = json.loads(result.stdout)

# 自动认领后端类 bounty
for bounty in bounties:
    if bounty['category'] == 'backend':
        print(f"Claiming bounty {bounty['id']}: {bounty['title']}")
        subprocess.run(['sf', 'bounty', 'claim', str(bounty['id']), '--yes'])
```

### 定时任务：每日 Bounty 报告

```bash
# 添加到 crontab，每天早上 9 点发送报告
0 9 * * * sf bounties list --status open --json > /tmp/bounties_$(date +\%Y\%m\%d).json
```

## 输出格式

### 表格格式（默认）

```
┏━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━┳━━━━━━┳━━━━━━━━┳━━━━━━━━━━━━┓
┃    ID ┃ Title                                            ┃      Reward ┃ Tier ┃ Status ┃   Category ┃
┡━━━━━━╇━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━╇━━━━━━╇━━━━━━━━╇━━━━━━━━━━━━┩
│    511 │ Bounty CLI tool                                 │ 300,000     │  T2  │  open  │    backend │
│  $FNDRY │                                                 │             │      │        │            │
└──────┴──────────────────────────────────────────────────┴─────────────┴──────┴────────┴────────────┘
```

### JSON 格式

```json
[
  {
    "id": 511,
    "title": "Bounty CLI tool",
    "description": "Build a CLI tool",
    "reward": 300000,
    "reward_token": "$FNDRY",
    "tier": "t2",
    "status": "open",
    "category": "backend",
    "created_at": "2026-03-22T08:12:11Z",
    "repository": "solfoundry/solfoundry",
    "issue_url": "https://github.com/solfoundry/solfoundry/issues/511"
  }
]
```

## Shell 补全

### Bash

```bash
# 添加到 ~/.bashrc
eval "$(sf completion bash)"

# 或临时启用
source <(sf completion bash)
```

### Zsh

```bash
# 添加到 ~/.zshrc
eval "$(sf completion zsh)"

# 或临时启用
source <(sf completion zsh)
```

### Fish

```bash
sf completion fish > ~/.config/fish/completions/sf.fish
```

## 故障排除

### 认证错误

```bash
# 检查配置
sf config show

# 重新设置 API key
sf config set api_key YOUR_API_KEY
```

### 连接错误

```bash
# 检查 API URL
sf config show

# 使用正确的 API URL
sf config set api_url https://api.solfoundry.io
```

### 权限不足

T2 bounty 需要先完成 4+ 个 T1 bounty。查看进度：

```bash
sf status
```

## 最佳实践

1. **使用 JSON 输出进行自动化**：`--json` 标志适合脚本处理
2. **先查看详情再认领**：`sf bounty get <id>` 了解完整需求
3. **及时提交作品**：认领后尽快完成并提交 PR
4. **关注截止日期**：bounty 有 7 天完成期限
5. **保证代码质量**：需要通过 5-LLM AI 代码评审（≥6.5/10）

## 获取帮助

```bash
# 主帮助
sf --help

# 子命令帮助
sf bounties --help
sf bounty --help
sf submissions --help

# 具体命令帮助
sf bounties list --help
sf bounty claim --help
```

---

更多文档：https://github.com/solfoundry/solfoundry
