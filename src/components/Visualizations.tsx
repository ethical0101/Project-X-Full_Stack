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

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C', '#8DD1E1', '#D084D0'];

export default function Visualizations({ data }: VisualizationsProps) {
  const [selectedVisualization, setSelectedVisualization] = useState('support-lift');

  if (!data || !data.itemsets || !data.rules) {
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

  // === DATA PROCESSING FOR ALL VISUALIZATIONS ===

  // 1. Support vs Lift Scatter Plot Data
  const supportLiftData = data.rules?.map((rule: any, index: number) => ({
    support: (rule.support || 0) * 100,
    lift: rule.lift || 0,
    confidence: (rule.confidence || 0) * 100,
    rule: `${Array.isArray(rule.antecedents) ? rule.antecedents.join(', ') : rule.antecedents} → ${Array.isArray(rule.consequents) ? rule.consequents.join(', ') : rule.consequents}`,
    index: index + 1
  })) || [];

  // 2. Item Frequency Data
  const itemFrequencies: { [key: string]: number } = {};
  data.itemsets?.forEach((itemset: any) => {
    const items = Array.isArray(itemset.itemset) ? itemset.itemset : [itemset.itemset];
    items.forEach((item: string) => {
      itemFrequencies[item] = Math.max(itemFrequencies[item] || 0, itemset.support || 0);
    });
  });

  const itemFrequencyData = Object.entries(itemFrequencies)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 20)
    .map(([name, frequency]) => ({ name, frequency: frequency * 100, support: frequency }));

  // 3. Confidence Distribution
  const confidenceHistogram: { [key: string]: number } = {};
  data.rules?.forEach((rule: any) => {
    const confBin = Math.floor((rule.confidence || 0) * 10) * 10;
    const binLabel = `${confBin}-${confBin + 9}%`;
    confidenceHistogram[binLabel] = (confidenceHistogram[binLabel] || 0) + 1;
  });

  const confidenceDistribution = Object.entries(confidenceHistogram)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .map(([name, count]) => ({ name, count, percentage: count }));

  // 4. Itemset Length Distribution
  const itemsetLengthData: { [key: number]: number } = {};
  data.itemsets?.forEach((itemset: any) => {
    const length = Array.isArray(itemset.itemset) ? itemset.itemset.length : 1;
    itemsetLengthData[length] = (itemsetLengthData[length] || 0) + 1;
  });

  const itemsetLengthChartData = Object.entries(itemsetLengthData || {}).map(([length, count]) => ({
    name: `${length} items`,
    count: count as number,
    value: count as number
  }));

  // 5. Quality Metrics Radar
  const calculateAverage = (field: string) => {
    if (!data.rules?.length) return 0;
    const sum = data.rules.reduce((acc: number, rule: any) => acc + (rule[field] || 0), 0);
    return sum / data.rules.length;
  };

  const radarData = [
    { metric: 'Avg Support', value: calculateAverage('support') * 100, fullMark: 100 },
    { metric: 'Avg Confidence', value: calculateAverage('confidence') * 100, fullMark: 100 },
    { metric: 'Avg Lift', value: Math.min(calculateAverage('lift') * 20, 100), fullMark: 100 },
    { metric: 'Rule Count', value: Math.min((data.rules?.length || 0) / 20 * 100, 100), fullMark: 100 },
    { metric: 'Item Diversity', value: Math.min(Object.keys(itemFrequencies).length / 50 * 100, 100), fullMark: 100 }
  ];

  // 6. Antecedent and Consequent Distributions
  const antecedentFreq: { [key: string]: number } = {};
  const consequentFreq: { [key: string]: number } = {};

  data.rules?.forEach((rule: any) => {
    const antecedents = Array.isArray(rule.antecedents) ? rule.antecedents : [rule.antecedents];
    const consequents = Array.isArray(rule.consequents) ? rule.consequents : [rule.consequents];

    antecedents.forEach((item: string) => {
      if (item) antecedentFreq[item] = (antecedentFreq[item] || 0) + 1;
    });

    consequents.forEach((item: string) => {
      if (item) consequentFreq[item] = (consequentFreq[item] || 0) + 1;
    });
  });

  const antecedentData = Object.entries(antecedentFreq)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 15)
    .map(([name, count]) => ({ name, count, frequency: count }));

  const consequentData = Object.entries(consequentFreq)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 15)
    .map(([name, count]) => ({ name, count, frequency: count }));

  // 7. Treemap Data for Confidence
  const treemapData = data.rules?.slice(0, 20).map((rule: any, index: number) => ({
    name: `R${index + 1}`,
    size: Math.max((rule.confidence || 0) * 1000, 1),
    confidence: ((rule.confidence || 0) * 100).toFixed(1),
    support: ((rule.support || 0) * 100).toFixed(1),
    lift: (rule.lift || 0).toFixed(2),
    rule: `${Array.isArray(rule.antecedents) ? rule.antecedents.join(',') : rule.antecedents} → ${Array.isArray(rule.consequents) ? rule.consequents.join(',') : rule.consequents}`
  })) || [];

  // 8. Support vs Confidence Scatter
  const supportConfidenceData = data.rules?.map((rule: any, index: number) => ({
    support: (rule.support || 0) * 100,
    confidence: (rule.confidence || 0) * 100,
    lift: rule.lift || 0,
    rule: `R${index + 1}`,
    size: (rule.lift || 1) * 5
  })) || [];

  // 9. Bubble Chart Data (3D visualization)
  const bubbleData = data.rules?.slice(0, 30).map((rule: any, index: number) => ({
    x: (rule.support || 0) * 100,
    y: (rule.confidence || 0) * 100,
    z: Math.max((rule.lift || 1) * 10, 5),
    rule: `R${index + 1}`,
    lift: rule.lift || 0
  })) || [];

  // 10. Parallel Coordinates Data
  const parallelData = data.rules?.slice(0, 50).map((rule: any, index: number) => ({
    rule: `R${index + 1}`,
    support: (rule.support || 0) * 100,
    confidence: (rule.confidence || 0) * 100,
    lift: Math.min((rule.lift || 0), 5),
    conviction: Math.min((rule.conviction || 1), 10)
  })) || [];

  // 11. Lift Matrix Heatmap
  const topItems = itemFrequencyData.slice(0, 8).map(item => item.name);
  const liftMatrixData = [];
  for (let i = 0; i < topItems.length; i++) {
    for (let j = 0; j < topItems.length; j++) {
      if (i !== j) {
        const rule = data.rules?.find((r: any) => {
          const antecedents = Array.isArray(r.antecedents) ? r.antecedents : [r.antecedents];
          const consequents = Array.isArray(r.consequents) ? r.consequents : [r.consequents];
          return antecedents.includes(topItems[i]) && consequents.includes(topItems[j]);
        });

        liftMatrixData.push({
          x: j,
          y: i,
          value: rule?.lift || 0,
          fromItem: topItems[i],
          toItem: topItems[j]
        });
      }
    }
  }

  // === VISUALIZATION DEFINITIONS ===
  const visualizations = [
    { id: 'support-lift', name: 'Support vs Lift Scatter', icon: '📊', description: 'Rule quality distribution analysis' },
    { id: 'item-frequency', name: 'Item Frequency', icon: '📈', description: 'Most frequent items in dataset' },
    { id: 'confidence-dist', name: 'Confidence Distribution', icon: '📉', description: 'Rule confidence histogram' },
    { id: 'itemset-length', name: 'Itemset Length Distribution', icon: '🔢', description: 'Itemset size breakdown' },
    { id: 'quality-radar', name: 'Quality Metrics Radar', icon: '🎯', description: 'Multi-dimensional quality view' },
    { id: 'support-confidence', name: 'Support vs Confidence', icon: '🎲', description: 'Rule quality quadrants' },
    { id: 'antecedent-dist', name: 'Antecedent Distribution', icon: '📋', description: 'Rule condition analysis' },
    { id: 'consequent-dist', name: 'Consequent Distribution', icon: '🎯', description: 'Rule outcome analysis' },
    { id: 'confidence-treemap', name: 'Confidence Treemap', icon: '🌳', description: 'Hierarchical confidence view' },
    { id: 'bubble-chart', name: 'Rule Bubble Chart', icon: '💭', description: '3D rule quality visualization' },
    { id: 'parallel-coordinates', name: 'Parallel Coordinates', icon: '📏', description: 'Multi-metric rule analysis' },
    { id: 'lift-heatmap', name: 'Lift Heatmap', icon: '🌡️', description: 'Item association matrix' }
  ];

  // === RENDER VISUALIZATION FUNCTION ===
  const renderVisualization = () => {
    switch (selectedVisualization) {
      case 'support-lift':
        return (
          <div className="h-96">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              📊 Support vs Lift Scatter Plot
              <span className="ml-2 text-sm text-gray-500">({supportLiftData.length} rules)</span>
            </h3>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart data={supportLiftData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="support" name="Support %" />
                <YAxis dataKey="lift" name="Lift" />
                <Tooltip
                  formatter={(value: any, name: string) => [
                    typeof value === 'number' ? value.toFixed(3) : value,
                    name === 'lift' ? 'Lift' : name === 'support' ? 'Support %' : name
                  ]}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.rule || ''}
                />
                <Scatter name="Rules" dataKey="lift" fill="#8884d8" />
                <ReferenceLine y={1} stroke="red" strokeDasharray="5 5" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        );

      case 'item-frequency':
        return (
          <div className="h-96">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              📈 Item Frequency Distribution
              <span className="ml-2 text-sm text-gray-500">({itemFrequencyData.length} items)</span>
            </h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={itemFrequencyData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} interval={0} />
                <YAxis />
                <Tooltip formatter={(value: any) => [`${typeof value === 'number' ? value.toFixed(2) : value}%`, 'Support']} />
                <Bar dataKey="frequency" fill="#82CA9D" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );

      case 'confidence-dist':
        return (
          <div className="h-96">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              📉 Confidence Distribution
              <span className="ml-2 text-sm text-gray-500">(Rule confidence ranges)</span>
            </h3>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={confidenceDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => [value, 'Number of Rules']} />
                <Area type="monotone" dataKey="count" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        );

      case 'itemset-length':
        return (
          <div className="h-96">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              🔢 Itemset Length Distribution
              <span className="ml-2 text-sm text-gray-500">({itemsetLengthChartData.reduce((sum, item) => sum + item.count, 0)} itemsets)</span>
            </h3>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={itemsetLengthChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="value"
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
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              🎯 Quality Metrics Radar Chart
              <span className="ml-2 text-sm text-gray-500">(Overall performance)</span>
            </h3>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Radar name="Quality" dataKey="value" stroke="#8884d8" fill="#8884d8" fillOpacity={0.4} strokeWidth={2} />
                <Tooltip formatter={(value: any) => [`${typeof value === 'number' ? value.toFixed(1) : value}%`, 'Score']} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        );

      case 'support-confidence':
        return (
          <div className="h-96">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              🎲 Support vs Confidence Analysis
              <span className="ml-2 text-sm text-gray-500">(Bubble size = lift)</span>
            </h3>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart data={supportConfidenceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="support" name="Support %" />
                <YAxis dataKey="confidence" name="Confidence %" />
                <Tooltip formatter={(value: any, name: any) => [
                  `${typeof value === 'number' ? value.toFixed(2) : value}${typeof name === 'string' && (name.includes('Support') || name.includes('Confidence')) ? '%' : ''}`,
                  name
                ]} />
                <Scatter name="Rules" dataKey="confidence" fill="#FF8042" />
                <ReferenceLine x={5} stroke="blue" strokeDasharray="5 5" />
                <ReferenceLine y={70} stroke="green" strokeDasharray="5 5" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        );

      case 'antecedent-dist':
        return (
          <div className="h-96">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              📋 Antecedent Distribution
              <span className="ml-2 text-sm text-gray-500">(Rule conditions)</span>
            </h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={antecedentData} layout="horizontal" margin={{ top: 20, right: 30, left: 80, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={80} />
                <Tooltip formatter={(value) => [value, 'Frequency']} />
                <Bar dataKey="count" fill="#00C49F" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );

      case 'consequent-dist':
        return (
          <div className="h-96">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              🎯 Consequent Distribution
              <span className="ml-2 text-sm text-gray-500">(Rule outcomes)</span>
            </h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={consequentData} layout="horizontal" margin={{ top: 20, right: 30, left: 80, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={80} />
                <Tooltip formatter={(value) => [value, 'Frequency']} />
                <Bar dataKey="count" fill="#FFBB28" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );

      case 'confidence-treemap':
        return (
          <div className="h-96">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              🌳 Confidence Treemap
              <span className="ml-2 text-sm text-gray-500">(Rule confidence hierarchy)</span>
            </h3>
            <ResponsiveContainer width="100%" height="100%">
              <Treemap
                data={treemapData}
                dataKey="size"
                stroke="#fff"
              >
                {treemapData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Treemap>
            </ResponsiveContainer>
          </div>
        );

      case 'bubble-chart':
        return (
          <div className="h-96">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              💭 Rule Bubble Chart
              <span className="ml-2 text-sm text-gray-500">(3D: support, confidence, lift)</span>
            </h3>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart data={bubbleData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="x" name="Support %" />
                <YAxis dataKey="y" name="Confidence %" />
                <Tooltip formatter={(value: any, name: any) => [
                  `${typeof value === 'number' ? value.toFixed(2) : value}${name === 'Support %' || name === 'Confidence %' ? '%' : ''}`,
                  name
                ]} />
                <Scatter name="Rules" dataKey="y" fill="#8884d8">
                  {bubbleData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        );

      case 'parallel-coordinates':
        return (
          <div className="h-96">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              📏 Parallel Coordinates Plot
              <span className="ml-2 text-sm text-gray-500">(Multi-metric analysis)</span>
            </h3>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={parallelData.slice(0, 20)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="rule" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="support" stroke="#8884d8" strokeWidth={1} dot={false} />
                <Line type="monotone" dataKey="confidence" stroke="#82ca9d" strokeWidth={1} dot={false} />
                <Line type="monotone" dataKey="lift" stroke="#ffc658" strokeWidth={1} dot={false} />
                <Legend />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );

      case 'lift-heatmap':
        return (
          <div className="h-96">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              🌡️ Lift Matrix Heatmap
              <span className="ml-2 text-sm text-gray-500">(Item associations)</span>
            </h3>
            <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="text-4xl mb-4">🌡️</div>
                <p className="text-gray-600 font-medium">Lift Heatmap</p>
                <p className="text-sm text-gray-500 mt-2">
                  Matrix showing lift values between top items
                </p>
                <div className="mt-4 text-xs text-gray-400">
                  Items analyzed: {topItems.join(', ')}
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return <div className="h-96 flex items-center justify-center text-gray-500">Select a visualization</div>;
    }
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">📈 Comprehensive Data Visualizations</h2>

      {/* Performance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-lg shadow">
          <div className="text-sm opacity-90">Total Rules</div>
          <div className="text-2xl font-bold">{data.rules?.length || 0}</div>
        </div>
        <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-4 rounded-lg shadow">
          <div className="text-sm opacity-90">Frequent Itemsets</div>
          <div className="text-2xl font-bold">{data.itemsets?.length || 0}</div>
        </div>
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-4 rounded-lg shadow">
          <div className="text-sm opacity-90">Unique Items</div>
          <div className="text-2xl font-bold">{Object.keys(itemFrequencies).length}</div>
        </div>
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-4 rounded-lg shadow">
          <div className="text-sm opacity-90">Avg Confidence</div>
          <div className="text-2xl font-bold">{(calculateAverage('confidence') * 100).toFixed(1)}%</div>
        </div>
      </div>

      {/* Visualization Selector */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">Choose Visualization</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {visualizations.map((viz) => (
            <button
              key={viz.id}
              onClick={() => setSelectedVisualization(viz.id)}
              className={`p-3 rounded-lg border text-left transition-all duration-200 ${
                selectedVisualization === viz.id
                  ? 'bg-blue-500 text-white border-blue-500 shadow-lg transform scale-105'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
              }`}
            >
              <div className="flex items-center mb-1">
                <span className="text-lg mr-2">{viz.icon}</span>
                <span className="font-medium text-sm">{viz.name}</span>
              </div>
              <p className="text-xs opacity-75">{viz.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Visualization Container */}
      <div className="bg-white rounded-lg shadow-lg border p-6 mb-6">
        {renderVisualization()}
      </div>

      {/* Data Insights */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4">📊 Key Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Top Performing Rules</h4>
            <div className="space-y-2">
              {supportLiftData.slice(0, 3).map((rule: any, index: number) => (
                <div key={index} className="text-sm bg-gray-50 p-2 rounded">
                  <div className="font-medium">Rule {rule.index}</div>
                  <div className="text-gray-600">Conf: {rule.confidence.toFixed(1)}%, Lift: {rule.lift.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Most Frequent Items</h4>
            <div className="space-y-2">
              {itemFrequencyData.slice(0, 3).map((item, index) => (
                <div key={index} className="text-sm bg-gray-50 p-2 rounded">
                  <div className="font-medium">{item.name}</div>
                  <div className="text-gray-600">Support: {item.frequency.toFixed(2)}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
