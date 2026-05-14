"use strict";
/**
 * SolFoundry API client for the Discord bot.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchLatestBounties = fetchLatestBounties;
exports.fetchOpenBounties = fetchOpenBounties;
exports.fetchLeaderboard = fetchLeaderboard;
const config_1 = require("./config");
/* ─── Fetch helpers ─── */
async function apiFetch(path, params) {
    const url = new URL(path, config_1.env.SOLFOUNDRY_API_URL);
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            url.searchParams.set(k, v);
        }
    }
    const res = await fetch(url.toString());
    if (!res.ok)
        throw new Error(`SolFoundry API ${res.status}: ${await res.text()}`);
    return res.json();
}
/* ─── Bounty methods ─── */
async function fetchLatestBounties(since) {
    const data = await apiFetch('/api/bounties', {
        status: 'open',
        limit: '10',
        sort: 'created_at',
        order: 'desc',
    });
    // Filter to only bounties created after `since`
    return data.items.filter(b => new Date(b.created_at) > new Date(since));
}
async function fetchOpenBounties(limit = 10) {
    const data = await apiFetch('/api/bounties', {
        status: 'open',
        limit: String(limit),
        sort: 'reward_amount',
        order: 'desc',
    });
    return data.items;
}
/* ─── Leaderboard methods ─── */
async function fetchLeaderboard(limit = 10) {
    const data = await apiFetch('/api/leaderboard', {
        limit: String(limit),
    });
    return data.entries ?? [];
}
//# sourceMappingURL=api.js.map