import { Guild } from 'discord.js';
import { config } from '../config.js';
import { sellauth } from './sellauth.js';
import { claimOrder, releaseOrderClaim } from './orderClaims.js';

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
      const normalizedOrderId = orderId.trim();
      const normalizedEmail = customerEmail.trim().toLowerCase();
      if (!normalizedOrderId) {
        return { success: false, message: 'Enter your SellAuth order ID.' };
      }
      if (!normalizedEmail || !normalizedEmail.includes('@')) {
        return { success: false, message: 'Enter the email address used for the purchase.' };
      }

      const member = await guild.members.fetch(discordUserId);
      const response = await sellauth.getOrder(normalizedOrderId);
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

      let buyerRole = guild.roles.cache.find(role => role.name.toUpperCase() === 'BUYER') ?? null;
      if (!buyerRole && config.roles.verifiedCustomer) {
        const configuredRole = await guild.roles.fetch(config.roles.verifiedCustomer).catch(() => null);
        if (configuredRole?.name.toUpperCase() === 'BUYER') buyerRole = configuredRole;
      }

      if (!buyerRole) {
        console.error('[SellAuth verification] A role named BUYER is missing. Create/rename the role to BUYER and set ROLE_VERIFIED_CUSTOMER to its role ID if needed.');
        return { success: false, message: 'The BUYER role is not configured. Please contact a server administrator.' };
      }

      // PostgreSQL's primary key makes this atomic, so simultaneous claims cannot win twice.
      // If the database is unavailable or not configured, fail closed rather than grant the role.
      const claim = await claimOrder(normalizedOrderId, discordUserId);
      if (claim.status === 'claimed-by-other') {
        return {
          success: false,
          message: 'This SellAuth order has already been claimed by another Discord account. If you think this is a mistake, contact staff.',
        };
      }

      try {
        if (!member.roles.cache.has(buyerRole.id)) {
          await member.roles.add(buyerRole, 'Verified completed SellAuth order');
        }
      } catch (roleError) {
        // Only release our own new claim if the essential BUYER role could not be assigned.
        if (claim.status === 'claimed') {
          await releaseOrderClaim(normalizedOrderId, discordUserId).catch((releaseError: unknown) => {
            console.error('[SellAuth verification] Could not release failed order claim:', releaseError);
          });
        }
        throw roleError;
      }

      const total = Number(
        order.total ??
        (Number(order.totals?.total_cents ?? order.totals?.total_usd_cents ?? 0) / 100)
      );
      if (Number.isFinite(total) && total >= 100 && config.roles.vipBuyer) {
        try {
          await member.roles.add(config.roles.vipBuyer, 'Customer purchase qualifies for VIP');
        } catch (vipError) {
          console.error('[SellAuth verification] BUYER was assigned, but VIP role assignment failed:', vipError);
        }
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
      const buyerRole = guild.roles.cache.find(item => item.name.toUpperCase() === 'BUYER') ?? null;
      if (member && buyerRole) {
        await member.roles.remove(buyerRole);
      } else if (member && config.roles.verifiedCustomer) {
        const configuredRole = await guild.roles.fetch(config.roles.verifiedCustomer).catch(() => null);
        if (configuredRole) await member.roles.remove(configuredRole);
      }
    } catch (error) {
      console.error('[RoleManager Revoke Error]', error);
    }
  }
}
