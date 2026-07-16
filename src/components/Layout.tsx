import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { syncEngine } from '../lib/sync';
import { db } from '../lib/db';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Users, 
  Clock, 
  CreditCard, 
  Settings, 
  LogOut, 
  Wifi, 
  WifiOff, 
  Moon, 
  Sun, 
  RefreshCw, 
  AlertTriangle,
  Receipt,
  FileSpreadsheet,
  Coins
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  addToast: (text: string, type: 'success' | 'error' | 'info' | 'sync') => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, addToast }) => {
  const { activeBusiness, businessSettings, activeUser, logout, setThemeAndColor, language, setLanguage, t } = useAuth();
  
  // Realtime States
  const [isOnline, setIsOnline] = useState(syncEngine.isOnline());
  const [isSyncing, setIsSyncing] = useState(syncEngine.isSyncing());
  const [syncQueueCount, setSyncQueueCount] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sync state tracking
  useEffect(() => {
    const handleSyncChange = (online: boolean, syncing: boolean) => {
      setIsOnline(online);
      setIsSyncing(syncing);
    };

    const updateQueueCount = async () => {
      try {
        const queue = await db.getAll('sync_queue');
        setSyncQueueCount(queue.length);
      } catch (err) {
        console.error(err);
      }
    };

    const unsubscribeSync = syncEngine.subscribe(handleSyncChange);
    const unsubscribeDb = db.subscribe(updateQueueCount);

    updateQueueCount();

    // Load visual theme from browser preference or localSettings
    const savedDark = localStorage.getItem('theme_display_mode') === 'dark';
    setIsDarkMode(savedDark);
    if (savedDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    return () => {
      unsubscribeSync();
      unsubscribeDb();
    };
  }, []);

  // Sync Action Trigger
  const handleForceSync = async () => {
    if (!isOnline) {
      addToast('Cannot sync: connection is offline!', 'error');
      return;
    }
    addToast('Initiating sequence: replicating local changes to cloud...', 'sync');
    const { successCount, failedCount } = await syncEngine.forceSync();
    if (successCount > 0) {
      addToast(`Sync Successful: Replicated ${successCount} entries to cloud.`, 'success');
    } else if (failedCount > 0) {
      addToast(`Sync warning: ${failedCount} entries encountered conflict.`, 'error');
    } else {
      addToast('Local state is already fully synchronized with Cloud ledger.', 'success');
    }
  };

  // Toggle Network Online State (Local sandbox simulator)
  const toggleNetworkSimulation = () => {
    const nextState = !isOnline;
    syncEngine.setNetworkState(nextState);
    setIsOnline(nextState);
    addToast(
      nextState 
        ? 'Network Simulated ONLINE. Background sync workers active.' 
        : 'Network Simulated OFFLINE. All POS sales will execute locally.',
      nextState ? 'success' : 'error'
    );
  };

  // Display Mode toggler (Light/Dark)
  const toggleDisplayMode = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    localStorage.setItem('theme_display_mode', nextDark ? 'dark' : 'light');
    if (nextDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Theme Visual Styling Helper
  const getBrandAccentClasses = () => {
    const theme = businessSettings?.chosenTheme || 'retail';
    switch (theme) {
      case 'butchery':
        return {
          bg: 'bg-red-600 hover:bg-red-700 text-white',
          text: 'text-red-600 dark:text-red-400',
          border: 'border-red-200 dark:border-red-800',
          ring: 'focus:ring-red-500',
          gradient: 'from-red-600 to-rose-700',
          activeBg: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'
        };
      case 'mitumba':
        return {
          bg: 'bg-emerald-600 hover:bg-emerald-700 text-white',
          text: 'text-emerald-600 dark:text-emerald-400',
          border: 'border-emerald-200 dark:border-emerald-800',
          ring: 'focus:ring-emerald-500',
          gradient: 'from-emerald-600 to-teal-700',
          activeBg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
        };
      case 'hardware':
        return {
          bg: 'bg-amber-600 hover:bg-amber-700 text-white',
          text: 'text-amber-600 dark:text-amber-400',
          border: 'border-amber-200 dark:border-amber-800',
          ring: 'focus:ring-amber-500',
          gradient: 'from-amber-600 to-orange-700',
          activeBg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
        };
      case 'cyber':
        return {
          bg: 'bg-purple-600 hover:bg-purple-700 text-white',
          text: 'text-purple-600 dark:text-purple-400',
          border: 'border-purple-200 dark:border-purple-800',
          ring: 'focus:ring-purple-500',
          gradient: 'from-purple-600 to-fuchsia-700',
          activeBg: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300'
        };
      default: // Retail Blue
        return {
          bg: 'bg-indigo-600 hover:bg-indigo-700 text-white',
          text: 'text-indigo-600 dark:text-indigo-400',
          border: 'border-indigo-200 dark:border-indigo-800',
          ring: 'focus:ring-indigo-500',
          gradient: 'from-indigo-600 to-blue-700',
          activeBg: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
        };
    }
  };

  const brand = getBrandAccentClasses();

  // Navigation Tabs configuration
  const navigationItems = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard, role: 'CASHIER' },
    { id: 'pos', label: t('nav.pos'), icon: ShoppingCart, role: 'CASHIER' },
    { id: 'inventory', label: t('nav.inventory'), icon: Package, role: 'MANAGER' },
    { id: 'sales', label: t('nav.sales'), icon: Receipt, role: 'CASHIER' },
    { id: 'crm', label: t('nav.crm'), icon: Users, role: 'CASHIER' },
    { id: 'expenses', label: t('nav.expenses'), icon: Coins, role: 'MANAGER' },
    { id: 'shift', label: t('nav.shift'), icon: Clock, role: 'CASHIER' },
    { id: 'settings', label: t('nav.settings'), icon: Settings, role: 'OWNER' }
  ];

  // Filter items based on active user role
  const userRole = activeUser?.role || 'CASHIER';
  const filteredNavItems = navigationItems.filter(item => {
    if (userRole === 'OWNER') return true;
    if (userRole === 'MANAGER') return item.role !== 'OWNER';
    return item.role === 'CASHIER';
  });

  // Calculate Trial Remaining
  const getTrialDaysRemaining = () => {
    if (!activeBusiness) return 0;
    const expiry = new Date(activeBusiness.licenseExpiresAt).getTime();
    const diff = expiry - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const trialDays = getTrialDaysRemaining();

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-200" id="app-viewport">
      
      {/* Dynamic Header */}
      <header className="sticky top-0 z-40 w-full bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shadow-sm px-4 py-3 flex items-center justify-between" id="app-header">
        
        {/* Brand Header */}
        <div className="flex items-center gap-3">
          <img 
            src="https://res.cloudinary.com/plj6rk0o/image/upload/v1783949717/og-image_rxcpkm.jpg" 
            alt="BuzzNa Logo" 
            className="w-10 h-10 rounded-xl object-cover shadow-md border border-zinc-100 dark:border-zinc-800"
            referrerPolicy="no-referrer"
          />
          <div>
            <h1 className="text-sm font-extrabold tracking-tight uppercase text-zinc-900 dark:text-white flex items-center gap-1.5 leading-none">
              {activeBusiness?.tradeName || 'BuzzNa D74'}
            </h1>
            <p className="text-[10px] text-zinc-500 font-mono tracking-wider mt-0.5 uppercase leading-none">
              {businessSettings?.chosenTheme ? `${businessSettings.chosenTheme} vertical` : 'multi-sector OS'}
            </p>
          </div>
        </div>

        {/* System Operations Controls */}
        <div className="flex items-center gap-2">
          
          {/* Trial Visual countdown card */}
          {trialDays > 0 && (
            <div className="hidden md:flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 px-3 py-1.5 rounded-xl text-amber-800 dark:text-amber-300 text-xs font-semibold" id="trial-timer">
              <Clock className="w-3.5 h-3.5" />
              <span>{t('global.trial')}: <b>{trialDays} {t('global.days_left')}</b></span>
            </div>
          )}

          {/* Sync Status Badge */}
          {syncQueueCount > 0 ? (
            <button 
              onClick={handleForceSync}
              className="flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-900 px-3 py-1.5 rounded-xl text-indigo-700 dark:text-indigo-300 text-xs font-bold animate-pulse cursor-pointer transition-all"
              id="header-sync-queue-btn"
              title="Force Sync pending events"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{syncQueueCount} {t('global.unsynced')}</span>
            </button>
          ) : (
            <span className="hidden sm:flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 px-3 py-1.5 rounded-xl text-emerald-800 dark:text-emerald-400 text-xs font-semibold" id="sync-status-badge">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{t('global.synced')}</span>
            </span>
          )}

          {/* Simulated Offline Network Gate Toggler */}
          <button
            onClick={toggleNetworkSimulation}
            className={`p-2 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
              isOnline 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-400 hover:bg-emerald-100' 
                : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-900 dark:text-red-400 hover:bg-red-100'
            }`}
            style={{ minWidth: '44px', minHeight: '44px' }}
            title={isOnline ? 'Simulated Online (Click to toggle offline)' : 'Simulated Offline (Click to toggle online)'}
            id="network-simulator-toggle"
          >
            {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4 animate-bounce" />}
          </button>

          {/* Language Switcher */}
          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-xl border border-zinc-200 dark:border-zinc-700" id="lang-switcher">
            <button
              onClick={() => setLanguage('EN')}
              className={`px-2.5 py-1 text-[10px] font-black rounded-lg transition-all cursor-pointer ${
                language === 'EN'
                  ? 'bg-white dark:bg-zinc-950 text-zinc-950 dark:text-white shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
              }`}
              style={{ minHeight: '30px' }}
              title="Switch to Simple English"
            >
              EN
            </button>
            <button
              onClick={() => setLanguage('SW')}
              className={`px-2.5 py-1 text-[10px] font-black rounded-lg transition-all cursor-pointer ${
                language === 'SW'
                  ? 'bg-white dark:bg-zinc-950 text-zinc-950 dark:text-white shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
              }`}
              style={{ minHeight: '30px' }}
              title="Badili hadi Kiswahili Rahisi"
            >
              SW
            </button>
          </div>

          {/* Theme display toggler */}
          <button
            onClick={toggleDisplayMode}
            className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 transition-all flex items-center justify-center cursor-pointer"
            style={{ minWidth: '44px', minHeight: '44px' }}
            id="theme-display-mode-toggle"
            aria-label="Toggle visual contrast theme"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Quick Active user widget */}
          <div className="hidden lg:flex flex-col text-right ml-2 pr-2 border-r border-zinc-200 dark:border-zinc-800">
            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{activeUser?.username}</span>
            <span className="text-[10px] text-zinc-500 font-mono tracking-wider">{activeUser?.role}</span>
          </div>

          {/* Logout Action */}
          <button
            onClick={logout}
            className="p-2 rounded-xl hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400 text-zinc-500 border border-transparent transition-all flex items-center justify-center cursor-pointer"
            style={{ minWidth: '44px', minHeight: '44px' }}
            id="logout-btn"
            title="Log out of system"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Body frame */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* Desktop Sidebar Navigation */}
        <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 py-4 px-3 overflow-y-auto shrink-0 justify-between" id="desktop-sidebar">
          <div className="flex flex-col gap-1">
            {filteredNavItems.map(item => {
              const IconComp = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                    isActive 
                      ? brand.activeBg + ' font-bold shadow-xs' 
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                  style={{ minHeight: '48px' }}
                  id={`sidebar-nav-${item.id}`}
                >
                  <IconComp className={`w-4 h-4 shrink-0 ${isActive ? brand.text : 'text-zinc-400 dark:text-zinc-500'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Quick legal/support footer */}
          <div className="mt-8 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-[10px] text-zinc-400 font-mono flex flex-col gap-1">
            <div>BuzzNa D74 OS v1.0</div>
            <div>Support: 0790435584</div>
            <div>Secure Multi-Tenant RLS</div>
          </div>
        </aside>

        {/* Active Content Frame */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6" id="primary-content-viewport">
          {children}
        </main>
      </div>

      {/* Mobile Sticky Footer Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 px-2 py-1.5 shadow-xl flex items-center justify-around" id="mobile-footer-nav">
        {filteredNavItems.slice(0, 5).map(item => {
          const IconComp = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-0.5 p-2 rounded-xl transition-all cursor-pointer ${
                isActive 
                  ? brand.text + ' font-bold' 
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900'
              }`}
              style={{ minWidth: '55px', minHeight: '48px' }}
              id={`mobile-nav-${item.id}`}
            >
              <IconComp className="w-5 h-5 shrink-0" />
              <span className="text-[9px] font-bold tracking-tight">{item.label.split(' ')[0]}</span>
            </button>
          );
        })}
        {/* Additional items toggler */}
        {filteredNavItems.length > 5 && (
          <button
            onClick={() => {
              setMobileMenuOpen(true);
            }}
            className="flex flex-col items-center gap-0.5 p-2 rounded-xl text-zinc-500 cursor-pointer"
            style={{ minWidth: '55px', minHeight: '48px' }}
            id="mobile-nav-more"
          >
            <Clock className="w-5 h-5 shrink-0" />
            <span className="text-[9px] font-bold tracking-tight">More</span>
          </button>
        )}
      </nav>

      {/* Mobile Extra Menu Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end md:hidden" id="mobile-more-drawer">
          <div className="w-full bg-white dark:bg-zinc-900 rounded-t-3xl p-6 shadow-2xl border-t border-zinc-200 dark:border-zinc-800 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="font-extrabold text-sm text-zinc-800 dark:text-zinc-100 uppercase tracking-wide">Terminal Modules</h3>
              <button 
                onClick={() => setMobileMenuOpen(false)}
                className="text-zinc-400 hover:text-zinc-900 p-2 text-xs font-bold cursor-pointer"
                style={{ minWidth: '44px', minHeight: '44px' }}
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {filteredNavItems.map(item => {
                const IconComp = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border text-sm font-bold transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-zinc-50 dark:bg-zinc-800 ' + brand.text + ' ' + brand.border
                        : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                    }`}
                    style={{ minHeight: '48px' }}
                  >
                    <IconComp className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
            
            {/* Display Active user profile */}
            <div className="bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-2xl flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-zinc-800 dark:text-zinc-100">{activeUser?.username}</div>
                <div className="text-[10px] text-zinc-500 font-mono tracking-wider">{activeUser?.role}</div>
              </div>
              <button
                onClick={() => {
                  logout();
                  setMobileMenuOpen(false);
                }}
                className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-950/20 px-3 py-2 rounded-xl"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Layout;
