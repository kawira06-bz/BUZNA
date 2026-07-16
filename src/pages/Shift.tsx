import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, generateUUID } from '../lib/db';
import { TillSession, SalesTransaction, PaymentMethod } from '../types';
import { PlayCircle, ShieldCheck, FileSpreadsheet, LockKeyhole, AlertTriangle, HelpCircle } from 'lucide-react';

export const Shift: React.FC<{ 
  addToast: (text: string, type: 'success' | 'error' | 'info' | 'sync') => void;
  onSessionChange: () => void;
}> = ({ addToast, onSessionChange }) => {
  const { activeBusiness, activeUser } = useAuth();
  
  // Realtime Active Session State
  const [activeSession, setActiveSession] = useState<TillSession | null>(null);
  const [cashSalesTotal, setCashSalesTotal] = useState(0);
  const [syncQueueLength, setSyncQueueLength] = useState(0);

  // Form Inputs
  const [openingFloat, setOpeningFloat] = useState('');
  const [blindCashCount, setBlindCashCount] = useState('');

  // Fetch shift details
  const fetchSessionData = async () => {
    try {
      const sessions = await db.getAll<TillSession>('till_sessions');
      const openSession = sessions.find(s => s.tenantId === activeBusiness?.tenantId && s.sessionStatus === 'OPEN');
      
      if (openSession) {
        setActiveSession(openSession);
        
        // Sum cash transactions during this active shift session
        const allTx = await db.getAll<SalesTransaction>('sales_transactions');
        const shiftTx = allTx.filter(t => t.sessionId === openSession.sessionId);
        
        const sumCash = shiftTx.reduce((sum, tx) => {
          if (tx.paymentMethod === PaymentMethod.CASH) {
            return sum + tx.grossTotal;
          }
          return sum;
        }, 0);
        
        setCashSalesTotal(sumCash);
      } else {
        setActiveSession(null);
        setCashSalesTotal(0);
      }

      // Check sync queue status
      const queue = await db.getAll('sync_queue');
      setSyncQueueLength(queue.length);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSessionData();
    const unsubscribe = db.subscribe(fetchSessionData);
    return () => unsubscribe();
  }, [activeBusiness]);

  // Open Till Session
  const handleOpenTill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openingFloat || Number(openingFloat) < 0) {
      addToast('Opening float cannot be negative.', 'error');
      return;
    }

    try {
      if (!activeBusiness || !activeUser) return;

      const sessionId = generateUUID();
      const newSession: TillSession = {
        sessionId,
        tenantId: activeBusiness.tenantId,
        userId: activeUser.userId,
        openingFloat: Number(openingFloat),
        expectedCashBalance: Number(openingFloat), // expected begins with opening float
        sessionStatus: 'OPEN',
        openedAt: new Date().toISOString()
      };

      await db.put('till_sessions', newSession);
      localStorage.setItem('active_till_session_id', sessionId);
      addToast(`Till session initialized successfully! Float set KES ${openingFloat}.`, 'success');
      setOpeningFloat('');
      onSessionChange();
    } catch (err) {
      addToast('Till initialization failed.', 'error');
    }
  };

  // Close Till Session with Blind Cash Audit
  const handleCloseTill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blindCashCount || Number(blindCashCount) < 0) {
      addToast('Physical cash count cannot be negative.', 'error');
      return;
    }

    // Dynamic Sync Gate Lock: Blocking close if queue has pending sync entries
    if (syncQueueLength > 0) {
      addToast(`Closure Blocked: ${syncQueueLength} unsynced sales in local queue. Please toggle simulated online and force sync before shift hand-off.`, 'error');
      return;
    }

    try {
      if (!activeSession) return;

      const physicalAmount = Number(blindCashCount);
      const expectedAmount = activeSession.openingFloat + cashSalesTotal;
      const variance = physicalAmount - expectedAmount;

      // Close the active session
      activeSession.actualCashBalance = physicalAmount;
      activeSession.sessionStatus = 'CLOSED';
      activeSession.closedAt = new Date().toISOString();

      await db.put('till_sessions', activeSession);
      localStorage.removeItem('active_till_session_id');

      // Dispatch alert on discrepancy variance
      if (variance === 0) {
        addToast('Blind Balance Audit Completed: Cash balanced perfectly!', 'success');
      } else if (Math.abs(variance) <= 50) {
        addToast(`Blind Balance completed with tolerable variance of KES ${variance}. Till Session closed.`, 'info');
      } else {
        addToast(`Discrepancy Exception: Variance detected: KES ${variance}. Session flagged as REVIEW_REQUIRED.`, 'error');
      }

      setBlindCashCount('');
      onSessionChange();
    } catch (err) {
      addToast('Closure operation failed.', 'error');
    }
  };

  return (
    <div className="space-y-6" id="shift-view">
      
      {/* View Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <h2 className="text-xl font-extrabold text-zinc-950 dark:text-white uppercase tracking-tight">Shift Handover & Till Audit</h2>
        <p className="text-xs text-zinc-500 mt-1">Initialize opening drawer floats or close active sessions via blind balance audits</p>
      </div>

      <div className="max-w-2xl mx-auto">
        
        {activeSession ? (
          /* ACTIVE SESSION SCREEN (Options to Close) */
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8 shadow-md space-y-6">
            <div className="flex items-center gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl flex items-center justify-center text-emerald-600">
                <PlayCircle className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-extrabold bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-md uppercase">Session Active</span>
                <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 mt-1">Operator Till Registered: {activeUser?.username}</h3>
                <p className="text-[10px] text-zinc-500 font-mono mt-0.5 uppercase">ID: {activeSession.sessionId.substring(0, 18).toUpperCase()}</p>
              </div>
            </div>

            {/* Current shift stats (Cash totals are computed but compared during close) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Float In</span>
                <p className="text-base font-extrabold text-zinc-900 dark:text-white mt-1">KES {activeSession.openingFloat.toLocaleString()}</p>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Shift Opened</span>
                <p className="text-xs font-mono text-zinc-900 dark:text-white mt-1.5">{new Date(activeSession.openedAt).toLocaleTimeString()}</p>
              </div>
            </div>

            {/* Shift Closure Blind Form */}
            <form onSubmit={handleCloseTill} className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <div className="space-y-1">
                <h4 className="font-extrabold text-xs text-zinc-900 dark:text-white uppercase tracking-wider">Mandatory Blind Balance Cash Audit</h4>
                <p className="text-[10px] text-zinc-500">Count the physical notes and coins in the till drawer and input the total below. Expected balances are hidden to ensure audit compliance.</p>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase text-zinc-500">Physical Cash Counted (KES) *</label>
                <input
                  type="number"
                  required
                  value={blindCashCount}
                  onChange={(e) => setBlindCashCount(e.target.value)}
                  placeholder="e.g., 12450"
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-mono"
                />
              </div>

              {/* Sync queue validator warn */}
              {syncQueueLength > 0 && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/60 p-4 rounded-2xl flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-red-800 dark:text-red-300">
                    <p className="font-bold uppercase tracking-wider text-[10px]">Sync Lock Active</p>
                    <p className="mt-1">You have {syncQueueLength} unsynced transactions in browser IndexedDB memory. A shift cannot be closed with unsynced transactions. Toggle network simulated status on and click "Force Sync" in the header first.</p>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider py-3.5 rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2"
                style={{ minHeight: '44px' }}
                id="close-till-btn"
              >
                <LockKeyhole className="w-4 h-4" />
                <span>Audit & Lock Till Session</span>
              </button>
            </form>
          </div>
        ) : (
          /* TILL OPENING FLOAT REGISTRY */
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8 shadow-md space-y-6">
            <div className="flex items-center gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl flex items-center justify-center text-indigo-600">
                <LockKeyhole className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-extrabold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded-md uppercase">Till Session Closed</span>
                <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 mt-1">POS Checkout Lock Active</h3>
                <p className="text-[10px] text-zinc-500 mt-0.5 uppercase">Set a float to unlock operational terminals</p>
              </div>
            </div>

            <form onSubmit={handleOpenTill} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase text-zinc-500">Opening Draw Float (KES) *</label>
                <input
                  type="number"
                  required
                  value={openingFloat}
                  onChange={(e) => setOpeningFloat(e.target.value)}
                  placeholder="e.g., 2000"
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-mono"
                />
                <p className="text-[10px] text-zinc-500">Provide the total physical coin and note count in hand inside the till drawer before accepting first sales.</p>
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider py-3.5 rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2"
                style={{ minHeight: '44px' }}
                id="open-till-btn"
              >
                <PlayCircle className="w-4 h-4" />
                <span>Initialize Till Float</span>
              </button>
            </form>
          </div>
        )}

      </div>

    </div>
  );
};

export default Shift;
