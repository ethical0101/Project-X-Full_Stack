'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { API_BASE_URL } from '../utils/api';
import { useError, handleApiError } from '@/contexts/ErrorContext';

interface DataUploadProps {
  onDataProcessed: (data: any) => void;
  onProcessingStart?: () => void;
  onProcessingComplete?: () => void;
}

export default function DataUpload({ onDataProcessed, onProcessingStart, onProcessingComplete }: DataUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [minSupport, setMinSupport] = useState(0.01);
  const [minConfidence, setMinConfidence] = useState(0.2);
  const [algorithm, setAlgorithm] = useState<'apriori' | 'fpgrowth' | 'eclat'>('apriori');
  const { handleError, handleSuccess, handleInfo } = useError();

  const validateFile = (file: File): string | null => {
    // Check file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return 'File size exceeds 50MB limit';
    }

    // Check file extension
    const allowedExtensions = ['.csv', '.json', '.xlsx', '.xls'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
      return 'Invalid file format. Please upload CSV, JSON, or Excel files';
    }

    return null;
  };

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    // Handle rejected files
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors.some((error: any) => error.code === 'file-invalid-type')) {
        handleError('Invalid file type. Please upload CSV, JSON, or Excel files');
      } else if (rejection.errors.some((error: any) => error.code === 'file-too-large')) {
        handleError('File too large. Maximum file size is 50MB');
      }
      return;
    }

    const file = acceptedFiles[0];
    if (file) {
      const validationError = validateFile(file);
      if (validationError) {
        handleError(validationError);
        return;
      }

      setUploadedFile(file);
      handleSuccess(`File "${file.name}" uploaded successfully!`);
    }
  }, [handleError, handleSuccess]);

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
      handleError('Please upload a file first');
      return;
    }

    // Validate parameters
    if (minSupport < 0.01 || minSupport > 0.5) {
      handleError('Minimum support must be between 1% and 50%');
      return;
    }
    if (minConfidence < 0.1 || minConfidence > 1.0) {
      handleError('Minimum confidence must be between 10% and 100%');
      return;
    }

    setIsProcessing(true);
    onProcessingStart?.(); // Notify parent that processing started
    handleInfo(`Processing file: ${uploadedFile.name}`);

    try {
      // Step 1: Upload the file
      const formData = new FormData();
      formData.append('file', uploadedFile);

      const uploadResponse = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw handleApiError(uploadResponse, 'File Upload');
      }

      const uploadResult = await uploadResponse.json();

      const uploadStats = uploadResult.stats || uploadResult.statistics || {};
      const totalTransactions = uploadStats.total_transactions
        ?? uploadStats.totalTransactions
        ?? uploadStats.transaction_count
        ?? uploadStats.total
        ?? 0;
      let uniqueItems = uploadStats.unique_items
        ?? uploadStats.uniqueItems
        ?? uploadStats.unique
        ?? uploadStats.columns
        ?? 0;

      // Dynamically relax parameters for sparse, large datasets
      let supportToUse = minSupport;
      let confidenceToUse = minConfidence;
      let algorithmToUse: 'apriori' | 'fpgrowth' | 'eclat' = algorithm;

      if (totalTransactions && totalTransactions > 0) {
        const heuristicSupport = Math.max(0.01, Math.min(0.1, (30 / totalTransactions)));
        if (heuristicSupport < supportToUse) {
          const roundedSupport = parseFloat(heuristicSupport.toFixed(3));
          supportToUse = roundedSupport;
          setMinSupport(roundedSupport);
          handleInfo(`Auto-adjusted minimum support to ${(roundedSupport * 100).toFixed(2)}% for better pattern discovery.`);
        }
      }

      if (confidenceToUse > 0.2 && supportToUse <= 0.01) {
        confidenceToUse = 0.15;
        setMinConfidence(0.15);
        handleInfo('Auto-adjusted minimum confidence to 15% to surface more rules.');
      }

      if (totalTransactions > 20000 && algorithm === 'apriori') {
        algorithmToUse = 'fpgrowth';
        setAlgorithm('fpgrowth');
        handleInfo('Switched to FP-Growth for improved performance on large datasets.');
      }

      // Step 2: Mine patterns with specified parameters
      handleInfo(`Mining patterns using ${algorithmToUse} algorithm...`);
      const miningResponse = await fetch(`${API_BASE_URL}/mine`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          min_support: supportToUse,
          min_confidence: confidenceToUse,
          algorithm: algorithmToUse
        }),
      });

      if (!miningResponse.ok) {
        throw handleApiError(miningResponse, 'Pattern Mining');
      }

      const miningResult = await miningResponse.json();

      // Step 3: Fetch analytics (if supported) to enrich the dataset
      let analyticsResult: any = null;
      try {
        const analyticsResponse = await fetch(`${API_BASE_URL}/analytics`);
        if (analyticsResponse.ok) {
          analyticsResult = await analyticsResponse.json();
        }
      } catch (analyticsError) {
        console.warn('Analytics endpoint not available:', analyticsError);
      }

      const frequentItemsets = miningResult.frequent_itemsets || miningResult.itemsets || [];
      const associationRules = miningResult.association_rules || miningResult.rules || [];

      if (!uniqueItems && Array.isArray(analyticsResult?.analytics?.top_items)) {
        uniqueItems = analyticsResult.analytics.top_items.length;
      }
      const avgItems = uploadStats.avg_items_per_transaction
        ?? uploadStats.average_items_per_transaction
        ?? uploadStats.avg_items
        ?? uploadStats.avgItems
        ?? 0;

      const itemFrequenciesFromUpload = uploadResult.item_frequencies || uploadResult.itemFrequencies;
      let itemFrequencies = Array.isArray(itemFrequenciesFromUpload) ? itemFrequenciesFromUpload : [];

      if (!itemFrequencies.length && analyticsResult?.item_frequencies) {
        itemFrequencies = analyticsResult.item_frequencies;
      }

      if (!itemFrequencies.length && Array.isArray(analyticsResult?.analytics?.top_items)) {
        const topItems = analyticsResult.analytics.top_items;
        itemFrequencies = topItems.map((item: any) => ({
          item: item.item || item.name,
          frequency: item.frequency || item.count || 0,
          support: totalTransactions ? (item.frequency || item.count || 0) / totalTransactions : 0
        }));
      }

      const calculateAverage = (values: number[]) => values.length ? values.reduce((acc, val) => acc + val, 0) / values.length : null;

      const confidences = associationRules.map((rule: any) => rule.confidence || 0);
      const lifts = associationRules.map((rule: any) => rule.lift || 0);
      const coverages = associationRules.map((rule: any) => rule.support || 0);

      const avgConfidence = calculateAverage(confidences);
      const avgLift = calculateAverage(lifts);
      const avgSupport = calculateAverage(coverages);
      const ruleDiversity = associationRules.length
        ? new Set(associationRules.map((rule: any) => Array.isArray(rule.antecedents)
            ? rule.antecedents.join('||')
            : String(rule.antecedents || '')
        )).size / associationRules.length
        : null;
      const ruleCoverage = totalTransactions
        ? (associationRules.length / totalTransactions) * 100
        : null;

      const performanceComparison = analyticsResult?.analytics?.performance_comparison;
      const aprioriTime = miningResult.performance?.apriori_time
        ?? performanceComparison?.apriori?.execution_time
        ?? performanceComparison?.Apriori?.execution_time
        ?? null;
      const fpgrowthTime = miningResult.performance?.fpgrowth_time
        ?? performanceComparison?.fpgrowth?.execution_time
        ?? performanceComparison?.FPGrowth?.execution_time
        ?? null;
      const miningTime = miningResult.performance?.mining_time
        ?? miningResult.performance?.execution_time
        ?? aprioriTime
        ?? null;
      const speedup = miningResult.performance?.speedup
        ?? (aprioriTime && fpgrowthTime ? (aprioriTime / fpgrowthTime) : null);

      const qualityMetrics = {
        ...(miningResult.quality_metrics || {}),
        ...(analyticsResult?.quality_metrics || {}),
        avg_confidence: avgConfidence ?? miningResult.quality_metrics?.avg_confidence,
        avg_lift: avgLift ?? miningResult.quality_metrics?.avg_lift,
        avg_support: avgSupport ?? miningResult.quality_metrics?.avg_support,
        rule_diversity: ruleDiversity ?? miningResult.quality_metrics?.rule_diversity,
        rule_coverage: ruleCoverage ?? miningResult.quality_metrics?.rule_coverage
      };

      const performance = {
        ...(miningResult.performance || {}),
        algorithm: algorithmToUse,
        min_support: supportToUse,
        min_confidence: confidenceToUse,
        apriori_time: aprioriTime,
        fpgrowth_time: fpgrowthTime,
        mining_time: miningTime,
        speedup: speedup
      };

      const combinedResult = {
        ...uploadResult,
        ...miningResult,
        analytics: analyticsResult || null,
        stats: {
          ...uploadStats,
          total_transactions: totalTransactions,
          unique_items: uniqueItems,
          avg_items_per_transaction: avgItems,
          avg_items: avgItems
        },
        summary: {
          transaction_count: totalTransactions,
          unique_items: uniqueItems,
          avg_items: avgItems
        },
        frequent_itemsets: frequentItemsets,
        itemsets: frequentItemsets,
        association_rules: associationRules,
        rules: associationRules,
        item_frequencies: itemFrequencies,
        performance,
        metrics: qualityMetrics,
        quality_metrics: qualityMetrics
      };

      console.log('Mining result:', miningResult);
      console.log('Analytics result:', analyticsResult);
      console.log('Combined result:', combinedResult);

      onDataProcessed(combinedResult);
      handleSuccess(`Successfully processed ${combinedResult.summary?.transaction_count || 0} transactions and found ${combinedResult.association_rules?.length || 0} association rules!`);
    } catch (error) {
  const normalizedError = error instanceof Error ? error : new Error(String(error));
  handleError(normalizedError, 'Data Processing');
  console.error('Error:', normalizedError);
    } finally {
      setIsProcessing(false);
      onProcessingComplete?.();
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
              <label htmlFor="minSupport" className="block text-sm font-medium text-gray-700 mb-1">
                Min Support ({(minSupport * 100).toFixed(1)}%)
              </label>
              <input
                id="minSupport"
                type="range"
                min="0.001"
                max="0.5"
                step="0.001"
                value={minSupport}
                onChange={(e) => setMinSupport(parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="text-xs text-gray-500 mt-1">Lower = more patterns</div>
            </div>
            <div>
              <label htmlFor="minConfidence" className="block text-sm font-medium text-gray-700 mb-1">
                Min Confidence ({(minConfidence * 100).toFixed(1)}%)
              </label>
              <input
                id="minConfidence"
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
              <label htmlFor="miningAlgorithm" className="block text-sm font-medium text-gray-700 mb-1">
                Algorithm
              </label>
              <select
                id="miningAlgorithm"
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
