'use client';

import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
  Legend
} from 'recharts';
import { API_BASE_URL } from '../utils/api';

interface DashboardProps {
  data: any;
}

interface StatusData {
  processing: {
    is_processing: boolean;
    current_step: string;
    progress: number;
    total_steps: number;
    started_at: string | null;
    estimated_completion: number | null;
  };
  data_status: {
    has_data: boolean;
    has_itemsets: boolean;
    has_rules: boolean;
    itemsets_count: number;
    rules_count: number;
  };
  timestamp: string;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function Dashboard({ data }: DashboardProps) {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Poll status updates
  useEffect(() => {
    if (status?.processing?.is_processing && !isPolling) {
      setIsPolling(true);
      const interval = setInterval(async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/status`);
          if (response.ok) {
            const statusData = await response.json();
            setStatus(statusData);

            // Stop polling if processing is complete
            if (!statusData.processing.is_processing) {
              setIsPolling(false);
              clearInterval(interval);
            }
          }
        } catch (error) {
          console.error('Error polling status:', error);
        }
      }, 1000); // Poll every second

      return () => clearInterval(interval);
    }
  }, [status?.processing?.is_processing, isPolling]);

  // Initial status fetch
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/status`);
        if (response.ok) {
          const statusData = await response.json();
          setStatus(statusData);
        }
      } catch (error) {
        console.error('Error fetching status:', error);
      }
    };
    fetchStatus();
  }, []);

  console.log('Dashboard received data:', data);

  if (!data) {
    return (
      <div className="p-8 text-center">
        <div className="text-gray-400 mb-4">
          <svg
            className="w-16 h-16 mx-auto"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-600 mb-2">No Data Available</h3>
        <p className="text-gray-500">Please upload and process data first to view the dashboard.</p>
      </div>
    );
  }

