'use client';

import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Treemap,
  AreaChart,
  Area,
  ComposedChart,
  ReferenceLine
} from 'recharts';

interface VisualizationsProps {
  data: any;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C'];

export default function Visualizations({ data }: VisualizationsProps) {
  const [selectedVisualization, setSelectedVisualization] = useState('support-lift');

  if (!data || !data.frequent_itemsets || !data.association_rules) {
    return (
      <div className="p-8 text-center">
        <div className="text-gray-400 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-600 mb-2">No Visualization Data</h3>
        <p className="text-gray-500">Please upload and process data first to view visualizations.</p>
      </div>
    );
  }

  // Prepare data for various visualizations
  const supportLiftData = data.association_rules?.map((rule: any, index: number) => ({
    name: `Rule ${index + 1}`,
    support: rule.support,
    lift: rule.lift,
    confidence: rule.confidence,
    antecedents: JSON.stringify(rule.antecedents),
    consequents: JSON.stringify(rule.consequents)
  })) || [];

  const itemFrequencyData = data.item_frequencies?.slice(0, 15).map((item: any) => ({
    name: item.item,
    frequency: item.frequency,
    support: item.support * 100
  })) || [];

  const confidenceDistribution = data.association_rules?.map((rule: any, index: number) => ({
    name: `Rule ${index + 1}`,
    confidence: rule.confidence * 100,
    lift: rule.lift
  })) || [];

  const itemsetLengthData = data.frequent_itemsets?.reduce((acc: any, itemset: any) => {
    const length = itemset.length;
    acc[length] = (acc[length] || 0) + 1;
    return acc;
  }, {});

  const itemsetLengthChartData = Object.entries(itemsetLengthData || {}).map(([length, count]) => ({
    length: `${length} items`,
    count: count
  }));

  const radarData = data.quality_metrics ? [
    {
      metric: 'Avg Confidence',
      value: (data.quality_metrics.avg_confidence || 0) * 100,
      fullMark: 100
    },
    {
      metric: 'Avg Lift',
      value: Math.min((data.quality_metrics.avg_lift || 0) * 50, 100),
      fullMark: 100
    },
    {
      metric: 'Rule Diversity',
      value: (data.quality_metrics.rule_diversity || 0) * 100,
      fullMark: 100
    },
    {
      metric: 'Coverage',
      value: data.metrics?.rule_coverage || 0,
      fullMark: 100
    }
  ] : [];

  const visualizations = [
    { id: 'support-lift', name: 'Support vs Lift Scatter', icon: '📊', description: 'Scatter plot showing rule quality distribution' },
    { id: 'item-frequency', name: 'Item Frequency Bar Chart', icon: '📈', description: 'Most frequent items in transactions' },
    { id: 'confidence-dist', name: 'Confidence Distribution', icon: '📉', description: 'Rule confidence histogram' },
    { id: 'itemset-length', name: 'Itemset Length Pie Chart', icon: '🔢', description: 'Distribution of itemset sizes' },
    { id: 'quality-radar', name: 'Quality Metrics Radar', icon: '🎯', description: 'Multi-dimensional quality analysis' },
    { id: 'lift-heatmap', name: 'Lift Matrix Heatmap', icon: '🌡️', description: 'Item association strength matrix' },
    { id: 'support-confidence', name: 'Support vs Confidence', icon: '🎲', description: 'Rule quality quadrant analysis' },
    { id: 'antecedent-dist', name: 'Antecedent Distribution', icon: '📋', description: 'Distribution of rule antecedents' },
    { id: 'consequent-dist', name: 'Consequent Distribution', icon: '🎯', description: 'Distribution of rule consequents' },
    { id: 'confidence-treemap', name: 'Confidence Treemap', icon: '🌳', description: 'Hierarchical view of rule confidence' },
    { id: 'parallel-coordinates', name: 'Parallel Coordinates', icon: '📏', description: 'Multi-dimensional rule analysis' },
    { id: 'bubble-chart', name: 'Rule Bubble Chart', icon: '�', description: 'Support, confidence, and lift in one view' }
  ];

  const renderVisualization = () => {
    switch (selectedVisualization) {
      case 'support-lift':
        return (
          <div className="h-96">
            <h3 className="text-lg font-semibold mb-4">Support vs Lift Scatter Plot</h3>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart data={supportLiftData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="support" name="Support" />
                <YAxis dataKey="lift" name="Lift" />
                <Tooltip
                  formatter={(value, name) => [typeof value === 'number' ? value.toFixed(3) : value, name]}
                  labelFormatter={() => ''}
                />
                <Scatter name="Rules" dataKey="lift" fill="#8884d8" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        );

      case 'item-frequency':
        return (
          <div className="h-96">
            <h3 className="text-lg font-semibold mb-4">Item Frequency Distribution</h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={itemFrequencyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip formatter={(value) => [value, 'Frequency']} />
                <Bar dataKey="frequency" fill="#82CA9D" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );

      case 'confidence-dist':
        return (
          <div className="h-96">
            <h3 className="text-lg font-semibold mb-4">Confidence Distribution</h3>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={confidenceDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => [`${typeof value === 'number' ? value.toFixed(1) : value}%`, 'Confidence']} />
                <Line type="monotone" dataKey="confidence" stroke="#8884d8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );

      case 'itemset-length':
        return (
          <div className="h-96">
            <h3 className="text-lg font-semibold mb-4">Itemset Length Distribution</h3>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={itemsetLengthChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {itemsetLengthChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        );

      case 'quality-radar':
        return (
          <div className="h-96">
            <h3 className="text-lg font-semibold mb-4">Quality Metrics Radar Chart</h3>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="metric" />
                <PolarRadiusAxis angle={90} domain={[0, 100]} />
                <Radar name="Quality" dataKey="value" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        );

      case 'rule-network':
        return (
          <div className="h-96">
            <h3 className="text-lg font-semibold mb-4">Association Rule Network</h3>
            <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="text-4xl mb-4">🕸️</div>
                <p className="text-gray-600">Network visualization coming soon!</p>
                <p className="text-sm text-gray-500 mt-2">
                  This will show the relationships between items and rules
                </p>
              </div>
            </div>
          </div>
        );

      default:
        return <div>Select a visualization</div>;
    }
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">Data Visualizations</h2>

      {/* Progress Indicator */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-blue-800">Processing Status</h3>
          <span className="text-green-600 font-medium">✅ Complete</span>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Data Upload</span>
            <span className="text-green-600">✅ {data.stats?.total_transactions || 0} transactions processed</span>
          </div>
          <div className="flex justify-between">
            <span>Pattern Mining</span>
            <span className="text-green-600">✅ {data.frequent_itemsets?.length || 0} itemsets found</span>
          </div>
          <div className="flex justify-between">
            <span>Rule Generation</span>
            <span className="text-green-600">✅ {data.association_rules?.length || 0} rules generated</span>
          </div>
          <div className="flex justify-between">
            <span>Visualizations</span>
            <span className="text-green-600">✅ {visualizations.length} charts available</span>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-sm text-gray-500">Mining Time</div>
          <div className="text-xl font-bold text-blue-600">
            {(data.performance?.mining_time || 0).toFixed(3)}s
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-sm text-gray-500">Algorithm</div>
          <div className="text-xl font-bold text-green-600">
            {data.performance?.algorithm || 'N/A'}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-sm text-gray-500">Avg Confidence</div>
          <div className="text-xl font-bold text-purple-600">
            {((data.quality_metrics?.avg_confidence || 0) * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Visualization Selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {visualizations.map((viz) => (
          <button
            key={viz.id}
            onClick={() => setSelectedVisualization(viz.id)}
            className={`px-4 py-2 rounded-lg border transition-colors ${
              selectedVisualization === viz.id
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <span className="mr-2">{viz.icon}</span>
            {viz.name}
          </button>
        ))}
      </div>

      {/* Visualization Container */}
      <div className="bg-white rounded-lg shadow border p-6">
        {renderVisualization()}
      </div>

      {/* Data Summary */}
      <div className="mt-6 bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4">Data Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-gray-500">Total Transactions</div>
            <div className="font-bold">{data.stats?.total_transactions || 0}</div>
          </div>
          <div>
            <div className="text-gray-500">Unique Items</div>
            <div className="font-bold">{data.stats?.unique_items || 0}</div>
          </div>
          <div>
            <div className="text-gray-500">Frequent Itemsets</div>
            <div className="font-bold">{data.frequent_itemsets?.length || 0}</div>
          </div>
          <div>
            <div className="text-gray-500">Association Rules</div>
            <div className="font-bold">{data.association_rules?.length || 0}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
