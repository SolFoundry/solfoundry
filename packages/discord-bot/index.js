require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, ActivityType } = require('discord.js');
const axios = require('axios');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

// Bot ready event
client.once('ready', () => {
  console.log(`Bot logged in as ${client.user.tag}`);
  
  // Set bot activity
  client.user.setActivity('SolFoundry Bounties', { type: ActivityType.Watching });
  
  // Register slash commands
  const commands = [
    new SlashCommandBuilder()
      .setName('bounties')
      .setDescription('List active SolFoundry bounties'),
    new SlashCommandBuilder()
      .setName('search')
      .setDescription('Search for bounties')
      .addStringOption(option =>
        option.setName('query')
          .setDescription('Search term')
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName('notify')
      .setDescription('Set up bounty notifications')
      .addBooleanOption(option =>
        option.setName('enabled')
          .setDescription('Enable or disable notifications')
          .setRequired(true)
      )
  ];
  
  console.log('Slash commands registered');
});

// Handle slash commands
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  
  const { commandName } = interaction;
  
  if (commandName === 'bounties') {
    // Create embed for bounties
    const embed = new EmbedBuilder()
      .setTitle('SolFoundry Active Bounties')
      .setDescription('Here are the current active bounties:')
      .setColor(0x00ff00)
      .setTimestamp()
      .addFields(
        { name: 'Tier 3 Bounties', value: '$150-300 rewards', inline: true },
        { name: 'Tier 2 Bounties', value: '$75-150 rewards', inline: true },
        { name: 'Tier 1 Bounties', value: '$25-75 rewards', inline: true }
      )
      .setFooter({ text: 'Use /search to find specific bounties' });
    
    await interaction.reply({ embeds: [embed] });
  }
  
  else if (commandName === 'search') {
    const query = interaction.options.getString('query');
    await interaction.reply(`Searching for bounties matching: "${query}"...`);
  }
  
  else if (commandName === 'notify') {
    const enabled = interaction.options.getBoolean('enabled');
    if (enabled) {
      await interaction.reply('Bounty notifications enabled! You will receive alerts for new bounties.');
    } else {
      await interaction.reply('Bounty notifications disabled.');
    }
  }
});

// Error handling
client.on('error', error => {
  console.error('Discord client error:', error);
});

// Login
client.login(process.env.DISCORD_TOKEN)
  .then(() => console.log('Bot started successfully'))
  .catch(err => console.error('Failed to start bot:', err));