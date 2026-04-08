import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import { initStorage, closeStorage } from './storage';
import { registerCommands } from './commands';
import { startNotifier } from './notifier';

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
  console.error('Missing TELEGRAM_BOT_TOKEN env var');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

initStorage();
registerCommands(bot);
startNotifier(bot);

console.log('🤖 SolFoundry Telegram Bot is running');

process.on('SIGINT', () => {
  console.log('Shutting down...');
  bot.stopPolling();
  closeStorage();
  process.exit(0);
});

process.on('SIGTERM', () => {
  bot.stopPolling();
  closeStorage();
  process.exit(0);
});
