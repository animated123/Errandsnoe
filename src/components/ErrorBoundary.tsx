import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-md rounded-[3rem] p-12 text-center shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-500">
            <div className="w-24 h-24 bg-rose-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-tr from-rose-100 to-transparent opacity-50" />
              <AlertTriangle size={48} className="text-rose-500 relative z-10" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Something went wrong</h2>
            <p className="text-sm font-bold text-slate-400 mb-10 leading-relaxed">
              We encountered an unexpected error. Don't worry, your data is safe.
            </p>
            
            <div className="space-y-3">
              <button 
                onClick={() => window.location.reload()}
                className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-slate-200 active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                <RefreshCw size={18} />
                Refresh Page
              </button>
              <button 
                onClick={() => window.location.href = '/'}
                className="w-full py-5 bg-slate-50 text-slate-400 rounded-2xl font-black uppercase text-xs tracking-widest hover:text-slate-900 transition-all flex items-center justify-center gap-3"
              >
                <Home size={18} />
                Go to Home
              </button>
            </div>
            
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-8 p-4 bg-slate-50 rounded-2xl text-left overflow-auto max-h-40">
                <p className="text-[10px] font-mono text-rose-500">{this.state.error?.toString()}</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
