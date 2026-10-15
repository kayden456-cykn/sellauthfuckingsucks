import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { config } from './config.js';

const commands = [
  new SlashCommandBuilder()
    .setName('redeem-panel')
    .setDescription('Post the buyer role redemption panel in this channel'),
  new SlashCommandBuilder()
    .setName('order')
    .setDescription('Manage customer orders')
    .addSubcommand(subcommand =>
      subcommand
        .setName('search')
        .setDescription('Search for an order')
        .addStringOption(option =>
          option
            .setName('query')
            .setDescription('Order ID')
            .setRequired(true)
        )
    ),

  new SlashCommandBuilder()
    .setName('product')
    .setDescription('Manage store products')
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List available products')
    ),

  new SlashCommandBuilder()
    .setName('stock')
    .setDescription('Manage product stock')
    .addSubcommand(subcommand =>
      subcommand
        .setName('check')
        .setDescription('Check product stock')
        .addStringOption(option =>
          option
            .setName('product_id')
            .setDescription('SellAuth product ID')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('restock')
        .setDescription('Add license keys/serials to a SellAuth product')
        .addStringOption(option =>
          option
            .setName('product_id')
            .setDescription('SellAuth product ID')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('variant_id')
            .setDescription('SellAuth variant ID for the deliverables')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('serials')
            .setDescription('Paste keys separated by new lines or commas (max 100)')
            .setRequired(true)
            .setMaxLength(4000)
        )
    ),

  new SlashCommandBuilder()
    .setName('role')
    .setDescription('Manage customer roles')
    .addSubcommand(subcommand =>
      subcommand
        .setName('verify')
        .setDescription('Verify a customer')
        .addStringOption(option =>
          option
            .setName('query')
            .setDescription('Verification query')
            .setRequired(true)
        )
    ),

  new SlashCommandBuilder()
    .setName('invoice')
    .setDescription('Manage invoices')
    .addSubcommand(subcommand =>
      subcommand
        .setName('pdf')
        .setDescription('Generate a PDF invoice')
        .addStringOption(option =>
          option
            .setName('order_id')
            .setDescription('Order ID')
            .setRequired(true)
        )
    ),

  new SlashCommandBuilder()
    .setName('keygen')
    .setDescription('Generate license keys')
    .addSubcommand(subcommand =>
      subcommand
        .setName('generate')
        .setDescription('Generate license keys for a product')
        .addStringOption(option =>
          option
            .setName('product_id')
            .setDescription('SellAuth product ID to add the keys to')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('variant_id')
            .setDescription('SellAuth variant ID to add the keys to')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName('amount')
            .setDescription('Number of keys to generate')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100)
        )
    ),

  new SlashCommandBuilder()
    .setName('redeem')
    .setDescription('Redeem a B4 Mods license key for your customer role')
    .addStringOption(option =>
      option
        .setName('key')
        .setDescription('Your B4 Mods license key')
        .setRequired(true)
        .setMaxLength(100)
    ),

  new SlashCommandBuilder()
    .setName('analytics')
    .setDescription('View store analytics')
    .addSubcommand(subcommand =>
      subcommand
        .setName('today')
        .setDescription("View today's revenue")
    ),

  new SlashCommandBuilder()
    .setName('customer')
    .setDescription('Manage customers')
    .addSubcommand(subcommand =>
      subcommand
        .setName('lookup')
        .setDescription('Look up a customer')
        .addStringOption(option =>
          option
            .setName('query')
            .setDescription('Customer ID or email')
            .setRequired(true)
        )
    ),

  new SlashCommandBuilder()
    .setName('coupon')
    .setDescription('Manage discount coupons')
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List available coupons')
    ),

  new SlashCommandBuilder()
    .setName('security')
    .setDescription('View security information')
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('View security status')
    ),

  new SlashCommandBuilder()
    .setName('system')
    .setDescription('Manage bot system')
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('View system status')
    ),

  new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Manage support tickets')
    .addSubcommand(subcommand =>
      subcommand
        .setName('export')
        .setDescription('Export a ticket transcript')
        .addStringOption(option =>
          option
            .setName('ticket_id')
            .setDescription('Ticket ID')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('format')
            .setDescription('Transcript format')
            .setRequired(false)
            .addChoices(
              { name: 'JSON', value: 'json' },
              { name: 'Text', value: 'txt' }
            )
        )
        .addBooleanOption(option =>
          option
            .setName('include_attachments')
            .setDescription('Include attachment metadata')
            .setRequired(false)
        )
    ),

  new SlashCommandBuilder()
    .setName('vouch')
    .setDescription('Manage customer reviews')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a customer review')
        .addStringOption(option =>
          option
            .setName('message')
            .setDescription('Review message')
            .setRequired(true)
        )
    ),

  new SlashCommandBuilder()
    .setName('crypto')
    .setDescription('Manage cryptocurrency payments')
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Check cryptocurrency payment status')
    ),

  new SlashCommandBuilder()
    .setName('notify')
    .setDescription('Manage notifications')
    .addSubcommand(subcommand =>
      subcommand
        .setName('toggle-dms')
        .setDescription('Toggle purchase notification settings')
    ),

  new SlashCommandBuilder()
    .setName('flashsale')
    .setDescription('Manage flash sales')
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Check current flash sale status')
    ),

  new SlashCommandBuilder()
    .setName('dispute')
    .setDescription('Manage payment disputes')
    .addSubcommand(subcommand =>
      subcommand
        .setName('lookup')
        .setDescription('Look up a dispute')
        .addStringOption(option =>
          option
            .setName('id')
            .setDescription('Dispute ID')
            .setRequired(true)
        )
    ),

  new SlashCommandBuilder()
    .setName('echo')
    .setDescription('Make the bot repeat a message')
    .addStringOption(option =>
      option
        .setName('message')
        .setDescription('The message the bot should send')
        .setRequired(true)
        .setMaxLength(2000)
    ),

  new SlashCommandBuilder()
    .setName('fun')
    .setDescription('Random fun commands')
    .addSubcommand(subcommand =>
      subcommand
        .setName('coinflip')
        .setDescription('Flip a coin')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('joke')
        .setDescription('Get a random joke')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('8ball')
        .setDescription('Ask the magic 8-ball a question')
        .addStringOption(option =>
          option
            .setName('question')
            .setDescription('Your question for the 8-ball')
            .setRequired(true)
            .setMaxLength(200)
        )
    ),

  new SlashCommandBuilder()
    .setName('affiliate')
    .setDescription('Manage affiliate information')
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('View affiliate status')
    ),
];

export async function registerCommands(): Promise<void> {
  if (!config.discord.token) {
    throw new Error(
      'DISCORD_BOT_TOKEN is missing from environment variables.'
    );
  }

  if (!config.discord.clientId || !config.discord.guildId) {
    throw new Error(
      'DISCORD_CLIENT_ID and DISCORD_GUILD_ID must be configured.'
    );
  }

  const rest = new REST({ version: '10' }).setToken(
    config.discord.token
  );

  console.log(
    `Registering ${commands.length} root SellAuth slash commands...`
  );

  await rest.put(
    Routes.applicationGuildCommands(
      config.discord.clientId,
      config.discord.guildId
    ),
    {
      body: commands.map(command => command.toJSON()),
    }
  );

  console.log('Successfully registered slash commands.');
}
