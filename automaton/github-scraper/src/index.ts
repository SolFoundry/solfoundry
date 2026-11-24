import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import cron from 'node-cron';

const app = express();

const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;
const SOLFOUNDRY_API_KEY = process.env.SOLFOUNDRY_API_KEY;
const SOLFOUNDRY_API_URL = process.env.SOLFOUNDRY_API_URL || 'https://api.solfoundry.com/v1/bounties';
const ALLOWED_REPOS = (process.env.ALLOWED_REPOS || 'SolFoundry/solfoundry').split(',');

if (!GITHUB_WEBHOOK_SECRET || !SOLFOUNDRY_API_KEY) {
    console.error('FATAL: GITHUB_WEBHOOK_SECRET and SOLFOUNDRY_API_KEY must be set.');
    process.exit(1);
}

const processedEvents = new Set<string>();

app.use(express.json({
    verify: (req: any, res: Response, buf: Buffer) => {
        req.rawBody = buf;
    }
}));

function verifySignature(req: any, res: Response, next: NextFunction) {
    const signature = req.headers['x-hub-signature-256'] as string;
    if (!signature) return res.status(401).send('No signature provided');

    const hmac = crypto.createHmac('sha256', GITHUB_WEBHOOK_SECRET!);
    const digest = Buffer.from('sha256=' + hmac.update(req.rawBody).digest('hex'), 'utf8');
    const sigBuffer = Buffer.from(signature, 'utf8');

    if (sigBuffer.length !== digest.length || !crypto.timingSafeEqual(sigBuffer, digest)) {
        return res.status(401).send('Invalid signature');
    }
    next();
}

async function fetchWithRetry(url: string, options: any, retries = 3, backoff = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.ok) return response;
            console.warn(`API Attempt ${i + 1} failed: ${response.statusText}`);
        } catch (error: any) {
            console.warn(`API Attempt ${i + 1} error: ${error.message}`);
        }
        await new Promise(r => setTimeout(r, backoff * Math.pow(2, i)));
    }
    throw new Error('All API retry attempts failed');
}

function getTier(labels: any[]): string {
    const names = labels.map(l => l.name.toLowerCase());
    if (names.includes('tier-1') || names.includes('t1')) return 'T1';
    if (names.includes('tier-2') || names.includes('t2')) return 'T2';
    if (names.includes('tier-3') || names.includes('t3')) return 'T3';
    return 'Standard';
}

async function syncIssueToSolFoundry(issue: any, repoFullName: string) {
    const labels = issue.labels.map((l: any) => l.name.toLowerCase());
    if (!labels.includes('bounty')) return;

    const payload = {
        issue_id: issue.id,
        source_url: issue.html_url,
        title: issue.title,
        description: issue.body,
        tier: getTier(issue.labels),
        repo: repoFullName,
        author: issue.user.login,
        state: issue.state,
        created_at: issue.created_at,
        updated_at: issue.updated_at
    };

    await fetchWithRetry(SOLFOUNDRY_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SOLFOUNDRY_API_KEY}`
        },
        body: JSON.stringify(payload)
    });
    console.log(`[SUCCESS] Synced bounty: ${issue.html_url}`);
}

app.post('/webhook/github', verifySignature, async (req: any, res: Response) => {
    const event = req.headers['x-github-event'];
    const deliveryId = req.headers['x-github-delivery'] as string;

    if (processedEvents.has(deliveryId)) {
        return res.status(200).send('Already processed');
    }
    processedEvents.add(deliveryId);
    if (processedEvents.size > 10000) {
        const firstItem = processedEvents.values().next().value;
        processedEvents.delete(firstItem);
    }

    const repoFullName = req.body.repository?.full_name;
    
    if (!ALLOWED_REPOS.includes(repoFullName)) {
        return res.status(403).send('Repository not in whitelist');
    }

    if (event === 'issues' && ['opened', 'edited', 'labeled', 'unlabeled', 'closed', 'reopened'].includes(req.body.action)) {
        try {
            await syncIssueToSolFoundry(req.body.issue, repoFullName);
        } catch (e: any) {
            console.error('[ERROR] Sync failed:', e.message);
            return res.status(500).send('Internal Sync Error');
        }
    }
    res.sendStatus(200);
});

cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Starting periodic issue sync...');
    for (const repo of ALLOWED_REPOS) {
        try {
            const res = await fetch(`https://api.github.com/repos/${repo}/issues?labels=bounty&state=all`);
            if (!res.ok) continue;
            const issues = await res.json();
            for (const issue of issues) {
                await syncIssueToSolFoundry(issue, repo).catch(e => console.error(`Cron error for ${issue.html_url}:`, e.message));
            }
        } catch (e: any) {
            console.error(`[CRON ERROR] Failed to fetch repo ${repo}:`, e.message);
        }
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SolFoundry Webhook Scraper running on port ${PORT}`));
