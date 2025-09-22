'use client';

import { useState, useEffect } from 'react';

interface ProcessingStatus {
  upload: boolean;
  mining: boolean;
  analysis: boolean;
  visualization: boolean;
}

interface ProgressIndicatorProps {
  data: any;
  isProcessing: boolean;
}

export default function ProgressIndicator({ data, isProcessing }: ProgressIndicatorProps) {
  const [status, setStatus] = useState<ProcessingStatus>({
    upload: false,
    mining: false,
    analysis: false,
    visualization: false
  });

  useEffect(() => {
    if (data) {
      setStatus({
        upload: !!data.stats,
        mining: !!(data.frequent_itemsets && data.frequent_itemsets.length > 0),
        analysis: !!data.quality_metrics,
        visualization: !!(data.frequent_itemsets && data.association_rules)
      });
    }
  }, [data]);

  const steps = [
    {
      id: 'upload',
      name: 'Data Upload',
      description: 'Processing transaction file',
      icon: '📁',
      completed: status.upload
    },
    {
      id: 'mining',
      name: 'Pattern Mining',
      description: 'Finding frequent itemsets',
      icon: '⛏️',
      completed: status.mining
    },
    {
      id: 'analysis',
      name: 'Rule Analysis',
      description: 'Generating association rules',
      icon: '🔍',
      completed: status.analysis
    },
    {
      id: 'visualization',
      name: 'Visualization',
      description: 'Preparing charts and graphs',
      icon: '📊',
      completed: status.visualization
    }
  ];

  const completedSteps = steps.filter(step => step.completed).length;
  const progressPercentage = (completedSteps / steps.length) * 100;

  if (!data && !isProcessing) {
    return null;
  }

  return (
    <div className="mb-6 p-6 bg-white rounded-lg shadow border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Processing Progress</h3>
        <div className="flex items-center space-x-2">
          {isProcessing ? (
            <>
              <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              <span className="text-blue-600 font-medium">Processing...</span>
            </>
          ) : (
            <span className="text-green-600 font-medium">
              {completedSteps === steps.length ? '✅ Complete' : `${completedSteps}/${steps.length} Steps`}
            </span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Progress</span>
          <span>{Math.round(progressPercentage)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`bg-blue-500 h-2 rounded-full transition-all duration-500 ease-out`}
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
      </div>

      {/* Steps */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`p-4 rounded-lg border-2 transition-all duration-300 ${
              step.completed
                ? 'border-green-500 bg-green-50'
                : isProcessing && index === completedSteps
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 bg-gray-50'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className={`text-2xl ${
                step.completed ? 'grayscale-0' : 'grayscale'
              }`}>
                {step.icon}
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">{step.name}</div>
                <div className="text-sm text-gray-600">{step.description}</div>
              </div>
              <div className="flex-shrink-0">
                {step.completed ? (
                  <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                ) : isProcessing && index === completedSteps ? (
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <div className="w-6 h-6 bg-gray-300 rounded-full"></div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Data Summary */}
      {data && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="font-medium text-gray-900 mb-3">Results Summary</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-blue-600 font-medium">Transactions</div>
              <div className="text-2xl font-bold text-blue-800">
                {data.stats?.total_transactions || 0}
              </div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="text-green-600 font-medium">Unique Items</div>
              <div className="text-2xl font-bold text-green-800">
                {data.stats?.unique_items || 0}
              </div>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg">
              <div className="text-purple-600 font-medium">Itemsets</div>
              <div className="text-2xl font-bold text-purple-800">
                {data.frequent_itemsets?.length || 0}
              </div>
            </div>
            <div className="bg-orange-50 p-3 rounded-lg">
              <div className="text-orange-600 font-medium">Rules</div>
              <div className="text-2xl font-bold text-orange-800">
                {data.association_rules?.length || 0}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
