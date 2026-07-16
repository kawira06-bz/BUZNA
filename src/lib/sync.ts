import { db } from './db';
import { SyncQueueItem } from '../types';

class SynchronizationEngine {
  private isSynchronizing = false;
  private networkOnline = true; // Reactive network state
  private listeners: Set<(online: boolean, syncing: boolean) => void> = new Set();

  constructor() {
    this.detectNativeConnection();
    // Start automated tick check for syncing (every 10 seconds)
    setInterval(() => this.triggerAutoSync(), 10000);
  }

  private detectNativeConnection() {
    this.networkOnline = navigator.onLine;
    window.addEventListener('online', () => this.setNetworkState(true));
    window.addEventListener('offline', () => this.setNetworkState(false));
  }

  public setNetworkState(isOnline: boolean) {
    this.networkOnline = isOnline;
    this.notifyListeners();
    if (isOnline) {
      this.triggerAutoSync();
    }
  }

  public isOnline(): boolean {
    return this.networkOnline;
  }

  public isSyncing(): boolean {
    return this.isSynchronizing;
  }

  public subscribe(listener: (online: boolean, syncing: boolean) => void): () => void {
    this.listeners.add(listener);
    // Emit initial
    listener(this.networkOnline, this.isSynchronizing);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.networkOnline, this.isSynchronizing));
  }

  // Auto Tick syncing
  private async triggerAutoSync() {
    if (!this.networkOnline || this.isSynchronizing) return;
    const queue = await db.getAll<SyncQueueItem>('sync_queue');
    if (queue.length === 0) return;

    this.forceSync();
  }

  // Master Synchronizer Batch Pipeline (Idempotent and fault tolerant)
  public async forceSync(): Promise<{ successCount: number; failedCount: number }> {
    if (this.isSynchronizing) return { successCount: 0, failedCount: 0 };
    
    this.isSynchronizing = true;
    this.notifyListeners();

    const queue = await db.getAll<SyncQueueItem>('sync_queue');
    let successCount = 0;
    let failedCount = 0;

    // Process queue records sequentially
    for (const item of queue) {
      try {
        if (!this.networkOnline) {
          throw new Error('Network dropout during sync session');
        }

        // Simulate cloud processing delay
        await new Promise(resolve => setTimeout(resolve, 300));

        // Walkaway Sync Protocol validation:
        // Here, we check if the local transaction has pushed the stock negative on the "cloud" side.
        // If an offline terminal sold an item that was actually out of stock on the server, we gracefully
        // handle the conflict here rather than throwing.
        if (item.entityType === 'sale') {
          const txData = item.payload;
          // Check for inventory anomalies (simulate walkaway check)
          const transactionItems = txData.items;
          for (const itemDet of transactionItems) {
            const currentStockInDb = await db.recalculateProductQuantity(itemDet.productId);
            if (currentStockInDb < 0) {
              console.warn(`[Walkaway Sync] Product ${itemDet.productId} has dropped to negative stock (${currentStockInDb}). Enqueueing attention notice.`);
              // Place in quarantine ledger locally or log warning
              const quarantineItem = {
                quarantineId: 'quar-' + Date.now(),
                tenantId: txData.transaction.tenantId,
                entityType: 'sale_negative_stock',
                rawPayload: itemDet,
                anomalyReason: `Walkaway Sync Conflict: Stock dropped to ${currentStockInDb} due to offline terminal sales matching. Recompiling stock views.`,
                resolvedStatus: false,
                createdAt: new Date().toISOString()
              };
              // Add to local sandbox quarantine registry (stored in localStorage for simplicity)
              const currentQuarantine = JSON.parse(localStorage.getItem('sync_quarantine_records') || '[]');
              currentQuarantine.push(quarantineItem);
              localStorage.setItem('sync_quarantine_records', JSON.stringify(currentQuarantine));
            }
          }
        }

        // Successfully synced to "cloud". Remove from queue.
        await db.delete('sync_queue', item.queueId);
        successCount++;
      } catch (err) {
        console.error(`Sync failure for item ${item.queueId}:`, err);
        failedCount++;
        // If network lost completely, cease sync batch immediately
        if (!this.networkOnline) break;
      }
    }

    this.isSynchronizing = false;
    this.notifyListeners();
    return { successCount, failedCount };
  }
}

export const syncEngine = new SynchronizationEngine();
export default syncEngine;
