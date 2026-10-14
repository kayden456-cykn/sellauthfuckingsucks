import { jsPDF } from 'jspdf';

export interface OrderInvoiceData {
  orderId: string;
  invoiceNumber: string;
  customerEmail: string;
  discordTag?: string;
  productName: string;
  quantity: number;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  currency: string;
  paymentMethod: string;
  txHash?: string;
  deliveredKeys: string[];
  createdAt: string;
  roleAssigned?: string;
}

export class InvoiceGenerator {
  static generateBuffer(order: OrderInvoiceData): Buffer {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Primary Discord blurple
    doc.setFillColor(88, 101, 242);
    doc.rect(0, 0, 210, 4, 'F');

    // Header banner
    doc.setFillColor(248, 249, 252);
    doc.rect(0, 4, 210, 38, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(88, 101, 242);
    doc.text('SellAuth Storefront', 15, 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 105, 115);
    doc.text('Automated Discord Fulfillment • Powered by SellAuth', 15, 28);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(30, 31, 34);
    doc.text('INVOICE', 195, 22, { align: 'right' });

    // Customer & Order Metadata
    const y = 52;
    doc.setFontSize(9);
    doc.setTextColor(100, 105, 115);
    doc.text('CUSTOMER:', 15, y);
    doc.text('ORDER INFO:', 110, y);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 31, 34);
    doc.text(order.customerEmail, 15, y + 6);
    if (order.discordTag) doc.text(`Discord: @${order.discordTag}`, 15, y + 11);

    doc.setFont('helvetica', 'normal');
    doc.text(`Invoice: ${order.invoiceNumber}`, 110, y + 6);
    doc.text(`Order ID: ${order.orderId}`, 110, y + 11);
    doc.text(`Payment: ${order.paymentMethod}`, 110, y + 16);

    // Items table
    const tableY = y + 25;
    doc.setFillColor(240, 242, 246);
    doc.rect(15, tableY, 180, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 105, 115);
    doc.text('ITEM DESCRIPTION', 20, tableY + 5.5);
    doc.text('QTY', 125, tableY + 5.5, { align: 'center' });
    doc.text('TOTAL', 190, tableY + 5.5, { align: 'right' });

    // Row
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 31, 34);
    doc.text(order.productName, 20, tableY + 16);
    doc.text(order.quantity.toString(), 125, tableY + 16, { align: 'center' });
    doc.text(`$${order.total.toFixed(2)} ${order.currency}`, 190, tableY + 16, { align: 'right' });

    // Delivered Serials box
    const keyY = tableY + 30;
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(15, keyY, 180, 30, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(88, 101, 242);
    doc.text('DELIVERED DIGITAL ASSET / LICENSE KEYS', 20, keyY + 7);

    doc.setFont('courier', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(20, 25, 35);
    order.deliveredKeys.forEach((key, idx) => {
      doc.text(`[Key #${idx + 1}]  ${key}`, 20, keyY + 15 + idx * 6);
    });

    const output = doc.output('arraybuffer');
    return Buffer.from(output);
  }
}
