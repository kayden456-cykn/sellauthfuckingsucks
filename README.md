# SellAuth Discord Bot & Web Command Suite

A production-ready Discord Bot powered by **Discord.js v14** and **TypeScript**, engineered specifically to manage and automate your **SellAuth** storefront.

## ✨ Core Features
- 👑 **Attribution**: Bot made by @PremiumNPC
- 🚀 **100+ Working Slash Commands**: Products, inventory, pricing, keys, HWID resets, customer lookup, revenue stats, fraud prevention, and more.
- 📜 **Automated PDF Invoices**: Automatically generates and attaches an official branded PDF receipt with tax calculations, transaction hashes, and delivered keys.
- 🎭 **Automated Customer Role Distribution**: Automatically verifies purchases, evaluates spend tiers, and dispenses Discord roles (@Verified Customer, @VIP, @Whale).
- 🚨 **Real-Time Stock Alerts**: Monitors inventory levels with custom warning thresholds and mentions staff roles when stock is depleted.
- 📊 **Discord Transaction Logging**: Formatted Discord embeds for completed sales, refunds, disputes, and restocks.

## 🛠️ Quick Start Guide

### 1. Installation
```bash
git clone https://github.com/your-username/sellauth-discord-bot.git
cd sellauth-discord-bot
npm install
```

### 2. Configuration
Copy the example environment file:
```bash
cp .env.example .env
```
Fill in:
- `DISCORD_BOT_TOKEN`: From [Discord Developer Portal](https://discord.com/developers/applications) (Bot tab).
- `SELLAUTH_API_KEY` & `SELLAUTH_SHOP_ID`: From your SellAuth dashboard under Developer API.
- Channel IDs for sales logs and stock alerts.

### License keys and Discord role redemption

- `/keygen generate` creates `b4mods-XXXXXXXX-XXXXXXXX` keys, saves them for one-time redemption, and attempts to upload them to the selected SellAuth product.
- Members use `/redeem key:<their-key>` in your Discord server. A valid unused key grants the role configured by `ROLE_VERIFIED_CUSTOMER`.
- Give the bot **Manage Roles** permission and place its highest role above the customer role.
- The redemption database is stored at `data/license-keys.json`. Use persistent disk storage on your hosting provider; ephemeral filesystems can erase the redemption database after a restart or redeploy.
- If the bot reports that SellAuth rejected an upload, the keys are saved for Discord redemption but were **not** added to SellAuth. Do not sell those keys through SellAuth until the upload/API issue is fixed.

### Stock management

- `/stock check product_id:<ID>` checks the current stock reported for a SellAuth product.
- `/stock restock product_id:<ID> serials:<keys>` adds up to 100 serials/license keys to that product. Paste one key per line, or separate keys with commas.
- Restocking is restricted to Discord server administrators. The bot's Discord permissions do not replace SellAuth API-key permissions; the SellAuth key must be allowed to append serials.
- `/product list` lists products and the stock values returned by SellAuth.

### 3. Deploy Slash Commands
Deploy all 100+ slash commands to your server:
```bash
npm run deploy:commands
```

### 4. Run the Bot
```bash
npm run dev
```
