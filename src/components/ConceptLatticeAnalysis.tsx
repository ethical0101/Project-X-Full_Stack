import React, { useState } from 'react';
import { API_BASE_URL } from '../utils/api';

interface ConceptNode {
  id: number;
  extent: string[];
  intent: string[];
  extent_size: number;
  intent_size: number;
  label: string;
  is_top: boolean;
  is_bottom: boolean;
}

interface ConceptEdge {
  source: number;
  target: number;
  type: string;
}

interface ConceptLattice {
  nodes: ConceptNode[];
  edges: ConceptEdge[];
  stats: {
    total_concepts: number;
    total_objects: number;
    total_attributes: number;
    top_concept: number;
    bottom_concept: number;
  };
}

interface LatticeResponse {
  lattice: ConceptLattice;
  processing_time: number;
  transaction_count: number;
  message: string;
}

const ConceptLatticeAnalysis: React.FC = () => {
  const [latticeData, setLatticeData] = useState<ConceptLattice | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<ConceptNode | null>(null);
  const [processingTime, setProcessingTime] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'network' | 'hesse'>('hesse');

  const triggerFileUpload = () => {
    const fileInput = document.getElementById('lattice-file-upload') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/concept-lattice`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: LatticeResponse = await response.json();
      setLatticeData(result.lattice);
      setProcessingTime(result.processing_time);
      setSelectedNode(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during file upload');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTestLattice = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/test-lattice`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: LatticeResponse = await response.json();
      setLatticeData(result.lattice);
      setProcessingTime(result.processing_time);
      setSelectedNode(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while loading test lattice');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadLatticeData = () => {
    if (!latticeData) return;

    const dataStr = JSON.stringify(latticeData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'concept_lattice.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Enhanced Hesse diagram layout
  const calculateHesseLayout = (nodes: ConceptNode[], edges: ConceptEdge[]) => {
    const positions: { [key: number]: { x: number; y: number; level: number } } = {};

    // Build parent-child relationships
    const children: { [key: number]: number[] } = {};
    const parents: { [key: number]: number[] } = {};

    nodes.forEach(node => {
      children[node.id] = [];
      parents[node.id] = [];
    });

    edges.forEach(edge => {
      children[edge.source] = children[edge.source] || [];
      parents[edge.target] = parents[edge.target] || [];
      children[edge.source].push(edge.target);
      parents[edge.target].push(edge.source);
    });

    // Find levels based on longest path from top
    const levels: { [key: number]: number } = {};
    const visited = new Set<number>();

    // Find top concept (or most general concept)
    const topCandidates = nodes.filter(n => n.is_top || parents[n.id].length === 0);
    const topNode = topCandidates[0] || nodes[0];

    // DFS to assign levels
    const assignLevel = (nodeId: number, level: number) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      levels[nodeId] = Math.max(levels[nodeId] || 0, level);

      children[nodeId].forEach(childId => {
        assignLevel(childId, level + 1);
      });
    };

    assignLevel(topNode.id, 0);

    // Group nodes by level
    const nodesByLevel: { [level: number]: number[] } = {};
    Object.entries(levels).forEach(([nodeId, level]) => {
      if (!nodesByLevel[level]) nodesByLevel[level] = [];
      nodesByLevel[level].push(parseInt(nodeId));
    });

    // Position nodes
    const svgWidth = 800;
    const svgHeight = 600;
    const margin = 80;
    const maxLevel = Math.max(...Object.values(levels));
    const levelHeight = maxLevel > 0 ? (svgHeight - 2 * margin) / maxLevel : 0;

    Object.entries(nodesByLevel).forEach(([levelStr, nodeIds]) => {
      const level = parseInt(levelStr);
      const y = margin + level * levelHeight;
      const totalWidth = svgWidth - 2 * margin;
      const nodeSpacing = nodeIds.length > 1 ? totalWidth / (nodeIds.length - 1) : 0;

      nodeIds.forEach((nodeId, index) => {
        const x = nodeIds.length === 1
          ? svgWidth / 2
          : margin + index * nodeSpacing;
        positions[nodeId] = { x, y, level };
      });
    });

    return positions;
  };

  // Network layout (circular)
  const calculateNetworkLayout = (nodes: ConceptNode[]) => {
    const positions: { [key: number]: { x: number; y: number; level: number } } = {};
    const centerX = 400;
    const centerY = 300;
    const radius = 200;

    nodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / nodes.length;
      positions[node.id] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        level: 0
      };
    });

    return positions;
  };

  const renderLatticeVisualization = () => {
    if (!latticeData) return null;

    const { nodes, edges } = latticeData;
    const svgWidth = 800;
    const svgHeight = 600;

    // Choose layout based on view mode
    const nodePositions = viewMode === 'hesse'
      ? calculateHesseLayout(nodes, edges)
      : calculateNetworkLayout(nodes);

    return (
      <div className="w-full overflow-x-auto">
        <svg width={svgWidth} height={svgHeight} className="border border-gray-300 rounded bg-white">
          <defs>
            {viewMode === 'hesse' && (
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f0f0f0" strokeWidth="1"/>
              </pattern>
            )}
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill="#6b7280"
              />
            </marker>
          </defs>

          {viewMode === 'hesse' && (
            <rect width="100%" height="100%" fill="url(#grid)" />
          )}

          {/* Render edges */}
          {edges.map((edge, index) => {
            const sourcePos = nodePositions[edge.source];
            const targetPos = nodePositions[edge.target];
            if (!sourcePos || !targetPos) return null;

            return (
              <line
                key={index}
                x1={sourcePos.x}
                y1={sourcePos.y}
                x2={targetPos.x}
                y2={targetPos.y}
                stroke="#6b7280"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
              />
            );
          })}

          {/* Render nodes */}
          {nodes.map(node => {
            const pos = nodePositions[node.id];
            if (!pos) return null;

            const isSelected = selectedNode?.id === node.id;
            const nodeColor = node.is_top
              ? '#ef4444'
              : node.is_bottom
                ? '#22c55e'
                : '#3b82f6';

            return (
              <g key={node.id}>
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={isSelected ? 20 : 15}
                  fill={nodeColor}
                  stroke={isSelected ? '#1f2937' : '#ffffff'}
                  strokeWidth={isSelected ? 3 : 2}
                  className="cursor-pointer"
                  onClick={() => setSelectedNode(node)}
                />
                <text
                  x={pos.x}
                  y={pos.y + 5}
                  textAnchor="middle"
                  fontSize="12"
                  fill="white"
                  fontWeight="bold"
                  className="pointer-events-none"
                >
                  {node.label}
                </text>
                {(node.is_top || node.is_bottom) && (
                  <text
                    x={pos.x}
                    y={pos.y - 25}
                    textAnchor="middle"
                    fontSize="10"
                    fill={nodeColor}
                    fontWeight="bold"
                    className="pointer-events-none"
                  >
                    {node.is_top ? 'TOP' : 'BOTTOM'}
                  </text>
                )}

                {/* Level indicator for Hesse diagram */}
                {viewMode === 'hesse' && (
                  <text
                    x={pos.x + 25}
                    y={pos.y + 5}
                    fontSize="10"
                    fill="#666"
                    className="pointer-events-none"
                  >
                    L{pos.level}
                  </text>
                )}
              </g>
            );
          })}

          {/* Level labels for Hesse diagram */}
          {viewMode === 'hesse' && (
            <>
              {Object.entries(
                nodes.reduce((levels: {[key: number]: number}, node) => {
                  const pos = nodePositions[node.id];
                  if (pos && !levels[pos.level]) {
                    levels[pos.level] = pos.y;
                  }
                  return levels;
                }, {})
              ).map(([level, y]) => (
                <text
                  key={level}
                  x={20}
                  y={y + 5}
                  fontSize="12"
                  fill="#666"
                  fontWeight="bold"
                >
                  L{level}
                </text>
              ))}
            </>
          )}
        </svg>
      </div>
    );
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header Card */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center">
          🕸️ Formal Concept Analysis - Concept Lattice
        </h2>

        <div className="flex flex-wrap gap-4 mb-6">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">View:</span>
            <button
              onClick={() => setViewMode('hesse')}
              className={`px-3 py-1 text-sm rounded ${
                viewMode === 'hesse'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              📊 Hesse Diagram
            </button>
            <button
              onClick={() => setViewMode('network')}
              className={`px-3 py-1 text-sm rounded ${
                viewMode === 'network'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              🕸️ Network View
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".csv,.json"
              onChange={handleFileUpload}
              className="hidden"
              id="lattice-file-upload"
              disabled={isLoading}
            />
            <label
              htmlFor="lattice-file-upload"
              className={`px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer inline-block ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
              onClick={triggerFileUpload}
            >
              📤 Upload Data
            </label>
          </div>

          <button
            onClick={loadTestLattice}
            disabled={isLoading}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
          >
            🕸️ Load Test Lattice
          </button>

          {latticeData && (
            <button
              onClick={downloadLatticeData}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              💾 Download Lattice
            </button>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
            <div className="text-red-800">{error}</div>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Generating concept lattice...</p>
          </div>
        )}
      </div>

      {latticeData && (
        <>
          {/* Statistics Card */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Lattice Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {latticeData.stats.total_concepts}
                </div>
                <div className="text-sm text-gray-600">Total Concepts</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {latticeData.stats.total_objects}
                </div>
                <div className="text-sm text-gray-600">Objects</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {latticeData.stats.total_attributes}
                </div>
                <div className="text-sm text-gray-600">Attributes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {processingTime.toFixed(2)}s
                </div>
                <div className="text-sm text-gray-600">Processing Time</div>
              </div>
            </div>
          </div>

          {/* Visualization Card */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {viewMode === 'hesse' ? 'Hesse Diagram' : 'Network Visualization'}
            </h3>
            <div className="mb-4">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                  <span>Top Concept</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                  <span>Bottom Concept</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                  <span>Regular Concept</span>
                </div>
                {viewMode === 'hesse' && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">L0, L1, L2... = Lattice Levels</span>
                  </div>
                )}
              </div>
            </div>
            {renderLatticeVisualization()}
          </div>

          {/* Selected Node Details */}
          {selectedNode && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                ℹ️ Concept Details: {selectedNode.label}
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2">Extent (Objects):</h4>
                  <div className="bg-gray-50 p-3 rounded border max-h-32 overflow-y-auto">
                    {selectedNode.extent.length > 0 ? (
                      selectedNode.extent.map((obj, index) => (
                        <span key={index} className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs mr-1 mb-1">
                          {obj}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-500 italic">Empty extent</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">Size: {selectedNode.extent_size}</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Intent (Attributes):</h4>
                  <div className="bg-gray-50 p-3 rounded border max-h-32 overflow-y-auto">
                    {selectedNode.intent.length > 0 ? (
                      selectedNode.intent.map((attr, index) => (
                        <span key={index} className="inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-xs mr-1 mb-1">
                          {attr}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-500 italic">Empty intent</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">Size: {selectedNode.intent_size}</p>
                </div>
              </div>

              {(selectedNode.is_top || selectedNode.is_bottom) && (
                <div className="mt-4 p-3 bg-yellow-50 border-l-4 border-yellow-400">
                  <p className="text-yellow-800">
                    {selectedNode.is_top
                      ? "This is the TOP concept - it contains all attributes that are common to all objects."
                      : "This is the BOTTOM concept - it contains all objects that share at least one common attribute."
                    }
                  </p>
                </div>
              )}
            </div>
          )}

          {/* All Concepts List */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">All Concepts List</h3>
            <div className="max-h-64 overflow-y-auto">
              <div className="space-y-2">
                {latticeData.nodes.map(node => (
                  <div
                    key={node.id}
                    className={`p-3 border rounded cursor-pointer transition-colors ${
                      selectedNode?.id === node.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedNode(node)}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium">
                        Concept {node.id} {node.label}
                        {node.is_top && <span className="text-red-600 font-bold"> (TOP)</span>}
                        {node.is_bottom && <span className="text-green-600 font-bold"> (BOTTOM)</span>}
                      </span>
                      <span className="text-sm text-gray-500">
                        {node.extent_size} objects, {node.intent_size} attributes
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Objects: {node.extent.slice(0, 5).join(', ')}{node.extent.length > 5 ? '...' : ''}
                    </div>
                    <div className="text-sm text-gray-600">
                      Attributes: {node.intent.slice(0, 5).join(', ')}{node.intent.length > 5 ? '...' : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ConceptLatticeAnalysis;
