'use client';

import React from 'react';

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export default function ResponsiveLayout({
  children,
  title,
  description,
  maxWidth = 'xl'
}: ResponsiveLayoutProps) {
  const maxWidthClasses = {
    sm: 'max-w-2xl',
    md: 'max-w-4xl',
    lg: 'max-w-6xl',
    xl: 'max-w-7xl',
    full: 'max-w-full'
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className={`container mx-auto px-4 sm:px-6 lg:px-8 py-8 ${maxWidthClasses[maxWidth]}`}>
        {/* Header */}
        {(title || description) && (
          <div className="mb-8 text-center sm:text-left">
            {title && (
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
                {title}
              </h1>
            )}
            {description && (
              <p className="text-gray-600 text-sm sm:text-base lg:text-lg">
                {description}
              </p>
            )}
          </div>
        )}

        {/* Content */}
        <div className="space-y-8">
          {children}
        </div>
      </div>
    </div>
  );
}

// Responsive grid component
interface ResponsiveGridProps {
  children: React.ReactNode;
  cols?: 1 | 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
}

export function ResponsiveGrid({ children, cols = 1, gap = 'md' }: ResponsiveGridProps) {
  const gridClasses = {
    cols: {
      1: 'grid-cols-1',
      2: 'grid-cols-1 md:grid-cols-2',
      3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
    },
    gap: {
      sm: 'gap-2 sm:gap-3',
      md: 'gap-4 sm:gap-6',
      lg: 'gap-6 sm:gap-8'
    }
  };

  return (
    <div className={`grid ${gridClasses.cols[cols]} ${gridClasses.gap[gap]}`}>
      {children}
    </div>
  );
}

// Responsive card component
interface ResponsiveCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  clickable?: boolean;
  onClick?: () => void;
}

export function ResponsiveCard({
  children,
  className = '',
  hover = false,
  clickable = false,
  onClick
}: ResponsiveCardProps) {
  const baseClasses = 'bg-white rounded-lg shadow-md border border-gray-200 p-4 sm:p-6';
  const hoverClasses = hover ? 'transition-all duration-200 hover:shadow-lg hover:border-gray-300' : '';
  const clickableClasses = clickable ? 'cursor-pointer' : '';

  return (
    <div
      className={`${baseClasses} ${hoverClasses} ${clickableClasses} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// Responsive stats card
interface StatsCardProps {
  title: string;
  value: string | number;
  icon?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'pink';
  trend?: {
    value: string;
    positive: boolean;
  };
}

export function StatsCard({ title, value, icon, color = 'blue', trend }: StatsCardProps) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    yellow: 'from-yellow-500 to-yellow-600',
    red: 'from-red-500 to-red-600',
    purple: 'from-purple-500 to-purple-600',
    pink: 'from-pink-500 to-pink-600'
  };

  return (
    <div className={`bg-gradient-to-r ${colorClasses[color]} text-white p-4 sm:p-6 rounded-lg shadow-lg`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-2xl sm:text-3xl opacity-80">{icon || '📊'}</div>
        {trend && (
          <div className={`text-xs bg-white bg-opacity-20 px-2 py-1 rounded ${
            trend.positive ? 'text-green-100' : 'text-red-100'
          }`}>
            {trend.value}
          </div>
        )}
      </div>
      <div className="text-sm sm:text-base opacity-90">{title}</div>
      <div className="text-xl sm:text-2xl lg:text-3xl font-bold">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  );
}