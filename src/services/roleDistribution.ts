import { Client, Guild, GuildMember } from 'discord.js';
import { config } from '../config.js';
import { sellauth } from './sellauth.js';

export class RoleManager {
  static async verifyAndAssign(guild: Guild, discordUserId: string, orderIdOrKey: string) {
    try {
      const member = await guild.members.fetch(discordUserId);
      if (!member) return { success: false, message: 'Member not found in server.' };

      // Query SellAuth to verify the purchase
      const order = await sellauth.getOrder(orderIdOrKey);
      if (!order || order.status !== 'COMPLETED') {
        return { success: false, message: 'No valid completed purchase found for this identifier.' };
      }

      // Assign default verified customer role
      if (config.roles.verifiedCustomer) {
        await member.roles.add(config.roles.verifiedCustomer);
      }

      // Check if spend qualifies for VIP ($100+)
      if (order.total >= 100 && config.roles.vipBuyer) {
        await member.roles.add(config.roles.vipBuyer);
      }

      return {
        success: true,
        roleName: order.total >= 100 ? 'VIP Buyer' : 'Verified Customer',
        order,
      };
    } catch (err: any) {
      console.error('[RoleManager Error]', err);
      return { success: false, message: err.message || 'Internal verification error.' };
    }
  }

  static async revokeCustomerRole(guild: Guild, discordUserId: string) {
    try {
      const member = await guild.members.fetch(discordUserId);
      if (member && config.roles.verifiedCustomer) {
        await member.roles.remove(config.roles.verifiedCustomer);
      }
    } catch (err) {
      console.error('[RoleManager Revoke Error]', err);
    }
  }
}
