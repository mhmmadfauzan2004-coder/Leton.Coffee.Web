import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw, Copy, Check } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Production React ErrorBoundary Caught Exception]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public handleClearSessionAndReload = () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('leton_customer_token');
        localStorage.removeItem('leton_customer_profile');
        localStorage.removeItem('leton_selected_outlet');
        localStorage.removeItem('leton_ordering_cart');
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  };

  public handleCopyError = () => {
    const errorDetails = `Error: ${this.state.error?.toString() || 'Unknown'}\nStack: ${
      this.state.error?.stack || ''
    }\nComponent Stack: ${this.state.errorInfo?.componentStack || ''}`;
    
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(errorDetails).then(() => {
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 3000);
      });
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full min-h-[60vh] flex flex-col items-center justify-center p-6 text-center bg-[#070b12] text-slate-100 font-sans">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4 shadow-lg shadow-red-500/10">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h3 className="font-display font-black text-xl text-white uppercase tracking-wide mb-2">
            {this.props.fallbackTitle || 'Terjadi Kendala Memuat Tampilan'}
          </h3>
          <p className="text-sm text-slate-400 max-w-lg mb-6 leading-relaxed">
            {this.props.fallbackMessage ||
              'Aplikasi mendeteksi error pada tampilan. Anda dapat memuat ulang atau mereset sesi untuk melanjutkan.'}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
            <button
              onClick={this.handleReset}
              className="px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-md"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Coba Lagi</span>
            </button>
            <button
              onClick={this.handleClearSessionAndReload}
              className="px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-[#00E5FF]" />
              <span>Reset Sesi & Muat Ulang</span>
            </button>
          </div>

          {this.state.error && (
            <div className="mt-4 p-4 bg-slate-950/90 border border-red-900/40 rounded-xl text-left max-w-2xl w-full overflow-x-auto text-[11px] font-mono text-red-400 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                <span className="font-bold text-red-300 uppercase tracking-wider text-[10px]">Detail Error Teknis:</span>
                <button
                  onClick={this.handleCopyError}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] transition-colors"
                >
                  {this.state.copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{this.state.copied ? 'Tersalin' : 'Salin Error'}</span>
                </button>
              </div>
              <div className="font-semibold">{this.state.error.toString()}</div>
              {this.state.error.stack && (
                <pre className="text-[10px] text-slate-400 whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {this.state.error.stack}
                </pre>
              )}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