  // Processing progress indicator
  const renderProgressIndicator = () => {
    if (!status?.processing?.is_processing) return null;

    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4">Processing Data...</h3>
        <div className="space-y-4">
          <div className="flex justify-between text-sm text-gray-600">
            <span>{status.processing.current_step}</span>
            <span>{status.processing.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${status.processing.progress}%` }}
            ></div>
          </div>
          {status.processing.estimated_completion && (
            <div className="text-xs text-gray-500">
              Estimated completion: {new Date(status.processing.estimated_completion * 1000).toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Enhanced summary cards with better styling
  const renderSummaryCards = () => {
    const cards = [
      {
        title: "Total Transactions",
        value: data.summary?.transaction_count || 0,
        icon: "📊",
        color: "from-blue-500 to-blue-600",
        trend: null
      },
      {
        title: "Unique Items",
        value: data.summary?.unique_items || 0,
        icon: "🛍️",
        color: "from-green-500 to-green-600",
        trend: null
      },
      {
        title: "Frequent Itemsets",
        value: data.frequent_itemsets?.length || 0,
        icon: "📈",
        color: "from-purple-500 to-purple-600",
        trend: status?.data_status?.itemsets_count || 0
      },
      {
        title: "Association Rules",
        value: data.association_rules?.length || data.rules?.length || 0,
        icon: "🔗",
        color: "from-orange-500 to-orange-600",
        trend: status?.data_status?.rules_count || 0
      }
    ];

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {cards.map((card, index) => (
          <div key={index} className={`bg-gradient-to-r ${card.color} text-white p-6 rounded-lg shadow-lg transform transition-transform hover:scale-105`}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-2xl opacity-80">{card.icon}</div>
              {card.trend !== null && card.trend > 0 && (
                <div className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded">
                  Processing...
                </div>
              )}
            </div>
            <div className="text-sm opacity-90">{card.title}</div>
            <div className="text-3xl font-bold">{card.value.toLocaleString()}</div>
          </div>
        ))}
      </div>
    );
  };

  // Enhanced frequent itemsets visualization
  const renderItemsetsChart = () => {
    const itemsetsData = data.frequent_itemsets?.slice(0, 20).map((itemset: any, index: number) => ({
      name: `Set ${index + 1}`,
      items: Array.isArray(itemset.itemset) ? itemset.itemset.join(', ') : itemset.itemset,
      support: (itemset.support || 0) * 100,
      length: Array.isArray(itemset.itemset) ? itemset.itemset.length : 1,
      frequency: itemset.support || 0
    })) || [];

    // Top items frequency
    const itemFrequency: { [key: string]: number } = {};
    data.frequent_itemsets?.forEach((itemset: any) => {
      const items = Array.isArray(itemset.itemset) ? itemset.itemset : [itemset.itemset];
      items.forEach((item: string) => {
        itemFrequency[item] = Math.max(itemFrequency[item] || 0, itemset.support || 0);
      });
    });

    const topItemsData = Object.entries(itemFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([name, frequency]) => ({ name, frequency: frequency * 100 }));

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md border">
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-semibold">Top Frequent Itemsets</h3>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={itemsetsData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  interval={0}
                  tick={{ fontSize: 10 }}
                />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(value: any, name: any) => [
                    `${typeof value === 'number' ? value.toFixed(2) : value}%`,
                    name === 'support' ? 'Support' : name
                  ]}
                  labelFormatter={(label) => itemsetsData.find(d => d.name === label)?.items || label}
                />
                <Bar dataKey="support" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md border">
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-semibold">Most Frequent Items</h3>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topItemsData} layout="horizontal" margin={{ top: 20, right: 30, left: 60, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" width={50} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value: any) => [`${(value * 100).toFixed(2)}%`, 'Support']} />
                <Bar dataKey="frequency" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  };

  // Enhanced association rules visualization
  const renderRulesChart = () => {
    const rulesData = data.association_rules || data.rules || [];

    // Rule quality distribution
    const ruleQualityData = rulesData.slice(0, 15).map((rule: any, index: number) => ({
      name: `R${index + 1}`,
      confidence: (rule.confidence || 0) * 100,
      lift: rule.lift || 0,
      support: (rule.support || 0) * 100,
      conviction: rule.conviction || 0,
      leverage: rule.leverage || 0
    }));

    // Confidence distribution histogram
    const confidenceRanges = [
      { range: '0-20%', count: 0 },
      { range: '20-40%', count: 0 },
      { range: '40-60%', count: 0 },
      { range: '60-80%', count: 0 },
      { range: '80-100%', count: 0 }
    ];

    rulesData.forEach((rule: any) => {
      const confidence = rule.confidence || 0;
      if (confidence <= 0.2) confidenceRanges[0].count++;
      else if (confidence <= 0.4) confidenceRanges[1].count++;
      else if (confidence <= 0.6) confidenceRanges[2].count++;
      else if (confidence <= 0.8) confidenceRanges[3].count++;
      else confidenceRanges[4].count++;
    });

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md border">
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-semibold">Rule Quality Analysis</h3>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={ruleQualityData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value: any, name: any) => [
                  typeof value === 'number' ? value.toFixed(2) : value,
                  name
                ]} />
                <Legend />
                <Line type="monotone" dataKey="confidence" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="lift" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="support" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md border">
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-semibold">Confidence Distribution</h3>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={confidenceRanges}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                  label={({ range, count, percent }) => `${range}: ${count} (${(percent * 100).toFixed(0)}%)`}
                >
                  {confidenceRanges.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  };

  // Enhanced rules table with better formatting
  const renderRulesTable = () => {
    const rulesData = data.association_rules || data.rules || [];

    return (
      <div className="bg-white rounded-lg shadow border">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h3 className="text-lg font-semibold">Association Rules</h3>
          <div className="text-sm text-gray-500">
            Showing {Math.min(rulesData.length, 10)} of {rulesData.length} rules
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Antecedent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Consequent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Support
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Confidence
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lift
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rulesData.slice(0, 10).map((rule: any, index: number) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {index + 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {Array.isArray(rule.antecedents)
                        ? rule.antecedents.map((ant: string, i: number) => (
                            <span key={i} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                              {ant}
                            </span>
                          ))
                        : rule.antecedents && (
                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                            {rule.antecedents}
                          </span>
                        )
                      }
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {Array.isArray(rule.consequents)
                        ? rule.consequents.map((cons: string, i: number) => (
                            <span key={i} className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                              {cons}
                            </span>
                          ))
                        : rule.consequents && (
                          <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                            {rule.consequents}
                          </span>
                        )
                      }
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {((rule.support || 0) * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      rule.confidence >= 0.8
                        ? 'bg-green-100 text-green-800'
                        : rule.confidence >= 0.6
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {((rule.confidence || 0) * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      rule.lift > 1.5
                        ? 'bg-purple-100 text-purple-800'
                        : rule.lift > 1.0
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {rule.lift?.toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Mining Results Dashboard</h2>
        <p className="text-gray-600">Real-time analysis of frequent patterns and association rules</p>
      </div>

      {renderProgressIndicator()}
      {renderSummaryCards()}
      {renderItemsetsChart()}
      {renderRulesChart()}
      {renderRulesTable()}
    </div>
  );
}