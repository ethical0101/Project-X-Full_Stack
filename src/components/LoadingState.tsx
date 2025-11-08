'use client';

import React from 'react';

interface LoadingStateProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
  showProgress?: boolean;
  progress?: number;
}

export default function LoadingState({
  message = 'Loading...',
  size = 'medium',
  showProgress = false,
  progress = 0
}: LoadingStateProps) {
  const sizeClasses = {
    small: 'h-4 w-4',
    medium: 'h-8 w-8',
    large: 'h-12 w-12'
  };

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className="flex flex-col items-center space-y-4">
        {/* Spinner */}
        <div className={`${sizeClasses[size]} animate-spin rounded-full border-2 border-gray-300 border-t-primary-600`}></div>

        {/* Message */}
        {message && (
          <div className="text-center">
            <p className="text-gray-600 font-medium">{message}</p>
          </div>
        )}

        {/* Progress bar */}
        {showProgress && (
          <div className="w-full max-w-sm">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Processing...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Empty state component for better UX
interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon = '📊', title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="text-6xl mb-4 opacity-50">{icon}</div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 mb-6 max-w-md">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
}

// Error state component
interface ErrorStateProps {
  title: string;
  description: string;
  onRetry?: () => void;
  retryText?: string;
}

export function ErrorState({ title, description, onRetry, retryText = 'Try Again' }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="text-6xl mb-4">⚠️</div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 mb-6 max-w-md">{description}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          {retryText}
        </button>
      )}
    </div>
  );
}