import TelegramBot from 'node-telegram-bot-api';
import cron from 'node-cron';
import * as api from './api';
import * as storage from './storage';
import { formatNotification } from './messages';
import { Bounty } from './types';

let lastSeenIds = new Set<string>();

function matchesFilters(bounty: Bounty, filters: string): boolean {
  if (!filters) return true;
  const parts = filters.toLowerCase().split(';').map((f) => f.trim()).filter(Boolean);
  const text = `${bounty.tier} ${bounty.token} ${(bounty.skills || []).join(' ')}`.toLowerCase();
  return parts.some((f) => text.includes(f));
}

export async function checkNewBounties(bot: TelegramBot): Promise<void> {
  try {
    const res = await api.listBounties({ limit: 20, status: 'open' });
    const newBounties = res.bounties.filter((b) => !lastSeenIds.has(b.id));

    if (lastSeenIds.size === 0) {
      // First run — seed only, don't notify
      res.bounties.forEach((b) => lastSeenIds.add(b.id));
      return;
    }

    for (const bounty of newBounties) {
      lastSeenIds.add(bounty.id);
      const subscribers = storage.getAllSubscribers();
      const message = formatNotification(bounty);
      const keyboard: TelegramBot.InlineKeyboardMarkup = {
        inline_keyboard: [
          [
            { text: '🔗 View Details', url: bounty.url },
            { text: '✅ Claim', url: `${bounty.url}/claim` },
          ],
        ],
      };

      for (const sub of subscribers) {
        if (matchesFilters(bounty, sub.filters || '')) {
          try {
            await bot.sendMessage(sub.chat_id, message, {
              parse_mode: 'Markdown',
              disable_web_page_preview: true,
              reply_markup: keyboard,
            });
          } catch (err) {
            console.error(`Failed to notify chat ${sub.chat_id}:`, (err as Error).message);
          }
        }
      }
    }
  } catch (err) {
    console.error('Poll error:', (err as Error).message);
  }
}

export function startNotifier(bot: TelegramBot): void {
  const interval = process.env.POLL_INTERVAL_MINUTES || '5';
  const cronExpr = `*/${interval} * * * *`;
  console.log(`Starting notifier with cron: ${cronExpr}`);

  // Initial check to seed IDs
  checkNewBounties(bot);

  cron.schedule(cronExpr, () => checkNewBounties(bot));
}
