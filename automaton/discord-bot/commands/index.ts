import { Client, SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { BountyPoller } from '../services/bounty-poller.js';
import { formatReward } from '../utils/format.js';

interface UserPrefs {
  minTier: number;
  minReward: number;
  domains: string[];
}

const userPrefs: Map<string, UserPrefs> = new Map();

export class CommandHandler {
  constructor(private readonly client: Client, private readonly poller: BountyPoller) {}

  getCommandDefinitions(): any[] {
    return [
      new SlashCommandBuilder().setName('bounties').setDescription('List open SolFoundry bounties')
        .addIntegerOption(o => o.setName('tier').setDescription('Filter by tier (1-3)').setMinValue(1).setMaxValue(3))
        .addStringOption(o => o.setName('domain').setDescription('Filter by domain'))
        .addIntegerOption(o => o.setName('limit').setDescription('Results (1-25)').setMinValue(1).setMaxValue(25)),
      new SlashCommandBuilder().setName('leaderboard').setDescription('Show top contributors')
        .addIntegerOption(o => o.setName('top').setDescription('Top N (1-20)').setMinValue(1).setMaxValue(20)),
      new SlashCommandBuilder().setName('subscribe').setDescription('Configure notification preferences')
        .addIntegerOption(o => o.setName('min_tier').setDescription('Minimum tier (1-3)').setMinValue(1).setMaxValue(3))
        .addIntegerOption(o => o.setName('min_reward').setDescription('Minimum reward'))
        .addStringOption(o => o.setName('domain').setDescription('Domains (comma-separated)')),
      new SlashCommandBuilder().setName('unsubscribe').setDescription('Remove notification preferences'),
      new SlashCommandBuilder().setName('status').setDescription('Show bot status'),
    ].map(c => c.toJSON());
  }

  async handle(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      switch (interaction.commandName) {
        case 'bounties': await this.bounties(interaction); break;
        case 'leaderboard': await this.leaderboard(interaction); break;
        case 'subscribe': await this.subscribe(interaction); break;
        case 'unsubscribe': await this.unsubscribe(interaction); break;
        case 'status': await this.status(interaction); break;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      await (interaction.replied ? interaction.followUp({ content: `❌ ${msg}`, ephemeral: true }) : interaction.reply({ content: `❌ ${msg}`, ephemeral: true }));
    }
  }

  private async bounties(interaction: ChatInputCommandInteraction): Promise<void> {
    const tier = interaction.options.getInteger('tier');
    const limit = interaction.options.getInteger('limit') ?? 5;
    const parts = [`📋 Showing latest open bounties`];
    if (tier) parts.push(`| Tier ≥ T${tier}`);
    parts.push(`| Max ${limit} results`);
    await interaction.reply({ content: parts.join(' ') + '\n\n_Bounty list will be populated when API is connected._', ephemeral: true });
  }

  private async leaderboard(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();
    try {
      const apiBase = process.env.SOLFOUNDRY_API_URL ?? 'https://api.solfoundry.io';
      const top = interaction.options.getInteger('top') ?? 10;
      const res = await fetch(`${apiBase}/api/contributors?sort=total_earned&limit=${top}`);
      if (!res.ok) { await interaction.editReply('⚠️ Could not fetch leaderboard.'); return; }
      const data = await res.json() as { contributors?: any[]; items?: any[] };
      const list = (data.contributors ?? data.items ?? []).slice(0, top);
      if (list.length === 0) { await interaction.editReply('🏆 No contributor data yet.'); return; }
      const medals = ['🥇', '🥈', '🥉'];
      const lines = list.map((c, i) => {
        const m = medals[i] ?? `**#${i + 1}**`;
        const name = c.username ?? c.github_username ?? c.wallet_address?.slice(0, 8) ?? 'Unknown';
        return `${m} **${name}** — ${formatReward(c.total_earned ?? c.earned, '$FNDRY')} (${c.pr_count ?? c.submissions ?? 0} PRs)`;
      });
      await interaction.editReply(`🏆 **SolFoundry Leaderboard**\n\n${lines.join('\n')}`);
    } catch { await interaction.editReply('⚠️ Failed to fetch leaderboard.'); }
  }

  private async subscribe(interaction: ChatInputCommandInteraction): Promise<void> {
    const minTier = interaction.options.getInteger('min_tier') ?? 1;
    const minReward = interaction.options.getInteger('min_reward') ?? 0;
    const domains = (interaction.options.getString('domain') ?? '').split(',').map(s => s.trim()).filter(Boolean);
    userPrefs.set(interaction.user.id, { minTier, minReward, domains });
    const parts = [`Tier ≥ T${minTier}`];
    if (minReward > 0) parts.push(`Reward ≥ ${minReward} $FNDRY`);
    if (domains.length) parts.push(`Domains: ${domains.join(', ')}`);
    await interaction.reply({ content: `✅ **Subscribed**\n${parts.join(' | ')}`, ephemeral: true });
  }

  private async unsubscribe(interaction: ChatInputCommandInteraction): Promise<void> {
    const existed = userPrefs.delete(interaction.user.id);
    await interaction.reply({ content: existed ? '✅ Preferences removed.' : 'ℹ️ No preferences to remove.', ephemeral: true });
  }

  private async status(interaction: ChatInputCommandInteraction): Promise<void> {
    const up = process.uptime();
    const h = Math.floor(up / 3600), m = Math.floor((up % 3600) / 60);
    await interaction.reply({
      content: [
        `🤖 **SolFoundry Bot Status**`,
        `• Running: ${this.poller.isRunning() ? '✅' : '❌'}`,
        `• Uptime: ${h}h ${m}m`,
        `• Tracked bounties: ${this.poller.getSeenCount()}`,
        `• Subscribed users: ${userPrefs.size}`,
      ].join('\n'),
      ephemeral: true,
    });
  }
}
