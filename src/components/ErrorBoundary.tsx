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

/**
 * ErrorBoundary component to catch React rendering errors gracefully.
 * Prevents the entire app from crashing when an unhandled error occurs
 * during render — e.g., React Error #185 (state update during render).
 *
 * Displays a user-friendly Russian error message with a reset button.
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

  handleReset = () => {
    // Clear persisted audit state to avoid re-triggering the error
    try {
      localStorage.removeItem('universe-audit-state');
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

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <div className="text-5xl mb-4">&#x26A0;&#xFE0F;</div>
          <h2 className="text-xl font-bold mb-2">Произошла ошибка отображения</h2>
          <p className="text-muted-foreground mb-4 max-w-md">
            Компонент столкнулся с непредвиденной ошибкой при отображении. 
            Это может быть вызвано ошибкой лимита запросов (429) или конфликтом состояния. 
            Попробуйте перезагрузить страницу.
          </p>
          {this.state.error && (
            <p className="text-xs text-muted-foreground mb-4 max-w-lg font-mono bg-muted p-2 rounded">
              {this.state.error.message}
            </p>
          )}
          <button
            onClick={this.handleReset}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Перезагрузить страницу
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
