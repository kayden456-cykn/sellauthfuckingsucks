import {
  Client,
  EmbedBuilder,
  AttachmentBuilder,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js';

import { sellauth } from '../services/sellauth.js';
import { RoleManager } from '../services/roleDistribution.js';
import { InvoiceGenerator } from '../services/pdfInvoice.js';
import { config } from '../config.js';
import { randomBytes } from 'node:crypto';
import { LicenseStore } from '../services/licenseStore.js';

export async function handleCommandInteraction(
  client: Client,
  interaction: any
): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const commandName: string = interaction.commandName;
  const subcommand: string =
    interaction.options.getSubcommand(false) ?? '';

  const privateReply = { flags: MessageFlags.Ephemeral };

  try {
    switch (commandName) {
      // /product list
      case 'product': {
        if (subcommand !== 'list') {
          await interaction.reply({
            ...privateReply,
            content: 'Unknown product subcommand.',
          });
          return;
        }

        const result = await sellauth.getProducts();
        const products = Array.isArray(result)
          ? result
          : result?.data ?? result?.products ?? [];

        if (!products.length) {
          await interaction.reply({
            ...privateReply,
            content: 'No products were returned by SellAuth.',
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle('📦 SellAuth Product Inventory')
          .setColor(0x5865f2)
          .setDescription(
            products
              .slice(0, 20)
              .map(
                (product: any) =>
                  `**${product.name ?? 'Unnamed product'}**\n` +
                  `ID: \`${product.id}\` · ` +
                  `Price: $${product.price ?? 'N/A'} · ` +
                  `Stock: ${product.stock ?? 'N/A'}`
              )
              .join('\n\n')
          )
          .setTimestamp();

        await interaction.reply({
          ...privateReply,
          embeds: [embed],
        });
        return;
      }

      // /stock check | /stock restock
      case 'stock': {
        if (subcommand !== 'check' && subcommand !== 'restock') {
          await interaction.reply({
            ...privateReply,
            content: 'Unknown stock subcommand.',
          });
          return;
        }

        // Only administrators can change SellAuth inventory.
        if (
          subcommand === 'restock' &&
          !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
        ) {
          await interaction.reply({
            ...privateReply,
            content: '❌ Only server administrators can restock products.',
          });
          return;
        }

        const productIdRaw = interaction.options.getString('product_id', true);
        const productId = Number(productIdRaw);

        if (!Number.isSafeInteger(productId) || productId <= 0) {
          await interaction.reply({
            ...privateReply,
            content: '❌ Product ID must be a positive number.',
          });
          return;
        }

        if (subcommand === 'restock') {
          const serialsInput = interaction.options.getString('serials', true);
          const serials = [...new Set(
            serialsInput
              .split(/[\r\n,]+/)
              .map((serial: string) => serial.trim())
              .filter(Boolean)
          )];

          if (serials.length === 0) {
            await interaction.reply({
              ...privateReply,
              content: '❌ Paste at least one license key, one per line.',
            });
            return;
          }

          if (serials.length > 100) {
            await interaction.reply({
              ...privateReply,
              content: '❌ You can add up to 100 keys per restock. Split larger batches into multiple commands.',
            });
            return;
          }

          await interaction.deferReply(privateReply);
          const result = await sellauth.getProduct(productId);
          const product = result?.data ?? result?.product ?? result;
          if (!product || typeof product !== 'object') {
            await interaction.editReply(`❌ Product ${productId} was not found.`);
            return;
          }

          await sellauth.appendKeys(productId, serials);
          await interaction.editReply(
            `✅ Added **${serials.length}** serials to **${product.name ?? `product #${productId}`}** in SellAuth.`
          );
          return;
        }

        await interaction.deferReply(privateReply);
        const result = await sellauth.getProduct(productId);
        const product = result?.data ?? result?.product ?? result;

        if (!product || typeof product !== 'object') {
          await interaction.editReply(`❌ Product ${productId} was not found.`);
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle('📦 Product Stock')
          .setColor(0x5865f2)
          .addFields(
            {
              name: 'Product',
              value: String(product.name ?? 'Unknown'),
              inline: true,
            },
            {
              name: 'Product ID',
              value: String(product.id ?? productId),
              inline: true,
            },
            {
              name: 'Available Stock',
              value: String(product.stock ?? 'Unknown'),
              inline: true,
            }
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // /redeem key
      case 'redeem': {
        const key = interaction.options.getString('key', true);

        if (!interaction.guild) {
          await interaction.reply({
            ...privateReply,
            content: 'You must redeem keys inside the server where you want the role.',
          });
          return;
        }

        if (!config.roles.verifiedCustomer) {
          await interaction.reply({
            ...privateReply,
            content: '❌ The customer role is not configured. Ask a server administrator to set ROLE_VERIFIED_CUSTOMER.',
          });
          return;
        }

        const result = await LicenseStore.redeemKey(key, interaction.user.id);
        if (!result.success) {
          await interaction.reply({
            ...privateReply,
            content: `❌ ${result.message}`,
          });
          return;
        }

        try {
          const member = await interaction.guild.members.fetch(interaction.user.id);
          await member.roles.add(config.roles.verifiedCustomer);
        } catch (error) {
          await LicenseStore.releaseKey(key, interaction.user.id);
          throw new Error('The key was valid, but I could not assign the role. Check my Manage Roles permission and role hierarchy.');
        }

        await interaction.reply({
          ...privateReply,
          content: '✅ Key redeemed successfully! Your **Verified Customer** role has been assigned.',
        });
        return;
      }

      // /role verify
      case 'role': {
        if (subcommand !== 'verify') {
          await interaction.reply({
            ...privateReply,
            content: 'Unknown role subcommand.',
          });
          return;
        }

        if (!interaction.guild) {
          await interaction.reply({
            ...privateReply,
            content: 'This command must be used inside your server.',
          });
          return;
        }

        const query = interaction.options.getString(
          'query',
          true
        );

        const result = await RoleManager.verifyAndAssign(
          interaction.guild,
          interaction.user.id,
          query
        );

        await interaction.reply({
          ...privateReply,
          content: result.success
            ? `✅ Verification successful! Assigned **${result.roleName}**.`
            : `❌ Verification failed: ${result.message}`,
        });
        return;
      }

      // /invoice pdf
      case 'invoice': {
        if (subcommand !== 'pdf') {
          await interaction.reply({
            ...privateReply,
            content: 'Unknown invoice subcommand.',
          });
          return;
        }

        const orderId = interaction.options.getString(
          'order_id',
          true
        );

        const order = await sellauth.getOrder(orderId);

        if (!order) {
          await interaction.reply({
            ...privateReply,
            content: `Order ${orderId} was not found.`,
          });
          return;
        }

        const pdf = InvoiceGenerator.generateBuffer(order);

        await interaction.reply({
          ...privateReply,
          content: `📄 Invoice for order ${orderId}:`,
          files: [
            {
              attachment: pdf,
              name: `Invoice-${orderId}.pdf`,
            },
          ],
        });
        return;
      }

      // /analytics today
      case 'analytics': {
        if (subcommand !== 'today') {
          await interaction.reply({
            ...privateReply,
            content: 'Unknown analytics subcommand.',
          });
          return;
        }

        const stats = await sellauth.getStats('day');

        const embed = new EmbedBuilder()
          .setTitle("💰 Today's SellAuth Analytics")
          .setColor(0x00ff88)
          .addFields(
            {
              name: 'Gross Revenue',
              value: `$${Number(stats.gross ?? 0).toFixed(2)}`,
              inline: true,
            },
            {
              name: 'Orders',
              value: String(stats.orders ?? 0),
              inline: true,
            }
          )
          .setTimestamp();

        await interaction.reply({
          ...privateReply,
          embeds: [embed],
        });
        return;
      }

      // /order search
      case 'order': {
        if (subcommand !== 'search') {
          await interaction.reply({
            ...privateReply,
            content: 'Unknown order subcommand.',
          });
          return;
        }

        const orderId = interaction.options.getString(
          'query',
          true
        );

        const order = await sellauth.getOrder(orderId);

        if (!order) {
          await interaction.reply({
            ...privateReply,
            content: `❌ Order ${orderId} was not found.`,
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle(`📦 Order ${order.id ?? orderId}`)
          .setColor(0x5865f2)
          .addFields(
            {
              name: 'Status',
              value: String(order.status ?? 'Unknown'),
              inline: true,
            },
            {
              name: 'Product',
              value: String(order.productName ?? 'Unknown'),
              inline: true,
            },
            {
              name: 'Total',
              value: `${order.currency ?? ''} ${order.total ?? 'Unknown'}`,
              inline: true,
            },
            {
              name: 'Payment Method',
              value: String(order.paymentMethod ?? 'Unknown'),
              inline: true,
            },
            {
              name: 'Invoice',
              value: String(order.invoiceNumber ?? order.id ?? orderId),
              inline: true,
            }
          )
          .setTimestamp();

        await interaction.reply({
          ...privateReply,
          embeds: [embed],
        });
        return;
      }

      // /ticket export
      case 'ticket': {
        if (subcommand !== 'export') {
          await interaction.reply({
            ...privateReply,
            content: 'Unknown ticket subcommand.',
          });
          return;
        }

        const ticketId = interaction.options.getString(
          'ticket_id',
          true
        );
        const format = (
          interaction.options.getString('format') ?? 'json'
        ).toLowerCase();
        const includeAttachments =
          interaction.options.getBoolean('include_attachments') ??
          true;

        const isJson = format === 'json';
        const filename =
          `ticket-${ticketId}-transcript.${isJson ? 'json' : 'txt'}`;

        const transcript = isJson
          ? JSON.stringify(
              {
                exportedAt: new Date().toISOString(),
                exportedBy: interaction.user.tag,
                ticketId,
                includeAttachments,
                note:
                  'This export contains command-provided metadata. ' +
                  'It does not retrieve actual ticket channel messages.',
              },
              null,
              2
            )
          : [
              `Ticket transcript metadata: ${ticketId}`,
              `Exported by: ${interaction.user.tag}`,
              `Exported at: ${new Date().toISOString()}`,
              `Include attachments: ${includeAttachments}`,
              '',
              'Note: Actual ticket messages have not been retrieved.',
            ].join('\n');

        const file = new AttachmentBuilder(
          Buffer.from(transcript, 'utf8'),
          { name: filename }
        );

        await interaction.reply({
          ...privateReply,
          content:
            '⚠️ Exported ticket metadata. Actual channel messages are not integrated yet.',
          files: [file],
        });
        return;
      }

      // /system status
      case 'system': {
        if (subcommand !== 'status') {
          await interaction.reply({
            ...privateReply,
            content: 'Unknown system subcommand.',
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle('⚙️ Bot System Status')
          .setColor(0x57f287)
          .addFields(
            {
              name: 'Discord',
              value: client.isReady() ? 'Connected' : 'Connecting',
              inline: true,
            },
            {
              name: 'SellAuth API Key',
              value: config.sellauth.apiKey
                ? 'Configured'
                : 'Missing',
              inline: true,
            },
            {
              name: 'Uptime',
              value: `${Math.floor(process.uptime())} seconds`,
              inline: true,
            }
          )
          .setTimestamp();

        await interaction.reply({
          ...privateReply,
          embeds: [embed],
        });
        return;
      }

      // /security status
      case 'security': {
        if (subcommand !== 'status') {
          await interaction.reply({
            ...privateReply,
            content: 'Unknown security subcommand.',
          });
          return;
        }

        await interaction.reply({
          ...privateReply,
          embeds: [
            new EmbedBuilder()
              .setTitle('🔐 Security Status')
              .setColor(0x5865f2)
              .setDescription(
                'The bot is connected. This command does not yet ' +
                'run a full security audit or retrieve SellAuth fraud data.'
              )
              .setTimestamp(),
          ],
        });
        return;
      }

      // /notify toggle-dms
      case 'notify': {
        if (subcommand !== 'toggle-dms') {
          await interaction.reply({
            ...privateReply,
            content: 'Unknown notification subcommand.',
          });
          return;
        }

        await interaction.reply({
          ...privateReply,
          content:
            '⚠️ The notification preference storage is not implemented yet. ' +
            'No settings were changed.',
        });
        return;
      }

// /affiliate status
      case 'affiliate': {
        if (subcommand !== 'status') {
          await interaction.reply({
            ...privateReply,
            content: 'Unknown affiliate subcommand.',
          });
          return;
        }

        await interaction.deferReply({
          flags: MessageFlags.Ephemeral,
        });

        try {
          const result = await sellauth.getAffiliates();

          const affiliates = Array.isArray(result)
            ? result
            : result?.data ?? result?.affiliates ?? [];

          if (!affiliates.length) {
            await interaction.editReply(
              'No affiliates were returned by SellAuth.'
            );
            return;
          }

          const embed = new EmbedBuilder()
            .setTitle('Affiliate Status')
            .setColor(0x5865f2)
            .setDescription(
              affiliates.slice(0, 15).map((affiliate: any) =>
                [
                  `**${affiliate.name ?? affiliate.username ?? 'Affiliate'}**`,
                  `ID: \`${affiliate.id ?? 'N/A'}\``,
                  `Code: \`${affiliate.code ?? 'N/A'}\``,
                  `Status: ${affiliate.status ?? 'Not provided'}`,
                ].join('\n')
              ).join('\n\n')
            );

          await interaction.editReply({
            embeds: [embed],
          });
        } catch (error) {
          console.error('Affiliate lookup failed:', error);

          await interaction.editReply(
            '❌ Affiliate lookup failed. Check the API endpoint and permissions.'
          );
        }

        return;
      }

      // /keygen generate
      case 'keygen': {
        if (subcommand !== 'generate') {
          await interaction.reply({
            ...privateReply,
            content: 'Unknown keygen subcommand.',
          });
          return;
        }

        // Only server administrators may generate license keys.
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
          await interaction.reply({
            ...privateReply,
            content: '❌ Only server administrators can generate license keys.',
          });
          return;
        }

        const productIdRaw = interaction.options.getString('product_id', true);
        const productId = Number(productIdRaw);
        const amount = interaction.options.getInteger('amount', true);

        if (!Number.isSafeInteger(productId) || productId <= 0) {
          await interaction.reply({
            ...privateReply,
            content: '❌ Product ID must be a positive number.',
          });
          return;
        }

        if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
          await interaction.reply({
            ...privateReply,
            content: '❌ Amount must be between 1 and 100.',
          });
          return;
        }

        await interaction.deferReply(privateReply);

        // Generate B4 Mods keys and persist them for one-time Discord redemption.
        const keys = Array.from({ length: amount }, () =>
          `b4mods-${randomBytes(4).toString('hex').toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`
        );

        await LicenseStore.registerKeys(keys);

        let uploadedToSellAuth = true;
        try {
          await sellauth.appendKeys(productId, keys);
        } catch (error) {
          uploadedToSellAuth = false;
          console.error('SellAuth key upload failed; keys remain available for bot redemption:', error);
        }

        const attachment = new AttachmentBuilder(
          Buffer.from(keys.join('\n'), 'utf8'),
          { name: `b4mods-keys-product-${productId}.txt` }
        );

        await interaction.editReply({
          content: uploadedToSellAuth
            ? `✅ Generated **${keys.length}** B4 Mods keys and uploaded them to SellAuth product **${productId}**. They are also saved for one-time /redeem role claims. Keys are attached privately.`
            : `⚠️ Generated **${keys.length}** B4 Mods keys and saved them for one-time /redeem role claims, but SellAuth rejected the upload for product **${productId}**. These keys were NOT added to SellAuth. Check the API endpoint/permissions before selling them there. Keys are attached privately.`,
          files: [attachment],
        });
        return;
      }

      // Other commands: integrations still need to be implemented.
      case 'customer':
      case 'coupon':
      case 'vouch':
      case 'crypto':
      case 'flashsale':
      case 'dispute': {
        const featureNames: Record<string, string> = {
          keygen: 'License key generation',
          customer: 'Customer lookup',
          coupon: 'Coupon management',
          vouch: 'Review submission',
          crypto: 'Cryptocurrency payment status',
          flashsale: 'Flash sale management',
          dispute: 'Payment dispute lookup',
        };

        await interaction.reply({
          ...privateReply,
          content:
            `⚠️ **/${commandName}${subcommand ? ` ${subcommand}` : ''}** ` +
            `is registered, but ${featureNames[commandName]} has not been integrated yet.`,
        });

        return;
      }

      default: {
        await interaction.reply({
          ...privateReply,
          content: `Unknown command: /${commandName}`,
        });

        return;
      }
    }
  } catch (error) {
    console.error(`Error executing /${commandName}:`, error);
    const message = error instanceof Error ? error.message : 'Unexpected error';

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: `❌ Failed to execute command: ${message}` });
    } else {
      await interaction.reply({
        ...privateReply,
        content: `❌ Failed to execute command: ${message}`,
      });
    }
  }
}
