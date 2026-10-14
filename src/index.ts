import {
  Client,
  GatewayIntentBits,
  Partials,
  Interaction,
} from 'discord.js';

import { config } from './config.js';
import { registerCommands } from './deployCommands.js';
import { handleCommandInteraction } from './commands/registry.js';
import { StockMonitor } from './services/stockMonitor.js';

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.GuildMember,
  ],
});

client.once('clientReady', async () => {
client.user?.setStatus('online');

client.user?.setPresence({
  status: 'online',
  activities: [
    {
      name: 'SellAuth Licenses',
      type: 3,
    },
  ],
});
  console.log(
    `🤖 [SellAuth Bot] Logged in as ${client.user?.tag}`
  );

  console.log(
    `📊 Connected to Guild: ${config.discord.guildId}`
  );

  client.user?.setActivity('Bot made by @PremiumNPC', {
    type: 3,
  });

  try {
    await registerCommands();
    console.log('✅ Slash commands registered successfully.');
  } catch (error) {
    console.error('❌ Failed to register slash commands:', error);
  }

  StockMonitor.startBackgroundWatcher(client);
});

client.on('interactionCreate', async (interaction: Interaction) => {
  if (
    !interaction.isChatInputCommand() &&
    !interaction.isButton()
  ) {
    return;
  }

  try {
    await handleCommandInteraction(client, interaction);
  } catch (error) {
    console.error('❌ Interaction handler error:', error);
  }
});

client.login(config.discord.token).catch((error) => {
  console.error('❌ Failed to log in to Discord:', error);
});
