import {
  Client,
  EmbedBuilder,
  AttachmentBuilder,
  MessageFlags,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
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
  // B4 beta tester application dashboard.
  if (interaction.isButton() && interaction.customId === 'b4_beta_apply') {
    const modal = new ModalBuilder()
      .setCustomId('b4_beta_application_modal')
      .setTitle('B4 Beta Tester Application');

    const whyInput = new TextInputBuilder()
      .setCustomId('beta_why')
      .setLabel('Why do you want to beta test?')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1000);
    const platformInput = new TextInputBuilder()
      .setCustomId('beta_platform')
      .setLabel('What device/platform will you test on?')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);
    const experienceInput = new TextInputBuilder()
      .setCustomId('beta_experience')
      .setLabel('Any software or bot testing experience?')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(700);
    const availabilityInput = new TextInputBuilder()
      .setCustomId('beta_availability')
      .setLabel('How often can you test and report bugs?')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(300);
    const ideasInput = new TextInputBuilder()
      .setCustomId('beta_ideas')
      .setLabel('What would you test or improve?')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1000);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(whyInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(platformInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(experienceInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(availabilityInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(ideasInput),
    );
    await interaction.showModal(modal);
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId === 'b4_beta_application_modal') {
    const applicationChannelId = process.env.BETA_APPLICATION_CHANNEL_ID;
    if (!applicationChannelId || !interaction.guild) {
      await interaction.reply({
        content: 'Applications are temporarily unavailable. Please tell a server administrator to configure BETA_APPLICATION_CHANNEL_ID in Railway.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const applicationChannel = await interaction.guild.channels.fetch(applicationChannelId).catch(() => null);
    if (!applicationChannel || !applicationChannel.isTextBased() || !('send' in applicationChannel)) {
      await interaction.reply({
        content: 'The beta application inbox is not configured correctly. Please contact a server administrator.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const answer = (id: string) => interaction.fields.getTextInputValue(id).trim().slice(0, 1000) || 'No answer provided';
    const applicationEmbed = new EmbedBuilder()
      .setTitle('🧪 New B4 Redeemer Beta Tester Application')
      .setColor(0xe53935)
      .setDescription(`Applicant: <@${interaction.user.id}> (\`${interaction.user.id}\`)`)
      .addFields(
        { name: 'Why do you want to beta test?', value: answer('beta_why') },
        { name: 'Device / platform', value: answer('beta_platform') },
        { name: 'Testing experience', value: answer('beta_experience') },
        { name: 'Availability', value: answer('beta_availability') },
        { name: 'What would you test or improve?', value: answer('beta_ideas') },
      )
      .setFooter({ text: 'B4 Redeemer • Beta Applications' })
      .setTimestamp();

    const acceptButton = new ButtonBuilder()
      .setCustomId(`b4_beta_review_accept:${interaction.user.id}`)
      .setLabel('Accept Applicant')
      .setStyle(ButtonStyle.Success);
    const denyButton = new ButtonBuilder()
      .setCustomId(`b4_beta_review_deny:${interaction.user.id}`)
      .setLabel('Deny Applicant')
      .setStyle(ButtonStyle.Danger);
    const reviewDashboard = new EmbedBuilder()
      .setTitle('📋 B4 REDEEMER • APPLICATION REVIEW')
      .setDescription('A new beta tester application is awaiting an administrator decision.')
      .setColor(0xe53935)
      .addFields(
        { name: 'STATUS', value: '🟡 PENDING REVIEW', inline: true },
        { name: 'APPLICANT', value: `<@${interaction.user.id}>\n\`${interaction.user.id}\``, inline: true },
        ...applicationEmbed.data.fields!.map((field: any) => ({ name: field.name, value: field.value, inline: false })),
      )
      .setFooter({ text: 'B4 Redeemer • Staff Review Dashboard' })
      .setTimestamp();

    await applicationChannel.send({
      embeds: [reviewDashboard],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(acceptButton, denyButton)],
      allowedMentions: { parse: [] },
    });
    await interaction.reply({
      content: 'Your B4 Redeemer beta tester application has been submitted. Staff will review it.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Beta application decisions are restricted to server administrators.
  if (interaction.isButton() && /^b4_beta_review_(accept|deny):\d+$/.test(interaction.customId)) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: 'Only server administrators can accept or deny beta applications.', flags: MessageFlags.Ephemeral });
      return;
    }
    const [, decision, applicantId] = interaction.customId.match(/^b4_beta_review_(accept|deny):(\d+)$/)!;
    const accepted = decision === 'accept';
    const currentEmbed = interaction.message.embeds[0];
    const updatedEmbed = EmbedBuilder.from(currentEmbed)
      .setTitle(accepted ? '✅ B4 REDEEMER • APPLICATION ACCEPTED' : '⛔ B4 REDEEMER • APPLICATION DENIED')
      .setColor(accepted ? 0x2ecc71 : 0xe74c3c)
      .setDescription(`Decision recorded by <@${interaction.user.id}>.`)
      .setFields(
        ...currentEmbed.fields.filter((field: any) => field.name !== 'STATUS' && field.name !== 'REVIEWED BY'),
        { name: 'STATUS', value: accepted ? '✅ ACCEPTED' : '⛔ DENIED', inline: true },
        { name: 'REVIEWED BY', value: `<@${interaction.user.id}>`, inline: true },
      )
      .setTimestamp();
    await interaction.update({ embeds: [updatedEmbed], components: [] });

    const auditChannelId = process.env.BETA_APPLICATION_LOG_CHANNEL_ID;
    if (auditChannelId && interaction.guild) {
      const auditChannel = await interaction.guild.channels.fetch(auditChannelId).catch(() => null);
      if (auditChannel && auditChannel.isTextBased() && 'send' in auditChannel) {
        const auditEmbed = new EmbedBuilder()
          .setTitle('📊 BETA APPLICATION • DECISION LOG')
          .setColor(accepted ? 0x2ecc71 : 0xe74c3c)
          .setDescription(accepted ? 'The application was **accepted**.' : 'The application was **denied**.')
          .addFields(
            { name: 'APPLICANT', value: `<@${applicantId}>\n\`${applicantId}\``, inline: true },
            { name: 'DECISION', value: accepted ? '✅ ACCEPTED' : '⛔ DENIED', inline: true },
            { name: 'ADMIN', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'REVIEW DASHBOARD', value: `[Open reviewed application](https://discord.com/channels/${interaction.guildId}/${interaction.channelId}/${interaction.message.id})` },
          )
          .setFooter({ text: 'B4 Redeemer • Audit Log' })
          .setTimestamp();
        await auditChannel.send({ embeds: [auditEmbed], allowedMentions: { parse: [] } }).catch((error: unknown) => console.error('Could not write beta decision audit log:', error));
      }
    }

    await interaction.followUp({
      content: accepted ? `✅ Accepted <@${applicantId}>'s beta application.` : `⛔ Denied <@${applicantId}>'s beta application.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Ticket creation and close buttons.
  if (interaction.isButton() && interaction.customId === 'b4_ticket_create') {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({ content: 'Tickets can only be opened inside the server.', flags: MessageFlags.Ephemeral });
      return;
    }
    const existing = guild.channels.cache.find((channel: any) =>
      channel.type === 0 && channel.topic?.includes(`ticket-owner:${interaction.user.id}`)
    );
    if (existing) {
      await interaction.reply({ content: `You already have an open ticket: <#${existing.id}>`, flags: MessageFlags.Ephemeral });
      return;
    }
    const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 20) || 'user';
    const overwrites: any[] = [
      { id: guild.roles.everyone.id, deny: ['ViewChannel'] },
      { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles', 'EmbedLinks'] },
      { id: client.user!.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageChannels'] },
    ];
    if (config.tickets.supportRoleId) {
      overwrites.push({ id: config.tickets.supportRoleId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles'] });
    }
    const channel = await guild.channels.create({
      name: `ticket-${safeName}`,
      type: 0,
      topic: `ticket-owner:${interaction.user.id}`,
      parent: config.tickets.categoryId || undefined,
      permissionOverwrites: overwrites,
    });
    const closeButton = new ButtonBuilder()
      .setCustomId('b4_ticket_close')
      .setLabel('Close Ticket')
      .setStyle(ButtonStyle.Danger);
    const greeting = new EmbedBuilder()
      .setTitle('🎫 Support Ticket')
      .setDescription(`Welcome <@${interaction.user.id}>! Describe your issue and a staff member will help you.${config.tickets.supportRoleId ? `\n\n<@&${config.tickets.supportRoleId}>\n` : ''}`)
      .setColor(0x8b5cf6)
      .setTimestamp();
    await channel.send({
      embeds: [greeting],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(closeButton)],
      allowedMentions: { users: [interaction.user.id], roles: config.tickets.supportRoleId ? [config.tickets.supportRoleId] : [] },
    });
    await interaction.reply({ content: `✅ Your ticket is ready: <#${channel.id}>`, flags: MessageFlags.Ephemeral });
    return;
  }

  if (interaction.isButton() && interaction.customId === 'b4_ticket_close') {
    const channel = interaction.channel;
    const guild = interaction.guild;
    if (!guild || !channel || !('topic' in channel) || !channel.topic?.startsWith('ticket-owner:')) {
      await interaction.reply({ content: 'This is not a recognized ticket channel.', flags: MessageFlags.Ephemeral });
      return;
    }
    const ownerId = channel.topic.slice('ticket-owner:'.length);
    const isOwner = interaction.user.id === ownerId;
    const isAdmin = Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.Administrator));
    const hasSupportRole = Boolean(config.tickets.supportRoleId && interaction.member?.roles?.cache?.has(config.tickets.supportRoleId));
    if (!isOwner && !isAdmin && !hasSupportRole) {
      await interaction.reply({ content: 'Only the ticket creator, support staff, or an administrator can close this ticket.', flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.reply({ content: '🔒 Ticket closed. This channel will be deleted in 5 seconds.' });
    if (config.tickets.logChannelId) {
      const logChannel = guild.channels.cache.get(config.tickets.logChannelId);
      if (logChannel && logChannel.isTextBased() && 'send' in logChannel) {
        await logChannel.send(`🔒 Ticket <#${channel.id}> closed by <@${interaction.user.id}> (owner <@${ownerId}>).`);
      }
    }
    setTimeout(() => { void channel.delete('Ticket closed').catch(console.error); }, 5000);
    return;
  }

  // Redemption panel button opens a modal for the SellAuth order ID.
  if (interaction.isButton() && interaction.customId === 'b4_redeem_order') {
    const modal = new ModalBuilder()
      .setCustomId('b4_redeem_order_modal')
      .setTitle('Redeem Your Order');
    const orderIdInput = new TextInputBuilder()
      .setCustomId('sellauth_order_id')
      .setLabel('SellAuth order ID')
      .setPlaceholder('Enter your order ID')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(orderIdInput));
    await interaction.showModal(modal);
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId === 'b4_redeem_order_modal') {
    const orderId = interaction.fields.getTextInputValue('sellauth_order_id').trim();
    if (!orderId || orderId.length > 100) {
      await interaction.reply({ content: 'Please enter a valid SellAuth order ID.', flags: MessageFlags.Ephemeral });
      return;
    }
    // Do not automatically grant the buyer role from an order ID alone: it does not prove ownership.
    // This safely collects the ID and lets staff verify ownership before assigning the role.
    await interaction.reply({
      content: `✅ Order ID \`\${orderId.replace(/\`/g, '')}\` submitted. Staff must verify the order belongs to you before assigning the **BUYER** role.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const commandName: string = interaction.commandName;
  const subcommand: string =
    interaction.options.getSubcommand(false) ?? '';

  // Replies in this channel should be public; keep replies ephemeral elsewhere.
  const privateReply =
    interaction.channelId === '1559728973603405854'
      ? {}
      : { flags: MessageFlags.Ephemeral };

  try {
    switch (commandName) {
      case 'dashboard': {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
          await interaction.reply({
            content: 'Only administrators can post the beta tester dashboard.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (!process.env.BETA_APPLICATION_CHANNEL_ID) {
          await interaction.reply({
            content: 'Set BETA_APPLICATION_CHANNEL_ID in Railway to the private staff review channel. Optionally set BETA_APPLICATION_LOG_CHANNEL_ID to a separate audit-log channel.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle('🧪 B4 Redeemer Beta Tester Program')
          .setDescription('Want to help test upcoming features and report bugs? Click **Apply to Beta Test** and answer the application questions. Your answers are sent privately to the configured staff application channel.')
          .setColor(0xe53935)
          .addFields(
            { name: 'What beta testers do', value: '• Try new features\n• Report bugs clearly\n• Share useful feedback', inline: true },
            { name: 'Before applying', value: 'Be respectful, give honest answers, and only apply if you can test features when available.', inline: true },
          )
          .setFooter({ text: 'B4 Redeemer • Beta Tester Dashboard' });

        const applyButton = new ButtonBuilder()
          .setCustomId('b4_beta_apply')
          .setLabel('Apply to Beta Test')
          .setStyle(ButtonStyle.Danger);

        await interaction.channel.send({
          embeds: [embed],
          components: [new ActionRowBuilder<ButtonBuilder>().addComponents(applyButton)],
        });
        await interaction.reply({
          content: 'Beta tester dashboard posted.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      case 'ticket-panel': {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
          await interaction.reply({ content: '❌ Only administrators can post the ticket panel.', flags: MessageFlags.Ephemeral });
          return;
        }
        const embed = new EmbedBuilder()
          .setTitle('🎫 B4 Mods Support')
          .setDescription('Need help? Click **Open Ticket** below to create a private support channel. Please explain your issue clearly and wait for staff.')
          .setColor(0x8b5cf6)
          .setFooter({ text: 'B4 Mods Support' });
        const button = new ButtonBuilder()
          .setCustomId('b4_ticket_create')
          .setLabel('Open Ticket')
          .setEmoji('🎫')
          .setStyle(ButtonStyle.Success);
        await interaction.channel.send({ embeds: [embed], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(button)] });
        await interaction.reply({ content: '✅ Ticket panel posted.', flags: MessageFlags.Ephemeral });
        return;
      }

      case 'redeem-panel': {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
          await interaction.reply({ content: '❌ Only server administrators can post the redemption panel.', flags: MessageFlags.Ephemeral });
          return;
        }
        const embed = new EmbedBuilder()
          .setTitle('👑 Redeem Your Order')
          .setDescription('Click the button below and enter your SellAuth order ID to claim the buyer role.')
          .setColor(0x8b5cf6)
          .setFooter({ text: 'B4 Mods • Powered by SellAuth' });
        const button = new ButtonBuilder()
          .setCustomId('b4_redeem_order')
          .setLabel('Redeem Order')
          .setStyle(ButtonStyle.Primary);
        await interaction.channel.send({
          embeds: [embed],
          components: [new ActionRowBuilder<ButtonBuilder>().addComponents(button)],
        });
        await interaction.reply({ content: '✅ Redemption panel posted in this channel.', flags: MessageFlags.Ephemeral });
        return;
      }

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
            content: '❌ Only server administrators can restock products.',
          });
          return;
        }

        const productIdRaw = interaction.options.getString('product_id', true);
        const productId = Number(productIdRaw);

        if (!Number.isSafeInteger(productId) || productId <= 0) {
          await interaction.reply({
            content: '❌ Product ID must be a positive number.',
          });
          return;
        }

        if (subcommand === 'restock') {
          const variantId = interaction.options.getString('variant_id', true);
          if (!/^\d+$/.test(variantId) || Number(variantId) <= 0) {
            await interaction.reply({ content: '❌ Variant ID must be a positive numeric SellAuth variant ID.' });
            return;
          }
          const serialsInput = interaction.options.getString('serials', true);
          const serials: string[] = Array.from(
            new Set<string>(
              serialsInput
                .split(/[\r\n,]+/)
                .map((serial: string) => serial.trim())
                .filter((serial: string): serial is string => serial.length > 0)
            )
          );

          if (serials.length === 0) {
            await interaction.reply({
                content: '❌ Paste at least one license key, one per line.',
            });
            return;
          }

          if (serials.length > 100) {
            await interaction.reply({
                content: '❌ You can add up to 100 keys per restock. Split larger batches into multiple commands.',
            });
            return;
          }

          await interaction.deferReply();
          const result = await sellauth.getProduct(productId);
          const product = result?.data ?? result?.product ?? result;
          if (!product || typeof product !== 'object') {
            await interaction.editReply(`❌ Product ${productId} was not found.`);
            return;
          }

          await sellauth.appendKeys(productId, variantId, serials);
          await interaction.editReply(
            `✅ Added **${serials.length}** serials to **${product.name ?? `product #${productId}`}** in SellAuth.`
          );
          return;
        }

        await interaction.deferReply();
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
          content: '✅ Key redeemed successfully! Your **BUYER** role has been assigned.',
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
        const variantId = interaction.options.getString('variant_id', true);
        const amount = interaction.options.getInteger('amount', true);

        if (!Number.isSafeInteger(productId) || productId <= 0) {
          await interaction.reply({
            ...privateReply,
            content: '❌ Product ID must be a positive number.',
          });
          return;
        }

        if (!/^\d+$/.test(variantId) || Number(variantId) <= 0) {
          await interaction.reply({ ...privateReply, content: '❌ Variant ID must be a positive numeric SellAuth variant ID.' });
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
          await sellauth.appendKeys(productId, variantId, keys);
        } catch (error) {
          uploadedToSellAuth = false;
          console.error('SellAuth key upload failed; keys remain available for bot redemption:', error);
        }

        // DM the generated keys to the admin as a .txt file.
        let dmSent = true;
        try {
          const keyFile = new AttachmentBuilder(
            Buffer.from(keys.join('\n'), 'utf8'),
            { name: `b4mods-keys-product-${productId}.txt` }
          );
          await interaction.user.send({
            content: `🔑 Your ${keys.length} generated B4 Mods keys for product ${productId}:`,
            files: [keyFile],
          });
        } catch (error) {
          dmSent = false;
          console.error('Could not DM generated key file to command user:', error);
        }

        await interaction.editReply({
          content: uploadedToSellAuth
            ? (dmSent
                ? `✅ Generated **${keys.length}** B4 Mods keys and uploaded them to SellAuth product **${productId}**. The keys were sent to your DMs and saved for one-time /redeem role claims.`
                : `⚠️ Generated **${keys.length}** B4 Mods keys and uploaded them to SellAuth product **${productId}**, but I couldn't DM you the keys. Enable DMs from this server and try again; no file was attached.`)
            : (dmSent
                ? `⚠️ Generated **${keys.length}** B4 Mods keys and sent them to your DMs for one-time /redeem role claims, but SellAuth rejected the upload for product **${productId}**. These keys were NOT added to SellAuth. Check the API endpoint/permissions before selling them there.`
                : `⚠️ Generated **${keys.length}** B4 Mods keys, but SellAuth rejected the upload and I couldn't DM you the keys. These keys were NOT added to SellAuth. Enable DMs from this server before generating another batch.`),
        });
        return;
      }

      // Coupon listing and creation are restricted to Discord administrators.
      case 'coupon': {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
          await interaction.reply({
            content: '❌ Only server administrators can manage discount coupons.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (subcommand === 'list') {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });

          const result = await sellauth.getCoupons();
          const coupons = Array.isArray(result)
            ? result
            : Array.isArray(result?.data)
              ? result.data
              : Array.isArray(result?.coupons)
                ? result.coupons
                : Array.isArray(result?.data?.coupons)
                  ? result.data.coupons
                  : [];

          if (coupons.length === 0) {
            await interaction.editReply('No coupons were returned by SellAuth.');
            return;
          }

          const embed = new EmbedBuilder()
            .setTitle('🎟️ SellAuth Coupons')
            .setColor(0x5865f2)
            .setDescription(
              coupons.slice(0, 20).map((coupon: any) => {
                const code = String(coupon.code ?? coupon.name ?? 'Unknown code');
                const rawDiscount = coupon.discount ?? coupon.amount ?? coupon.value;
                const discountType = String(coupon.type ?? coupon.discount_type ?? '').toLowerCase();
                const discount = rawDiscount == null
                  ? 'Discount not provided'
                  : discountType.includes('percent') || coupon.percentage != null
                    ? `${coupon.percentage ?? rawDiscount}% off`
                    : discountType.includes('fixed') || discountType.includes('amount')
                      ? `${rawDiscount} off`
                      : String(rawDiscount);
                const status = coupon.status ?? (coupon.active === false ? 'Inactive' : coupon.active === true ? 'Active' : 'Status unknown');
                const uses = coupon.uses ?? coupon.used ?? coupon.usage_count;
                const maxUses = coupon.max_uses ?? coupon.usage_limit;
                const usage = uses == null
                  ? ''
                  : `\nUses: ${uses}${maxUses == null ? '' : ` / ${maxUses}`}`;
                return `**${code}**\nDiscount: ${discount}\nStatus: ${status}${usage}`;
              }).join('\n\n')
            )
            .setFooter({ text: `Showing ${Math.min(coupons.length, 20)} of ${coupons.length} coupons` })
            .setTimestamp();

          await interaction.editReply({ embeds: [embed] });
          return;
        }

        if (subcommand !== 'create') {
          await interaction.reply({
            flags: MessageFlags.Ephemeral,
            content: 'Unknown coupon subcommand.',
          });
          return;
        }

        const code = interaction.options.getString('code', true).trim().toUpperCase();
        const discount = interaction.options.getNumber('discount', true);
        const type = interaction.options.getString('type', true) as 'percentage' | 'fixed';

        if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
          await interaction.reply({
            content: '❌ Coupon code must be 3–32 characters and use only letters, numbers, underscores, or hyphens.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (!Number.isFinite(discount) || discount <= 0 || (type === 'percentage' && discount > 100)) {
          await interaction.reply({
            content: type === 'percentage'
              ? '❌ Percentage discount must be greater than 0 and no more than 100.'
              : '❌ Fixed discount must be greater than 0.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const result = await sellauth.createCoupon({
          code,
          discount,
          type,
          global: true,
        });
        const coupon = result?.data ?? result?.coupon ?? result;
        const createdCode = String(coupon?.code ?? code);
        await interaction.editReply(
          `✅ Created coupon **${createdCode}** with a ${type === 'percentage' ? `${discount}% discount` : `fixed discount of ${discount}`}. It applies store-wide.`
        );
        return;
      }

      // Other commands: integrations still need to be implemented.
      case 'customer':
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

      // /echo message
      case 'echo': {
        const message = interaction.options.getString('message', true).trim();

        if (!message) {
          await interaction.reply({
            flags: MessageFlags.Ephemeral,
            content: '❌ Enter a message for me to echo.',
          });
          return;
        }

        const channel = interaction.channel;
        if (!channel || !channel.isTextBased() || !('send' in channel)) {
          await interaction.reply({
            flags: MessageFlags.Ephemeral,
            content: '❌ I cannot send messages in this channel.',
          });
          return;
        }

        // Send a separate normal channel message, not the slash-command response.
        await channel.send({
          content: message,
          allowedMentions: { parse: [] },
        });

        await interaction.reply({
          flags: MessageFlags.Ephemeral,
          content: '✅ Message sent.',
        });
        return;
      }

      // /fun coinflip | /fun joke | /fun 8ball
      case 'fun': {
        const jokes = [
          'Why did the developer go broke? Because they used up all their cache.',
          'There are 10 kinds of people: those who understand binary and those who don’t.',
          'Why do programmers prefer dark mode? Because light attracts bugs.',
          'I told my computer I needed a break, and it said: “No problem — I’ll go to sleep.”',
          'Why was the Discord bot calm? It had great server stability.',
        ];
        const answers = [
          'It is certain. 🔮',
          'Probably, twin. ✨',
          'Signs point to yes. 👀',
          'Ask again after the next update. 💻',
          'The vibes say no. 🥀',
          'Cannot predict that one — the API is acting up. 😭',
          'Absolutely. Ship it. 🚀',
          'I would not count on it. 🫡',
        ];

        if (subcommand === 'coinflip') {
          await interaction.reply(
            Math.random() < 0.5 ? '🪙 **Heads!**' : '🪙 **Tails!**'
          );
          return;
        }

        if (subcommand === 'joke') {
          await interaction.reply(
            jokes[Math.floor(Math.random() * jokes.length)]
          );
          return;
        }

        if (subcommand === '8ball') {
          const question = interaction.options.getString('question', true);
          const answer = answers[Math.floor(Math.random() * answers.length)];
          const embed = new EmbedBuilder()
            .setTitle('🔮 Magic 8-Ball')
            .setColor(0x8b5cf6)
            .addFields(
              { name: 'Question', value: question },
              { name: 'Answer', value: answer }
            )
            .setFooter({ text: `Asked by ${interaction.user.username}` });
          await interaction.reply({ embeds: [embed] });
          return;
        }

        await interaction.reply({
          content: 'Pick a subcommand: coinflip, joke, or 8ball.',
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
