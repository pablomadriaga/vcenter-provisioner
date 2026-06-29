import React, { useMemo } from 'react';
import { ConnectivityEntry } from '../../hooks/useServiceMonitor';

interface ServiceDiagramProps {
  connectivity: ConnectivityEntry[];
}

interface NodePosition {
  id: string;
  label: string;
  x: number;
  y: number;
}

const NODES: Record<string, NodePosition> = {
  'provisioner-ui': { id: 'provisioner-ui', label: 'UI', x: 50, y: 10 },
  'api-gateway': { id: 'api-gateway', label: 'Gateway', x: 50, y: 25 },
  'auth-service': { id: 'auth-service', label: 'Auth', x: 20, y: 40 },
  'typing-service': { id: 'typing-service', label: 'Typing', x: 80, y: 40 },
  'vm-orchestrator': { id: 'vm-orchestrator', label: 'Orchestrator', x: 50, y: 55 },
  'vcenter-operations': { id: 'vcenter-operations', label: 'vCenter', x: 20, y: 70 },
  'stats-service': { id: 'stats-service', label: 'Stats', x: 50, y: 70 },
  'monitoring-service': { id: 'monitoring-service', label: 'Monitor', x: 80, y: 70 },
  'credential-manager': { id: 'credential-manager', label: 'CredMgr', x: 20, y: 90 },
};

export const ServiceDiagram: React.FC<ServiceDiagramProps> = ({ connectivity }) => {
  const nodeStatus = useMemo(() => {
    const status: Record<string, 'up' | 'down' | 'unknown'> = {};
    const allNodes = Object.keys(NODES);
    const conn = connectivity || [];

    allNodes.forEach((nodeId) => {
      const downConnections = conn.filter(
        (c) => c.target === nodeId && !c.reachable
      );
      const upConnections = conn.filter(
        (c) => c.target === nodeId && c.reachable
      );

      if (downConnections.length > 0 && upConnections.length === 0) {
        status[nodeId] = 'down';
      } else if (upConnections.length > 0) {
        status[nodeId] = 'up';
      } else {
        status[nodeId] = 'unknown';
      }
    });

    return status;
  }, [connectivity]);

  const edges = useMemo(() => {
    return (connectivity || [])
      .filter((c) => c.reachable && c.source !== c.target)
      .map((c) => ({
        from: c.source,
        to: c.target,
        latency: c.latency_ms,
      }));
  }, [connectivity]);

  const getNodeColor = (nodeId: string): string => {
    const status = nodeStatus[nodeId] || 'unknown';
    switch (status) {
      case 'up':
        return '#10b981';
      case 'down':
        return '#ef4444';
      default:
        return '#9ca3af';
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4 overflow-hidden">
      <svg viewBox="0 0 100 110" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker
            id="arrowhead"
            markerWidth="6"
            markerHeight="6"
            refX={12}
            refY={3}
            orient="auto"
            fill="#6b7280"
          >
            <polygon points="0 0, 6 3, 0 6" />
          </marker>
        </defs>

        {edges.map((edge, idx) => {
          const fromNode = NODES[edge.from];
          const toNode = NODES[edge.to];
          if (!fromNode || !toNode) return null;

          return (
            <line
              key={idx}
              x1={`${fromNode.x}%`}
              y1={`${fromNode.y}%`}
              x2={`${toNode.x}%`}
              y2={`${toNode.y}%`}
              stroke="#4b5563"
              strokeWidth="0.5"
              markerEnd="url(#arrowhead)"
              opacity={0.6}
            />
          );
        })}

        {Object.entries(NODES).map(([nodeId, node]) => {
          const color = getNodeColor(nodeId);
          const isUnknown = nodeStatus[nodeId] === 'unknown';

          return (
            <g key={nodeId}>
              <circle
                cx={`${node.x}%`}
                cy={`${node.y}%`}
                r={6}
                fill={color}
                className={isUnknown ? 'opacity-50' : ''}
              />
              <text
                x={`${node.x}%`}
                y={`${node.y + 10}%`}
                textAnchor="middle"
                fill="#e5e7eb"
                fontSize={5}
                fontWeight="500"
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flex justify-center space-x-6 mt-3 text-xs text-gray-400">
        <div className="flex items-center">
          <span className="w-3 h-3 rounded-full bg-green-500 mr-2" />
          <span>Up</span>
        </div>
        <div className="flex items-center">
          <span className="w-3 h-3 rounded-full bg-red-500 mr-2" />
          <span>Down</span>
        </div>
        <div className="flex items-center">
          <span className="w-3 h-3 rounded-full bg-gray-400 mr-2" />
          <span>Unknown</span>
        </div>
      </div>
    </div>
  );
};

export default ServiceDiagram;
