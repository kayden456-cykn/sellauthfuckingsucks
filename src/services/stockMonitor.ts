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

      const response: unknown = await sellauth.getProducts();

      // SellAuth may wrap the product list in an object instead of returning
      // the array directly. Normalize common response shapes before iterating.
      const payload = response as {
        data?: unknown;
        products?: unknown;
        items?: unknown;
      } | null;

      const nestedData = payload?.data as {
        products?: unknown;
        items?: unknown;
        data?: unknown;
      } | null;

      const products: any[] | null =
        Array.isArray(response) ? response :
        Array.isArray(payload?.data) ? payload.data :
        Array.isArray(payload?.products) ? payload.products :
        Array.isArray(payload?.items) ? payload.items :
        Array.isArray(nestedData?.products) ? nestedData.products :
        Array.isArray(nestedData?.items) ? nestedData.items :
        Array.isArray(nestedData?.data) ? nestedData.data :
        null;

      if (!products) {
        const responseKeys =
          response && typeof response === 'object'
            ? Object.keys(response as Record<string, unknown>).join(', ')
            : typeof response;
        console.error(
          '[StockMonitor] SellAuth products response was not an array. ' +
          `Response shape: ${responseKeys || 'empty object'}`
        );
        return;
      }

      for (const product of products) {
        const stock = Number(product?.stock);
        if (!product || product.id == null || !Number.isFinite(stock)) {
          console.warn('[StockMonitor] Skipping product with missing ID or invalid stock data.');
          continue;
        }

        const threshold = Number(product.minStockAlert) || 5;
        if (stock <= threshold && !this.alertCooldowns.has(Number(product.id))) {
          this.alertCooldowns.add(Number(product.id));

          const isDepleted = stock === 0;
          const embed = new EmbedBuilder()
            .setTitle(isDepleted ? '🚨 CRITICAL: Stock Depleted (0 Units Left)' : '⚠️ Low Stock Alert')
            .setColor(isDepleted ? 0xEF4444 : 0xF59E0B)
            .setDescription(`Product **${product.name}** is running low on SellAuth!`)
            .addFields(
              { name: 'Product ID', value: `#${product.id}`, inline: true },
              { name: 'Current Stock', value: `${stock} units`, inline: true },
              { name: 'Safety Threshold', value: `${threshold} units`, inline: true }
            )
            .setTimestamp();

          const ping = config.roles.stockAlertPing ? `<@&${config.roles.stockAlertPing}> ` : '';
          await channel.send({ content: ping, embeds: [embed] });
        } else if (stock > threshold) {
          // Clear cooldown if product was restocked
          this.alertCooldowns.delete(Number(product.id));
        }
      }
    } catch (err) {
      console.error('[StockMonitor Check Error]', err);
    }
  }
}
