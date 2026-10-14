import {
  Client,
  TextChannel,
  EmbedBuilder,
} from 'discord.js';

import { config } from '../config.js';
import { InvoiceGenerator } from './pdfInvoice.js';

export class DiscordLogger {
  static async logSale(client: Client, orderData: any) {
    try {
      const channel = await client.channels.fetch(
        config.channels.transactionsLog
      );

      if (!channel || !channel.isTextBased()) {
        console.error(
          '[DiscordLogger] Transactions log channel was not found or is not text-based.'
        );
        return;
      }

      const textChannel = channel as TextChannel;

      const customerEmail =
        typeof orderData.customerEmail === 'string'
          ? orderData.customerEmail
          : 'Not provided';

      const maskedEmail = customerEmail.replace(
        /(.{2})(.*)(?=@)/,
        '$1***'
      );

      const embed = new EmbedBuilder()
        .setTitle('🛍️ New Purchase Completed!')
        .setColor(0x00ff88)
        .setDescription(
          `Customer successfully purchased **${orderData.productName}** on SellAuth!`
        )
        .addFields(
          {
            name: 'Order ID',
            value: String(orderData.id),
            inline: true,
          },
          {
            name: 'Total Paid',
            value: `**$${Number(orderData.total).toFixed(2)} ${orderData.currency}**`,
            inline: true,
          },
          {
            name: 'Payment Method',
            value: String(orderData.paymentMethod ?? 'Unknown'),
            inline: true,
          },
          {
            name: 'Customer Email',
            value: maskedEmail,
            inline: true,
          },
          {
            name: 'License Delivered',
            value: `${orderData.deliveredKeys?.length || 1} serial(s)`,
            inline: true,
          },
          {
            name: 'Role Assigned',
            value: orderData.roleAssigned
              ? `@${orderData.roleAssigned}`
              : 'None',
            inline: true,
          }
        )
        .setFooter({
          text: 'SellAuth Automated Webhook Dispatcher',
        })
        .setTimestamp();

      const pdfBuffer =
        InvoiceGenerator.generateBuffer(orderData);

      await textChannel.send({
        embeds: [embed],
        files: [
          {
            attachment: pdfBuffer,
            name: `Invoice-${orderData.id}.pdf`,
          },
        ],
      });
    } catch (error) {
      console.error('[DiscordLogger Sale Error]', error);
    }
  }
}
