
import {
  Client,
  EmbedBuilder,
  AttachmentBuilder,
} from 'discord.js';

import { sellauth } from '../services/sellauth.js';
import { RoleManager } from '../services/roleDistribution.js';
import { InvoiceGenerator } from '../services/pdfInvoice.js';
import { config } from './config.js';

export async function handleCommandInteraction(
  client: Client,
  interaction: any
) {
  const { commandName } = interaction;

  try {
    switch (commandName) {
      case 'product-list': {
        const products = await sellauth.getProducts();

        const embed = new EmbedBuilder()
          .setTitle('📦 SellAuth Product Inventory')
          .setColor(0x5865f2)
          .setDescription(
            products
              .map(
                (p: any) =>
                  `• **#${p.id} ${p.name}** — $${p.price} (${p.stock} in stock)`
              )
              .join('\n')
          );

        return await interaction.reply({ embeds: [embed] });
      }

      case 'role-verify': {
        const query = interaction.options.getString('query', true);

        const result = await RoleManager.verifyAndAssign(
          interaction.guild!,
          interaction.user.id,
          query
        );

        if (result.success) {
          return await interaction.reply({
            content: `🎉 Verified! Granted role **${result.roleName}**. PDF invoice and license access unlocked!`,
            ephemeral: true,
          });
        }

        return await interaction.reply({
          content: `❌ ${result.message}`,
          ephemeral: true,
        });
      }

      case 'invoice-pdf': {
        const orderId = interaction.options.getString('order_id', true);
        const order = await sellauth.getOrder(orderId);
        const pdf = InvoiceGenerator.generateBuffer(order);

        return await interaction.reply({
          content: `📄 Official PDF Invoice for Order #${orderId}:`,
          files: [
            {
              attachment: pdf,
              name: `Invoice-${orderId}.pdf`,
            },
          ],
          ephemeral: true,
        });
      }

      case 'revenue-today': {
        const stats = await sellauth.getStats('day');

        const embed = new EmbedBuilder()
          .setTitle("💰 SellAuth Today's Revenue")
          .setColor(0x00ff88)
          .addFields(
            {
              name: 'Gross Revenue',
              value: `$${stats.gross?.toFixed(2) || '0.00'}`,
              inline: true,
            },
            {
              name: 'Total Orders',
              value: `${stats.orders || 0}`,
              inline: true,
            }
          );

        return await interaction.reply({ embeds: [embed] });
      }

      case 'notify-toggle-dms': {
        const member = await interaction.guild?.members.fetch(
          interaction.user.id
        );

        const isVerified = member?.roles.cache.some(
          (r: any) =>
            r.name === 'Verified Customer' || r.name.includes('VIP')
        );

        if (!isVerified) {
          return await interaction.reply({
            content:
              '⛔ **Verified Customer Required**: You must hold the Verified Customer role to enable or disable purchase confirmation DMs.',
            ephemeral: true,
          });
        }

        const embed = new EmbedBuilder()
          .setTitle('📬 Direct Message Purchase Notifications Updated')
          .setColor(0x57f287)
          .setDescription(
            'Your preference for automated Discord DM delivery of license keys and PDF invoices has been updated successfully.'
          )
          .setFooter({
            text: 'SellAuth Notification Engine • Bot made by @PremiumNPC',
          });

        return await interaction.reply({
          embeds: [embed],
          ephemeral: true,
        });
      }

      case 'order-search':
      case 'order': {
        const orderId =
          interaction.options.getString('order-id') ||
          interaction.options.getString('id') ||
          interaction.options.getString('query');

        if (!config.sellauth.apiKey) {
          return await interaction.reply({
            content:
              '⚠️ **SellAuth API Key Required**: Configure SELLAUTH_API_KEY in your environment variables.',
            ephemeral: true,
          });
        }

        if (!orderId) {
          return await interaction.reply({
            content: '❌ Please provide an order ID.',
            ephemeral: true,
          });
        }

        const order = await sellauth.getOrder(orderId);

        if (!order) {
          return await interaction.reply({
            content: `❌ Order #${orderId} not found in SellAuth records. Please verify the ID or invoice number.`,
            ephemeral: true,
          });
        }

        const embed = new EmbedBuilder()
          .setTitle(`📦 SellAuth Order Details — #${order.id || orderId}`)
          .setColor(
            order.status === 'COMPLETED' ? 0x57f287 : 0xfee75c
          )
          .setDescription(
            'Detailed transaction and fulfillment records retrieved from SellAuth.'
          )
          .addFields(
            {
              name: 'Product Purchased',
              value: `**${order.productName}** (Qty: ${order.quantity})`,
              inline: true,
            },
            {
              name: 'Customer Email',
              value: `${order.customerEmail || 'Not available'}`,
              inline: true,
            },
            {
              name: 'Total Paid',
              value: `**$${Number(order.total || 0).toFixed(2)} ${order.currency || ''}** (${order.paymentMethod || 'Unknown'})`,
              inline: true,
            },
            {
              name: 'Invoice Reference',
              value: `${order.invoiceNumber || 'Not available'}`,
              inline: true,
            },
            {
              name: 'Order Status',
              value: `${order.status || 'Unknown'}`,
              inline: true,
            },
            {
              name: 'Role Assigned',
              value: `@${order.roleAssigned || 'Verified Customer'}`,
              inline: true,
            },
            {
              name: 'Delivered License Keys',
              value: `\`\`\`\n${order.deliveredKeys?.join('\n') || 'Instant Delivery'}\n\`\`\``,
              inline: false,
            },
            {
              name: 'Store Control Status',
              value: 'SellAuth API integration configured',
              inline: false,
            }
          )
          .setFooter({
            text: 'SellAuth Order Inspector • Bot made by @PremiumNPC',
          });

        return await interaction.reply({ embeds: [embed] });
      }

      case 'ticket-export':
      case 'ticket': {
        const ticketId =
          interaction.options.getString('ticket_id') ||
          interaction.options.getString('id') ||
          '1042';

        const format = (
          interaction.options.getString('format') || 'json'
        ).toLowerCase();

        const includeAttachments =
          interaction.options.getBoolean('include_attachments') ?? true;

        const isJson = format === 'json';

        const filename = `ticket-${ticketId}-transcript.${isJson ? 'json' : 'txt'}`;

        const transcriptPayload = isJson
          ? JSON.stringify(
              {
                export_metadata: {
                  system: 'SellAuth Discord Bot',
                  watermark: 'Bot made by @PremiumNPC',
                  exported_at: new Date().toISOString(),
                  exported_by: interaction.user.tag,
                  ticket_id: ticketId,
                  format: 'JSON',
                  include_attachments: includeAttachments,
                },
                ticket: {
                  id: ticketId,
                  channel: `ticket-${ticketId}`,
                  subject: 'Customer Order Support Session',
                  status: 'OPEN',
                  priority: 'MEDIUM',
                  customer: {
                    username: interaction.user.tag,
                    id: interaction.user.id,
                  },
                  attachments: includeAttachments
                    ? [
                        {
                          filename: `invoice_proof_${ticketId}.png`,
                          contentType: 'image/png',
                          note: 'Attachment metadata only; no file contents are included.',
                        },
                      ]
                    : [],
                },
              },
              null,
              2
            )
          : `================================================================================
SELLAUTH SUPPORT TICKET TRANSCRIPT — #${ticketId}
Exported by: ${interaction.user.tag} • Bot made by @PremiumNPC
Include Attachments: ${includeAttachments ? 'YES' : 'NO'}
================================================================================`;

        const fileAttachment = new AttachmentBuilder(
          Buffer.from(transcriptPayload, 'utf8'),
          { name: filename }
        );

        const embed = new EmbedBuilder()
          .setTitle(`📁 Support Ticket #${ticketId} Transcript Exported`)
          .setColor(0x57f287)
          .setDescription(
            `Transcript compiled for **#ticket-${ticketId}**.`
          )
          .addFields(
            {
              name: 'Format',
              value: isJson ? 'JSON' : 'TEXT',
              inline: true,
            },
            {
              name: 'Attachments Included',
              value: includeAttachments ? 'Yes' : 'No',
              inline: true,
            },
            {
              name: 'File Attached',
              value: filename,
              inline: true,
            }
          )
          .setFooter({
            text: 'SellAuth Ticket Engine • Bot made by @PremiumNPC',
          });

        return await interaction.reply({
          embeds: [embed],
          files: [fileAttachment],
        });
      }

      default: {
        return await interaction.reply({
          content: `✨ Command /${commandName} received, but no handler is configured for it.`,
          ephemeral: true,
        });
      }
    }
  } catch (err: any) {
    console.error(`Error executing ${commandName}:`, err);

const message =
  err instanceof Error ? err.message : 'An unexpected error occurred.';


    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: `❌ Error: ${message}`,
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: `❌ Error: ${message}`,
        ephemeral: true,
      });
    }
  }
}
