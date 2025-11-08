'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { useError } from '@/contexts/ErrorContext';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundaryClass extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorBoundaryWrapper
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          resetError={() => {
            this.setState({ hasError: false, error: undefined, errorInfo: undefined });
          }}
        />
      );
    }

    return this.props.children;
  }
}

function ErrorBoundaryWrapper({
  error,
  errorInfo,
  resetError
}: {
  error?: Error;
  errorInfo?: ErrorInfo;
  resetError: () => void;
}) {
  const { handleError } = useError();

  React.useEffect(() => {
    if (error) {
      handleError(error, 'Application Error');
    }
  }, [error, handleError]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg border border-red-200 p-6 sm:p-8 max-w-md w-full">
        <div className="text-center">
          <div className="text-6xl mb-4">🚨</div>
          <h2 className="text-xl font-bold text-red-600 mb-4">Oops! Something went wrong</h2>
          <p className="text-gray-600 mb-6">
            We're sorry, but something unexpected happened. The error has been logged and our team will look into it.
          </p>

          <div className="space-y-3">
            <button
              onClick={resetError}
              className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Reload Page
            </button>
          </div>

          {process.env.NODE_ENV === 'development' && error && (
            <details className="mt-6 text-left">
              <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                Technical Details
              </summary>
              <div className="mt-2 p-3 bg-gray-50 rounded text-xs text-gray-700 overflow-auto max-h-40">
                <div className="font-mono mb-2">
                  <strong>Error:</strong> {error.message}
                </div>
                {errorInfo && (
                  <div className="font-mono">
                    <strong>Component Stack:</strong>
                    <pre className="whitespace-pre-wrap break-words">
                      {errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

// Error Boundary Hook for functional components
export function useErrorHandler() {
  const { handleError } = useError();

  return React.useCallback((error: Error, context?: string) => {
    console.error('Error caught by useErrorHandler:', error, context);
    handleError(error, context);
  }, [handleError]);
}

// Main ErrorBoundary Component
export default function ErrorBoundary({ children, fallback }: Props) {
  return <ErrorBoundaryClass>{children}</ErrorBoundaryClass>;
}