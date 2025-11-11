'use client';

import { useState } from 'react';
import DataUpload from '@/components/DataUpload';
import DatasetGenerator from '@/components/DatasetGenerator';
import Dashboard from '@/components/Dashboard';
import Analytics from '@/components/Analytics';
import Visualizations from '@/components/Visualizations';
import ConceptLatticeAnalysis from '@/components/ConceptLatticeAnalysis';
import ProgressIndicator from '@/components/ProgressIndicator';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'upload' | 'generator' | 'dashboard' | 'analytics' | 'visualizations' | 'lattice'>('upload');
  const [data, setData] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDataProcessed = (processedData: any) => {
    setData(processedData);
    setIsProcessing(false);
  };

  const handleProcessingStart = () => {
    setIsProcessing(true);
  };

  const handleProcessingComplete = () => {
    setIsProcessing(false);
  };

  const tabs = [
    { id: 'upload', name: 'Data Upload', icon: '📁' },
    { id: 'generator', name: 'Dataset Generator', icon: '🎲' },
    { id: 'dashboard', name: 'Dashboard', icon: '📊' },
    { id: 'analytics', name: 'Analytics', icon: '🔍' },
    { id: 'visualizations', name: 'Visualizations', icon: '📈' },
    { id: 'lattice', name: 'Concept Lattice', icon: '🕸️' },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 mb-8">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-6 py-3 border-b-2 font-medium text-sm ${
              activeTab === tab.id
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.name}
          </button>
        ))}
      </div>

      {/* Progress Indicator */}
      {(activeTab === 'upload' || activeTab === 'dashboard') && (
        <ProgressIndicator data={data} isProcessing={isProcessing} />
      )}

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow-sm border">
        {activeTab === 'upload' && (
          <DataUpload
            onDataProcessed={handleDataProcessed}
            onProcessingStart={handleProcessingStart}
            onProcessingComplete={handleProcessingComplete}
          />
        )}
        {activeTab === 'generator' && (
          <DatasetGenerator onDataGenerated={setData} />
        )}
        {activeTab === 'dashboard' && (
          <Dashboard data={data} />
        )}
        {activeTab === 'analytics' && (
          <Analytics data={data} />
        )}
        {activeTab === 'visualizations' && (
          <Visualizations data={data} />
        )}
        {activeTab === 'lattice' && (
          <ConceptLatticeAnalysis />
        )}
      </div>
    </div>
  );
}
