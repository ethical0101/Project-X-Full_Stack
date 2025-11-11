'use client';

import styles from '../styles/analytics.module.css';

interface AnalyticsProps {
  data: any;
}

export default function Analytics({ data }: AnalyticsProps) {
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
              d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-600 mb-2">No Analytics Available</h3>
        <p className="text-gray-500">Please upload and process data first to view analytics.</p>
      </div>
    );
  }

  const summary = data.summary || {};
  const stats = data.stats || {};
  const performance = data.performance || {};
  const analyticsPayload = data.analytics?.analytics || data.analytics || {};
  const metrics = data.metrics || data.quality_metrics || analyticsPayload.metrics || {};

  const totalTransactions = summary.transaction_count
    ?? stats.total_transactions
    ?? analyticsPayload.total_transactions
    ?? 0;
  const uniqueItems = summary.unique_items
    ?? stats.unique_items
    ?? analyticsPayload.unique_items
    ?? 0;

  const avgItems = typeof summary.avg_items === 'number'
    ? summary.avg_items
    : typeof summary.avg_items_per_transaction === 'number'
      ? summary.avg_items_per_transaction
      : typeof stats.avg_items_per_transaction === 'number'
        ? stats.avg_items_per_transaction
        : typeof analyticsPayload.avg_items === 'number'
          ? analyticsPayload.avg_items
          : 0;

  const dataDensity = uniqueItems > 0 ? (avgItems / uniqueItems) * 100 : null;

  // Determine algorithm execution times and reported algorithm
  const algorithmName = performance.algorithm || performance.algo || 'unknown';

  const execTime = typeof performance.mining_time === 'number'
    ? performance.mining_time
    : typeof performance.execution_time === 'number'
      ? performance.execution_time
      : undefined;

  const aprioriTime = typeof performance.apriori_time === 'number' ? performance.apriori_time : undefined;
  const fpgrowthTime = typeof performance.fpgrowth_time === 'number' ? performance.fpgrowth_time : undefined;

  const speedup = typeof performance.speedup === 'number'
    ? performance.speedup
    : (typeof aprioriTime === 'number' && typeof fpgrowthTime === 'number' && fpgrowthTime !== 0
        ? aprioriTime / fpgrowthTime
        : undefined);

  const formatValue = (value: number | null | undefined, decimals = 2, suffix = '') => {
    if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
      return 'N/A';
    }
    return `${value.toFixed(decimals)}${suffix}`;
  };

  const rules = Array.isArray(data.rules)
    ? data.rules
    : Array.isArray(data.association_rules)
      ? data.association_rules
      : [];

  // Normalize item frequencies from multiple possible backend shapes (support, frequency/count, nested analytics)
  const buildItemFrequencies = () => {
    const itemFrequencyMap: { [key: string]: number } = {};

    // Prefer frequent_itemsets if available (take highest support per item)
    if (Array.isArray(data.frequent_itemsets)) {
      data.frequent_itemsets.forEach((itemset: any) => {
        const items = Array.isArray(itemset.itemset) ? itemset.itemset : [itemset.itemset];
        items.forEach((it: string) => {
          itemFrequencyMap[it] = Math.max(itemFrequencyMap[it] || 0, itemset.support || 0);
        });
      });
    }

    const totalTx = stats.total_transactions || summary.transaction_count || analyticsPayload.total_transactions || null;

    const normalizeEntry = (entry: any) => {
      const name = entry.item || entry.name || entry.label;
      if (!name) return null;
      if (typeof entry.support === 'number' && entry.support >= 0 && entry.support <= 1) return { name, support: entry.support };
      const freq = entry.frequency ?? entry.count ?? entry.freq ?? null;
      if (typeof freq === 'number' && totalTx) return { name, support: freq / totalTx };
      if (typeof freq === 'number') return { name, support: freq };
      return null;
    };

    if (Object.keys(itemFrequencyMap).length === 0) {
      const sources = [data.item_frequencies, analyticsPayload.item_frequencies, analyticsPayload.top_items, data.itemFrequencies];
      let collected: any[] = [];
      for (const s of sources) {
        if (Array.isArray(s) && s.length) { collected = s; break; }
      }

      if (collected.length) {
        const temp: { name: string; support: number }[] = [];
        let maxRaw = 0;
        collected.forEach((entry: any) => {
          const ne = normalizeEntry(entry);
          if (ne) { temp.push(ne); if (ne.support > maxRaw) maxRaw = ne.support; }
        });
        temp.forEach(({ name, support }) => {
          const finalSupport = (support > 1 && !totalTx) ? (support / maxRaw) : support;
          itemFrequencyMap[name] = finalSupport;
        });
      }
    }

    const out = Object.entries(itemFrequencyMap).map(([name, support]) => ({ item: name, support }));
    out.sort((a, b) => b.support - a.support);
    return out;
  };

  const itemFrequencies = buildItemFrequencies();

  const avgConfidence = typeof metrics.avg_confidence === 'number' ? metrics.avg_confidence : null;
  const avgLift = typeof metrics.avg_lift === 'number' ? metrics.avg_lift : null;
  const ruleDiversity = typeof metrics.rule_diversity === 'number' ? metrics.rule_diversity : null;
  const ruleCoverage = typeof metrics.rule_coverage === 'number'
    ? metrics.rule_coverage
    : null;

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">Advanced Analytics</h2>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold mb-4">Algorithm Performance</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Execution Time ({algorithmName}):</span>
              <span className="font-medium">{formatValue(execTime, 4, 's')}</span>
            </div>

            {typeof aprioriTime === 'number' && (
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Apriori Execution Time:</span>
                <span className="font-medium">{formatValue(aprioriTime, 4, 's')}</span>
              </div>
            )}

            {typeof fpgrowthTime === 'number' && (
              <div className="flex justify-between items-center">
                <span className="text-gray-600">FP-Growth Execution Time:</span>
                <span className="font-medium">{formatValue(fpgrowthTime, 4, 's')}</span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-gray-600">Speed Improvement:</span>
              <span className="font-medium">{formatValue(speedup, 2, 'x')}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold mb-4">Data Quality Metrics</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Avg Items per Transaction:</span>
              <span className="font-medium">{formatValue(avgItems, 2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Data Density:</span>
              <span className="font-medium">{formatValue(dataDensity, 1, '%')}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Rule Coverage:</span>
              <span className="font-medium">{formatValue(ruleCoverage, 2, '%')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Rule Quality Analysis */}
      <div className="bg-white p-6 rounded-lg shadow border mb-8">
        <h3 className="text-lg font-semibold mb-4">Rule Quality Analysis</h3>

        {/* Quality Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {formatValue(avgConfidence, 3)}
            </div>
            <div className="text-sm text-gray-500">Average Confidence</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {formatValue(avgLift, 3)}
            </div>
            <div className="text-sm text-gray-500">Average Lift</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {formatValue(ruleDiversity, 3)}
            </div>
            <div className="text-sm text-gray-500">Rule Diversity</div>
          </div>
        </div>

        {/* Detailed Rules Table */}
        {rules.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rule</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Support</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Confidence</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lift</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quality</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rules.slice(0, 10).map((rule: any, index: number) => {
                  const getQualityLabel = (confidence: number, lift: number) => {
                    if (confidence > 0.8 && lift > 1.5) return { label: 'Excellent', color: 'bg-green-100 text-green-800' };
                    if (confidence > 0.7 && lift > 1.2) return { label: 'Good', color: 'bg-blue-100 text-blue-800' };
                    if (confidence > 0.6 && lift > 1.0) return { label: 'Fair', color: 'bg-yellow-100 text-yellow-800' };
                    return { label: 'Poor', color: 'bg-red-100 text-red-800' };
                  };

                  const ruleConfidence = typeof rule.confidence === 'number' ? rule.confidence : parseFloat(rule.confidence) || 0;
                  const ruleLift = typeof rule.lift === 'number' ? rule.lift : parseFloat(rule.lift) || 0;
                  const quality = getQualityLabel(ruleConfidence, ruleLift);

                  return (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm">
                        <div className="flex items-center">
                          <span className="font-medium text-blue-600">
                            {Array.isArray(rule.antecedents) ? rule.antecedents.join(', ') : String(rule.antecedents || '')}
                          </span>
                          <span className="mx-2 text-gray-400">→</span>
                          <span className="font-medium text-green-600">
                            {Array.isArray(rule.consequents) ? rule.consequents.join(', ') : String(rule.consequents || '')}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {formatValue(typeof rule.support === 'number' ? rule.support * 100 : 0, 1, '%')}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {formatValue(ruleConfidence * 100, 1, '%')}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {formatValue(ruleLift, 2)}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${quality.color}`}>
                          {quality.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {rules.length > 10 && (
              <div className="text-center py-3 text-sm text-gray-500">
                Showing top 10 rules of {rules.length} total rules
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <div className="text-gray-400 mb-2">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p>No association rules found. Try lowering the confidence threshold.</p>
          </div>
        )}
      </div>

      {/* Top Items by Support */}
      <div className="bg-white p-6 rounded-lg shadow border">
        <h3 className="text-lg font-semibold mb-4">Top Items by Support</h3>
        <div className="space-y-3">
          {itemFrequencies.slice(0, 10).map((item: any, index: number) => {
            const supportValue = typeof item.support === 'number' ? item.support : 0;
            const supportPercentage = Math.max(0, Math.min(100, supportValue * 100));
            // Convert percentage to a Tailwind width class
            const getWidthClass = (percentage: number) => {
              if (percentage >= 90) return 'w-full';
              if (percentage >= 75) return 'w-3/4';
              if (percentage >= 50) return 'w-1/2';
              if (percentage >= 25) return 'w-1/4';
              if (percentage >= 10) return 'w-1/6';
              return 'w-2';
            };

            return (
              <div key={index} className="flex items-center justify-between">
                <span className="font-medium">{item.item || item.name}</span>
                <div className="flex items-center space-x-3">
                  <div className="w-32 bg-gray-200 rounded-full h-2 relative">
                    <div className={`bg-blue-600 h-2 rounded-full transition-all duration-300 ${getWidthClass(supportPercentage)}`}></div>
                  </div>
                  <span className="text-sm text-gray-600 w-12">
                    {supportPercentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
