import { Guild } from 'discord.js';
import { config } from '../config.js';
import { sellauth } from './sellauth.js';

type VerificationResult =
  | { success: true; roleName: string; order: any }
  | { success: false; message: string };

export class RoleManager {
  static async verifyAndAssign(
    guild: Guild,
    discordUserId: string,
    orderId: string,
    customerEmail: string,
  ): Promise<VerificationResult> {
    try {
      const normalizedEmail = customerEmail.trim().toLowerCase();
      if (!normalizedEmail || !normalizedEmail.includes('@')) {
        return { success: false, message: 'Enter the email address used for the purchase.' };
      }

      const member = await guild.members.fetch(discordUserId);
      const response = await sellauth.getOrder(orderId.trim());
      const order = response?.data ?? response?.order ?? response;

      if (!order || typeof order !== 'object') {
        return { success: false, message: 'That order could not be found in the configured SellAuth shop.' };
      }

      const status = String(order.status ?? order.payment?.status ?? '').toUpperCase();
      if (status !== 'COMPLETED') {
        return { success: false, message: 'That order is not marked COMPLETED. If you have paid, contact staff for help.' };
      }

      const orderEmail = String(
        order.customer?.email ??
        order.customer_email ??
        order.email ??
        order.buyer?.email ??
        ''
      ).trim().toLowerCase();

      if (!orderEmail || orderEmail !== normalizedEmail) {
        return { success: false, message: 'The order ID and purchase email do not match. Check both and try again.' };
      }

      // Prefer the configured role ID, but support the server's role named BUYER.
      let buyerRole = config.roles.verifiedCustomer
        ? await guild.roles.fetch(config.roles.verifiedCustomer).catch(() => null)
        : null;
      buyerRole ??= guild.roles.cache.find(role => role.name.toUpperCase() === 'BUYER') ?? null;

      if (!buyerRole) {
        console.error('[SellAuth verification] BUYER role is missing. Set ROLE_VERIFIED_CUSTOMER to its role ID or create a role named BUYER.');
        return { success: false, message: 'The BUYER role is not configured. Please contact a server administrator.' };
      }

      if (!member.roles.cache.has(buyerRole.id)) {
        await member.roles.add(buyerRole, 'Verified completed SellAuth order');
      }

      const total = Number(
        order.total ??
        (Number(order.totals?.total_cents ?? order.totals?.total_usd_cents ?? 0) / 100)
      );
      if (Number.isFinite(total) && total >= 100 && config.roles.vipBuyer) {
        await member.roles.add(config.roles.vipBuyer, 'Customer purchase qualifies for VIP');
      }

      return { success: true, roleName: buyerRole.name, order };
    } catch (error) {
      console.error('[SellAuth order verification failed]', error);
      return {
        success: false,
        message: 'SellAuth verification is temporarily unavailable. Please try again later or contact staff.',
      };
    }
  }

  static async revokeCustomerRole(guild: Guild, discordUserId: string) {
    try {
      const member = await guild.members.fetch(discordUserId);
      const role = config.roles.verifiedCustomer
        ? await guild.roles.fetch(config.roles.verifiedCustomer).catch(() => null)
        : guild.roles.cache.find(item => item.name.toUpperCase() === 'BUYER') ?? null;
      if (member && role) await member.roles.remove(role);
    } catch (error) {
      console.error('[RoleManager Revoke Error]', error);
    }
  }
}
