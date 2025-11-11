// Simple Node script to simulate Dashboard item-frequency normalization logic
function normalizeItemFrequencies(data) {
  const itemFrequency = {};

  // Prefer frequent_itemsets if available (take highest support per item)
  if (Array.isArray(data.frequent_itemsets)) {
    data.frequent_itemsets.forEach((itemset) => {
      const items = Array.isArray(itemset.itemset) ? itemset.itemset : [itemset.itemset];
      items.forEach((item) => {
        itemFrequency[item] = Math.max(itemFrequency[item] || 0, itemset.support || 0);
      });
    });
  }

  const totalTx = (data.stats && data.stats.total_transactions) || (data.summary && data.summary.transaction_count) || null;

  function normalizeEntry(entry) {
    const name = entry.item || entry.name || entry.label;
    if (!name) return null;
    if (typeof entry.support === 'number' && entry.support >= 0 && entry.support <= 1) {
      return { name, support: entry.support };
    }
    const freq = entry.frequency ?? entry.count ?? entry.freq ?? null;
    if (typeof freq === 'number' && totalTx) {
      return { name, support: freq / totalTx };
    }
    if (typeof freq === 'number') {
      return { name, support: freq };
    }
    return null;
  }

  if (Object.keys(itemFrequency).length === 0) {
    const sources = [data.item_frequencies, data.analytics && data.analytics.item_frequencies, data.analytics && data.analytics.top_items, data.itemFrequencies];
    let collected = [];
    for (const s of sources) {
      if (Array.isArray(s) && s.length) {
        collected = s;
        break;
      }
    }

    if (collected.length) {
      const temp = [];
      let maxRawFreq = 0;
      collected.forEach((entry) => {
        const ne = normalizeEntry(entry);
        if (ne) {
          temp.push(ne);
          if (ne.support > maxRawFreq) maxRawFreq = ne.support;
        }
      });

      temp.forEach(({ name, support }) => {
        const finalSupport = (support > 1 && !totalTx) ? (support / maxRawFreq) : support;
        itemFrequency[name] = finalSupport;
      });
    }
  }

  const arr = Object.entries(itemFrequency).map(([name, support]) => ({ name, support }));
  arr.sort((a, b) => b.support - a.support);
  return arr;
}

// Test payloads
const payloads = [
  {
    name: 'frequent_itemsets_with_support',
    data: {
      frequent_itemsets: [
        { itemset: ['apple', 'banana'], support: 0.3 },
        { itemset: ['carrot'], support: 0.2 }
      ]
    }
  },
  {
    name: 'item_frequencies_counts_with_stats',
    data: {
      item_frequencies: [
        { item: 'x', frequency: 50 },
        { item: 'y', frequency: 30 }
      ],
      stats: { total_transactions: 200 }
    }
  },
  {
    name: 'analytics_top_items',
    data: {
      analytics: { top_items: [ { name: 'm', count: 10 }, { name: 'n', count: 5 } ] },
      stats: { total_transactions: 100 }
    }
  },
  {
    name: 'raw_counts_no_total',
    data: {
      item_frequencies: [
        { item: 'p', frequency: 40 },
        { item: 'q', frequency: 10 }
      ]
      // no stats.total_transactions
    }
  }
];

payloads.forEach((p) => {
  console.log('---', p.name, '---');
  const res = normalizeItemFrequencies(p.data);
  console.log(JSON.stringify(res.slice(0, 10), null, 2));
});
