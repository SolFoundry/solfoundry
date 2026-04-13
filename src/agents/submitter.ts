import { execSync } from 'child_process';
import OpenAI from 'openai';
import type { Bounty, AnalysisPlan, AgentResult, PRResult } from '../types/index.js';

const MODEL = process.env.LLM_PRIMARY_MODEL || 'gpt-4o';
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export class PRSubmitter {
  async submit(bounty: Bounty, plan: AnalysisPlan, workDir: string): Promise<AgentResult<PRResult>> {
    const start = Date.now();
    const repoName = bounty.repo;
    const branchName = `bounty-${bounty.issueNumber}-${Date.now()}`;

    try {
      // Stage, commit, push
      execSync('git add -A', { cwd: workDir, timeout: 30000 });
      
      const commitMsg = await this.getCommitMessage(bounty, plan);
      execSync(`git -c user.name="${process.env.GITHUB_USERNAME || 'BountyHunter'}" -c user.email="${process.env.GITHUB_EMAIL || 'agent@solfoundry'}" commit -m "${commitMsg.replace(/"/g, '\\"')}"`, { cwd: workDir, timeout: 30000 });
      
      execSync(`git push -u origin ${branchName} 2>/dev/null`, { cwd: workDir, timeout: 60000 });

      // Generate PR body
      const prBody = await this.getPRBody(bounty, plan);

      // Create PR via gh CLI
      const prJson = execSync(
        `gh pr create --repo ${repoName} --title "[${bounty.tier}] ${bounty.title.replace(/"/g, '\\"')}" --body "${prBody.replace(/"/g, '\\"')}" --base main --head ${branchName} --json number,html_url 2>/dev/null`,
        { timeout: 30000 }
      );
      const pr = JSON.parse(prJson.toString());

      // Add labels
      try {
        execSync(`gh api repos/${repoName}/issues/${pr.number}/labels -X POST -f labels[]=bounty -f labels[]=auto-submitted 2>/dev/null`, { timeout: 10000 });
      } catch {}

      // Comment on issue
      try {
        execSync(`gh comment create --repo ${repoName} --issue ${bounty.issueNumber} --body "Bounty claimed! PR: ${pr.html_url}" 2>/dev/null`, { timeout: 10000 });
      } catch {}

      return {
        success: true,
        data: { prUrl: pr.html_url, prNumber: pr.number },
        duration: Date.now() - start,
      };
    } catch (e: any) {
      return { success: false, error: e.message, duration: Date.now() - start };
    }
  }

  private async getCommitMessage(bounty: Bounty, plan: AnalysisPlan): Promise<string> {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: 'Write a concise git commit message. Format: <type>(<scope>): <short description>. Example: feat(bounty-123): implement X' },
        { role: 'user', content: `Write a commit message for: ${bounty.title} (${bounty.tier}, ${plan.estimatedComplexity}). Steps: ${plan.steps.map(s => s.description).join('; ')}` },
      ],
      temperature: 0.3,
      max_tokens: 80,
    });
    return response.choices[0]?.message?.content?.trim().split('\n')[0] || `feat(bounty): ${bounty.title.substring(0, 50)}`;
  }

  private async getPRBody(bounty: Bounty, plan: AnalysisPlan): Promise<string> {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: 'Write a professional PR description for SolFoundry. Include: Summary, How it addresses each criterion, Testing done.' },
        { role: 'user', content: `PR for bounty: ${bounty.title}\nURL: ${bounty.url}\nReward: ${bounty.reward}\nTier: ${bounty.tier}\n\nAcceptance Criteria:\n${plan.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\nSteps:\n${plan.steps.map(s => `- ${s.order}. ${s.description}`).join('\n')}` },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });
    return response.choices[0]?.message?.content || `## Summary\n${plan.acceptanceCriteria.join('\n')}`;
  }
}
