"use strict";
/**
 * SolFoundry Discord Bot
 *
 * Commands:
 *   /bounties     — List current open bounties
 *   /leaderboard  — Show top contributors
 *   /notify       — Configure personal notification filters
 *   /bounty <id>  — View a specific bounty
 *
 * Automatically polls for new bounties and posts rich embeds
 * to the configured channel.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const cron = __importStar(require("node-cron"));
const config_1 = require("./config");
const api_1 = require("./api");
const embeds_1 = require("./embeds");
const filters_1 = require("./filters");
/* ─── Slash commands ─── */
const commands = [
    new discord_js_1.SlashCommandBuilder()
        .setName('bounties')
        .setDescription('List current open bounties')
        .addIntegerOption(opt => opt.setName('limit').setDescription('Number of bounties (1-10)').setMinValue(1).setMaxValue(10)),
    new discord_js_1.SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Show top SolFoundry contributors'),
    new discord_js_1.SlashCommandBuilder()
        .setName('bounty')
        .setDescription('View a specific bounty')
        .addStringOption(opt => opt.setName('id').setDescription('Bounty ID').setRequired(true)),
    new discord_js_1.SlashCommandBuilder()
        .setName('notify')
        .setDescription('Configure your bounty notification preferences')
        .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable or disable notifications'))
        .addIntegerOption(opt => opt.setName('min-reward').setDescription('Minimum reward amount in FNDRY').setMinValue(0))
        .addStringOption(opt => opt.setName('tiers').setDescription('Comma-separated tiers (t1,t2,t3)'))
        .addStringOption(opt => opt.setName('skills').setDescription('Comma-separated skill tags')),
].map(cmd => cmd.toJSON());
/* ─── Bot ─── */
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
    ],
});
let lastPollTimestamp = new Date().toISOString();
/* ─── Register commands ─── */
async function registerCommands() {
    const rest = new discord_js_1.REST({ version: '10' }).setToken(config_1.env.DISCORD_TOKEN);
    if (config_1.env.GUILD_ID) {
        await rest.put(discord_js_1.Routes.applicationGuildCommands(client.user.id, config_1.env.GUILD_ID), { body: commands });
        console.log(`Registered ${commands.length} guild commands`);
    }
    else {
        await rest.put(discord_js_1.Routes.applicationCommands(client.user.id), { body: commands });
        console.log(`Registered ${commands.length} global commands`);
    }
}
/* ─── Command handlers ─── */
async function handleBounties(interaction) {
    const limit = interaction.options.getInteger('limit') ?? 5;
    await interaction.deferReply();
    try {
        const bounties = await (0, api_1.fetchOpenBounties)(limit);
        if (bounties.length === 0) {
            await interaction.editReply('No open bounties right now. Check back soon!');
            return;
        }
        for (const bounty of bounties.slice(0, 5)) {
            await interaction.followUp({
                embeds: [(0, embeds_1.bountyEmbed)(bounty)],
                components: [(0, embeds_1.bountyButtons)(bounty)],
            });
        }
        if (bounties.length > 5) {
            await interaction.followUp(`...and ${bounties.length - 5} more. Visit SolFoundry for the full list.`);
        }
    }
    catch (err) {
        console.error('Error fetching bounties:', err);
        await interaction.editReply('Failed to fetch bounties. Try again later.');
    }
}
async function handleLeaderboard(interaction) {
    await interaction.deferReply();
    try {
        const entries = await (0, api_1.fetchLeaderboard)(config_1.env.LEADERBOARD_LIMIT);
        if (entries.length === 0) {
            await interaction.editReply('No leaderboard data yet.');
            return;
        }
        await interaction.editReply({ embeds: [(0, embeds_1.leaderboardEmbed)(entries)] });
    }
    catch (err) {
        console.error('Error fetching leaderboard:', err);
        await interaction.editReply('Failed to fetch leaderboard. Try again later.');
    }
}
async function handleBounty(interaction) {
    const id = interaction.options.getString('id', true);
    await interaction.deferReply();
    try {
        // Fetch single bounty — use the API directly
        const res = await fetch(`${config_1.env.SOLFOUNDRY_API_URL}/api/bounties/${id}`);
        if (!res.ok)
            throw new Error(`API returned ${res.status}`);
        const bounty = (await res.json());
        await interaction.editReply({
            embeds: [(0, embeds_1.bountyEmbed)(bounty)],
            components: [(0, embeds_1.bountyButtons)(bounty)],
        });
    }
    catch (err) {
        console.error('Error fetching bounty:', err);
        await interaction.editReply(`Bounty #${id} not found or API error.`);
    }
}
async function handleNotify(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const enabled = interaction.options.getBoolean('enabled');
    const minReward = interaction.options.getInteger('min-reward');
    const tiersStr = interaction.options.getString('tiers');
    const skillsStr = interaction.options.getString('skills');
    const update = {};
    if (enabled !== null)
        update.enabled = enabled;
    if (minReward !== null)
        update.minReward = minReward;
    if (tiersStr)
        update.tiers = tiersStr.split(',').map(t => t.trim());
    if (skillsStr)
        update.skills = skillsStr.split(',').map(s => s.trim());
    const filter = (0, filters_1.setFilter)(guildId, userId, update);
    const lines = [
        `**Notification Preferences** for <@${userId}>`,
        `Enabled: ${filter.enabled ? '✅' : '❌'}`,
        `Min Reward: ${filter.minReward.toLocaleString()} $FNDRY`,
        `Tiers: ${filter.tiers.length ? filter.tiers.join(', ') : 'any'}`,
        `Skills: ${filter.skills.length ? filter.skills.join(', ') : 'any'}`,
    ];
    await interaction.reply({ content: lines.join('\n'), ephemeral: true });
}
/* ─── Polling ─── */
async function pollForNewBounties() {
    try {
        const newBounties = await (0, api_1.fetchLatestBounties)(lastPollTimestamp);
        lastPollTimestamp = new Date().toISOString();
        if (newBounties.length === 0)
            return;
        const channel = await client.channels.fetch(config_1.env.BOUNTY_CHANNEL_ID);
        if (!channel?.isTextBased())
            return;
        for (const bounty of newBounties) {
            // Send to the main channel
            if ('send' in channel) {
                await channel.send({
                    embeds: [(0, embeds_1.bountyEmbed)(bounty)],
                    components: [(0, embeds_1.bountyButtons)(bounty)],
                });
            }
            // Send DMs to users whose filters match
            // (only in guilds where we have member lists)
            for (const [guildId, guild] of client.guilds.cache) {
                const members = await guild.members.fetch();
                for (const [memberId, member] of members) {
                    if (member.user.bot)
                        continue;
                    const filter = (0, filters_1.getFilter)(guild.id, member.id);
                    if ((0, filters_1.matchesFilter)(bounty, filter)) {
                        try {
                            await member.send({
                                embeds: [(0, embeds_1.bountyEmbed)(bounty)],
                                components: [(0, embeds_1.bountyButtons)(bounty)],
                            });
                        }
                        catch {
                            // User has DMs disabled — skip silently
                        }
                    }
                }
            }
        }
        console.log(`Posted ${newBounties.length} new bounties`);
    }
    catch (err) {
        console.error('Polling error:', err);
    }
}
/* ─── Lifecycle ─── */
client.once(discord_js_1.Events.ClientReady, async () => {
    console.log(`SolFoundry bot online as ${client.user.tag}`);
    await registerCommands();
    // Poll every POLL_INTERVAL_SEC seconds
    setInterval(pollForNewBounties, config_1.env.POLL_INTERVAL_SEC * 1000);
    // Also poll on a cron schedule (every minute) for redundancy
    cron.schedule('* * * * *', pollForNewBounties);
});
client.on(discord_js_1.Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand())
        return;
    switch (interaction.commandName) {
        case 'bounties':
            await handleBounties(interaction);
            break;
        case 'leaderboard':
            await handleLeaderboard(interaction);
            break;
        case 'bounty':
            await handleBounty(interaction);
            break;
        case 'notify':
            await handleNotify(interaction);
            break;
    }
});
/* ─── Start ─── */
(0, config_1.validateEnv)();
client.login(config_1.env.DISCORD_TOKEN);
//# sourceMappingURL=index.js.map