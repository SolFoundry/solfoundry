#!/usr/bin/env node
/**
 * Spike v2 — Autonomous Multi-LLM Bounty-Hunting Agent
 * 
 * True multi-agent orchestration:
 *   Planner (DeepSeek) → Auditor (Semgrep + Patterns) → Fixer (Claude/GLM) → Validator (DeepSeek)
 * 
 * Run: npm install && spike pipeline
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const https = require('https');
require('dotenv').config();

// ── Config ──
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const SILICONFLOW_KEY = process.env.SILICONFLOW_KEY;
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const STATE = path.join(__dirname, '..', 'state');

if (!TOKEN) { console.error('❌ GITHUB_TOKEN required'); process.exit(1); }
fs.mkdirSync(STATE, { recursive: true });

function log(lvl, msg) { console.error(`${new Date().toISOString().slice(11, 19)} [${lvl}] ${msg}`); }

// ── Multi-LLM Router ──
async function callLLM(provider, prompt) {
  if (provider === 'deepseek' && DEEPSEEK_KEY) {
    return await apiPost('api.deepseek.com', '/v1/chat/completions', DEEPSEEK_KEY, {
      model: "deepseek-v4-flash", messages: [{ role: 'user', content: prompt }], max_tokens: 2000
    });
  }
  if (provider === 'anthropic' && ANTHROPIC_KEY) {
    return await apiPost('api.anthropic.com', '/v1/messages', ANTHROPIC_KEY, {
      model: 'claude-sonnet-4-20250514', max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    }, 'x-api-key');
  }
  if (provider === 'siliconflow' && SILICONFLOW_KEY) {
    return await apiPost('api.siliconflow.cn', '/v1/chat/completions', SILICONFLOW_KEY, {
      model: 'THUDM/GLM-4.1V-9B-Thinking', messages: [{ role: 'user', content: prompt }], max_tokens: 2000
    });
  }
  return null;
}

async function apiPost(host, path, key, body, authHeader = 'authorization') {
  const data = JSON.stringify(body);
  return new Promise((resolve) => {
    const req = https.request({ hostname: host, path, method: 'POST',
      headers: {
        [authHeader]: authHeader === 'x-api-key' ? key : `Bearer ${key}`,
        'Content-Type': 'application/json'
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          resolve(j.choices?.[0]?.message?.content || j.content?.[0]?.text || null);
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.write(data); req.end();
  });
}

// ── Agent 1: Planner ──
async function plan(repo) {
  log('INFO', `🧠 [Planner] Analyzing ${repo}...`);
  const prompt = `You are a security bounty planning agent. Given the repository "${repo}", 
plan a step-by-step security audit. Consider:
1. What type of project is this? (framework, library, app, CLI tool)
2. What security vectors are most relevant? (XSS, injection, secrets, CI/CD, deps)
3. What files should be prioritized? (config files, CI workflows, auth logic, user input handlers)
4. What specific patterns to look for

Output a concise plan (3-5 bullet points).`;

  const plan = await callLLM('deepseek', prompt) 
    || await callLLM('siliconflow', prompt)
    || "1. Scan CI/CD for pull_request_target\n2. Check for hardcoded secrets\n3. Audit auth/input handling";
  
  log('INFO', `[Planner] Plan: ${plan.slice(0, 200)}`);
  return plan;
}

// ── Agent 2: Auditor ──
async function audit(owner, repo) {
  log('INFO', `🔬 [Auditor] Scanning ${owner}/${repo}...`);
  const findings = [];
  const dir = path.join(STATE, `${owner}_${repo}`);
  
  if (!fs.existsSync(dir)) {
    try {
      execSync(`git clone --depth 1 "https://github.com/${owner}/${repo}.git" "${dir}"`, 
        { stdio: 'pipe', timeout: 60000 });
    } catch (e) { log('ERROR', `Clone: ${e.message}`); return findings; }
  }

  // Tool 1: Semgrep security scan
  try {
    const r = spawnSync('semgrep', [
      '--config', 'p/security-audit', '--config', 'p/owasp-top-ten',
      '--config', 'p/command-injection', '--config', 'p/xss',
      '--json', '--no-git-ignore', '--quiet', '--metrics', 'off',
      '--max-lines-per-finding', '3',
      dir
    ], { timeout: 120000, maxBuffer: 5 * 1024 * 1024 });

    if (r.stdout) {
      const sg = JSON.parse(r.stdout.toString());
      for (const f of sg.results || []) {
        findings.push({
          tool: 'semgrep', severity: mapSev(f.extra?.severity),
          check: f.check_id, file: f.path.replace(dir, '').slice(1),
          line: f.start?.line, message: f.extra?.message || f.check_id,
        });
      }
    }
  } catch {}

  // Tool 2: Pattern scan (CI/CD specific - our specialty)
  const ciPatterns = [
    { re: /pull_request_target/, msg: 'pull_request_target in CI — review access control', sev: 'high' },
    { re: /\${{.*github\.event.*pull_request.*}}/, msg: 'GitHub context injection in CI', sev: 'critical' },
    { re: /\${{.*github\.event\.issue.*}}/, msg: 'GitHub issue context in CI step — injection risk', sev: 'critical' },
    { re: /\${{.*inputs\..*}}/, msg: 'Input interpolation in run step — injection risk', sev: 'high' },
    { re: /actions\/checkout@.*\n\s+with:.*\n\s+ref:\s*\$/, msg: 'Checkout with dynamic ref — potential unsafe', sev: 'medium' },
    { re: /secrets\.GITHUB_TOKEN.*run:.*\$\{\{/, msg: 'Token + interpolation in run step', sev: 'high' },
  ];

  const secPatterns = [
    { re: /\.innerHTML\s*=/, msg: 'innerHTML assignment — XSS', sev: 'high' },
    { re: /eval\s*\(/, msg: 'eval() — code injection risk', sev: 'high' },
    { re: /(?:api[-_]?key|secret|password|token)\s*[=:]\s*['"`][A-Za-z0-9_\-=]{16,}/i, msg: 'Hardcoded credential', sev: 'high' },
    { re: /child_process\.exec(?:Sync)?\s*\(/, msg: 'Command injection surface', sev: 'high' },
    { re: /crypto\.createHash\(['"](md5|sha1)['"]/, msg: 'Weak hash (MD5/SHA1)', sev: 'medium' },
    { re: /verify\s*=\s*False|check_hostname\s*=\s*False/, msg: 'TLS verification disabled', sev: 'high' },
    { re: /http:\/\/(?!localhost|127\.0\.0\.1)/, msg: 'Insecure HTTP', sev: 'low' },
    { re: /console\.log\(/, msg: 'Debug logging', sev: 'low' },
  ];

  function walk(d) {
    try {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (/^(\.|node_modules|dist|build|vendor|.git)/.test(e.name)) continue;
        const f = path.join(d, e.name);
        if (e.isDirectory()) walk(f);
        else if (/\.(yml|yaml)$/.test(e.name)) {
          // CI config check
          const content = fs.readFileSync(f, 'utf-8');
          const rel = f.replace(dir, '').slice(1);
          for (const p of ciPatterns) {
            const lines = content.split('\n');
            const ln = lines.findIndex(l => p.re.test(l)) + 1;
            if (ln > 0) findings.push({
              tool: 'ci-audit', severity: p.sev, file: rel, line: ln,
              message: p.msg, snippet: lines[ln-1].trim().slice(0, 100)
            });
          }
        } else if (/\.(js|ts|jsx|tsx|py|rb|go)$/.test(e.name)) {
          const content = fs.readFileSync(f, 'utf-8');
          const rel = f.replace(dir, '').slice(1);
          for (const p of secPatterns) {
            const lines = content.split('\n');
            const ln = lines.findIndex(l => p.re.test(l)) + 1;
            if (ln > 0) findings.push({
              tool: 'pattern', severity: p.sev, file: rel, line: ln,
              message: p.msg, snippet: lines[ln-1].trim().slice(0, 100)
            });
          }
        }
      }
    } catch {}
  }
  walk(dir);

  return findings;
}

function mapSev(s) { const m = { ERROR:'critical', WARNING:'high', INFO:'medium' }; return m[s] || (s||'').toLowerCase(); }

// ── Agent 3: AI Fixer ──
async function fix(filePath, finding) {
  log('INFO', `🧪 [Fixer] ${finding.file}:${finding.line}`);
  if (!fs.existsSync(filePath)) return null;
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  const s = Math.max(0, (finding.line||1) - 8);
  const e = Math.min(lines.length, (finding.line||1) + 6);
  const ctx = lines.slice(s, e).join('\n');

  const prompt = `Fix this security issue. Return ONLY the fixed code (the changed lines).

Issue: ${finding.message} (${finding.severity})
File: ${finding.file}:${finding.line}

Context:
\`\`\`
${ctx}
\`\`\``;

  // Try Claude, fallback to DeepSeek, fallback to SiliconFlow
  return await callLLM('anthropic', prompt)
    || await callLLM('deepseek', prompt)
    || await callLLM('siliconflow', prompt);
}

// ── Agent 4: Validator ──
async function validate(findings, plan) {
  log('INFO', `✅ [Validator] Scoring findings...`);
  
  const bySev = {};
  for (const f of findings) {
    bySev[f.severity] = (bySev[f.severity] || 0) + 1;
  }

  const prompt = `You are a security review validator. Given this audit plan and findings:

PLAN: ${plan?.slice(0,300)}

FINDINGS:
${Object.entries(bySev).map(([k,v]) => `${k}: ${v}`).join('\n')}
Total: ${findings.length}

Score this security audit:
- Coverage (did we miss obvious areas?): 1-5
- Severity (how critical are the findings?): 1-5  
- Actionability (can these all be fixed?): 1-5

Output: [total score /5] + brief recommendation`;

  const score = await callLLM('deepseek', prompt) 
    || await callLLM('siliconflow', prompt)
    || `Score: 3/5 — review findings manually`;
  
  return score;
}

// ── Main Pipeline ──
async function pipeline(repo) {
  console.log(`\n🎯 Spike v2 — Multi-LLM Bounty Hunter\n`);
  const [owner, r] = repo.split('/');
  
  // Phase 1: Plan
  console.log('── Agent 1: Planner ──');
  const planResult = await plan(repo);
  console.log(`  ${planResult}\n`);
  
  // Phase 2: Audit
  console.log('── Agent 2: Auditor ──');
  const findings = await audit(owner, r);
  const bySev = {};
  for (const f of findings) bySev[f.severity] = (bySev[f.severity] || 0) + 1;
  console.log(`  Total: ${findings.length} findings`);
  for (const s of ['critical','high','medium','low','info']) {
    if (bySev[s]) console.log(`  ${s}: ${bySev[s]}`);
  }
  
  // Show top findings
  const criticals = findings.filter(f => f.severity === 'critical' || f.severity === 'high');
  for (const f of criticals.slice(0, 5)) {
    console.log(`  ⚠️  ${f.file}:${f.line} — ${f.message.slice(0, 60)}`);
  }
  console.log();

  // Phase 3: Fix (if AI keys available)
  if (ANTHROPIC_KEY || DEEPSEEK_KEY || SILICONFLOW_KEY) {
    console.log('── Agent 3: AI Fixer ──');
    const toFix = criticals.filter(f => !f.file.includes('.github/')).slice(0, 3);
    for (const f of toFix) {
      const fp = path.join(STATE, `${owner}_${r}`, f.file);
      const result = await fix(fp, f);
      if (result) console.log(`  ✅ ${f.file}:${f.line} — fix generated`);
      else console.log(`  ⏭️  ${f.file}:${f.line} — skipped`);
    }
    console.log();
  }

  // Phase 4: Validate
  console.log('── Agent 4: Validator ──');
  const score = await validate(findings, planResult);
  console.log(`  ${score}\n`);

  return findings;
}

// ── CLI ──
const cmd = process.argv[2];
(async () => {
  try {
    if (cmd === 'pipeline' && process.argv[3]) {
      await pipeline(process.argv[3]);
    } else if (cmd === 'scan') {
      const [owner, repo] = (process.argv[3]||'').split('/');
      const findings = await audit(owner, repo);
      console.log(JSON.stringify(findings));
    } else {
      console.log(`
  🎯 Spike v2 — Multi-LLM Bounty Hunter

  Usage:
    spike pipeline <owner/repo>   Full multi-agent pipeline
    spike scan <owner/repo>       Quick security audit

  LLM Providers (env):
    ANTHROPIC_API_KEY=...     Claude Sonnet (primary fixer)
    DEEPSEEK_API_KEY=...      DeepSeek (planner + validator)
    SILICONFLOW_KEY=...       GLM-4.1V (fix fallback)
    GITHUB_TOKEN=...          GitHub API (required)
      `);
    }
  } catch (e) { console.error(`❌ ${e.message}`); }
})();
