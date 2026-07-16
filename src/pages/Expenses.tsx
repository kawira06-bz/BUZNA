import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, generateUUID } from '../lib/db';
import { Expense } from '../types';
import { Plus, Search, Calendar, Landmark, BadgeCent, Trash2, Archive, HelpCircle } from 'lucide-react';

export const Expenses: React.FC<{ addToast: (text: string, type: 'success' | 'error') => void }> = ({ addToast }) => {
  const { activeBusiness } = useAuth();
  
  // Realtime list state
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState('all');

  // Form states
  const [showModal, setShowModal] = useState(false);
  const [expenseName, setExpenseName] = useState('');
  const [expenseCat, setExpenseCat] = useState('Suppliers');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchExpenses = async () => {
    try {
      const all = await db.getAll<Expense>('expenses');
      setExpenses(all);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchExpenses();
    const unsubscribe = db.subscribe(fetchExpenses);
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseName || !expenseAmount) {
      addToast('Name and amount are required.', 'error');
      return;
    }

    try {
      if (!activeBusiness) return;
      
      const newExpense: Expense = {
        expenseId: 'exp-' + generateUUID().substring(0, 8),
        tenantId: activeBusiness.tenantId,
        expenseName,
        category: expenseCat,
        amount: Number(expenseAmount),
        incurredDate: expenseDate,
        createdAt: new Date().toISOString()
      };

      await db.put('expenses', newExpense);
      addToast(`Expense "${expenseName}" logged successfully!`, 'success');
      
      setExpenseName('');
      setExpenseAmount('');
      setShowModal(false);
    } catch (err) {
      addToast('Failed to log expense.', 'error');
    }
  };

  const handleDeleteExpense = async (id: string, name: string) => {
    if (confirm(`Purge expense item "${name}"?`)) {
      try {
        await db.delete('expenses', id);
        addToast(`Purged expense "${name}".`, 'success');
      } catch (err) {
        addToast('Delete failed.', 'error');
      }
    }
  };

  // Filter lists
  const filteredExpenses = expenses.filter(exp => {
    const matchesSearch = exp.expenseName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCat === 'all' || exp.category === selectedCat;
    return matchesSearch && matchesCat;
  });

  const totalExpenseVolume = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6" id="expenses-view">
      
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h2 className="text-xl font-extrabold text-zinc-950 dark:text-white uppercase tracking-tight">Direct Expense Log</h2>
          <p className="text-xs text-zinc-500 mt-1">Record supplier freight charges, municipal permits, and staff tokens directly</p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider py-3 px-4 rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1 self-start md:self-auto"
          style={{ minHeight: '44px' }}
          id="log-expense-btn"
        >
          <Plus className="w-4 h-4" />
          <span>Log Outflow</span>
        </button>
      </div>

      {/* Stats summaries cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-xs">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Total logged outflow</span>
          <p className="text-xl font-extrabold text-red-600 dark:text-red-400 mt-1">KES {totalExpenseVolume.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-xs">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Permits & Fees</span>
          <p className="text-lg font-bold text-zinc-800 dark:text-zinc-200 mt-1">
            KES {expenses.filter(e => e.category === 'Municipal licenses').reduce((s, e) => s + e.amount, 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-xs">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Suppliers freight</span>
          <p className="text-lg font-bold text-zinc-800 dark:text-zinc-200 mt-1">
            KES {expenses.filter(e => e.category === 'Suppliers').reduce((s, e) => s + e.amount, 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Filter list options */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search logged outflows..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 focus:outline-none text-sm"
          />
        </div>

        <div className="w-full sm:w-auto shrink-0 flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Category:</span>
          <select
            value={selectedCat}
            onChange={(e) => setSelectedCat(e.target.value)}
            className="w-full sm:w-auto px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 focus:outline-none text-xs font-semibold"
          >
            <option value="all">All Outflows</option>
            <option value="Suppliers">Suppliers & Freight</option>
            <option value="Municipal licenses">Municipal permits / KRA</option>
            <option value="Staff lunch">Staff lunches / tokens</option>
            <option value="General rent">Rents / Utilities</option>
          </select>
        </div>
      </div>

      {/* Logged lists */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 text-xs font-bold tracking-wider text-zinc-500 uppercase">
                <th className="py-4 px-6">Expense Details</th>
                <th className="py-4 px-4">Category</th>
                <th className="py-4 px-4">Date incurred</th>
                <th className="py-4 px-4 text-right">Amount Outflow</th>
                <th className="py-4 px-6 text-center">Purge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-400">
                    <Archive className="w-12 h-12 text-zinc-200 dark:text-zinc-800 mx-auto mb-3" />
                    <p className="text-sm font-semibold">No direct expenses found</p>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map(exp => (
                  <tr key={exp.expenseId} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                        {exp.expenseName}
                      </div>
                      <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                        REF: {exp.expenseId.toUpperCase()}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                      {exp.category}
                    </td>
                    <td className="py-4 px-4 text-xs font-mono text-zinc-500">
                      {new Date(exp.incurredDate).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-4 text-right font-mono font-bold text-sm text-red-600 dark:text-red-400">
                      KES {exp.amount.toLocaleString()}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <button
                        onClick={() => handleDeleteExpense(exp.expenseId, exp.expenseName)}
                        className="p-2 rounded-xl text-zinc-400 hover:text-red-600 cursor-pointer transition-all flex items-center justify-center mx-auto"
                        style={{ minWidth: '44px', minHeight: '44px' }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EXPENSE CREATION MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" id="expense-modal">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="font-extrabold text-sm text-zinc-900 dark:text-white uppercase tracking-wider mb-4">Log Outgoing Cost</h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Expense Description *</label>
                <input
                  type="text"
                  required
                  value={expenseName}
                  onChange={(e) => setExpenseName(e.target.value)}
                  placeholder="e.g., KRA permit renewal"
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Outflow Category *</label>
                <select
                  value={expenseCat}
                  onChange={(e) => setExpenseCat(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 text-sm focus:outline-none"
                >
                  <option value="Suppliers">Suppliers & Freight</option>
                  <option value="Municipal licenses">Municipal permits / KRA</option>
                  <option value="Staff lunch">Staff lunches / tokens</option>
                  <option value="General rent">Rents / Utilities</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Amount Incurred (KES) *</label>
                <input
                  type="number"
                  required
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder="KES"
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 text-sm focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Date Incurred *</label>
                <input
                  type="date"
                  required
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 text-sm focus:outline-none font-mono"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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
                  Confirm Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Expenses;
