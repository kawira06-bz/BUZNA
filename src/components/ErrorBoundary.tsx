import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Download } from 'lucide-react';
import { db } from '../lib/db';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by boundary:', error, errorInfo);
  }

  private handleForcedDump = async () => {
    try {
      const sales = await db.getAll('sales_transactions');
      const queue = await db.getAll('sync_queue');
      
      const payload = {
        dumpTimestamp: new Date().toISOString(),
        unsyncedQueueCount: queue.length,
        localSalesTransactions: sales,
        localSyncQueue: queue
      };

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `buzzna_d74_crash_dump_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      alert('Failed to construct backup dump. Please contact support immediately at 0790435584.');
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-zinc-200 p-8 text-center">
            <div className="w-16 h-16 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            </div>

            <h1 className="text-xl font-bold text-zinc-900 mb-2">Something went wrong</h1>
            <p className="text-sm text-zinc-600 mb-6">
              BuzzNa D74 encountered an unexpected UI render error. Your local sales ledger and till session remains secure in offline memory.
            </p>

            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-left font-mono text-xs text-zinc-700 overflow-auto max-h-36 mb-6">
              {this.state.error?.toString() || 'Unknown Runtime Exception'}
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm py-3 px-4 rounded-xl shadow-sm transition-all cursor-pointer"
                id="crash-reload"
              >
                <RefreshCcw className="w-4 h-4" />
                Soft Reload App
              </button>

              <button
                onClick={this.handleForcedDump}
                className="w-full flex items-center justify-center gap-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-semibold text-sm py-3 px-4 rounded-xl border border-zinc-200 transition-all cursor-pointer"
                id="crash-dump"
              >
                <Download className="w-4 h-4" />
                Download Forced Local Dump
              </button>
            </div>

            <p className="mt-6 text-xs text-zinc-500">
              Need urgent support? Dial / WhatsApp <b className="text-zinc-800">0790435584</b>
            </p>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

export default ErrorBoundary;
