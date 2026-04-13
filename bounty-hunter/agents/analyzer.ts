import OpenAI from 'openai';
import type { Bounty, AnalysisPlan, AgentResult } from '../types/index.js';

const MODEL = process.env.LLM_PRIMARY_MODEL || 'gpt-4o';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export class Analyzer {
  async analyze(bounty: Bounty): Promise<AgentResult<AnalysisPlan>> {
    const start = Date.now();

    const systemPrompt = `You are a senior software architect analyzing GitHub issues for bounty implementation.

For each issue, produce a detailed implementation plan with:
1. Files that need to be created or modified
2. Step-by-step implementation order (max 8 steps)
3. Test strategy
4. Acceptance criteria

Be specific — include file paths and code patterns. Respond ONLY with valid JSON in this exact format, no markdown, no explanation:
{"estimatedComplexity":"low|medium|high","filesToModify":["path/file.ts"],"filesToCreate":["new/file.ts"],"steps":[{"order":1,"description":"do X","files":["path/file.ts"],"testCommands":["npm test"]}],"tests":["test/file.test.ts"],"acceptanceCriteria":["criterion 1","criterion 2"]}`;

    const userPrompt = `Analyze this bounty issue:

# Issue Title
${bounty.title}

# Issue Body
${bounty.body}

# Repository
${bounty.repo}

# Labels
${bounty.labels.join(', ')}

Return ONLY the JSON plan, no markdown code blocks or explanation.`;

    try {
      const response = await client.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('LLM did not return valid JSON plan: ' + content.substring(0, 200));
      }

      const raw = JSON.parse(jsonMatch[0]);
      const plan: AnalysisPlan = {
        bountyId: bounty.id,
        estimatedComplexity: raw.estimatedComplexity || 'medium',
        filesToModify: raw.filesToModify || [],
        filesToCreate: raw.filesToCreate || [],
        steps: (raw.steps || []).map((s: any, i: number) => ({
          order: s.order || i + 1,
          description: s.description || '',
          files: s.files || [],
          testCommands: s.testCommands || [],
        })),
        tests: raw.tests || [],
        acceptanceCriteria: raw.acceptanceCriteria || [],
      };

      return {
        success: true,
        data: plan,
        tokensUsed: response.usage?.total_tokens,
        duration: Date.now() - start,
      };
    } catch (e: any) {
      return {
        success: false,
        error: e.message,
        duration: Date.now() - start,
      };
    }
  }
}
