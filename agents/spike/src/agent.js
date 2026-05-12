#!/usr/bin/env node
/**
 * Spike — Autonomous Bounty-Hunting Agent
 * A self-contained AI agent that finds, audits, and fixes open-source security bounties.
 * 
 * No external dependencies beyond npm packages (Anthropic SDK + Octokit).
 * Run anywhere: `npm install && spike discover`
 */

const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');
require('dotenv').config();

// ── Configuration ──
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
// For AI fix generation, uses Anthropic Claude as fallback if SILICONFLOW_KEY is not set
const SILICONFLOW_KEY = process.env.SILICONFLOW_KEY;

if (!GITHUB_TOKEN) {
  console.error('❌ GITHUB_TOKEN required. Set it in .env or export it.');
  process.exit(1);
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });

// ── Agent State ──
const STATE_DIR = path.join(__dirname, '..', 'state');
fs.mkdirSync(STATE_DIR, { recursive: true });

function log(level, msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`${ts} [${level}] ${msg}`);
}

// ── Tool 1: Discover Bounties ──
async function discoverBounties() {
  log('INFO', '🔍 Scanning for bounty opportunities...');
  const results = [];

  // GitHub issues with bounty label
  try {
    const { data } = await octokit.search.issuesAndPullRequests({
      q: 'label:bounty is:issue is:open',
      sort: 'updated',
      per_page: 15,
    });
    for (const issue of data.items.slice(0, 10)) {
      results.push({
        source: 'github',
        url: issue.html_url,
        repo: issue.repository_url?.replace('https://api.github.com/repos/', ''),
        title: issue.title,
        labels: issue.labels.map(l => l.name),
      });
    }
    log('INFO', `  GitHub: ${data.items.length} bounty issues found`);
  } catch (e) {
    log('WARN', `  GitHub search: ${e.message}`);
  }

  // Security advisories
  try {
    const { data } = await octokit.request('GET /advisories', {
      per_page: 10,
      type: 'reviewed',
    });
    for (const adv of data) {
      results.push({
        source: 'ghsa',
        id: adv.ghsa_id,
        severity: adv.severity,
        summary: adv.summary,
        description: adv.description?.slice(0, 300),
      });
    }
    log('INFO', `  Advisories: ${data.length} recent`);
  } catch (e) {
    log('WARN', `  Advisories: ${e.message}`);
  }

  return results;
}

