import dotenv from 'dotenv';

dotenv.config();

export const config = {
  discord: {
    token: process.env.DISCORD_BOT_TOKEN || '',
    clientId: process.env.DISCORD_CLIENT_ID || '',
    guildId: process.env.DISCORD_GUILD_ID || '',
  },

  sellauth: {
    apiKey: process.env.SELLAUTH_API_KEY || '',
    shopId: process.env.SELLAUTH_SHOP_ID || '',
    webhookSecret: process.env.SELLAUTH_WEBHOOK_SECRET || '',
    baseUrl: 'https://api.sellauth.com/v1',
  },

  ai: {
    apiKey: process.env.OPENAI_API_KEY || process.env.AI_API_KEY || '',
    baseUrl: (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    model: process.env.AI_MODEL || 'gpt-4o-mini',
  },

  tickets: {
    categoryId: process.env.TICKET_CATEGORY_ID || '',
    supportRoleId: process.env.TICKET_SUPPORT_ROLE_ID || '',
    logChannelId: process.env.TICKET_LOG_CHANNEL_ID || '',
  },

  channels: {
    transactionsLog: process.env.CHANNEL_TRANSACTIONS_LOG || '',
    stockAlerts: process.env.CHANNEL_STOCK_ALERTS || '',
    disputesLog: process.env.CHANNEL_DISPUTES_LOG || '',
  },

  roles: {
    verifiedCustomer: process.env.ROLE_VERIFIED_CUSTOMER || '',
    vipBuyer: process.env.ROLE_VIP_BUYER || '',
    stockAlertPing: process.env.ROLE_STOCK_ALERT_PING || '',
  },
};
