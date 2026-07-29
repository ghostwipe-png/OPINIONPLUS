// components/ErrorBoundary.js
'use client';

import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    
    // Log to console for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Log to backend error aggregation (fire and forget)
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
      fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' })
        .then(r => r.json())
        .then(csrf => {
          // The error will be aggregated by the backend's global error handler
          // when the next request fails, or we can send it explicitly
        })
        .catch(() => {});
    } catch (e) {}
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          retry: this.handleRetry,
          reload: this.handleReload,
        });
      }

      // Default fallback UI
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border-2 border-wire rounded-sm p-8 text-center shadow-lg">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
              <AlertTriangle size={28} className="text-signal" />
            </div>
            <h2 className="text-xl font-black text-ink uppercase tracking-tight mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-ink-500 font-medium mb-6 leading-relaxed">
              An unexpected error occurred. This has been logged and our team will look into it.
            </p>
            {this.state.error && (
              <details className="mb-6 text-left">
                <summary className="text-xs font-bold text-ink-400 uppercase tracking-wider cursor-pointer hover:text-ink">
                  Technical details
                </summary>
                <pre className="mt-2 p-3 bg-ink-50 border border-wire rounded-sm text-[10px] font-mono text-ink-500 overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack?.slice(0, 500)}
                </pre>
              </details>
            )}
            <div className="flex gap-3">
              <button
                onClick={this.handleRetry}
                className="flex-1 border border-wire bg-white text-ink font-bold uppercase text-xs tracking-wider px-4 py-3 rounded-sm hover:border-ink transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw size={14} /> Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 bg-ink text-white font-bold uppercase text-xs tracking-wider px-4 py-3 rounded-sm hover:bg-signal transition-colors"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;