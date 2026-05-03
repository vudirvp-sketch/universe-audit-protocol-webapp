'use client';

import * as React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// Only remove audit state — NEVER touch settings or other localStorage keys
const AUDIT_STATE_KEY = 'universe-audit-state';

/**
 * ErrorBoundary component to catch React rendering errors gracefully.
 * Prevents the entire app from crashing when an unhandled error occurs
 * during render — e.g., React Error #185 (state update during render).
 *
 * Two recovery options:
 * - "Попробовать восстановить" — resets error boundary without page reload
 * - "Сбросить и перезагрузить" — clears audit state and reloads page
 *
 * IMPORTANT: Only removes 'universe-audit-state' from localStorage,
 * NOT 'universe-audit-settings' or any other keys.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error for debugging — don't show raw stack to users
    console.error('[ErrorBoundary] Caught rendering error:', error.message);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  handleRecover = () => {
    // Try to recover without clearing any state or reloading
    this.setState({ hasError: false, error: null });
  };

  handleReset = () => {
    // Clear ONLY the audit state — never touch settings
    try {
      localStorage.removeItem(AUDIT_STATE_KEY);
    } catch {
      // Ignore — localStorage may be unavailable
    }
    this.setState({ hasError: false, error: null });
    // Force a full page reload to reset all state
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isDev = process.env.NODE_ENV === 'development';

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <div className="text-5xl mb-4">&#x26A0;&#xFE0F;</div>
          <h2 className="text-xl font-bold mb-2">Произошла ошибка отображения</h2>
          <p className="text-muted-foreground mb-4 max-w-md">
            Компонент столкнулся с непредвиденной ошибкой при отображении. 
            Это может быть вызвано ошибкой лимита запросов (429) или конфликтом состояния. 
            Вы можете попробовать восстановиться без потери данных или сбросить состояние аудита.
          </p>
          {(this.state.error || isDev) && (
            <p className="text-xs text-muted-foreground mb-4 max-w-lg font-mono bg-muted p-2 rounded">
              {this.state.error?.message || 'Unknown error'}
            </p>
          )}
          {isDev && this.state.error?.stack && (
            <details className="text-xs text-muted-foreground mb-4 max-w-lg text-left">
              <summary className="cursor-pointer mb-1">Стек ошибки (только в dev)</summary>
              <pre className="bg-muted p-2 rounded overflow-auto max-h-[200px] whitespace-pre-wrap">
                {this.state.error.stack}
              </pre>
            </details>
          )}
          <div className="flex gap-3">
            <button
              onClick={this.handleRecover}
              className="px-4 py-2 border border-border rounded-md hover:bg-accent transition-colors"
            >
              Попробовать восстановить
            </button>
            <button
              onClick={this.handleReset}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Сбросить и перезагрузить
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
