/**
 * BuzzNa D74 Enterprise Operating System
 * Shared TypeScript Domain Declarations
 */

export enum LicenseStatus {
  TRIAL_ACTIVE = 'TRIAL_ACTIVE',
  PAYMENT_DUE = 'PAYMENT_DUE',
  GRACE_PERIOD = 'GRACE_PERIOD',
  SUSPENDED_NON_PAYMENT = 'SUSPENDED_NON_PAYMENT',
  FULLY_ACTIVATED = 'FULLY_ACTIVATED'
}

export enum PaymentMethod {
  CASH = 'CASH',
  MPESA = 'MPESA',
  DEBT = 'DEBT',
  SPLIT = 'SPLIT'
}

export enum InventoryEventType {
  STOCK_ADD = 'STOCK_ADD',
  SALE_DISPATCH = 'SALE_DISPATCH',
  SPOILAGE = 'SPOILAGE',
  DAMAGE = 'DAMAGE',
  THEFT_LOSS = 'THEFT_LOSS',
  REFUND_RETURN = 'REFUND_RETURN',
  STOCK_CORRECTION = 'STOCK_CORRECTION'
}

export enum VerticalTheme {
  RETAIL = 'retail',
  BUTCHERY = 'butchery',
  MITUMBA = 'mitumba',
  HARDWARE = 'hardware',
  CYBER = 'cyber'
}

export interface Business {
  tenantId: string;
  legalName: string;
  tradeName?: string;
  industry: string;
  country: string;
  currency: string;
  language: string;
  timezone: string;
  licenseStatus: LicenseStatus;
  licenseExpiresAt: string;
  createdAt: string;
}

export interface BusinessSettings {
  tenantId: string;
  chosenTheme: VerticalTheme;
  brandColor: string; // Hex color or Tailwind name (e.g., 'indigo', 'emerald')
  dailyRevenueTarget: number;
  weeklyRevenueTarget: number;
  monthlyRevenueTarget: number;
  darajaPaybill?: string;
  darajaTillNumber?: string;
  darajaApiKey?: string;
  eodTime?: string; // Standard e.g., '21:00'
}

export interface User {
  userId: string;
  tenantId: string;
  role: 'OWNER' | 'MANAGER' | 'CASHIER';
  username: string;
  phoneNumber: string;
  emailAddress?: string;
  isActive: boolean;
  createdAt: string;
  password?: string;
}

export interface Category {
  categoryId: string;
  tenantId: string;
  categoryName: string;
}

export interface Product {
  productId: string;
  tenantId: string;
  categoryId: string | null;
  barcode?: string;
  productName: string;
  costFloor: number;
  retailPrice: number;
  currentQuantity: number; // Cached projected quantity
  isSerialized?: boolean;
  expiryDate?: string; // For perishable goods
  supplierId?: string;
  imageUrl?: string;
}

export interface InventoryEvent {
  eventId: string;
  tenantId: string;
  productId: string;
  userId: string;
  eventType: InventoryEventType;
  quantityDelta: number;
  reasonCode: string;
  terminalTimestamp: string;
  createdAt: string;
}

export interface TillSession {
  sessionId: string;
  tenantId: string;
  userId: string;
  openingFloat: number;
  expectedCashBalance: number;
  actualCashBalance?: number;
  sessionStatus: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt?: string;
}

export interface SalesTransaction {
  transactionId: string;
  tenantId: string;
  sessionId: string;
  customerId: string | null;
  paymentMethod: PaymentMethod;
  paymentStatus: 'PENDING' | 'PAID' | 'REFUNDED' | 'FAILED';
  grossTotal: number;
  taxAmount: number;
  discountAmount: number;
  terminalTimestamp: string;
  createdAt: string;
}

export interface SaleItem {
  itemId: string;
  transactionId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface PaymentAllocation {
  allocationId: string;
  transactionId: string;
  allocatedMethod: PaymentMethod;
  allocatedAmount: number;
}

export interface Customer {
  customerId: string;
  tenantId: string;
  customerName: string;
  phoneNumber: string;
  emailAddress?: string;
  creditLimit: number;
  existingDebt: number;
  createdAt: string;
}

export interface CustomerCreditLedgerEntry {
  ledgerId: string;
  tenantId: string;
  customerId: string;
  transactionId?: string;
  amountDelta: number;
  runningBalance: number;
  createdAt: string;
}

export interface Expense {
  expenseId: string;
  tenantId: string;
  amount: number;
  category: string; // 'Utility', 'Rent', 'Repair', 'Wages', 'Other'
  description?: string;
  recordedBy?: string;
  createdAt: string;
  expenseName: string;
  incurredDate: string;
}

export interface SyncBatch {
  batchId: string;
  tenantId: string;
  deviceUid: string;
  processedStatus: 'PENDING' | 'SUCCESS' | 'FAILED';
  recordsCount: number;
  createdAt: string;
}

export interface SyncQueueItem {
  queueId: string;
  entityType: 'sale' | 'inventory_event' | 'customer' | 'customer_credit' | 'expense' | 'till_session';
  payload: any;
  createdAt: string;
}
