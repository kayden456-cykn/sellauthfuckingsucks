import axios, { AxiosInstance } from 'axios';
import { config } from '../config.js';

export class SellAuthClient {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: config.sellauth.baseUrl,
      headers: {
        'Authorization': `Bearer ${config.sellauth.apiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });
  }

  // --- Products ---
  async getProducts() {
    const res = await this.api.get(`/shops/${config.sellauth.shopId}/products`);
    return res.data;
  }

  async getProduct(productId: number) {
    const res = await this.api.get(`/shops/${config.sellauth.shopId}/products/${productId}`);
    return res.data;
  }

  async createProduct(data: { name: string; price: number; type?: string; description?: string }) {
    const res = await this.api.post(`/shops/${config.sellauth.shopId}/products`, data);
    return res.data;
  }

  async updateProduct(productId: number, data: Partial<{ name: string; price: number; stock: number }>) {
    const res = await this.api.put(`/shops/${config.sellauth.shopId}/products/${productId}`, data);
    return res.data;
  }

  async deleteProduct(productId: number) {
    const res = await this.api.delete(`/shops/${config.sellauth.shopId}/products/${productId}`);
    return res.data;
  }

  // --- Licenses & Keys ---
  async appendKeys(productId: number, variantId: string, keys: string[]) {
    const res = await this.api.put(
      `/shops/${config.sellauth.shopId}/products/${productId}/deliverables/append/${variantId}`,
      { deliverables: keys }
    );
    return res.data;
  }

  async revokeKey(key: string, reason: string) {
    const res = await this.api.post(`/shops/${config.sellauth.shopId}/licenses/revoke`, { key, reason });
    return res.data;
  }

  async resetHWID(key: string) {
    const res = await this.api.post(`/shops/${config.sellauth.shopId}/licenses/hwid-reset`, { key });
    return res.data;
  }

  // --- Orders & Invoices ---
  async getOrder(orderId: string) {
    const res = await this.api.get(`/shops/${config.sellauth.shopId}/invoices/${orderId}`);
    return res.data;
  }

  async refundOrder(orderId: string, reason: string) {
    const res = await this.api.post(`/shops/${config.sellauth.shopId}/invoices/${orderId}/refund`, { reason });
    return res.data;
  }

  // --- Blacklist & Fraud ---
  async addBlacklist(data: { value: string; type: string; reason: string }) {
    const res = await this.api.post(`/shops/${config.sellauth.shopId}/blacklist`, data);
    return res.data;
  }

  async removeBlacklist(value: string) {
    const res = await this.api.delete(`/shops/${config.sellauth.shopId}/blacklist/${encodeURIComponent(value)}`);
    return res.data;
  }

  // --- Analytics & Stats ---
  async getStats(period: 'day' | 'week' | 'month' | 'all' = 'day') {
    const res = await this.api.get(`/shops/${config.sellauth.shopId}/analytics?period=${period}`);
    return res.data;
  }

  // --- Affiliates ---
  async getAffiliates() {
    const res = await this.api.get(
      `/shops/${config.sellauth.shopId}/affiliates`
    );

    return res.data;
  }
}

export const sellauth = new SellAuthClient();
