import TelegramBot from 'node-telegram-bot-api';
import * as api from './api';
import * as storage from './storage';
import { formatBountyCard, formatBountyDetail, formatLeaderboard, formatStats } from './messages';

export function registerCommands(bot: TelegramBot): void {
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const subbed = storage.isSubscribed(chatId);
    const text = [
      '👋 *Welcome to SolFoundry Bounty Bot!*',
      '',
      'Stay on top of the latest bounties on SolFoundry.',
      '',
      subbed ? '✅ You are subscribed to notifications.' : '🔔 Use /subscribe to get notified of new bounties.',
      '',
      '*Commands:*',
      '/bounties — List latest open bounties',
      '/bounty <id> — Get bounty details',
      '/subscribe — Enable notifications',
      '/unsubscribe — Disable notifications',
      '/filter <tier|token|skill> — Set filters',
      '/leaderboard — Top contributors',
      '/stats — Platform statistics',
    ].join('\n');
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  });

  bot.onText(/\/bounties/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const res = await api.listBounties({ limit: 10, status: 'open' });
      if (!res.bounties.length) {
        bot.sendMessage(chatId, 'No open bounties found.');
        return;
      }
      const text = res.bounties.map((b, i) => `${i + 1}. ${formatBountyCard(b)}`).join('\n\n');
      bot.sendMessage(chatId, `📋 *Latest Open Bounties*\n\n${text}`, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      });
    } catch {
      bot.sendMessage(chatId, '❌ Failed to fetch bounties. Try again later.');
    }
  });

  bot.onText(/\/bounty\s+(.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const id = match![1].trim();
    try {
      const bounty = await api.getBounty(id);
      bot.sendMessage(chatId, formatBountyDetail(bounty), {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔗 View Details', url: bounty.url },
              { text: '✅ Claim', url: `${bounty.url}/claim` },
            ],
          ],
        },
      });
    } catch {
      bot.sendMessage(chatId, `❌ Bounty "${id}" not found.`);
    }
  });

  bot.onText(/\/subscribe/, (msg) => {
    const chatId = msg.chat.id;
    if (storage.isSubscribed(chatId)) {
      bot.sendMessage(chatId, '✅ You are already subscribed!');
      return;
    }
    storage.addSubscriber(chatId, msg.from?.username);
    bot.sendMessage(chatId, [
      '🎉 *Subscribed!*',
      '',
      'You\'ll receive notifications for new bounties.',
      'Use /filter to customize which bounties you see.',
    ].join('\n'), { parse_mode: 'Markdown' });
  });

  bot.onText(/\/unsubscribe/, (msg) => {
    const chatId = msg.chat.id;
    if (storage.removeSubscriber(chatId)) {
      bot.sendMessage(chatId, '👋 Unsubscribed. You won\'t receive notifications anymore.');
    } else {
      bot.sendMessage(chatId, 'You weren\'t subscribed.');
    }
  });

  bot.onText(/\/filter\s+(.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const filters = match![1].trim();
    if (!storage.isSubscribed(chatId)) {
      bot.sendMessage(chatId, '⚠️ Subscribe first with /subscribe');
      return;
    }
    storage.setFilters(chatId, filters);
    bot.sendMessage(chatId, `🔧 Filters updated: \`${filters}\`\n\nExamples: \`T1\`, \`USDC\`, \`rust\`, \`T1;USDC\``, { parse_mode: 'Markdown' });
  });

  bot.onText(/\/leaderboard/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const entries = await api.getLeaderboard();
      bot.sendMessage(chatId, formatLeaderboard(entries), { parse_mode: 'Markdown' });
    } catch {
      bot.sendMessage(chatId, '❌ Failed to fetch leaderboard.');
    }
  });

  bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const stats = await api.getStats();
      bot.sendMessage(chatId, formatStats(stats), { parse_mode: 'Markdown' });
    } catch {
      bot.sendMessage(chatId, '❌ Failed to fetch stats.');
    }
  });
}
