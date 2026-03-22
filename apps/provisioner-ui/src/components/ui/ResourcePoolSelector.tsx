import React from 'react';
import { RetryBanner, ErrorBanner } from './RetryBanner';
import { useResourcePools } from '../../hooks/useResourcePools';

interface ResourcePoolSelectorProps {
  clusterId: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const ResourcePoolSelector: React.FC<ResourcePoolSelectorProps> = ({
  clusterId,
  value,
  onChange,
  disabled = false,
}) => {
  const {
    pools,
    loading,
    error,
    retryable,
    refetch,
  } = useResourcePools({
    clusterId,
    timeout: 10000,
  });

  const showRetryBanner = retryable && !!error;
  const showErrorBanner = !loading && !!error;
  const showDropdown = !loading || pools.length > 0;

  return (
    <div className="mb-4">
      <label
        htmlFor="resource-pool"
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        Resource Pool
      </label>

      <RetryBanner
        visible={showRetryBanner}
        attempt={1}
        maxAttempts={1}
        countdown={0}
        message="Reintentando..."
        onCancel={undefined}
      />

      <ErrorBanner
        visible={showErrorBanner}
        message={`Error: ${error?.message || 'Sin conexión a vCenter'}. Podés usar el pool default del cluster.`}
        onRetry={retryable ? refetch : undefined}
      />

      {showDropdown && (
        <select
          id="resource-pool"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || loading}
          className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          {loading && pools.length === 0 ? (
            <option value="">Cargando...</option>
          ) : (
            <>
              <option value="">Usar pool default del cluster</option>
              {pools.map((pool, index) => (
                <option key={index} value={pool}>
                  {pool}
                </option>
              ))}
            </>
          )}
        </select>
      )}

      {!loading && pools.length === 0 && !error && clusterId && (
        <select
          id="resource-pool-empty"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
        >
          <option value="">Usar pool default del cluster</option>
        </select>
      )}

      {!clusterId && (
        <p className="mt-1 text-xs text-gray-500">
          Seleccioná un vCenter para ver los resource pools disponibles.
        </p>
      )}

      {clusterId && !loading && !error && pools.length === 0 && (
        <p className="mt-1 text-xs text-gray-500">
          No hay resource pools custom. Se usará el pool root del cluster.
        </p>
      )}
    </div>
  );
};
