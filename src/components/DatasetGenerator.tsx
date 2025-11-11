'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../utils/api';

interface DatasetGeneratorProps {
  onDataGenerated?: (data: any) => void;
}

export default function DatasetGenerator({ onDataGenerated }: DatasetGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedData, setGeneratedData] = useState<any>(null);

  // Form state
  const [numberOfTransactions, setNumberOfTransactions] = useState(1000);
  const [numberOfItems, setNumberOfItems] = useState(100);
  const [avgItemsPerTransaction, setAvgItemsPerTransaction] = useState(5);
  const [distributionType, setDistributionType] = useState<'uniform' | 'normal' | 'exponential' | 'zipf'>('uniform');
  const [outputFormat, setOutputFormat] = useState<'csv' | 'xlsx' | 'json'>('csv');
  const [exportFormat, setExportFormat] = useState<'transaction_per_row' | 'item_per_row'>('item_per_row');
  const [minItemsPerTransaction, setMinItemsPerTransaction] = useState(1);

  const generateDataset = async () => {
    setIsGenerating(true);

    try {
      const response = await fetch(`${API_BASE_URL}/generate-dataset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          number_of_transactions: numberOfTransactions,
          number_of_items: numberOfItems,
          avg_items_per_transaction: avgItemsPerTransaction,
          distribution_type: distributionType,
          output_format: outputFormat,
            export_format: exportFormat,
            min_items_per_transaction: minItemsPerTransaction,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Dataset generation failed');
      }

      const result = await response.json();
      setGeneratedData(result);
      onDataGenerated?.(result);

      toast.success(`Generated ${result.stats.total_transactions.toLocaleString()} transactions successfully!`);
    } catch (error) {
      toast.error(`Failed to generate dataset: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadDataset = async () => {
    if (!generatedData?.download_url) return;

    try {
      const response = await fetch(`${API_BASE_URL}${generatedData.download_url}`);

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = generatedData.download_url.split('/').pop() || 'dataset.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Dataset downloaded successfully!');
    } catch (error) {
      toast.error('Failed to download dataset');
      console.error('Download error:', error);
    }
  };

  const getDistributionDescription = (type: string) => {
    switch (type) {
      case 'uniform':
        return 'All items have equal probability of appearing';
      case 'normal':
        return 'Some items are more popular than others (bell curve)';
      case 'exponential':
        return 'Few very popular items, many rare items';
      case 'zipf':
        return 'Power law distribution (real-world market basket pattern)';
      default:
        return '';
    }
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">Synthetic Dataset Generator</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Configuration Panel */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Dataset Configuration</h3>

            {/* Number of Transactions */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of Transactions: {numberOfTransactions.toLocaleString()}
              </label>
              <input
                type="range"
                min="100"
                max="100000"
                step="100"
                value={numberOfTransactions}
                onChange={(e) => setNumberOfTransactions(parseInt(e.target.value))}
                className="w-full"
                disabled={isGenerating}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>100</span>
                <span>100,000</span>
              </div>
            </div>

            {/* Number of Items */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of Unique Items: {numberOfItems.toLocaleString()}
              </label>
              <input
                type="range"
                min="10"
                max="1000"
                step="10"
                value={numberOfItems}
                onChange={(e) => setNumberOfItems(parseInt(e.target.value))}
                className="w-full"
                disabled={isGenerating}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>10</span>
                <span>1,000</span>
              </div>
            </div>

            {/* Average Items per Transaction */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Avg Items per Transaction: {avgItemsPerTransaction.toFixed(1)}
              </label>
              <input
                type="range"
                min="1"
                max={Math.min(50, numberOfItems)}
                step="0.5"
                value={avgItemsPerTransaction}
                onChange={(e) => setAvgItemsPerTransaction(parseFloat(e.target.value))}
                className="w-full"
                disabled={isGenerating}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1</span>
                <span>{Math.min(50, numberOfItems)}</span>
              </div>
            </div>

            {/* Minimum Items per Transaction */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Min Items per Transaction: {minItemsPerTransaction}
              </label>
              <input
                type="range"
                min="1"
                max={Math.max(1, Math.min(50, numberOfItems))}
                step="1"
                value={minItemsPerTransaction}
                onChange={(e) => setMinItemsPerTransaction(parseInt(e.target.value))}
                className="w-full"
                disabled={isGenerating}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1</span>
                <span>{Math.max(1, Math.min(50, numberOfItems))}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Ensure generated transactions contain at least this many items (useful to guarantee rules).</p>
            </div>

            {/* Distribution Type */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Distribution Type
              </label>
              <select
                value={distributionType}
                onChange={(e) => setDistributionType(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                disabled={isGenerating}
              >
                <option value="uniform">Uniform</option>
                <option value="normal">Normal</option>
                <option value="exponential">Exponential</option>
                <option value="zipf">Zipf (Power Law)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {getDistributionDescription(distributionType)}
              </p>
            </div>

            {/* Output Format */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Output Format
              </label>
              <select
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                disabled={isGenerating}
              >
                <option value="csv">CSV</option>
                <option value="xlsx">Excel (XLSX)</option>
                <option value="json">JSON</option>
              </select>
            </div>

            {/* Export Format */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Export Format
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="transaction_per_row"
                    checked={exportFormat === 'transaction_per_row'}
                    onChange={(e) => setExportFormat(e.target.value as any)}
                    className="mr-2"
                    disabled={isGenerating}
                  />
                  <span className="text-sm">Transaction per Row</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="item_per_row"
                    checked={exportFormat === 'item_per_row'}
                    onChange={(e) => setExportFormat(e.target.value as any)}
                    className="mr-2"
                    disabled={isGenerating}
                  />
                  <span className="text-sm">Item per Row (recommended)</span>
                </label>
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={generateDataset}
              disabled={isGenerating}
              className="w-full px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isGenerating ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin mr-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Generating Dataset...
                </div>
              ) : (
                'Generate Dataset'
              )}
            </button>
          </div>
        </div>

        {/* Results Panel */}
        <div className="space-y-6">
          {generatedData ? (
            <>
              {/* Statistics */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="text-lg font-semibold mb-4">Dataset Statistics</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-600">Total Transactions:</span>
                    <span className="text-sm">{generatedData.stats.total_transactions.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-600">Unique Items:</span>
                    <span className="text-sm">{generatedData.stats.unique_items.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-600">Avg Items per Transaction:</span>
                    <span className="text-sm">{generatedData.stats.avg_items_per_transaction.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-600">Min Items:</span>
                    <span className="text-sm">{generatedData.stats.min_items}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-600">Max Items:</span>
                    <span className="text-sm">{generatedData.stats.max_items}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-600">Generation Time:</span>
                    <span className="text-sm">{generatedData.stats.generation_time.toFixed(2)}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-600">File Size:</span>
                    <span className="text-sm">{(generatedData.stats.file_size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                </div>

                {/* Download Button */}
                <button
                  onClick={downloadDataset}
                  className="w-full mt-6 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                >
                  Download Dataset ({outputFormat.toUpperCase()})
                </button>
              </div>

              {/* Preview */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="text-lg font-semibold mb-4">Preview (First 10 Transactions)</h3>
                <div className="max-h-64 overflow-y-auto">
                  <pre className="text-xs bg-gray-50 p-3 rounded border">
                    {JSON.stringify(generatedData.preview, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Item Frequencies */}
              {generatedData.item_frequencies && generatedData.item_frequencies.length > 0 && (
                <div className="bg-white p-6 rounded-lg border border-gray-200">
                  <h3 className="text-lg font-semibold mb-4">Top 20 Most Frequent Items</h3>
                  <div className="max-h-64 overflow-y-auto">
                    <div className="space-y-2">
                      {generatedData.item_frequencies.map((item: any, index: number) => (
                        <div key={item.item} className="flex justify-between items-center">
                          <span className="text-sm font-mono">{item.item}</span>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-500">
                              {item.frequency.toLocaleString()} ({(item.support * 100).toFixed(1)}%)
                            </span>
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-primary-600 h-2 rounded-full"
                                style={{ width: `${item.support * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-gray-50 p-8 rounded-lg border border-gray-200 text-center">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-600 mb-2">No Dataset Generated Yet</h3>
              <p className="text-sm text-gray-500">
                Configure the parameters on the left and click "Generate Dataset" to create a synthetic dataset.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-800 mb-3">About Synthetic Dataset Generation</h3>
        <div className="space-y-2 text-sm text-blue-700">
          <p><strong>Distribution Types:</strong></p>
          <ul className="ml-4 list-disc space-y-1">
            <li><strong>Uniform:</strong> All items have equal probability - creates balanced datasets</li>
            <li><strong>Normal:</strong> Bell curve distribution - some items are moderately more popular</li>
            <li><strong>Exponential:</strong> Few very popular items, many rare items - realistic retail pattern</li>
            <li><strong>Zipf:</strong> Power law distribution - follows natural market basket patterns</li>
          </ul>

          <p className="mt-3"><strong>Export Formats:</strong></p>
          <ul className="ml-4 list-disc space-y-1">
            <li><strong>Transaction per Row:</strong> Each row contains all items for one transaction</li>
            <li><strong>Item per Row:</strong> Each row contains one item from one transaction</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
