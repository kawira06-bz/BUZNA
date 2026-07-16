import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/db';
import { SalesTransaction, SaleItem, Product, Customer, Expense, PaymentMethod } from '../types';
import { Sparkles, TrendingUp, Users, ArrowUpRight, ArrowDownRight, RefreshCw, BarChart2, Coins, AlertTriangle } from 'lucide-react';

export const Dashboard: React.FC<{ addToast: (text: string, type: 'success' | 'error') => void }> = ({ addToast }) => {
  const { activeBusiness, businessSettings, t } = useAuth();
  
  // Realtime lists state
  const [transactions, setTransactions] = useState<SalesTransaction[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // AI Forecast state
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch all DB parameters
  const fetchDashboardData = async () => {
    try {
      const txs = await db.getAll<SalesTransaction>('sales_transactions');
      const items = await db.getAll<SaleItem>('sales_items');
      const prods = await db.getAll<Product>('products');
      const custs = await db.getAll<Customer>('customers');
      const exps = await db.getAll<Expense>('expenses');

      setTransactions(txs);
      setSaleItems(items);
      setProducts(prods);
      setCustomers(custs);
      setExpenses(exps);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const unsubscribe = db.subscribe(fetchDashboardData);
    return () => unsubscribe();
  }, []);

  // Operational calculations
  const nonVoidTxs = transactions.filter(t => t.paymentStatus !== 'VOID');
  const totalSalesVolume = nonVoidTxs.reduce((sum, t) => sum + t.grossTotal, 0);
  
  // Profit (Gross Sales minus actual product cost floors)
  const totalProfit = nonVoidTxs.reduce((sum, tx) => {
    const txItems = saleItems.filter(i => i.transactionId === tx.transactionId);
    const costForTx = txItems.reduce((costSum, item) => {
      const prod = products.find(p => p.productId === item.productId);
      const floor = prod ? prod.costFloor : item.unitPrice * 0.7; // Fallback to 30% margin if deleted
      return costSum + (item.quantity * floor);
    }, 0);
    return sum + (tx.grossTotal - costForTx);
  }, 0);

  const totalDebts = customers.reduce((sum, c) => sum + c.existingDebt, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netEarnings = totalSalesVolume - totalExpenses;

  // Payments breakdown splits
  const cashSales = nonVoidTxs.filter(t => t.paymentMethod === PaymentMethod.CASH).reduce((s, t) => s + t.grossTotal, 0);
  const mpesaSales = nonVoidTxs.filter(t => t.paymentMethod === PaymentMethod.MPESA).reduce((s, t) => s + t.grossTotal, 0);
  const debtSales = nonVoidTxs.filter(t => t.paymentMethod === PaymentMethod.DEBT).reduce((s, t) => s + t.grossTotal, 0);

  // Daily target compliance check (defaults KES 10,000)
  const dailyTarget = businessSettings?.dailyRevenueTarget || 10000;
  const targetPct = Math.min((totalSalesVolume / dailyTarget) * 100, 100);

  // Trigger server-side Gemini Forecasting Report
  const generateAIForecast = async () => {
    setIsGenerating(true);
    setAiReport(null);
    try {
      const response = await fetch("/api/gemini/forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          products,
          sales: nonVoidTxs,
          industry: activeBusiness?.industry
        })
      });

      if (!response.ok) {
        throw new Error("Handshake with analytics server failed.");
      }

      const data = await response.json();
      setAiReport(data.forecast);
      addToast("Gemini stock forecast compiled successfully!", "success");
    } catch (err: any) {
      addToast(err.message || "Failed to trigger forecast.", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6" id="dashboard-view">
      
      {/* Title greeting row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h2 className="text-xl font-extrabold text-zinc-950 dark:text-white uppercase tracking-tight">{t('dash.title')}</h2>
          <p className="text-xs text-zinc-500 mt-1">{t('dash.subtitle')}</p>
        </div>

        <div className="text-xs font-semibold px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 border border-indigo-100 dark:border-indigo-950 uppercase">
          {activeBusiness?.industry || 'Retail General'}
        </div>
      </div>

      {/* METRIC SUMMARIES GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="dashboard-stats-grid">
        {/* Sales Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-xs flex justify-between items-start">
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Sales volume (Gross)</span>
            <p className="text-2xl font-extrabold text-zinc-950 dark:text-white font-mono">KES {totalSalesVolume.toLocaleString()}</p>
            <span className="text-[9px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-full uppercase inline-block">Revenue</span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-600">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Profits Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-xs flex justify-between items-start">
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Gross Profit (Margins)</span>
            <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">KES {totalProfit.toLocaleString()}</p>
            <span className="text-[9px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-full uppercase inline-block">Net margins</span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>

        {/* Debts Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-xs flex justify-between items-start">
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Outstanding customer debt</span>
            <p className="text-2xl font-extrabold text-red-600 dark:text-red-400 font-mono">KES {totalDebts.toLocaleString()}</p>
            <span className="text-[9px] font-medium text-red-600 bg-red-50 dark:bg-red-950/20 px-2 py-0.5 rounded-full uppercase inline-block">Credit risk</span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center text-red-600">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Expenses Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-xs flex justify-between items-start">
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Direct cost outflows</span>
            <p className="text-2xl font-extrabold text-zinc-800 dark:text-zinc-200 font-mono">KES {totalExpenses.toLocaleString()}</p>
            <span className="text-[9px] font-medium text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-full uppercase inline-block">Outflows</span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
            <ArrowDownRight className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* REVENUE TARGET COMPLIANCE & SPLITS FRAME */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Target Compliances (Col 2) */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-6">
          <div>
            <h3 className="font-extrabold text-sm text-zinc-900 dark:text-white uppercase tracking-wider">Revenue target compliance tracking</h3>
            <p className="text-xs text-zinc-500 mt-1">Measures current sales volume against operational daily targets configured in system Settings</p>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-end text-xs">
              <span className="font-bold text-zinc-500 uppercase tracking-wider">Daily Sales Progress</span>
              <span className="font-mono font-extrabold text-zinc-900 dark:text-white">KES {totalSalesVolume.toLocaleString()} / KES {dailyTarget.toLocaleString()} ({targetPct.toFixed(0)}%)</span>
            </div>
            
            {/* Custom styled progress meter */}
            <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-4 rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-700/60">
              <div 
                className="bg-indigo-600 h-full rounded-full transition-all duration-1000"
                style={{ width: `${targetPct}%` }}
              />
            </div>

            {targetPct >= 100 ? (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 p-2.5 rounded-xl border border-emerald-100">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>Daily Revenue Target achieved perfectly! Enterprise operating profitably.</span>
              </div>
            ) : (
              <p className="text-[10px] text-zinc-400">Target config details: update threshold margins in system Settings tab.</p>
            )}
          </div>

          {/* Payment Method Distribution splits */}
          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <h4 className="font-bold text-xs text-zinc-900 dark:text-white uppercase tracking-wider mb-4">Payment distribution splits</h4>
            
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                <Coins className="w-5 h-5 text-indigo-500 mx-auto mb-1.5" />
                <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Cash Sales</span>
                <p className="text-sm font-extrabold text-zinc-900 dark:text-white font-mono mt-1">KES {cashSales.toLocaleString()}</p>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                <BarChart2 className="w-5 h-5 text-emerald-500 mx-auto mb-1.5" />
                <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wide">M-Pesa Sales</span>
                <p className="text-sm font-extrabold text-zinc-900 dark:text-white font-mono mt-1">KES {mpesaSales.toLocaleString()}</p>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                <Users className="w-5 h-5 text-red-500 mx-auto mb-1.5" />
                <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Debt Sales</span>
                <p className="text-sm font-extrabold text-zinc-900 dark:text-white font-mono mt-1">KES {debtSales.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* AI-POWERED STOCK FORECASTING REPORT (Col 1) */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
              <h3 className="font-extrabold text-xs text-zinc-900 dark:text-white uppercase tracking-wider">AI Stock Forecasting</h3>
            </div>
            <p className="text-[10px] text-zinc-500 leading-relaxed uppercase">
              Executes a server-side Gemini 3.5 Flash evaluation over active catalogs, cost floors, and daily transactions.
            </p>

            <button
              onClick={generateAIForecast}
              disabled={isGenerating}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider py-3 px-4 rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ minHeight: '44px' }}
            >
              <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>Compile Gemini Report</span>
            </button>

            {/* AI Response Display panel */}
            <div className="border border-zinc-100 dark:border-zinc-800 rounded-2xl bg-zinc-50 dark:bg-zinc-950 p-4 min-h-[160px] max-h-[220px] overflow-y-auto">
              {isGenerating ? (
                <div className="flex flex-col items-center justify-center py-8 text-zinc-400 space-y-2">
                  <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
                  <p className="text-[10px] uppercase font-bold tracking-wider">Formulating stock analytics...</p>
                </div>
              ) : aiReport ? (
                <div className="text-xs text-zinc-700 dark:text-zinc-300 space-y-2 leading-relaxed whitespace-pre-line font-sans">
                  {aiReport}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-zinc-400 text-center">
                  <Sparkles className="w-8 h-8 text-zinc-200 dark:text-zinc-800 mb-2" />
                  <p className="text-[10px] uppercase font-bold">No insights compiled yet</p>
                  <p className="text-[9px] mt-1 px-4 text-zinc-500">Click compile button above to query Gemini over local IndexedDB state.</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-3.5 flex items-start gap-2.5 mt-4">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[9px] text-zinc-700 dark:text-zinc-300">
              <b>Sync Integrity:</b> Offline terminal actions require zero attendance. Ledger entries will automatically merge on next network discovery.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
};

export default Dashboard;
