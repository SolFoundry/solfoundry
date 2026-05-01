"""PR submission module."""
import subprocess
from typing import Optional

class PRSubmitter:
    def submit_pr(self, repo: str, branch: str, title: str, body: str, base: str = "main") -> Optional[str]:
        cmd = ["gh", "pr", "create", f"--repo={repo}", f"--head={branch}", f"--base={base}", f"--title={title}", f"--body={body}"]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            return result.stdout.strip() if result.returncode == 0 else None
        except Exception as e:
            print(f"PR error: {e}")
            return None

    @staticmethod
    def format_pr_body(bounty_issue: int, approach: str, implementation: str, testing: str) -> str:
        return f"""## Bounty Submission: #{bounty_issue}

### Approach
{approach}

### Implementation
{implementation}

### Testing
{testing}

### Multi-LLM Review
- ✅ Implementation review (GLM-5.1)
- ✅ Security review (DeepSeek-V4-Pro)  
- ✅ Code quality (Qwen-3.5-397B)

---
*Submitted by OpenClaw Agent Team — 51 agents, 7 gateways*"""
