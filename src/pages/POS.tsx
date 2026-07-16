import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, generateUUID } from '../lib/db';
import { printThermalReceiptHTML } from '../lib/receipt';
import { Product, Category, TillSession, SalesTransaction, SaleItem, PaymentMethod, Customer, PaymentAllocation } from '../types';
import { Search, ShoppingCart, Trash2, ArrowRight, Smartphone, Coins, Split, Users, Check, Printer, HelpCircle, ShieldAlert } from 'lucide-react';

interface CartItem {
  product: Product;
  quantity: number;
  bargainPrice: number; // Bargained price per unit
}

export const POS: React.FC<{ addToast: (text: string, type: 'success' | 'error' | 'info') => void }> = ({ addToast }) => {
  const { activeBusiness, businessSettings, activeUser } = useAuth();
  
  // Terminal states
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activeSession, setActiveSession] = useState<TillSession | null>(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [appliedDiscount, setAppliedDiscount] = useState('0');

  // Checkout Form parameters
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [mpesaPhoneNumber, setMpesaPhoneNumber] = useState('');

  // Split payment allocations
  const [splitCashAmount, setSplitCashAmount] = useState('');
  const [splitMpesaAmount, setSplitMpesaAmount] = useState('');
  const [splitDebtAmount, setSplitDebtAmount] = useState('');

  // Receipt modal state
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [completedTx, setCompletedTx] = useState<SalesTransaction | null>(null);
  const [completedItems, setCompletedItems] = useState<CartItem[]>([]);
  const [receiptHTML, setReceiptHTML] = useState('');

  // Fetch reference records
  const fetchPOSData = async () => {
    try {
      const prods = await db.getAll<Product>('products');
      const cats = await db.getAll<Category>('product_categories');
      const custs = await db.getAll<Customer>('customers');
      const sessions = await db.getAll<TillSession>('till_sessions');
      
      setProducts(prods);
      setCategories(cats);
      setCustomers(custs);

      // Find active till session
      const openSession = sessions.find(s => s.tenantId === activeBusiness?.tenantId && s.sessionStatus === 'OPEN');
      setActiveSession(openSession || null);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPOSData();
    const unsubscribe = db.subscribe(fetchPOSData);
    return () => unsubscribe();
  }, [activeBusiness]);

  // Cart Mutators
  const addToCart = (product: Product) => {
    if (product.currentQuantity <= 0) {
      addToast(`OutOfStock: "${product.productName}" is fully depleted. Walkaway sales active but verify physical counts.`, 'info');
    }

    const exists = cart.find(item => item.product.productId === product.productId);
    if (exists) {
      setCart(cart.map(item => 
        item.product.productId === product.productId 
          ? { ...item, quantity: item.quantity + 1 } 
          : item
      ));
    } else {
      setCart([...cart, { product, quantity: 1, bargainPrice: product.retailPrice }]);
    }
    addToast(`"${product.productName}" added to terminal cart.`, 'success');
  };

  const updateCartQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(cart.map(item => 
      item.product.productId === productId 
        ? { ...item, quantity: qty } 
        : item
    ));
  };

  const updateCartBargain = (productId: string, bargain: number) => {
    const item = cart.find(i => i.product.productId === productId);
    if (!item) return;

    // costFloor Margin Guard
    if (bargain < item.product.costFloor) {
      addToast(`Bargain Blocked: KES ${bargain} is below cost price (KES ${item.product.costFloor}) for "${item.product.productName}".`, 'error');
      return;
    }

    setCart(cart.map(i => 
      i.product.productId === productId 
        ? { ...i, bargainPrice: bargain } 
        : i
    ));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.productId !== productId));
  };

  // Computations
  const getSubtotal = () => cart.reduce((sum, item) => sum + (item.quantity * item.bargainPrice), 0);
  const getTax = () => getSubtotal() * 0.16; // 16% standard VAT
  const getGrossTotal = () => getSubtotal() - Number(appliedDiscount);

  // Form Initializer
  const handleOpenCheckout = () => {
    if (cart.length === 0) {
      addToast('Checkout Blocked: Add catalog items to terminal cart first.', 'error');
      return;
    }
    
    // Auto-init split values equally
    const gross = getGrossTotal();
    setSplitCashAmount('');
    setSplitMpesaAmount('');
    setSplitDebtAmount('');
    
    setShowCheckoutModal(true);
  };

  // Submit Checkout
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;

    const gross = getGrossTotal();

    // 1. Validations based on payment modes
    if (paymentMethod === PaymentMethod.DEBT && !selectedCustomerId) {
      addToast('Debt Checkout: Please select a registered debtor.', 'error');
      return;
    }

    if (paymentMethod === PaymentMethod.DEBT) {
      const debtor = customers.find(c => c.customerId === selectedCustomerId);
      if (debtor && debtor.existingDebt + gross > debtor.creditLimit) {
        addToast(`Repayment Lock: Customer credit limit ceiling of KES ${debtor.creditLimit} will be breached.`, 'error');
        return;
      }
    }

    // Split Validation
    let allocations: Omit<PaymentAllocation, 'allocationId' | 'transactionId'>[] = [];
    if (paymentMethod === PaymentMethod.SPLIT) {
      const cash = Number(splitCashAmount || 0);
      const mpesa = Number(splitMpesaAmount || 0);
      const debt = Number(splitDebtAmount || 0);

      if (Math.abs((cash + mpesa + debt) - gross) > 0.01) {
        addToast(`Split Checkout Blocked: Allocations KES ${(cash + mpesa + debt).toLocaleString()} must match the Gross Total KES ${gross.toLocaleString()}.`, 'error');
        return;
      }

      if (debt > 0 && !selectedCustomerId) {
        addToast('Split involves Debt allocation: Select customer.', 'error');
        return;
      }

      if (debt > 0) {
        const debtor = customers.find(c => c.customerId === selectedCustomerId);
        if (debtor && debtor.existingDebt + debt > debtor.creditLimit) {
          addToast('Repayment limit exceeded on split debt allocation.', 'error');
          return;
        }
      }

      if (cash > 0) allocations.push({ allocatedMethod: PaymentMethod.CASH, allocatedAmount: cash });
      if (mpesa > 0) allocations.push({ allocatedMethod: PaymentMethod.MPESA, allocatedAmount: mpesa });
      if (debt > 0) allocations.push({ allocatedMethod: PaymentMethod.DEBT, allocatedAmount: debt });
    }

    try {
      const transactionId = 'tx-' + generateUUID().substring(0, 8);
      const activeUser_id = activeUser?.userId || 'demo-owner-id';
      
      const salesTransaction: SalesTransaction = {
        transactionId,
        tenantId: activeSession.tenantId,
        sessionId: activeSession.sessionId,
        customerId: selectedCustomerId || null,
        paymentMethod,
        paymentStatus: 'PAID',
        grossTotal: gross,
        taxAmount: getTax(),
        discountAmount: Number(appliedDiscount),
        terminalTimestamp: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      const saleItems: Omit<SaleItem, 'itemId' | 'transactionId'>[] = cart.map(item => ({
        product_id: item.product.productId, // map to lower case
        productId: item.product.productId,
        quantity: item.quantity,
        unitPrice: item.bargainPrice,
        totalPrice: item.quantity * item.bargainPrice
      }));

      // Simulate Lipa Na M-Pesa STK push matching
      if (paymentMethod === PaymentMethod.MPESA && mpesaPhoneNumber) {
        addToast(`Daraja Handshake: Transmitting STK Push trigger KES ${gross} to customer ${mpesaPhoneNumber}...`, 'info');
        await new Promise(resolve => setTimeout(resolve, 1500));
        addToast('Daraja Callback matched: Payment matched instantly!', 'success');
      }

      // Execute on local IndexDB
      await db.executeSaleCheckout(salesTransaction, saleItems, allocations);
      
      // Render receipt print visual
      const custObj = customers.find(c => c.customerId === selectedCustomerId);
      const receipt = printThermalReceiptHTML(
        activeBusiness?.legalName || 'BuzzNa D74 OS',
        businessSettings?.brandColor === 'red' ? '#dc2626' : businessSettings?.brandColor === 'emerald' ? '#059669' : '#4f46e5',
        salesTransaction,
        cart.map(i => ({ product: i.product, qty: i.quantity, price: i.bargainPrice })),
        paymentMethod === PaymentMethod.SPLIT ? 'SPLIT ALLOC' : paymentMethod,
        custObj?.customerName
      );

      setCompletedTx(salesTransaction);
      setCompletedItems([...cart]);
      setReceiptHTML(receipt);
      
      // Clear CART
      setCart([]);
      setAppliedDiscount('0');
      setSelectedCustomerId('');
      setMpesaPhoneNumber('');
      
      setShowCheckoutModal(false);
      setShowReceiptModal(true);
    } catch (err: any) {
      addToast(err.message || 'Checkout failed.', 'error');
    }
  };

  // Quick Action scan sim
  const triggerPseudoBarcodeScan = () => {
    if (products.length === 0) return;
    const randomProd = products[Math.floor(Math.random() * products.length)];
    addToCart(randomProd);
    addToast(`Pseudo Scan: Detected barcode matched to "${randomProd.productName}".`, 'info');
  };

  // Print command
  const handlePrintCommand = () => {
    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(`<html><head><title>Thermal Receipt</title></head><body onload="window.print(); window.close();">${receiptHTML}</body></html>`);
      printWin.document.close();
    }
  };

  const handleWhatsAppShare = () => {
    addToast(`Digital receipt converted to compressed web PDF. shared directly to customer WhatsApp channel.`, 'info');
  };

  // Filter Catalog
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.productName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.barcode && p.barcode.includes(searchQuery));
    const matchesCategory = activeCategory === 'all' || p.categoryId === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6" id="pos-view">
      
      {/* Till lock check */}
      {!activeSession ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 max-w-lg mx-auto text-center shadow-lg my-12">
          <ShieldAlert className="w-16 h-16 text-amber-500 animate-bounce mx-auto mb-6" />
          <h3 className="text-lg font-extrabold text-zinc-900 dark:text-white uppercase tracking-wider mb-2">POS Terminal Locked</h3>
          <p className="text-xs text-zinc-500 leading-relaxed mb-6">
            Access to sales checkouts is restricted. No active shift session detected for this terminal. Initialize a till float to begin checkouts.
          </p>
          <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-2xl text-[10px] text-zinc-500 uppercase font-mono tracking-wide">
            Till Status: CLOSED | Multi-Tenant RLS Secure
          </div>
        </div>
      ) : (
        /* ACTIVE GRID TERMINAL */
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          
          {/* Catalog side (Grid 7) */}
          <div className="xl:col-span-7 space-y-4">
            
            {/* Quick action bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-center">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search catalog items or scan barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900 focus:outline-none text-xs"
                />
              </div>

              {/* Pseudo Barcode trigger */}
              <button
                onClick={triggerPseudoBarcodeScan}
                className="w-full sm:w-auto px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-xs uppercase tracking-wider rounded-xl border border-zinc-200 dark:border-zinc-700 shrink-0 transition-colors cursor-pointer"
                style={{ minHeight: '44px' }}
                title="Simulate quick barcode scan"
              >
                Simulate Scan
              </button>
            </div>

            {/* Categories horizontal rail */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none" id="category-rail">
              <button
                onClick={() => setActiveCategory('all')}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap transition-colors ${
                  activeCategory === 'all'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white dark:bg-zinc-900 hover:bg-zinc-50 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800'
                }`}
                style={{ minHeight: '36px' }}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat.categoryId}
                  onClick={() => setActiveCategory(cat.categoryId)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap transition-colors ${
                    activeCategory === cat.categoryId
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white dark:bg-zinc-900 hover:bg-zinc-50 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800'
                  }`}
                  style={{ minHeight: '36px' }}
                >
                  {cat.categoryName}
                </button>
              ))}
            </div>

            {/* Catalog list card grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" id="pos-product-grid">
              {filteredProducts.map(p => (
                <button
                  key={p.productId}
                  onClick={() => addToCart(p)}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 flex flex-col justify-between text-left shadow-xs hover:border-indigo-400 cursor-pointer transition-all h-36"
                >
                  <div>
                    <h4 className="font-bold text-xs text-zinc-900 dark:text-white line-clamp-2 leading-tight">{p.productName}</h4>
                    <p className="text-[9px] text-zinc-400 font-mono tracking-wider mt-1 uppercase">Stock: {p.currentQuantity} units</p>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-50 dark:border-zinc-800/60">
                    <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400">KES {p.retailPrice}</span>
                    <span className="text-[9px] font-mono font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded-sm">MARGIN</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Cart side (Grid 5) */}
          <div className="xl:col-span-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="font-extrabold text-xs text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-indigo-600" />
                <span>Active Terminal Cart ({cart.reduce((s, i) => s + i.quantity, 0)})</span>
              </h3>
              <button 
                onClick={() => setCart([])}
                className="text-[10px] font-bold text-red-600 hover:text-red-700 uppercase tracking-wider cursor-pointer"
              >
                Clear Cart
              </button>
            </div>

            {/* Cart Items list */}
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <div className="text-center py-12 text-zinc-400">
                  <ShoppingCart className="w-12 h-12 text-zinc-150 dark:text-zinc-800 mx-auto mb-3" />
                  <p className="text-xs font-semibold">Cart is currently empty</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.product.productId} className="flex gap-3 items-start border-b border-zinc-50 dark:border-zinc-800/40 pb-3 last:border-0 last:pb-0">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-100 truncate">{item.product.productName}</h4>
                      <p className="text-[9px] text-zinc-400 mt-0.5">Base Price: KES {item.product.retailPrice} | Floor: KES {item.product.costFloor}</p>
                      
                      {/* Bargain Margin override input */}
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className="text-[9px] font-bold uppercase text-zinc-400">Unit (KES):</span>
                        <input
                          type="number"
                          value={item.bargainPrice}
                          onChange={(e) => updateCartBargain(item.product.productId, Number(e.target.value))}
                          className="w-16 px-1.5 py-0.5 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs font-mono"
                          title="Override price (haggle margin validation is active)"
                        />
                      </div>
                    </div>

                    {/* Qty controller */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateCartQty(item.product.productId, item.quantity - 1)}
                          className="w-7 h-7 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 rounded-lg flex items-center justify-center font-bold text-xs cursor-pointer"
                        >
                          -
                        </button>
                        <span className="w-8 text-center font-mono text-xs font-bold">{item.quantity}</span>
                        <button
                          onClick={() => updateCartQty(item.product.productId, item.quantity + 1)}
                          className="w-7 h-7 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 rounded-lg flex items-center justify-center font-bold text-xs cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                      <span className="font-mono text-xs font-extrabold text-zinc-800 dark:text-zinc-100">KES {(item.quantity * item.bargainPrice).toLocaleString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Calculations summaries */}
            <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4 space-y-2 text-xs">
              <div className="flex justify-between text-zinc-500">
                <span>Cart Subtotal</span>
                <span className="font-mono">KES {getSubtotal().toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-zinc-500 items-center">
                <span>Discounts (Haggle Offset)</span>
                <input
                  type="number"
                  value={appliedDiscount}
                  onChange={(e) => setAppliedDiscount(e.target.value)}
                  className="w-20 px-2 py-0.5 border border-zinc-200 dark:border-zinc-800 rounded-md text-right font-mono"
                />
              </div>
              <div className="flex justify-between font-extrabold text-base text-zinc-950 dark:text-white border-t border-zinc-150 dark:border-zinc-800 pt-3">
                <span>GRAND TOTAL</span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400">KES {getGrossTotal().toLocaleString()}</span>
              </div>
            </div>

            {/* Checkout proceed action */}
            <button
              onClick={handleOpenCheckout}
              disabled={cart.length === 0}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase tracking-wider py-4 rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 transition-colors"
              style={{ minHeight: '48px' }}
              id="pos-proceed-checkout"
            >
              <span>Onboard Checkout Sequence</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      )}

      {/* MODAL: CHECKOUT SEQUENCE DETAILS */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" id="checkout-modal">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-extrabold text-sm text-zinc-900 dark:text-white uppercase tracking-wider mb-4">Complete Operational Sale</h3>
            
            <form onSubmit={handleCheckoutSubmit} className="space-y-4">
              
              {/* Payment selection modes */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-2">Payment Mode *</label>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod(PaymentMethod.CASH)}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      paymentMethod === PaymentMethod.CASH
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-bold'
                        : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-500'
                    }`}
                  >
                    <Coins className="w-4 h-4" />
                    <span className="text-[10px]">CASH</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod(PaymentMethod.MPESA)}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      paymentMethod === PaymentMethod.MPESA
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-bold'
                        : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-500'
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span className="text-[10px]">M-PESA</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod(PaymentMethod.DEBT)}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      paymentMethod === PaymentMethod.DEBT
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-bold'
                        : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-500'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span className="text-[10px]">DEBT</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod(PaymentMethod.SPLIT)}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      paymentMethod === PaymentMethod.SPLIT
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-bold'
                        : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-500'
                    }`}
                  >
                    <Split className="w-4 h-4" />
                    <span className="text-[10px]">SPLIT</span>
                  </button>
                </div>
              </div>

              {/* Lipa na M-Pesa STK prompts */}
              {paymentMethod === PaymentMethod.MPESA && (
                <div className="space-y-2 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-950">
                  <label className="block text-[10px] font-bold uppercase text-zinc-500">Customer M-Pesa Number *</label>
                  <input
                    type="tel"
                    required
                    value={mpesaPhoneNumber}
                    onChange={(e) => setMpesaPhoneNumber(e.target.value)}
                    placeholder="e.g., +254701234567 or 07..."
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900 text-sm focus:outline-none"
                  />
                  <p className="text-[9px] text-indigo-600 dark:text-indigo-400 font-semibold uppercase tracking-wide">Direct STK push will compile and send on confirm.</p>
                </div>
              )}

              {/* Debt choices prompts */}
              {(paymentMethod === PaymentMethod.DEBT || paymentMethod === PaymentMethod.SPLIT) && (
                <div className="space-y-2 bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <label className="block text-[10px] font-bold uppercase text-zinc-500">Choose Registered Debtor *</label>
                  <select
                    required={paymentMethod === PaymentMethod.DEBT}
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900 text-sm focus:outline-none"
                  >
                    <option value="">-- Choose Debtor Account --</option>
                    {customers.map(c => (
                      <option key={c.customerId} value={c.customerId}>
                        {c.customerName} (Available limit: KES {(c.creditLimit - c.existingDebt).toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Split allocation fields */}
              {paymentMethod === PaymentMethod.SPLIT && (
                <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 space-y-3">
                  <span className="block text-[10px] font-bold uppercase text-zinc-500">Split Payment Distributions</span>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <label className="block text-[9px] font-bold text-zinc-400 uppercase mb-1">CASH (KES)</label>
                      <input
                        type="number"
                        value={splitCashAmount}
                        onChange={(e) => setSplitCashAmount(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-zinc-400 uppercase mb-1">M-PESA (KES)</label>
                      <input
                        type="number"
                        value={splitMpesaAmount}
                        onChange={(e) => setSplitMpesaAmount(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-zinc-400 uppercase mb-1">DEBT (KES)</label>
                      <input
                        type="number"
                        value={splitDebtAmount}
                        onChange={(e) => setSplitDebtAmount(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900 font-mono font-bold"
                      />
                    </div>
                  </div>
                  <p className="text-[9px] text-zinc-400">Distributions must sum perfectly to KES {getGrossTotal().toLocaleString()}.</p>
                </div>
              )}

              <div className="flex gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowCheckoutModal(false)}
                  className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs uppercase tracking-wider py-3 rounded-xl border border-zinc-200 cursor-pointer"
                  style={{ minHeight: '44px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider py-3 rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-1"
                  style={{ minHeight: '44px' }}
                >
                  <Check className="w-4 h-4" />
                  <span>Execute Order</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PRINT THERMAL RECEIPT & SCAN CODES */}
      {showReceiptModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" id="receipt-modal">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-sm p-5 shadow-2xl">
            <h3 className="font-extrabold text-xs text-zinc-900 dark:text-white uppercase tracking-wider mb-4 border-b border-zinc-100 pb-2">Checkout Completed Successfully</h3>
            
            {/* Visual Receipt Scroll */}
            <div className="max-h-[350px] overflow-y-auto mb-5 border border-zinc-200 rounded-2xl bg-zinc-50 p-1">
              <div dangerouslySetInnerHTML={{ __html: receiptHTML }} />
            </div>

            {/* Receipt Actions */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handlePrintCommand}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider py-3 rounded-xl shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                style={{ minHeight: '44px' }}
              >
                <Printer className="w-4 h-4" />
                <span>Thermal Print</span>
              </button>
              <button
                onClick={handleWhatsAppShare}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider py-3 rounded-xl shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                style={{ minHeight: '44px' }}
              >
                <span>Share WhatsApp</span>
              </button>
            </div>

            <button
              onClick={() => setShowReceiptModal(false)}
              className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs uppercase tracking-wider py-3 rounded-xl border border-zinc-200 mt-3 cursor-pointer"
              style={{ minHeight: '44px' }}
            >
              Clear & Next Checkout
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default POS;
