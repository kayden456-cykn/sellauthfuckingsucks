import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { config } from '../config.js';
import { sellauth } from './sellauth.js';

export class StockMonitor {
  private static alertCooldowns = new Set<number>();

  static startBackgroundWatcher(client: Client) {
    setInterval(() => {
      this.checkStockLevels(client);
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  static async checkStockLevels(client: Client) {
    try {
      const channel = await client.channels.fetch(config.channels.stockAlerts) as TextChannel;
      if (!channel) return;

      const products = await sellauth.getProducts();
      for (const product of products) {
        const threshold = product.minStockAlert || 5;
        if (product.stock <= threshold && !this.alertCooldowns.has(product.id)) {
          this.alertCooldowns.add(product.id);

          const isDepleted = product.stock === 0;
          const embed = new EmbedBuilder()
            .setTitle(isDepleted ? '🚨 CRITICAL: Stock Depleted (0 Units Left)' : '⚠️ Low Stock Alert')
            .setColor(isDepleted ? 0xEF4444 : 0xF59E0B)
            .setDescription(`Product **${product.name}** is running low on SellAuth!`)
            .addFields(
              { name: 'Product ID', value: `#${product.id}`, inline: true },
              { name: 'Current Stock', value: `${product.stock} units`, inline: true },
              { name: 'Safety Threshold', value: `${threshold} units`, inline: true }
            )
            .setTimestamp();

          const ping = config.roles.stockAlertPing ? `<@&${config.roles.stockAlertPing}> ` : '';
          await channel.send({ content: ping, embeds: [embed] });
        } else if (product.stock > threshold) {
          // Clear cooldown if product was restocked
          this.alertCooldowns.delete(product.id);
        }
      }
    } catch (err) {
      console.error('[StockMonitor Check Error]', err);
    }
  }
}
