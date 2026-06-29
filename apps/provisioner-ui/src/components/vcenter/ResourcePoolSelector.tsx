import React, { useCallback, useEffect } from 'react';
import { useResourcePools } from '../../hooks/vcenter/useResourcePools';

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
    fetch,
  } = useResourcePools({ clusterId });

  const handleOpen = useCallback(() => {
    if (clusterId && !loading && pools.length === 0 && !error) {
      fetch();
    }
  }, [clusterId, loading, pools.length, error, fetch]);

  useEffect(() => {
    if (clusterId) {
      fetch();
    }
  }, [clusterId, fetch]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  };

  const isDisabled = disabled || !clusterId;

  if (!clusterId) {
    return (
      <div className="mb-4">
        <label
          htmlFor="resource-pool"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Pool de Recursos
          <span className="ml-2 text-xs text-gray-400">(opcional)</span>
        </label>
        <select
          id="resource-pool"
          value=""
          disabled
          className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-gray-100 cursor-not-allowed"
        >
          <option value="">Seleccioná un cluster primero</option>
        </select>
        <p className="mt-1 text-xs text-gray-500">
          Seleccioná un cluster para ver los pools de recursos disponibles.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <label
        htmlFor="resource-pool"
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        Pool de Recursos
        <span className="ml-2 text-xs text-gray-400">(opcional)</span>
        {loading && <span className="ml-2 text-xs text-gray-400">(cargando...)</span>}
        {error && <span className="ml-2 text-xs text-yellow-600">(sin conexión)</span>}
      </label>

      <select
        id="resource-pool"
        value={value}
        onChange={handleChange}
        onClick={handleOpen}
        disabled={isDisabled || loading}
        className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        {loading && pools.length === 0 ? (
          <option value="">Cargando pools de recursos...</option>
        ) : pools.length === 0 && !error ? (
          <>
            <option value="">Usar pool default del cluster</option>
          </>
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

      {error && retryable ? (
        <p className="mt-1 text-xs text-gray-500">
          No se pudo obtener la lista de pools de recursos.
          <button
            type="button"
            onClick={fetch}
            className="ml-2 text-indigo-600 hover:text-indigo-800 underline"
          >
            Reintentar
          </button>
        </p>
      ) : pools.length === 0 && !loading && !error ? (
        <p className="mt-1 text-xs text-gray-500">
          Se usará el pool default del cluster.
        </p>
      ) : null}
    </div>
  );
};
