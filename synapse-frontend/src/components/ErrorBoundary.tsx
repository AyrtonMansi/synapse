/**
 * @fileoverview Global Error Boundary Component
 * 
 * Catches JavaScript errors anywhere in the child component tree,
 * logs error details, and displays a fallback UI instead of crashing.
 * 
 * @module synapse-frontend/components/ErrorBoundary
 * @version 1.1.0
 * 
 * @example
 * ```tsx
 * import { ErrorBoundary } from '@/components/ErrorBoundary';
 * 
 * function App() {
 *   return (
 *     <ErrorBoundary 
 *       onError={(error, info) => logToService(error, info)}
 *       fallback={<CustomErrorPage />}
 *     >
 *       <YourApp />
 *     </ErrorBoundary>
 *   );
 * }
 * ```
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { Link } from 'react-router-dom';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Props for ErrorBoundary component
 */
interface ErrorBoundaryProps {
  /** Child components to render */
  children: ReactNode;
  /** Custom fallback UI (optional) */
  fallback?: ReactNode;
  /** Callback when error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Component to reset error state */
  resetKeys?: Array<string | number>;
  /** Callback when error boundary resets */
  onReset?: () => void;
}

/**
 * State for ErrorBoundary component
 */
interface ErrorBoundaryState {
  /** Whether an error has been caught */
  hasError: boolean;
  /** The caught error */
  error: Error | null;
  /** React error info */
  errorInfo: ErrorInfo | null;
  /** Error ID for tracking */
  errorId: string;
  /** Whether to show detailed error info */
  showDetails: boolean;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate unique error ID for tracking
 */
function generateErrorId(): string {
  return `err_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Log error to console with formatting
 */
function logError(error: Error, errorInfo: ErrorInfo, errorId: string): void {
  // eslint-disable-next-line no-console
  console.error(`[ErrorBoundary:${errorId}]`, {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    componentStack: errorInfo.componentStack,
    timestamp: new Date().toISOString(),
    errorId,
  });
}

/**
 * Check if error should be reported to external service
 */
function shouldReportError(error: Error): boolean {
  // Don't report known React errors that are typically development-only
  const ignoredPatterns = [
    /^ResizeObserver loop/, // Common benign warning
    /^Uncaught .* in promise/, // Already handled by promise rejections
  ];
  
  return !ignoredPatterns.some(pattern => pattern.test(error.message));
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Error Boundary - Catches errors in child component tree
 * 
 * @class
 * @extends Component
 * 
 * @description
 * React error boundaries catch JavaScript errors anywhere in their child 
 * component tree, log those errors, and display a fallback UI instead of 
 * the component tree that crashed.
 * 
 * @see {@link https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary}
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  /**
   * Initial state
   */
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
    errorId: '',
    showDetails: false,
  };

  /**
   * Track previous reset keys for detecting changes
   */
  private prevResetKeys: Array<string | number> = [];

  /**
   * Static method to derive state from error
   * Called when an error is thrown in a child component
   * 
   * @param error - The caught error
   * @returns New state with error info
   */
  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { 
      hasError: true, 
      error,
      errorId: generateErrorId(),
    };
  }

  /**
   * Lifecycle method called after an error is caught
   * Used for side effects like logging
   * 
   * @param error - The caught error
   * @param errorInfo - React component stack info
   */
  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const errorId = this.state.errorId || generateErrorId();
    
    this.setState({ errorInfo });
    
    // Log to console
    logError(error, errorInfo, errorId);
    
    // Report to external service if configured
    if (shouldReportError(error) && this.props.onError) {
      try {
        this.props.onError(error, errorInfo);
      } catch (reportingError) {
        // eslint-disable-next-line no-console
        console.error('Error reporting failed:', reportingError);
      }
    }
  }

  /**
   * Check if resetKeys have changed
   */
  public componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    const { hasError, errorId } = this.state;
    const { resetKeys } = this.props;

    // Reset error state if resetKeys changed
    if (hasError && errorId && resetKeys && resetKeys.length > 0) {
      const hasResetKeyChanged = resetKeys.some(
        (key, index) => key !== this.prevResetKeys[index]
      );

      if (hasResetKeyChanged) {
        this.resetErrorBoundary();
      }
    }

    this.prevResetKeys = resetKeys || [];
  }

  /**
   * Reset error boundary state
   * Called to retry rendering after an error
   */
  private resetErrorBoundary = (): void => {
    const { onReset } = this.props;

    if (onReset) {
      onReset();
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      showDetails: false,
    });
  };

  /**
   * Toggle detailed error information display
   */
  private toggleDetails = (): void => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  /**
   * Render fallback error UI
   */
  private renderErrorUI(): ReactNode {
    const { error, errorInfo, errorId, showDetails } = this.state;

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
        <div className="glass-card p-8 max-w-2xl w-full">
          {/* Error Icon */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-4 animate-pulse">
              <AlertTriangle className="w-10 h-10 text-red-400" />
            </div>
            <h1 className="text-3xl font-bold mb-2 text-white">
              Something went wrong
            </h1>
            <p className="text-slate-400 max-w-md">
              We encountered an unexpected error. Our team has been notified.
              Please try refreshing the page.
            </p>
          </div>

          {/* Error ID for support */}
          {errorId && (
            <div className="bg-slate-900/50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Error Reference</span>
                <code className="text-sm font-mono text-slate-300 bg-slate-800 px-2 py-1 rounded">
                  {errorId}
                </code>
              </div>
              <p className="text-xs text-slate-600 mt-2">
                Please include this ID when contacting support
              </p>
            </div>
          )}

          {/* Error Details (collapsible) */}
          {error && (
            <div className="mb-6">
              <button
                onClick={this.toggleDetails}
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-300 transition-colors mb-3"
                type="button"
              >
                <Bug className="w-4 h-4" />
                {showDetails ? 'Hide' : 'Show'} Technical Details
              </button>

              {showDetails && (
                <div className="bg-slate-950 rounded-lg p-4 overflow-auto max-h-64 border border-slate-800">
                  <div className="space-y-3">
                    <div>
                      <span className="text-xs font-semibold text-slate-500 uppercase">
                        Error Message
                      </span>
                      <p className="text-red-400 text-sm font-mono mt-1">
                        {error.name}: {error.message}
                      </p>
                    </div>

                    {errorInfo?.componentStack && (
                      <div>
                        <span className="text-xs font-semibold text-slate-500 uppercase">
                          Component Stack
                        </span>
                        <pre className="text-xs text-slate-500 font-mono mt-1 whitespace-pre-wrap">
                          {errorInfo.componentStack}
                        </pre>
                      </div>
                    )}

                    {error.stack && (
                      <div>
                        <span className="text-xs font-semibold text-slate-500 uppercase">
                          Stack Trace
                        </span>
                        <pre className="text-xs text-slate-600 font-mono mt-1 whitespace-pre-wrap">
                          {error.stack}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={this.resetErrorBoundary}
              className="btn-primary flex items-center justify-center gap-2"
              type="button"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
            
            <button
              onClick={() => window.location.reload()}
              className="btn-secondary flex items-center justify-center gap-2"
              type="button"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Page
            </button>
            
            <Link 
              to="/" 
              className="btn-ghost flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              Go Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /**
   * Main render method
   */
  public render(): ReactNode {
    const { hasError } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      return fallback || this.renderErrorUI();
    }

    return children;
  }
}

/**
 * Higher-order component to wrap components with error boundary
 * 
 * @param Component - Component to wrap
 * @param errorBoundaryProps - Error boundary props
 * @returns Wrapped component
 * 
 * @example
 * ```tsx
 * const SafeDashboard = withErrorBoundary(Dashboard, {
 *   onError: logError
 * });
 * ```
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps: Omit<ErrorBoundaryProps, 'children'> = {}
): React.ComponentType<P> {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';

  const ComponentWithErrorBoundary: React.ComponentType<P> = (props) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;

  return ComponentWithErrorBoundary;
}

export default ErrorBoundary;
