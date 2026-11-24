require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'bounties') {
    const embed = new EmbedBuilder()
      .setTitle('Latest SolFoundry Bounties')
      .setColor('#FF5A00')
      .setDescription('Check out the latest bounties on SolFoundry!')
      .setURL('https://solfoundry.io/bounties');
    await interaction.reply({ embeds: [embed] });
  }
});

client.login(process.env.DISCORD_TOKEN);
