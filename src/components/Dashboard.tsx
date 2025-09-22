'use client';

interface DashboardProps {
  data: any;
}

export default function Dashboard({ data }: DashboardProps) {
  console.log('Dashboard received data:', data);
  console.log('Association rules:', data?.association_rules);
  console.log('Rules:', data?.rules);

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

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">Mining Results Dashboard</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="text-sm font-medium text-gray-500">Total Transactions</div>
          <div className="text-2xl font-bold text-gray-900">{data.summary?.transaction_count || 0}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="text-sm font-medium text-gray-500">Unique Items</div>
          <div className="text-2xl font-bold text-gray-900">{data.summary?.unique_items || 0}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="text-sm font-medium text-gray-500">Frequent Itemsets</div>
          <div className="text-2xl font-bold text-gray-900">{data.frequent_itemsets?.length || 0}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="text-sm font-medium text-gray-500">Association Rules</div>
          <div className="text-2xl font-bold text-gray-900">{data.association_rules?.length || 0}</div>
        </div>
      </div>

      {/* Frequent Itemsets Table */}
      <div className="bg-white rounded-lg shadow border mb-8">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">Frequent Itemsets</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Itemset
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Support
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.frequent_itemsets?.slice(0, 10).map((itemset: any, index: number) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {JSON.stringify(itemset.itemset)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {itemset.support?.toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Association Rules Table */}
      <div className="bg-white rounded-lg shadow border">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">Association Rules</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
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
              {data.association_rules?.slice(0, 10).map((rule: any, index: number) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {JSON.stringify(rule.antecedents)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {JSON.stringify(rule.consequents)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {rule.support?.toFixed(3)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {rule.confidence?.toFixed(3)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {rule.lift?.toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
