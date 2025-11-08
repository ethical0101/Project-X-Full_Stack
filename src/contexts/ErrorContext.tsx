'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import toast, { Toaster } from 'react-hot-toast';

interface ErrorContextType {
  handleError: (error: Error | string, title?: string) => void;
  handleSuccess: (message: string) => void;
  handleInfo: (message: string) => void;
  clearAll: () => void;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export const useError = () => {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
};

interface ErrorProviderProps {
  children: React.ReactNode;
}

export const ErrorProvider: React.FC<ErrorProviderProps> = ({ children }) => {
  const handleError = useCallback((error: Error | string, title?: string) => {
    const message = error instanceof Error ? error.message : error;
    console.error('Application Error:', title || 'Error', message);

    if (title) {
      toast.error(`${title}: ${message}`, {
        duration: 5000,
        position: 'top-right',
        style: {
          background: '#ef4444',
          color: '#ffffff',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '14px',
          maxWidth: '500px',
        },
      });
    } else {
      toast.error(message, {
        duration: 4000,
        position: 'top-right',
        style: {
          background: '#ef4444',
          color: '#ffffff',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '14px',
          maxWidth: '500px',
        },
      });
    }
  }, []);

  const handleSuccess = useCallback((message: string) => {
    console.log('Success:', message);
    toast.success(message, {
      duration: 3000,
      position: 'top-right',
      style: {
        background: '#10b981',
        color: '#ffffff',
        padding: '12px 16px',
        borderRadius: '8px',
        fontSize: '14px',
        maxWidth: '500px',
      },
    });
  }, []);

  const handleInfo = useCallback((message: string) => {
    console.log('Info:', message);
    toast(message, {
      duration: 3000,
      position: 'top-right',
      icon: 'ℹ️',
      style: {
        background: '#3b82f6',
        color: '#ffffff',
        padding: '12px 16px',
        borderRadius: '8px',
        fontSize: '14px',
        maxWidth: '500px',
      },
    });
  }, []);

  const clearAll = useCallback(() => {
    toast.dismiss();
  }, []);

  return (
    <ErrorContext.Provider value={{ handleError, handleSuccess, handleInfo, clearAll }}>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1f2937',
            color: '#ffffff',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            maxWidth: '500px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#ffffff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#ffffff',
            },
          },
        }}
      />
    </ErrorContext.Provider>
  );
};

// API error handling utility
export const handleApiError = (error: any, context?: string) => {
  if (error.response) {
    // HTTP error response
    const status = error.response.status;
    const data = error.response.data;

    switch (status) {
      case 400:
        return new Error(data?.error || 'Invalid request. Please check your input.');
      case 401:
        return new Error('Unauthorized. Please log in again.');
      case 403:
        return new Error('Access forbidden. You don\'t have permission to perform this action.');
      case 404:
        return new Error(data?.error || 'Resource not found.');
      case 413:
        return new Error('File too large. Please upload a smaller file.');
      case 422:
        return new Error(data?.error || 'Invalid data format.');
      case 429:
        return new Error('Too many requests. Please wait a moment and try again.');
      case 500:
        return new Error('Server error. Please try again later.');
      default:
        return new Error(data?.error || `Request failed with status ${status}`);
    }
  } else if (error.request) {
    // Network error
    return new Error('Network error. Please check your connection and try again.');
  } else {
    // Other error
    return new Error(error.message || 'An unexpected error occurred');
  }
};