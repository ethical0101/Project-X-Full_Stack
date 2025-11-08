'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { API_BASE_URL } from '../utils/api';
import { useError, handleApiError } from '@/contexts/ErrorContext';

interface DataUploadProps {
  onDataProcessed: (data: any) => void;
  onProcessingStart?: () => void;
}

export default function DataUpload({ onDataProcessed, onProcessingStart }: DataUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [minSupport, setMinSupport] = useState(0.05);
  const [minConfidence, setMinConfidence] = useState(0.3);
  const [algorithm, setAlgorithm] = useState<'apriori' | 'fpgrowth' | 'eclat'>('apriori');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setUploadedFile(file);
      toast.success('File uploaded successfully!');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/json': ['.json'],
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    multiple: false,
  });

  const processData = async () => {
    if (!uploadedFile) {
      toast.error('Please upload a file first');
      return;
    }

    setIsProcessing(true);
    onProcessingStart?.(); // Notify parent that processing started
    try {
      // Step 1: Upload the file
      const formData = new FormData();
      formData.append('file', uploadedFile);

      const uploadResponse = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const uploadResult = await uploadResponse.json();

      // Step 2: Mine patterns with default parameters
      const miningResponse = await fetch(`${API_BASE_URL}/mine`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          min_support: minSupport,
          min_confidence: minConfidence,
          algorithm: algorithm
        }),
      });

      if (!miningResponse.ok) {
        const errorData = await miningResponse.json();
        throw new Error(errorData.error || 'Mining failed');
      }

      const miningResult = await miningResponse.json();

      // Combine upload and mining results
      const combinedResult = {
        ...uploadResult,
        ...miningResult,
        summary: {
          transaction_count: uploadResult.stats?.total_transactions || 0,
          unique_items: uploadResult.stats?.unique_items || 0,
          avg_items: uploadResult.stats?.avg_items_per_transaction || 0,
        },
        frequent_itemsets: miningResult.frequent_itemsets || [],
        association_rules: miningResult.association_rules || [], // Backend returns association_rules
        rules: miningResult.association_rules || [], // Keep both for compatibility
        performance: miningResult.performance || {},
        quality_metrics: miningResult.quality_metrics || {}
      };

      console.log('Mining result:', miningResult);
      console.log('Combined result:', combinedResult);
      console.log('Association rules count:', combinedResult.association_rules?.length);

      onDataProcessed(combinedResult);
      toast.success('Data processed and patterns mined successfully!');
    } catch (error) {
      toast.error(`Failed to process data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">Upload Transaction Data</h2>

      {/* File Upload Zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input {...getInputProps()} />
        <div className="mb-4">
          <svg
            className="w-12 h-12 mx-auto text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>
        {isDragActive ? (
          <p className="text-primary-600 font-medium">Drop the file here...</p>
        ) : (
          <div>
            <p className="text-gray-600 font-medium mb-2">
              Drag and drop a transaction file here, or click to select
            </p>
            <p className="text-sm text-gray-500">
              Supports JSON, CSV, and Excel files
            </p>
          </div>
        )}
      </div>

      {/* Uploaded File Info */}
      {uploadedFile && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-green-800">File uploaded:</p>
              <p className="text-sm text-green-600">{uploadedFile.name}</p>
              <p className="text-xs text-green-500">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
            </div>
            <button
              onClick={processData}
              disabled={isProcessing}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <div className="flex items-center">
                  <div className="animate-spin mr-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Processing...
                </div>
              ) : (
                'Process Data'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Mining Parameters */}
      {uploadedFile && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-medium text-blue-800 mb-4">Mining Parameters</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Support ({(minSupport * 100).toFixed(1)}%)
              </label>
              <input
                type="range"
                min="0.01"
                max="0.5"
                step="0.01"
                value={minSupport}
                onChange={(e) => setMinSupport(parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="text-xs text-gray-500 mt-1">Lower = more patterns</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Confidence ({(minConfidence * 100).toFixed(1)}%)
              </label>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={minConfidence}
                onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="text-xs text-gray-500 mt-1">Higher = stronger rules</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Algorithm
              </label>
              <select
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value as 'apriori' | 'fpgrowth' | 'eclat')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="apriori">Apriori</option>
                <option value="fpgrowth">FP-Growth</option>
                <option value="eclat">ECLAT</option>
              </select>
              <div className="text-xs text-gray-500 mt-1">FP-Growth and ECLAT are faster</div>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-800 mb-3">Data Format Instructions</h3>
        <div className="space-y-2 text-sm text-blue-700">
          <p><strong>JSON Format:</strong> Array of transactions, each containing an array of items</p>
          <pre className="bg-blue-100 p-2 rounded text-xs">
{`[
  ["milk", "bread", "apple"],
  ["rice", "oil", "beans"],
  ["milk", "eggs", "cheese"]
]`}
          </pre>
          <p><strong>CSV Format:</strong> transaction_id, item columns</p>
          <pre className="bg-blue-100 p-2 rounded text-xs">
{`transaction_id,item
1,milk
1,bread
2,rice`}
          </pre>
          <p><strong>Excel Format:</strong> transaction_id and item columns, or one transaction per row</p>
          <pre className="bg-blue-100 p-2 rounded text-xs">
{`transaction_id,item
1,milk
1,bread
2,rice`}
          </pre>
        </div>
      </div>
    </div>
  );
}