// ── Tool 2: Static Security Audit ──
async function auditRepo(owner, repo) {
  log('INFO', `🔬 Auditing ${owner}/${repo}...`);
  const findings = [];

  // Clone shallow
  const dir = path.join(STATE_DIR, `${owner}_${repo}`);
  if (!fs.existsSync(dir)) {
    try {
      const { execSync } = require('child_process');
      execSync(`git clone --depth 1 "https://github.com/${owner}/${repo}.git" "${dir}"`, {
        stdio: 'pipe', timeout: 60000,
      });
      log('INFO', `  Cloned ${owner}/${repo}`);
    } catch (e) {
      log('ERROR', `  Clone failed: ${e.message}`);
      return findings;
    }
  }

  // Pattern scan (no Semgrep dependency — pure regex)
  const patterns = [
    { re: /\.innerHTML\s*=/, msg: 'Direct innerHTML assignment — XSS risk', sev: 'high' },
    { re: /eval\s*\(/, msg: 'eval() — potential code injection', sev: 'high' },
    { re: /(api.?key|secret|password|token)\s*[=:]\s*['"`][A-Za-z0-9_\-=]{16,}/i, msg: 'Hardcoded credential', sev: 'high' },
    { re: /exec(?:Sync)?\(/, msg: 'Command execution — injection risk', sev: 'high' },
    { re: /child_process\./, msg: 'Child process usage', sev: 'medium' },
    { re: /crypto\.createHash\(['"](md5|sha1)['"]/, msg: 'Weak hash function', sev: 'medium' },
    { re: /http:\/\/(?!localhost|127\.0\.0\.1)/, msg: 'Insecure HTTP URL', sev: 'low' },
    { re: /process\.env\./, msg: 'Environment variable access', sev: 'info' },
    { re: /TODO|FIXME|HACK/, msg: 'Unresolved TODO marker', sev: 'info' },
    { re: /console\.log\(/, msg: 'Debug logging in production code', sev: 'low' },
  ];

  function walk(dirPath) {
    try {
      for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
        if (/^(\.|node_modules|dist|build|vendor|.git)/.test(entry.name)) continue;
        const full = path.join(dirPath, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(js|ts|jsx|tsx|py|rb|go)$/.test(entry.name)) {
          try {
            const content = fs.readFileSync(full, 'utf-8');
            const rel = full.replace(dir, '').slice(1);
            for (const p of patterns) {
              const lines = content.split('\n');
              const matchLine = lines.findIndex(l => p.re.test(l));
              if (matchLine >= 0) {
                findings.push({
                  severity: p.sev,
                  file: rel,
                  line: matchLine + 1,
                  message: p.msg,
                  snippet: lines[matchLine].trim().slice(0, 100),
                });
              }
            }
          } catch { /* binary or unreadable */ }
        }
      }
    } catch { /* permission */ }
  }
  walk(dir);

  log('INFO', `  Found ${findings.length} issues`);
  return findings;
}

// ── Tool 3: AI Fix Generation ──
async function generateFix(filePath, finding) {
  log('INFO', `🧠 Generating fix for ${finding.file}:${finding.line}`);
  
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const start = Math.max(0, (finding.line || 1) - 6);
  const end = Math.min(lines.length, (finding.line || 1) + 4);
  const context = lines.slice(start, end).join('\n');

  let fix = null;

  // Try Anthropic API first
  if (ANTHROPIC_API_KEY) {
    try {
      const Anthropic = require('@anthropic-ai/sdk');
      const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `Fix this vulnerability. Return ONLY the fixed code snippet, no explanation.

Vulnerability: ${finding.message}
File: ${finding.file}
Line: ${finding.line || 'N/A'}

Code context:
\`\`\`
${context}
\`\`\``
        }]
      });
      fix = msg.content[0]?.text || null;
    } catch {}
  }

  // Fallback: SiliconFlow API
  if (!fix && SILICONFLOW_KEY) {
    try {
      const https = require('https');
      const prompt = `Fix this vulnerability. Return ONLY the fixed code.

Vulnerability: ${finding.message}
Severity: ${finding.severity}
File: ${finding.file}
Line: ${finding.line || 'N/A'}

Code context:
\`\`\`
${context}
\`\`\``;

      fix = await new Promise((resolve) => {
        const req = https.request({
          hostname: 'api.siliconflow.cn', path: '/v1/chat/completions', method: 'POST',
          headers: { 'Authorization': `Bearer ${SILICONFLOW_KEY}`, 'Content-Type': 'application/json' },
        }, res => {
          let d = ''; res.on('data', c => d += c);
          res.on('end', () => {
            try { resolve(JSON.parse(d).choices?.[0]?.message?.content); }
            catch { resolve(null); }
          });
        });
        req.on('error', () => resolve(null));
        req.write(JSON.stringify({
          model: 'THUDM/GLM-4.1V-9B-Thinking',
          messages: [{ role: 'user', content: prompt }]
        }));
        req.end();
      });
    } catch {}
  }

  return fix;
}

// ── Tool 4: Submit PR ──
async function submitPR(owner, repo, branch, title, body, files) {
  log('INFO', `📤 Submitting PR to ${owner}/${repo}...`);

  // Create branch from fork
  const fork = `lloyd-c137`; // This would be the user's fork
  try {
    // Create or update files
    for (const { path: fpath, content } of files) {
      // Get current file SHA if it exists
      let sha = null;
      try {
        const { data } = await octokit.repos.getContent({
          owner: fork, repo, path: fpath, ref: branch,
        });
        sha = data.sha;
      } catch {}

      await octokit.repos.createOrUpdateFileContents({
        owner: fork, repo, path: fpath,
        message: `fix: ${title}`,
        content: Buffer.from(content).toString('base64'),
        sha: sha || undefined,
        branch,
      });
    }

    // Create PR to upstream
    const { data: pr } = await octokit.pulls.create({
      owner, repo,
      title,
      body,
      head: `${fork}:${branch}`,
      base: 'main',
    });
    
    log('INFO', `  ✅ PR #${pr.number}: ${pr.html_url}`);
    return pr.html_url;
  } catch (e) {
    log('ERROR', `  PR failed: ${e.message}`);
    return null;
  }
}

// ── Main Orchestration ──
async function runPipeline() {
  console.log('\n🎯 Spike — Autonomous Bounty Hunter\n');

  // Phase 1: Discover
  console.log('── Phase 1: Discovery ──');
  const opportunities = await discoverBounties();
  console.log(`\n  Found ${opportunities.length} opportunities\n`);

  // Phase 2: Audit top targets
  console.log('── Phase 2: Audit ──');
  const targets = [
    { owner: 'expressjs', repo: 'express' },
  ];
  
  const auditResults = [];
  for (const t of targets) {
    console.log(`\n── ${t.owner}/${t.repo} ──`);
    const findings = await auditRepo(t.owner, t.repo);
    auditResults.push({ ...t, findings });
    
    // Print summary
    const bySev = {};
    for (const f of findings) {
      bySev[f.severity] = (bySev[f.severity] || 0) + 1;
    }
    for (const [sev, count] of Object.entries(bySev)) {
      console.log(`  ${sev}: ${count}`);
    }
  }

  // Phase 3: Generate fixes for high-severity findings
  console.log('\n── Phase 3: AI Fix Generation ──');
  if (!ANTHROPIC_API_KEY && !SILICONFLOW_KEY) {
    console.log('  ⚠️  No AI API key set. Set ANTHROPIC_API_KEY or SILICONFLOW_KEY for fix generation.');
    console.log('  📄 Audit report saved to state/ for manual review.');
  } else {
    for (const r of auditResults) {
      const critical = r.findings.filter(f => f.severity === 'high');
      for (const f of critical.slice(0, 3)) {
        const filePath = path.join(STATE_DIR, `${r.owner}_${r.repo}`, f.file);
        const fix = await generateFix(filePath, f);
        if (fix) {
          console.log(`  ✅ ${f.file}:${f.line} — fix generated`);
        }
      }
    }
  }

  // Phase 4: Report
  const summary = {
    timestamp: new Date().toISOString(),
    opportunities,
    audits: auditResults,
  };
  fs.writeFileSync(path.join(STATE_DIR, 'last-run.json'), JSON.stringify(summary, null, 2));
  console.log(`\n💾 Full report saved to state/last-run.json`);
}

// ── CLI ──
const cmd = process.argv[2] || 'help';
(async () => {
  try {
    if (cmd === 'discover') {
      const results = await discoverBounties();
      console.log(JSON.stringify(results, null, 2));
    } else if (cmd === 'scan') {
      const [owner, repo] = (process.argv[3] || '').split('/');
      if (!owner || !repo) throw new Error('Usage: spike scan owner/repo');
      const findings = await auditRepo(owner, repo);
      console.log(JSON.stringify(findings, null, 2));
    } else if (cmd === 'pipeline') {
      await runPipeline();
    } else {
      console.log(`
  🎯 Spike — Autonomous Bounty Hunter

  Usage:
    spike discover              Find bounty opportunities
    spike scan <owner/repo>     Security audit a repo
    spike pipeline              Full auto: discover → audit → fix

  Environment (.env):
    GITHUB_TOKEN=...           (required)
    ANTHROPIC_API_KEY=...      (for AI fix generation)
    SILICONFLOW_KEY=...        (fallback for AI fix generation)
      `);
    }
  } catch (e) {
    console.error(`\n❌ ${e.message}`);
    process.exit(1);
  }
})();
