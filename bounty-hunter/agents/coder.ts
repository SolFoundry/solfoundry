import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import OpenAI from 'openai';
import type { AnalysisPlan, AgentResult } from '../types/index.js';

const MODEL = process.env.LLM_PRIMARY_MODEL || 'gpt-4o';
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export class Coder {
  async implement(plan: AnalysisPlan, baseBranch: string): Promise<AgentResult<{files: Map<string, string>}>> {
    const start = Date.now();
    const implementedFiles = new Map<string, string>();
    const repoName = plan.bountyId.split(':')[0];
    const workDir = `/tmp/bounty-${plan.bountyId.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}`;

    try {
      // Clone repo
      execSync(`git clone --depth 1 https://github.com/${repoName} ${workDir} 2>/dev/null`, { timeout: 60000 });
      execSync(`cd ${workDir} && git checkout -b bounty-${Date.now()} ${baseBranch} 2>/dev/null`, { timeout: 30000 });

      const sortedSteps = [...plan.steps].sort((a, b) => a.order - b.order);

      for (const step of sortedSteps) {
        console.log(`   Step ${step.order}: ${step.description}`);

        for (const filePath of step.files) {
          const fullPath = join(workDir, filePath);
          const existing = existsSync(fullPath) ? readFileSync(fullPath, 'utf8') : null;

          const code = await this.generateCode(filePath, existing, step.description, plan, workDir);
          
          mkdirSync(dirname(fullPath), { recursive: true });
          writeFileSync(fullPath, code);
          implementedFiles.set(filePath, code);
          console.log(`     ✅ ${filePath} (${code.length} chars)`);
        }
      }

      return { success: true, data: { files: implementedFiles }, duration: Date.now() - start };
    } catch (e: any) {
      return { success: false, error: e.message, duration: Date.now() - start };
    }
  }

  private async generateCode(
    filePath: string,
    existing: string | null,
    stepDescription: string,
    plan: AnalysisPlan,
    workDir: string,
  ): Promise<string> {
    const systemPrompt = `You are a senior engineer implementing features for the SolFoundry project.
Follow the repository's existing patterns. Write complete, production-ready code. Never leave TODOs.`;

    const userPrompt = `## Task: ${stepDescription}
## File: ${filePath}
${existing ? `## Existing content (modify this):\n\`\`\`\n${existing.substring(0, 4000)}\n\`\`\`` : '## Create new file'}

## Context
- Work directory: ${workDir}
- Complexity: ${plan.estimatedComplexity}
- Acceptance criteria: ${plan.acceptanceCriteria.join('; ')}

Write the complete file content. Return ONLY the code, no markdown, no explanation.`;

    try {
      const response = await client.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 4000,
      });

      let code = response.choices[0]?.message?.content || '';
      // Strip markdown code blocks
      if (code.startsWith('```')) {
        code = code.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');
      }
      return code.trim();
    } catch (e: any) {
      throw new Error(`Code generation failed for ${filePath}: ${e.message}`);
    }
  }
}
