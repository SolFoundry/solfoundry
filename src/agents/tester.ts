import { execSync } from 'child_process';
import { existsSync } from 'fs';
import type { AnalysisPlan, AgentResult, TestResult } from '../types/index.js';

export class Tester {
  async test(plan: AnalysisPlan, workDir: string): Promise<AgentResult<{passed: boolean; results: TestResult[]}>> {
    const start = Date.now();
    const results: TestResult[] = [];

    // Install deps
    try {
      execSync('npm install --frozen-lockfile 2>/dev/null || npm install 2>/dev/null || yarn install', {
        cwd: workDir, timeout: 120000, stdio: 'pipe'
      });
    } catch {}

    // Run plan's test commands
    for (const cmd of plan.steps.flatMap(s => s.testCommands)) {
      if (!cmd) continue;
      results.push(await this.run(cmd, workDir));
    }

    // Run project tests
    if (results.length === 0) {
      for (const t of plan.tests) {
        const fullPath = `${workDir}/${t}`;
        if (existsSync(fullPath)) {
          results.push(await this.run(`npx vitest run ${t} --reporter=verbose`, workDir));
        }
      }
      if (results.length === 0) {
        try {
          results.push(await this.run('npm test -- --passWithNoTests 2>/dev/null || npx vitest run --passWithNoTests', workDir));
        } catch {}
      }
    }

    // TypeScript check
    if (existsSync(`${workDir}/tsconfig.json`)) {
      try {
        results.push(await this.run('npx tsc --noEmit', workDir));
      } catch {}
    }

    const allPassed = results.every(r => r.exitCode === 0);
    return {
      success: allPassed,
      data: { passed: allPassed, results },
      duration: Date.now() - start,
    };
  }

  private async run(cmd: string, cwd: string): Promise<TestResult> {
    const name = cmd.split(' ').slice(1, 4).join(' ');
    try {
      const stdout = execSync(cmd, { cwd, timeout: 120000, stdio: 'pipe' }).toString();
      return { name, exitCode: 0, stdout: stdout.substring(0, 2000), stderr: '' };
    } catch (e: any) {
      return {
        name,
        exitCode: e.status || 1,
        stdout: (e.stdout || '').toString().substring(0, 2000),
        stderr: (e.stderr || e.message).toString().substring(0, 1000),
      };
    }
  }
}
