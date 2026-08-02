#!/usr/bin/env node
// hermes-verify-845: ad-hoc verification of the SolFoundry Auto-Submit Agent (#845).
import { loadAgentConfig, validateConfig } from './src/config.js';
import { classifyBounties } from './src/classifier.js';
import { createProvider } from './src/llm.js';

let ok = 0;
function check(label, fn) {
  try { fn(); ok++; console.log(`[PASS] ${label}`); }
  catch (e) { console.error(`[FAIL] ${label}: ${e}`); process.exitCode = 1; }
}

check('config defaults', () => {
  const cfg = loadAgentConfig();
  if (cfg.baseUrl !== 'https://api.solfoundry.io') throw new Error(cfg.baseUrl);
  if (!cfg.submitPrs) throw new Error('submitPrs');
});

check('validateConfig reports missing keys for claude', () => {
  const missing = validateConfig(loadAgentConfig());
  if (!missing.some((m) => m === 'ANTHROPIC_API_KEY')) throw new Error(String(missing));
});

check('mock backend needs no keys when SUBMIT_PRS=false', () => {
  process.env.LLM_BACKEND = 'mock';
  process.env.SUBMIT_PRS = 'false';
  const cfg = loadAgentConfig();
  if (cfg.llmBackend !== 'mock') throw new Error(cfg.llmBackend);
  if (cfg.submitPrs) throw new Error('still true');
  const missing = validateConfig(cfg);
  if (missing.length > 0) throw new Error(String(missing));
  delete process.env.LLM_BACKEND;
  delete process.env.SUBMIT_PRS;
});

check('classifier scores a matching backend bounty highly', () => {
  const b = [{ id: 'x', title: 'Fix API', description: 'd', category: 'backend',
    rewardAmount: 100, requiredSkills: ['typescript', 'rest-api'],
    matchedSkills: [], feasibilityScore: 0, matchedCapability: null, issueNumber: null }];
  const out = classifyBounties(b);
  if (out.length !== 1) throw new Error('len=' + out.length);
  if (out[0].feasibilityScore < 0.7) throw new Error(out[0].feasibilityScore);
});

check('classifier rejects an unknown-skill bounty', () => {
  const b = [{ id: 'x', title: 'X', description: 'd', category: 'backend',
    rewardAmount: 100, requiredSkills: Array.from({ length: 20 }, (_, i) => 'unknown_' + i),
    matchedSkills: [], feasibilityScore: 0, matchedCapability: null, issueNumber: null }];
  if (classifyBounties(b).length !== 0) throw new Error('should filter');
});

check('classifier fallback for unrecognised category', () => {
  const b = [{ id: 'x', title: 'X', description: 'd', category: 'unknown-cat',
    rewardAmount: 100, requiredSkills: ['typescript'],
    matchedSkills: [], feasibilityScore: 0, matchedCapability: null, issueNumber: null }];
  const out = classifyBounties(b);
  if (out.length !== 1) throw new Error('len=' + out.length);
  if (out[0].feasibilityScore < 0.4) throw new Error(out[0].feasibilityScore);
});

check('classifier sorts highest feasibility first', () => {
  const b = [
    { id: 'weak', title: 'W', description: 'd', category: 'backend', rewardAmount: 100,
      requiredSkills: ['rust', 'unknown_x'], matchedSkills: [], feasibilityScore: 0, matchedCapability: null, issueNumber: null },
    { id: 'strong', title: 'S', description: 'd', category: 'backend', rewardAmount: 100,
      requiredSkills: ['typescript', 'python', 'testing'], matchedSkills: [], feasibilityScore: 0, matchedCapability: null, issueNumber: null },
  ];
  const out = classifyBounties(b);
  if (out[0].id !== 'strong') throw new Error(out[0].id);
});

check('mock LLMProvider returns deterministic content', async () => {
  const p = createProvider('mock', { model: 'test' });
  const r = await p.chat([{ role: 'user', content: 'hi' }]);
  if (r.provider !== 'mock') throw new Error(r.provider);
  if (r.content.length === 0) throw new Error('empty');
});

process.on('exit', () => { if (!process.exitCode) console.log(`\n[OK] all ${ok} checks passed`); });
