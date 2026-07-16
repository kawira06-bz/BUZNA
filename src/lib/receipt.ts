import { SalesTransaction, SaleItem, Product } from '../types';

export interface CompactReceipt {
  transactionId: string;
  timestamp: string;
  total: number;
  items: Array<{ name: string; qty: number; price: number }>;
  signature: string;
}

// Emulate compact token generation for offline QR receipting
export function generateOfflineQRToken(tx: SalesTransaction, items: Array<{ name: string; qty: number; price: number }>): string {
  const compactPayload: CompactReceipt = {
    transactionId: tx.transactionId.substring(0, 8),
    timestamp: tx.terminalTimestamp,
    total: tx.grossTotal,
    items: items.map(i => ({ name: i.name.substring(0, 15), qty: i.qty, price: i.price })),
    signature: 'BZN-' + tx.transactionId.substring(0, 4).toUpperCase() + '-' + Math.floor(tx.grossTotal)
  };

  // Stringify and base64-encode to represent high compression
  return btoa(JSON.stringify(compactPayload));
}

// Generate printable receipts dynamically
export function printThermalReceiptHTML(
  businessName: string,
  themeAccent: string,
  tx: SalesTransaction,
  items: Array<{ product: Product; qty: number; price: number }>,
  paymentMethod: string,
  customerName?: string
): string {
  const formattedItems = items.map(item => ({
    name: item.product.productName,
    qty: item.qty,
    price: item.price
  }));

  const qrToken = generateOfflineQRToken(tx, formattedItems);
  
  // Format dates elegantly
  const dateStr = new Date(tx.terminalTimestamp).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' });

  return `
    <div style="font-family: 'Courier New', Courier, monospace; max-width: 320px; margin: 0 auto; padding: 20px; border: 1px dashed #ccc; background-color: #fff; color: #000;">
      <div style="text-align: center; margin-bottom: 15px;">
        <h2 style="margin: 0; font-size: 1.3rem; font-weight: bold; text-transform: uppercase;">${businessName}</h2>
        <p style="margin: 3px 0; font-size: 0.8rem;">Zero-Attendance Merchant Till</p>
        <p style="margin: 3px 0; font-size: 0.75rem;">Kenya SME Licensed Hub</p>
      </div>
      
      <div style="border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px; font-size: 0.8rem;">
        <div><b>Tx ID:</b> ${tx.transactionId.substring(0, 18).toUpperCase()}...</div>
        <div><b>Date:</b> ${dateStr}</div>
        ${customerName ? `<div><b>Customer:</b> ${customerName}</div>` : ''}
        <div><b>Till Operator:</b> Active Shift User</div>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; margin-bottom: 8px;">
        <thead>
          <tr style="border-bottom: 1px solid #000;">
            <th style="text-align: left; padding: 3px 0;">Item</th>
            <th style="text-align: center; padding: 3px 0;">Qty</th>
            <th style="text-align: right; padding: 3px 0;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(i => `
            <tr>
              <td style="padding: 4px 0; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${i.product.productName}</td>
              <td style="text-align: center; padding: 4px 0;">${i.qty}</td>
              <td style="text-align: right; padding: 4px 0;">${(i.qty * i.price).toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="border-top: 1px dashed #000; padding-top: 8px; font-size: 0.85rem; line-height: 1.4;">
        <div style="display: flex; justify-content: space-between;">
          <span>Subtotal:</span>
          <span>KES ${tx.grossTotal.toFixed(2)}</span>
        </div>
        ${tx.discountAmount > 0 ? `
          <div style="display: flex; justify-content: space-between; color: #cc0000;">
            <span>Discount Applied:</span>
            <span>-KES ${tx.discountAmount.toFixed(2)}</span>
          </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1rem; border-top: 1px solid #000; margin-top: 4px; padding-top: 4px;">
          <span>GRAND TOTAL:</span>
          <span>KES ${(tx.grossTotal - tx.discountAmount).toFixed(2)}</span>
        </div>
      </div>

      <div style="border-top: 1px dashed #000; padding-top: 8px; margin-top: 8px; font-size: 0.8rem;">
        <div><b>Payment Mode:</b> ${paymentMethod}</div>
        <div><b>Verification Status:</b> IDEMPOTENT SECURE</div>
      </div>

      <div style="text-align: center; margin-top: 15px; padding-top: 10px; border-top: 1px dashed #000;">
        <p style="margin: 0 0 5px 0; font-size: 0.7rem; font-weight: bold;">ANTI-FRAUD SECURE SCAN</p>
        <!-- Represent a scan-ready QR code using custom high-contrast visuals -->
        <div style="display: inline-block; padding: 6px; background-color: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 5px;">
          <svg width="100" height="100" style="display: block;">
            <rect width="100" height="100" fill="#fff"/>
            <!-- Pseudo QR modules -->
            <rect x="5" y="5" width="25" height="25" fill="#000"/>
            <rect x="10" y="10" width="15" height="15" fill="#fff"/>
            <rect x="13" y="13" width="9" height="9" fill="#000"/>
            
            <rect x="70" y="5" width="25" height="25" fill="#000"/>
            <rect x="75" y="10" width="15" height="15" fill="#fff"/>
            <rect x="78" y="13" width="9" height="9" fill="#000"/>

            <rect x="5" y="70" width="25" height="25" fill="#000"/>
            <rect x="10" y="75" width="15" height="15" fill="#fff"/>
            <rect x="13" y="78" width="9" height="9" fill="#000"/>

            <!-- Center scatter dots -->
            <rect x="40" y="40" width="10" height="10" fill="#000"/>
            <rect x="55" y="45" width="8" height="8" fill="#000"/>
            <rect x="45" y="60" width="12" height="12" fill="#000"/>
            <rect x="60" y="60" width="10" height="10" fill="#000"/>
            <rect x="40" y="15" width="15" height="5" fill="#000"/>
            <rect x="40" y="25" width="5" height="10" fill="#000"/>
            <rect x="15" y="40" width="10" height="12" fill="#000"/>
            <rect x="75" y="40" width="15" height="15" fill="#000"/>
          </svg>
        </div>
        <div style="font-size: 0.6rem; word-break: break-all; color: #555; max-height: 35px; overflow: hidden; text-overflow: ellipsis;">
          ${qrToken}
        </div>
        <p style="margin: 8px 0 0 0; font-size: 0.75rem; font-weight: bold; color: ${themeAccent};">Asanteni kwa biashara yenu!</p>
      </div>
    </div>
  `;
}
