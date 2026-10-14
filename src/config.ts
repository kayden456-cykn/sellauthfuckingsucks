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
