"use strict";
/**
 * Discord embed builders for SolFoundry bounty and leaderboard displays.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.bountyEmbed = bountyEmbed;
exports.leaderboardEmbed = leaderboardEmbed;
exports.bountyButtons = bountyButtons;
const discord_js_1 = require("discord.js");
const FNDRY_EMOJI = '🤑';
const TIER_COLORS = {
    t1: 0x00E676, // emerald
    t2: 0xFFA726, // amber
    t3: 0xAB47BC, // purple
};
function bountyEmbed(bounty) {
    const color = TIER_COLORS[bounty.tier] ?? 0x00E676;
    const reward = (bounty.reward_amount / 1_000_000).toLocaleString();
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(color)
        .setTitle(`${FNDRY_EMOJI} ${bounty.title}`)
        .setURL(`${process.env.SOLFOUNDRY_API_URL ?? 'https://solfoundry.xyz'}/bounties/${bounty.id}`)
        .setDescription(bounty.description?.slice(0, 300) ?? 'No description')
        .addFields({ name: 'Reward', value: `${reward} $${bounty.reward_token}`, inline: true }, { name: 'Tier', value: bounty.tier.toUpperCase(), inline: true }, { name: 'Status', value: bounty.status, inline: true })
        .setTimestamp(new Date(bounty.created_at));
    if (bounty.skills?.length) {
        embed.addFields({ name: 'Skills', value: bounty.skills.join(', '), inline: false });
    }
    if (bounty.deadline) {
        const deadline = new Date(bounty.deadline);
        embed.addFields({ name: 'Deadline', value: `<t:${Math.floor(deadline.getTime() / 1000)}:R>`, inline: true });
    }
    return embed;
}
function leaderboardEmbed(entries) {
    const lines = entries.map((e, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**#${e.rank}**`;
        const earned = (e.total_earned / 1_000_000).toLocaleString();
        return `${medal} **${e.username}** — ${e.bounties_completed} bounties, ${earned} $FNDRY earned`;
    });
    return new discord_js_1.EmbedBuilder()
        .setColor(0xFFD700) // gold
        .setTitle('🏆 SolFoundry Leaderboard')
        .setDescription(lines.join('\n'))
        .setTimestamp();
}
function bountyButtons(bounty) {
    return new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setLabel('View Bounty')
        .setStyle(discord_js_1.ButtonStyle.Link)
        .setURL(`${process.env.SOLFOUNDRY_API_URL ?? 'https://solfoundry.xyz'}/bounties/${bounty.id}`), ...(bounty.github_issue_url
        ? [new discord_js_1.ButtonBuilder().setLabel('GitHub Issue').setStyle(discord_js_1.ButtonStyle.Link).setURL(bounty.github_issue_url)]
        : []));
}
//# sourceMappingURL=embeds.js.map