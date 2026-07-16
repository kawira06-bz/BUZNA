import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, generateUUID } from '../lib/db';
import { Customer, CustomerCreditLedgerEntry } from '../types';
import { Plus, Search, UserPlus, Phone, CreditCard, RefreshCw, Landmark, ShieldAlert, BadgeCent } from 'lucide-react';

export const CRM: React.FC<{ addToast: (text: string, type: 'success' | 'error' | 'info') => void }> = ({ addToast }) => {
  const { activeBusiness } = useAuth();
  
  // Realtime States
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<CustomerCreditLedgerEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form toggles
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRepayModal, setShowRepayModal] = useState(false);

  // Add form inputs
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [creditLimit, setCreditLimit] = useState('5000');

  // Repayment form inputs
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [repayAmount, setRepayAmount] = useState('');

  // Fetch details
  const fetchCRMData = async () => {
    try {
      const custs = await db.getAll<Customer>('customers');
      const ledger = await db.getAll<CustomerCreditLedgerEntry>('customer_credit_ledger');
      setCustomers(custs);
      setLedgerEntries(ledger);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCRMData();
    const unsubscribe = db.subscribe(fetchCRMData);
    return () => unsubscribe();
  }, []);

  // Handle Add Customer
  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName || !custPhone) {
      addToast('Customer name and phone number are required.', 'error');
      return;
    }

    try {
      if (!activeBusiness) return;

      const customerId = 'cust-' + generateUUID().substring(0, 8);
      const newCustomer: Customer = {
        customerId,
        tenantId: activeBusiness.tenantId,
        customerName: custName,
        phoneNumber: custPhone,
        emailAddress: custEmail || undefined,
        creditLimit: Number(creditLimit),
        existingDebt: 0,
        createdAt: new Date().toISOString()
      };

      await db.put('customers', newCustomer);
      addToast(`Debtor profile created successfully for ${custName}!`, 'success');
      
      // Reset
      setCustName('');
      setCustPhone('');
      setCustEmail('');
      setCreditLimit('5000');
      setShowAddModal(false);
    } catch (err) {
      addToast('Failed to instantiate customer profile.', 'error');
    }
  };

  // Handle Debt Repayment Log (Compensating Ledger Entry)
  const handleRepayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !repayAmount || Number(repayAmount) <= 0) {
      addToast('Please select a debtor and specify a positive repayment amount.', 'error');
      return;
    }

    try {
      if (!activeBusiness) return;
      const amount = Number(repayAmount);
      
      const customer = customers.find(c => c.customerId === selectedCustomerId);
      if (!customer) return;

      if (amount > customer.existingDebt) {
        addToast(`Bargain Repayment Exception: Repayment amount KES ${amount} exceeds their current outstanding debt of KES ${customer.existingDebt}.`, 'error');
        return;
      }

      // Record negative delta to adjust ledger debt downward
      await db.adjustCustomerDebt(activeBusiness.tenantId, selectedCustomerId, -amount);
      addToast(`Payment Logged: KES ${amount} reconciled on "${customer.customerName}" credit balance.`, 'success');

      // Reset
      setSelectedCustomerId('');
      setRepayAmount('');
      setShowRepayModal(false);
    } catch (err: any) {
      addToast(err.message || 'Repayment logging failed.', 'error');
    }
  };

  // Automated WhatsApp / SMS Reminders Simulation
  const triggerDebtorWhatsAppAlert = (customer: Customer) => {
    addToast(`Automated WhatsApp handshake: Dispatched debt reminder to ${customer.customerName} (${customer.phoneNumber}) via Brevo API gateway.`, 'info');
  };

  // Filter lists
  const filteredCustomers = customers.filter(c => 
    c.customerName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.phoneNumber.includes(searchQuery)
  );

  return (
    <div className="space-y-6" id="crm-view">
      
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h2 className="text-xl font-extrabold text-zinc-950 dark:text-white uppercase tracking-tight">Customer Directory & Credit Ledger</h2>
          <p className="text-xs text-zinc-500 mt-1">Govern credit bounds, track customer repayment logs, and dispatch automated alerts</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRepayModal(true)}
            className="bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-800 dark:text-zinc-200 font-bold text-xs uppercase tracking-wider py-3 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 transition-all cursor-pointer flex items-center gap-1"
            style={{ minHeight: '44px' }}
            id="log-repayment-btn"
          >
            <BadgeCent className="w-4 h-4" />
            <span>Repayment</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider py-3 px-4 rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1"
            style={{ minHeight: '44px' }}
            id="add-customer-btn"
          >
            <UserPlus className="w-4 h-4" />
            <span>New Debtor</span>
          </button>
        </div>
      </div>

      {/* Search Input bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search debtor directory by name or Safaricom phone number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 focus:outline-none text-sm"
          />
        </div>
      </div>

      {/* Directory Table Frame */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Customer debtor lists */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 text-xs font-bold tracking-wider text-zinc-500 uppercase">
                  <th className="py-4 px-6">Customer Details</th>
                  <th className="py-4 px-4 text-right">Credit Ceiling</th>
                  <th className="py-4 px-4 text-right">Outstanding Debt</th>
                  <th className="py-4 px-4 text-right">Credit Remaining</th>
                  <th className="py-4 px-6 text-center">EOD Reminders</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-zinc-400">
                      <UserPlus className="w-12 h-12 text-zinc-200 dark:text-zinc-800 mx-auto mb-3" />
                      <p className="text-sm font-semibold">No customer directory matches</p>
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map(cust => {
                    const remainingLimit = cust.creditLimit - cust.existingDebt;
                    const hasHighDebt = cust.existingDebt > 0.8 * cust.creditLimit;

                    return (
                      <tr key={cust.customerId} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                              <Phone className="w-4 h-4 text-zinc-500" />
                            </div>
                            <div>
                              <div className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">{cust.customerName}</div>
                              <div className="text-xs text-zinc-400 font-mono mt-0.5">{cust.phoneNumber}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right font-mono font-bold text-xs text-zinc-500 dark:text-zinc-400">
                          KES {cust.creditLimit.toLocaleString()}
                        </td>
                        <td className={`py-4 px-4 text-right font-mono font-bold text-sm ${
                          cust.existingDebt > 0 ? 'text-red-600 dark:text-red-400' : 'text-zinc-950 dark:text-white'
                        }`}>
                          KES {cust.existingDebt.toLocaleString()}
                        </td>
                        <td className={`py-4 px-4 text-right font-mono font-bold text-xs ${
                          hasHighDebt ? 'text-amber-600' : 'text-emerald-600 dark:text-emerald-400'
                        }`}>
                          KES {remainingLimit.toLocaleString()}
                        </td>
                        <td className="py-4 px-6 text-center">
                          <button
                            onClick={() => triggerDebtorWhatsAppAlert(cust)}
                            disabled={cust.existingDebt === 0}
                            className="text-xs bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold px-3 py-1.5 rounded-xl disabled:opacity-30 cursor-pointer transition-all"
                            style={{ minHeight: '44px' }}
                          >
                            Send Alert
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

        {/* RECENT CREDIT ADJUSTMENT LOGS */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-sm text-zinc-900 dark:text-white uppercase tracking-wider mb-1">Audit Ledger Timeline</h3>
            <p className="text-[10px] text-zinc-500 mb-4 uppercase">Latest credit adjust entries</p>

            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
              {ledgerEntries.length === 0 ? (
                <p className="text-xs text-zinc-400 text-center py-8">No credit entries logged</p>
              ) : (
                ledgerEntries.slice().reverse().map(entry => {
                  const customerObj = customers.find(c => c.customerId === entry.customerId);
                  const isRepayment = entry.amountDelta < 0;

                  return (
                    <div key={entry.ledgerId} className="flex gap-3 items-start border-b border-zinc-50 dark:border-zinc-800/60 pb-3 last:border-0 last:pb-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isRepayment ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20' : 'bg-red-50 text-red-600 dark:bg-red-950/20'
                      }`}>
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-zinc-800 dark:text-zinc-100 truncate">
                          {customerObj?.customerName || 'Anonymous Debtor'}
                        </div>
                        <div className="text-[9px] text-zinc-400 font-mono mt-0.5">
                          {new Date(entry.createdAt).toLocaleString()}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono mt-1">
                          Running Balance: KES {entry.runningBalance.toLocaleString()}
                        </div>
                      </div>
                      <div className={`text-xs font-mono font-extrabold ${
                        isRepayment ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {isRepayment ? '-' : '+'}KES {Math.abs(entry.amountDelta).toLocaleString()}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          
          <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 text-[10px] text-zinc-500 font-mono uppercase tracking-wide mt-4">
            Total Outstanding Debts: KES {customers.reduce((acc, c) => acc + c.existingDebt, 0).toLocaleString()}
          </div>
        </div>

      </div>

      {/* MODAL: ADD CUSTOMER FORM */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" id="add-customer-modal">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="font-extrabold text-sm text-zinc-900 dark:text-white uppercase tracking-wider mb-4">Instantiate Debtor Profile</h3>
            
            <form onSubmit={handleAddCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  required
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder="e.g., Kamau Wa Matatu"
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Safaricom Mobile Number *</label>
                <input
                  type="tel"
                  required
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  placeholder="e.g., +254701234567"
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Email Address (Optional)</label>
                <input
                  type="email"
                  value={custEmail}
                  onChange={(e) => setCustEmail(e.target.value)}
                  placeholder="e.g., kamau@gmail.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Credit Limit (KES Ceiling) *</label>
                <input
                  type="number"
                  required
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 text-sm focus:outline-none font-mono"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs uppercase tracking-wider py-2.5 rounded-xl border border-zinc-200 cursor-pointer"
                  style={{ minHeight: '44px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider py-2.5 rounded-xl shadow-md cursor-pointer"
                  style={{ minHeight: '44px' }}
                >
                  Register Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REPAYMENT LOG FORM */}
      {showRepayModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" id="repay-modal">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="font-extrabold text-sm text-zinc-900 dark:text-white uppercase tracking-wider mb-4">Log Debt Repayment</h3>
            
            <form onSubmit={handleRepayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Select Debtor *</label>
                <select
                  required
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 text-sm focus:outline-none"
                >
                  <option value="">-- Choose Debtor Profile --</option>
                  {customers.filter(c => c.existingDebt > 0).map(c => (
                    <option key={c.customerId} value={c.customerId}>
                      {c.customerName} (Due: KES {c.existingDebt.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Repay Amount Received (KES) *</label>
                <input
                  type="number"
                  required
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(e.target.value)}
                  placeholder="Count received cash"
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 text-sm focus:outline-none font-mono"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRepayModal(false)}
                  className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs uppercase tracking-wider py-2.5 rounded-xl border border-zinc-200 cursor-pointer"
                  style={{ minHeight: '44px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider py-2.5 rounded-xl shadow-md cursor-pointer"
                  style={{ minHeight: '44px' }}
                >
                  Confirm Reconcile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default CRM;
