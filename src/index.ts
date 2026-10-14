import { Client, GatewayIntentBits, Partials, Collection, Interaction } from 'discord.js';
import { config } from './config.js';
import { registerCommands, handleCommandInteraction } from './commands/registry.js';
import { StockMonitor } from './services/stockMonitor.js';

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});

client.once('ready', async () => {
  console.log(`🤖 [SellAuth Bot] Logged in successfully as ${client.user?.tag}`);
  console.log(`📊 Connected to Guild: ${config.discord.guildId}`);

  // Bot Watermark Activity
  client.user?.setActivity('Bot made by @PremiumNPC', { type: 3 });

  // Start periodic stock watcher (every 5 minutes)
  StockMonitor.startBackgroundWatcher(client);
});

client.on('interactionCreate', async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;
  await handleCommandInteraction(client, interaction);
});

// Login to Discord
client.login(config.discord.token);
