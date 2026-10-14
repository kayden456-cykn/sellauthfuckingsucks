import { Client, GatewayIntentBits, Partials, Interaction } from 'discord.js';
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
  console.log(`🤖 [SellAuth Bot] Logged in as ${client.user?.tag}`);
  console.log(`📊 Connected to Guild: ${config.discord.guildId}`);

  client.user?.setActivity('Bot made by @PremiumNPC', { type: 3 });

  StockMonitor.startBackgroundWatcher(client);
});

client.on('interactionCreate', async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;
  await handleCommandInteraction(client, interaction);
});

client.login(config.discord.token);
