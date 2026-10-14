import { Client, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { config } from '../config.js';
import { InvoiceGenerator } from './pdfInvoice.js';

export class DiscordLogger {
  static async logSale(client: Client, orderData: any) {
    try {
      const channel = await client.channels.fetch(config.channels.transactionsLog) as TextChannel;
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setTitle('🛍️ New Purchase Completed!')
        .setColor(0x00FF88)
        .setDescription(`Customer successfully purchased **${orderData.productName}** on SellAuth!`)
        .addFields(
          { name: 'Order ID', value: ```${orderData.id}```, inline: true },
          { name: 'Total Paid', value: `**$${orderData.total.toFixed(2)} ${orderData.currency}**`, inline: true },
          { name: 'Payment Method', value: orderData.paymentMethod, inline: true },
          { name: 'Customer Email', value: orderData.customerEmail.replace(/(.{2})(.*)(?=@)/, '$1***'), inline: true },
          { name: 'License Delivered', value: `${orderData.deliveredKeys?.length || 1} serial(s)`, inline: true },
          { name: 'Role Assigned', value: orderData.roleAssigned ? `@${orderData.roleAssigned}` : 'None', inline: true }
        )
        .setFooter({ text: 'SellAuth Automated Webhook Dispatcher' })
        .setTimestamp();

      // Generate PDF invoice attachment
      const pdfBuffer = InvoiceGenerator.generateBuffer(orderData);

      await channel.send({
        embeds: [embed],
        files: [{ attachment: pdfBuffer, name: `Invoice-${orderData.id}.pdf` }],
      });
    } catch (err) {
      console.error('[DiscordLogger Sale Error]', err);
    }
  }
}
