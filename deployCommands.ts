import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { config } from './config.js';

/**
 * Discord enforces a hard cap of 100 root commands per bot application.
 * By organizing our 106 SellAuth actions into 12 Root Commands using Discord
 * Subcommands (.addSubcommand()), we stay well within Discord's 100-command limit
 * while making autocomplete in the Discord client intuitive and clean!
 */
const commands = [
  // 1. /order <subcommand> & /sales
  new SlashCommandBuilder()
    .setName('order')
    .setDescription('SellAuth order search, lookups, recent transactions, and store control')
    .addSubcommand(sub => sub.setName('search').setDescription('Search specific order details by ID from store records').addStringOption(o => o.setName('order-id').setDescription('SellAuth Order ID (e.g. SA-98214)').setRequired(true)))
    .addSubcommand(sub => sub.setName('lookup').setDescription('Find order by ID or TXID').addStringOption(o => o.setName('id').setDescription('Order ID').setRequired(true)))
    .addSubcommand(sub => sub.setName('recent').setDescription('List most recent store orders'))
    .addSubcommand(sub => sub.setName('refund').setDescription('Process or audit order refund').addStringOption(o => o.setName('id').setDescription('Order ID').setRequired(true)))
    .addSubcommand(sub => sub.setName('resend').setDescription('Resend order key to buyer email').addStringOption(o => o.setName('id').setDescription('Order ID').setRequired(true))),

  // 2. /product <subcommand>
  new SlashCommandBuilder()
    .setName('product')
    .setDescription('SellAuth product catalog, pricing, and stock pool manager')
    .addSubcommand(sub => sub.setName('list').setDescription('List all store products with stock & prices'))
    .addSubcommand(sub => sub.setName('get').setDescription('Inspect specific product details').addIntegerOption(o => o.setName('id').setDescription('Product ID').setRequired(true)))
    .addSubcommand(sub => sub.setName('create').setDescription('Publish a new product').addStringOption(o => o.setName('name').setDescription('Name').setRequired(true)).addNumberOption(o => o.setName('price').setDescription('Price').setRequired(true)))
    .addSubcommand(sub => sub.setName('delete').setDescription('Archive or remove a product').addIntegerOption(o => o.setName('id').setDescription('Product ID').setRequired(true))),

  // 3. /stock <subcommand>
  new SlashCommandBuilder()
    .setName('stock')
    .setDescription('Inventory watcher, depletion notifications & restock thresholds')
    .addSubcommand(sub => sub.setName('status').setDescription('View stock levels across all products'))
    .addSubcommand(sub => sub.setName('alerts').setDescription('View active low stock warnings'))
    .addSubcommand(sub => sub.setName('set-threshold').setDescription('Set minimum safety threshold for restock pings').addIntegerOption(o => o.setName('id').setDescription('Product ID').setRequired(true)).addIntegerOption(o => o.setName('min').setDescription('Minimum Stock').setRequired(true)))
    .addSubcommand(sub => sub.setName('add').setDescription('Deposit key serials into product pool').addIntegerOption(o => o.setName('id').setDescription('Product ID').setRequired(true)).addStringOption(o => o.setName('keys').setDescription('Newline-separated keys').setRequired(true))),

  // 4. /role <subcommand>
  new SlashCommandBuilder()
    .setName('role')
    .setDescription('Automated customer verification, spend tiers & Discord role sync')
    .addSubcommand(sub => sub.setName('verify').setDescription('Self-service customer role verification').addStringOption(o => o.setName('query').setDescription('Order ID or Billed Email').setRequired(true)))
    .addSubcommand(sub => sub.setName('claim').setDescription('Claim customer role portal'))
    .addSubcommand(sub => sub.setName('sync').setDescription('Audit and sync all customer roles with SellAuth API'))
    .addSubcommand(sub => sub.setName('rules').setDescription('Display tier thresholds: @Verified, @VIP, @Whale')),

  // 5. /invoice <subcommand>
  new SlashCommandBuilder()
    .setName('invoice')
    .setDescription('Tamper-evident PDF invoice generator and tax receipts')
    .addSubcommand(sub => sub.setName('pdf').setDescription('Download high-res PDF invoice with SHA-256 hash').addStringOption(o => o.setName('id').setDescription('Order ID').setRequired(true)))
    .addSubcommand(sub => sub.setName('resend').setDescription('Email official PDF invoice to buyer').addStringOption(o => o.setName('id').setDescription('Order ID').setRequired(true))),

  // 6. /keygen <subcommand>
  new SlashCommandBuilder()
    .setName('keygen')
    .setDescription('Cryptographic license generation, HWID resets & key pool management')
    .addSubcommand(sub => sub.setName('batch').setDescription('Generate batch of license serials').addIntegerOption(o => o.setName('id').setDescription('Product ID').setRequired(true)).addIntegerOption(o => o.setName('count').setDescription('Quantity').setRequired(true)))
    .addSubcommand(sub => sub.setName('revoke').setDescription('Revoke or deactivate a compromised key').addStringOption(o => o.setName('key').setDescription('License Key').setRequired(true)))
    .addSubcommand(sub => sub.setName('hwid-reset').setDescription('Reset hardware ID binding on license').addStringOption(o => o.setName('key').setDescription('License Key').setRequired(true))),

  // 7. /analytics <subcommand>
  new SlashCommandBuilder()
    .setName('analytics')
    .setDescription('Real-time revenue metrics, gateway breakdowns & conversion data')
    .addSubcommand(sub => sub.setName('revenue').setDescription('Gross revenue and order volume summary'))
    .addSubcommand(sub => sub.setName('daily').setDescription('Today\'s sales and payment methods'))
    .addSubcommand(sub => sub.setName('monthly').setDescription('Monthly revenue projection & history')),

  // 8. /customer <subcommand>
  new SlashCommandBuilder()
    .setName('customer')
    .setDescription('Customer CRM, spend history & fraud blacklisting')
    .addSubcommand(sub => sub.setName('lookup').setDescription('Look up customer profile and lifetime spend').addStringOption(o => o.setName('email').setDescription('Email or Discord ID').setRequired(true)))
    .addSubcommand(sub => sub.setName('blacklist').setDescription('Blacklist fraudulent customer').addStringOption(o => o.setName('email').setDescription('Email').setRequired(true))),

  // 9. /coupon <subcommand>
  new SlashCommandBuilder()
    .setName('coupon')
    .setDescription('Promo discounts, flash sales & coupon usage tracking')
    .addSubcommand(sub => sub.setName('create').setDescription('Create promo code').addStringOption(o => o.setName('code').setDescription('Code').setRequired(true)).addIntegerOption(o => o.setName('discount').setDescription('Discount %').setRequired(true)))
    .addSubcommand(sub => sub.setName('list').setDescription('List active coupons')),

  // 10. /security <subcommand>
  new SlashCommandBuilder()
    .setName('security')
    .setDescription('Fraud guards, webhook HMAC verification & IP protection')
    .addSubcommand(sub => sub.setName('fraud-check').setDescription('Audit transaction risk score').addStringOption(o => o.setName('id').setDescription('Order ID').setRequired(true)))
    .addSubcommand(sub => sub.setName('status').setDescription('Webhook HMAC signature & TLS status')),

  // 11. /system <subcommand>
  new SlashCommandBuilder()
    .setName('system')
    .setDescription('Bot gateway diagnostics, ping latency & SellAuth API sync')
    .addSubcommand(sub => sub.setName('ping').setDescription('Bot latency and websocket heartbeat'))
    .addSubcommand(sub => sub.setName('status').setDescription('Bot daemon uptime and memory footprint'))
    .addSubcommand(sub => sub.setName('sync-commands').setDescription('Re-register slash commands with Discord API')),

  // 12. /ticket <subcommand>
  new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Order-linked customer support channels, claiming & transcripts')
    .addSubcommand(sub => sub.setName('create').setDescription('Open private support ticket').addStringOption(o => o.setName('order_id').setDescription('SellAuth Order ID').setRequired(false)).addStringOption(o => o.setName('reason').setDescription('Issue reason').setRequired(false)))
    .addSubcommand(sub => sub.setName('claim').setDescription('Assign staff member to ticket').addStringOption(o => o.setName('ticket_id').setDescription('Ticket ID').setRequired(false)))
    .addSubcommand(sub => sub.setName('close').setDescription('Close ticket & dispatch transcript').addStringOption(o => o.setName('reason').setDescription('Closing reason').setRequired(false)))
    .addSubcommand(sub => sub.setName('transcript').setDescription('Generate encrypted HTML transcript').addStringOption(o => o.setName('ticket_id').setDescription('Ticket ID').setRequired(false)))
    .addSubcommand(sub => sub.setName('export').setDescription('Generate downloadable JSON or text transcript with attachments').addStringOption(o => o.setName('ticket_id').setDescription('Ticket ID (e.g. 1042)').setRequired(true)).addStringOption(o => o.setName('format').setDescription('json or text').setRequired(false)).addBooleanOption(o => o.setName('include_attachments').setDescription('Include attachments (true/false)').setRequired(false))),

  // 13. /vouch <subcommand>
  new SlashCommandBuilder()
    .setName('vouch')
    .setDescription('Order-verified reviews, star ratings & discount rewards')
    .addSubcommand(sub => sub.setName('add').setDescription('Submit order-verified review').addStringOption(o => o.setName('order_id').setDescription('SellAuth Order ID').setRequired(true)).addIntegerOption(o => o.setName('stars').setDescription('Rating 1-5').setRequired(true)).addStringOption(o => o.setName('comment').setDescription('Review text').setRequired(true)))
    .addSubcommand(sub => sub.setName('list').setDescription('List verified reviews').addIntegerOption(o => o.setName('product_id').setDescription('Product ID').setRequired(false)))
    .addSubcommand(sub => sub.setName('reward').setDescription('Dispense promo discount coupon').addStringOption(o => o.setName('order_id').setDescription('Order ID').setRequired(true))),

  // 14. /crypto <subcommand>
  new SlashCommandBuilder()
    .setName('crypto')
    .setDescription('Real-time blockchain confirmations, mempool fees & coin rates')
    .addSubcommand(sub => sub.setName('check').setDescription('Query mempool confirmation progress').addStringOption(o => o.setName('query').setDescription('TXID or Order ID').setRequired(true)))
    .addSubcommand(sub => sub.setName('rates').setDescription('Live BTC/ETH/LTC/SOL rates'))
    .addSubcommand(sub => sub.setName('mempool').setDescription('Audit gas fee condition').addStringOption(o => o.setName('coin').setDescription('BTC, ETH, LTC, SOL').setRequired(false))),

  // 15. /notify <subcommand>
  new SlashCommandBuilder()
    .setName('notify')
    .setDescription('Direct message purchase confirmations and product restock alerts')
    .addSubcommand(sub => sub.setName('toggle-dms').setDescription('Toggle direct message purchase confirmation receipts').addStringOption(o => o.setName('state').setDescription('enable, disable, toggle, or status').setRequired(false)))
    .addSubcommand(sub => sub.setName('restock').setDescription('Subscribe to restock alert').addIntegerOption(o => o.setName('product_id').setDescription('Product ID').setRequired(true)))
    .addSubcommand(sub => sub.setName('list').setDescription('View active restock alerts'))
    .addSubcommand(sub => sub.setName('clear').setDescription('Clear restock alert subscription').addIntegerOption(o => o.setName('product_id').setDescription('Product ID').setRequired(false))),

  // 16. /flashsale <subcommand>
  new SlashCommandBuilder()
    .setName('flashsale')
    .setDescription('Timed promotional drops, live countdowns & deal alerts')
    .addSubcommand(sub => sub.setName('start').setDescription('Launch timed flash sale').addIntegerOption(o => o.setName('product_id').setDescription('Product ID').setRequired(true)).addIntegerOption(o => o.setName('discount').setDescription('Discount %').setRequired(true)).addIntegerOption(o => o.setName('duration_minutes').setDescription('Duration in min').setRequired(true)))
    .addSubcommand(sub => sub.setName('end').setDescription('End active flash sale').addIntegerOption(o => o.setName('product_id').setDescription('Product ID').setRequired(false)))
    .addSubcommand(sub => sub.setName('active').setDescription('List active flash sales')),

  // 17. /dispute <subcommand>
  new SlashCommandBuilder()
    .setName('dispute')
    .setDescription('Evidence dossier compilation, key revocation & fraud freeze')
    .addSubcommand(sub => sub.setName('packet').setDescription('Generate dispute defense dossier').addStringOption(o => o.setName('order_id').setDescription('Order ID').setRequired(true)))
    .addSubcommand(sub => sub.setName('lock').setDescription('Revoke keys & blacklist buyer').addStringOption(o => o.setName('order_id').setDescription('Order ID').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)))
    .addSubcommand(sub => sub.setName('status').setDescription('Audit dispute status').addStringOption(o => o.setName('order_id').setDescription('Order ID').setRequired(true))),

  // 18. /affiliate <subcommand>
  new SlashCommandBuilder()
    .setName('affiliate')
    .setDescription('Commission tracking, referral links & crypto payouts')
    .addSubcommand(sub => sub.setName('link').setDescription('Get your SellAuth referral link'))
    .addSubcommand(sub => sub.setName('stats').setDescription('View referral clicks and balance'))
    .addSubcommand(sub => sub.setName('payout').setDescription('Request affiliate payout').addStringOption(o => o.setName('address').setDescription('Crypto address').setRequired(true)).addStringOption(o => o.setName('coin').setDescription('Coin symbol (LTC)').setRequired(false))),
];

const rest = new REST({ version: '10' }).setToken(config.discord.token);

(async () => {
  try {
    console.log(`🚀 Registering ${commands.length} root SellAuth application slash commands (with 128+ subcommands)...`);
    await rest.put(
      Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
      { body: commands.map(c => c.toJSON()) }
    );
    console.log('✅ Successfully published grouped slash commands to Discord guild! (Total root commands: ' + commands.length + ' <= 100 Discord limit)');
  } catch (error) {
    console.error('Failed to deploy commands:', error);
  }
})();
