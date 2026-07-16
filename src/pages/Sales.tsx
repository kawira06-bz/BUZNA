import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/db';
import { SalesTransaction, SaleItem, Product, Customer } from '../types';
import { Calendar, Search, ArrowLeft, RotateCcw, AlertTriangle, Printer, Archive, HelpCircle } from 'lucide-react';
import { printThermalReceiptHTML } from '../lib/receipt';

export const Sales: React.FC<{ addToast: (text: string, type: 'success' | 'error') => void }> = ({ addToast }) => {
  const { activeBusiness, activeUser, businessSettings } = useAuth();
  
  // Realtime Lists
  const [transactions, setTransactions] = useState<SalesTransaction[]>([]);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedTx, setSelectedTx] = useState<SalesTransaction | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Receipt Modal State
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptHTML, setReceiptHTML] = useState('');

  // Fetch sales records
  const fetchSalesData = async () => {
    try {
      const txs = await db.getAll<SalesTransaction>('sales_transactions');
      const allItems = await db.getAll<SaleItem>('sales_items');
      const prods = await db.getAll<Product>('products');
      const custs = await db.getAll<Customer>('customers');
      
      setTransactions(txs);
      setItems(allItems);
      setProducts(prods);
      setCustomers(custs);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSalesData();
    const unsubscribe = db.subscribe(fetchSalesData);
    return () => unsubscribe();
  }, []);

  // Void Sales Transaction (Strict: Owner Only)
  const handleVoidTransaction = async (tx: SalesTransaction) => {
    if (activeUser?.role !== 'OWNER') {
      addToast('Permissions Blocked: Only business Owners are authorized to trigger refunds or void entries.', 'error');
      return;
    }

    if (confirm(`Void sales transaction "${tx.transactionId}"? This creates a compensatory event replenishing inventory quantities.`)) {
      try {
        await db.voidSalesTransaction(tx.transactionId);
        addToast('Transaction Voided: Stock quantities replenished, ledger compensation posted.', 'success');
        setSelectedTx(null);
      } catch (err: any) {
        addToast(err.message || 'Void operation failed.', 'error');
      }
    }
  };

  // Re-print thermal receipt
  const triggerReceiptReprint = (tx: SalesTransaction) => {
    try {
      const txItems = items.filter(i => i.transactionId === tx.transactionId);
      const cartItemsMapped = txItems.map(item => {
        const prod = products.find(p => p.productId === item.productId);
        return {
          product: prod || { productId: item.productId, productName: 'Unknown Product', costFloor: 0, retailPrice: item.unitPrice, currentQuantity: 0, tenantId: tx.tenantId },
          qty: item.quantity,
          price: item.unitPrice
        };
      });

      const customerObj = customers.find(c => c.customerId === tx.customerId);
      const receipt = printThermalReceiptHTML(
        activeBusiness?.legalName || 'BuzzNa D74 OS',
        businessSettings?.brandColor === 'red' ? '#dc2626' : businessSettings?.brandColor === 'emerald' ? '#059669' : '#4f46e5',
        tx,
        cartItemsMapped as any,
        tx.paymentMethod,
        customerObj?.customerName
      );

      setReceiptHTML(receipt);
      setShowReceiptModal(true);
    } catch (err) {
      addToast('Failed to compile receipt layout.', 'error');
    }
  };

  const executeReceiptPrintWindow = () => {
    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(`<html><head><title>Thermal Receipt Reprint</title></head><body onload="window.print(); window.close();">${receiptHTML}</body></html>`);
      printWin.document.close();
    }
  };

  // Filter list
  const filteredTxs = transactions.filter(tx => {
    const customerObj = customers.find(c => c.customerId === tx.customerId);
    const matchesSearch = tx.transactionId.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (customerObj && customerObj.customerName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesDate = !dateFilter || tx.terminalTimestamp.startsWith(dateFilter);
    return matchesSearch && matchesDate;
  });

  return (
    <div className="space-y-6" id="sales-view">
      
      {/* Title bar */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <h2 className="text-xl font-extrabold text-zinc-950 dark:text-white uppercase tracking-tight">Chronological Sales Log</h2>
        <p className="text-xs text-zinc-500 mt-1">Audit operational checkouts, process refunds, or print physical receipts</p>
      </div>

      {/* Query filters */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search by transaction ID or customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 focus:outline-none text-sm"
          />
        </div>

        <div className="w-full sm:w-auto shrink-0 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-zinc-400" />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 focus:outline-none text-xs font-mono"
          />
        </div>
      </div>

      {/* Main logs list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Table list (Col 2) */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 text-xs font-bold tracking-wider text-zinc-500 uppercase">
                  <th className="py-4 px-6">Transaction Ref / Time</th>
                  <th className="py-4 px-4">Pay Mode</th>
                  <th className="py-4 px-4">Status</th>
                  <th className="py-4 px-4 text-right">Gross Sale</th>
                  <th className="py-4 px-6 text-center">Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {filteredTxs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-zinc-400">
                      <Archive className="w-12 h-12 text-zinc-200 dark:text-zinc-800 mx-auto mb-3" />
                      <p className="text-sm font-semibold">No transactions logged</p>
                    </td>
                  </tr>
                ) : (
                  filteredTxs.slice().reverse().map(tx => {
                    const isVoid = tx.paymentStatus === 'VOID';
                    
                    return (
                      <tr 
                        key={tx.transactionId} 
                        className={`hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer ${
                          selectedTx?.transactionId === tx.transactionId ? 'bg-indigo-50/30 dark:bg-indigo-950/20' : ''
                        }`}
                        onClick={() => setSelectedTx(tx)}
                      >
                        <td className="py-4 px-6">
                          <div className="font-bold text-zinc-900 dark:text-zinc-100 text-sm font-mono uppercase">
                            {tx.transactionId}
                          </div>
                          <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                            {new Date(tx.terminalTimestamp).toLocaleString()}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-[10px] font-mono font-bold uppercase text-zinc-600 dark:text-zinc-400">
                            {tx.paymentMethod}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full ${
                            isVoid 
                              ? 'bg-red-50 text-red-700 dark:bg-red-950/20' 
                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20'
                          }`}>
                            {tx.paymentStatus}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right font-mono font-bold text-sm text-zinc-900 dark:text-white">
                          KES {tx.grossTotal.toLocaleString()}
                        </td>
                        <td className="py-4 px-6 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedTx(tx)}
                            className="text-xs text-indigo-600 hover:text-indigo-700 font-bold uppercase cursor-pointer"
                            style={{ minWidth: '44px', minHeight: '44px' }}
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar Details Panel (Col 1) */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
          {selectedTx ? (
            <div className="space-y-6">
              <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <h3 className="font-extrabold text-xs text-zinc-900 dark:text-white uppercase tracking-wider">Transaction Detail</h3>
                <p className="text-[10px] text-zinc-400 font-mono uppercase mt-1">REF: {selectedTx.transactionId.toUpperCase()}</p>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Sale Items Breakdown</h4>
                <div className="divide-y divide-zinc-50 dark:divide-zinc-800 max-h-[220px] overflow-y-auto pr-1">
                  {items.filter(i => i.transactionId === selectedTx.transactionId).map(item => {
                    const prod = products.find(p => p.productId === item.productId);
                    return (
                      <div key={item.itemId} className="py-2.5 flex justify-between text-xs">
                        <div>
                          <div className="font-bold text-zinc-800 dark:text-zinc-100">{prod?.productName || 'Unknown Product'}</div>
                          <div className="text-[10px] text-zinc-400 font-mono">{item.quantity} x KES {item.unitPrice.toLocaleString()}</div>
                        </div>
                        <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">
                          KES {item.totalPrice.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Totals Summary */}
              <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Subtotal</span>
                  <span className="font-mono">KES {(selectedTx.grossTotal + selectedTx.discountAmount).toLocaleString()}</span>
                </div>
                {selectedTx.discountAmount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Discount (Haggle offset)</span>
                    <span className="font-mono">-KES {selectedTx.discountAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-extrabold text-sm border-t border-zinc-200 dark:border-zinc-800 pt-2">
                  <span>GROSS TOTAL</span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400">KES {selectedTx.grossTotal.toLocaleString()}</span>
                </div>
              </div>

              {/* Refund Void option (Only Owner is permitted) */}
              <div className="space-y-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => triggerReceiptReprint(selectedTx)}
                    className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-xs uppercase tracking-wider py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 cursor-pointer flex items-center justify-center gap-1.5"
                    style={{ minHeight: '44px' }}
                  >
                    <Printer className="w-4 h-4" />
                    <span>Receipt</span>
                  </button>

                  <button
                    onClick={() => handleVoidTransaction(selectedTx)}
                    disabled={selectedTx.paymentStatus === 'VOID' || activeUser?.role !== 'OWNER'}
                    className="bg-red-50 hover:bg-red-100 text-red-700 disabled:opacity-30 font-bold text-xs uppercase tracking-wider py-3 rounded-xl border border-red-100 cursor-pointer flex items-center justify-center gap-1.5"
                    style={{ minHeight: '44px' }}
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Void Sale</span>
                  </button>
                </div>
                
                {activeUser?.role !== 'OWNER' && (
                  <div className="flex items-start gap-1.5 text-[9px] text-amber-600 mt-2 bg-amber-50 dark:bg-amber-950/20 p-2 rounded-lg">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Refund control is locked. Log in as Business Owner to execute void entries.</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-zinc-400">
              <Archive className="w-12 h-12 text-zinc-150 dark:text-zinc-800 mx-auto mb-3" />
              <p className="text-xs font-semibold">Select Transaction Log</p>
              <p className="text-[10px] mt-1">Audit line items, generate PDF copies, or issue compensatory voids.</p>
            </div>
          )}

          <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 text-[10px] text-zinc-500 font-mono uppercase tracking-wide mt-4">
            Terminal Volume: KES {transactions.filter(t => t.paymentStatus !== 'VOID').reduce((acc, t) => acc + t.grossTotal, 0).toLocaleString()}
          </div>
        </div>

      </div>

      {/* REPRINT RECEIPT MODAL FRAME */}
      {showReceiptModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" id="reprint-modal">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-sm p-5 shadow-2xl">
            <h3 className="font-extrabold text-xs text-zinc-900 dark:text-white uppercase tracking-wider mb-4 border-b border-zinc-100 pb-2">Thermal Receipt Reprint</h3>
            
            <div className="max-h-[350px] overflow-y-auto mb-4 border border-zinc-200 rounded-2xl bg-zinc-50 p-1">
              <div dangerouslySetInnerHTML={{ __html: receiptHTML }} />
            </div>

            <button
              onClick={executeReceiptPrintWindow}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider py-3 rounded-xl shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
              style={{ minHeight: '44px' }}
            >
              <Printer className="w-4 h-4" />
              <span>Print Out copy</span>
            </button>

            <button
              onClick={() => setShowReceiptModal(false)}
              className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs uppercase tracking-wider py-3 rounded-xl border border-zinc-200 mt-3 cursor-pointer"
              style={{ minHeight: '44px' }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default Sales;
