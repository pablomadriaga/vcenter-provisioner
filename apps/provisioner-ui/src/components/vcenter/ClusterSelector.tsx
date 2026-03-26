import React, { useCallback } from 'react';
import { useClusters } from '../../hooks/vcenter/useClusters';

interface ClusterSelectorProps {
  datacenter: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const ClusterSelector: React.FC<ClusterSelectorProps> = ({
  datacenter,
  value,
  onChange,
  disabled = false,
}) => {
  const {
    clusters,
    loading,
    error,
    retryable,
    fetch,
  } = useClusters({ datacenter });

  const handleOpen = useCallback(() => {
    if (datacenter && !loading && clusters.length === 0 && !error) {
      fetch();
    }
  }, [datacenter, loading, clusters.length, error, fetch]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  };

  const isDisabled = disabled || !datacenter;

  return (
    <div className="mb-4">
      <label
        htmlFor="cluster"
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        Cluster
        {loading && <span className="ml-2 text-xs text-gray-400">(cargando...)</span>}
        {error && <span className="ml-2 text-xs text-yellow-600">(sin conexión)</span>}
      </label>

      <select
        id="cluster"
        value={value}
        onChange={handleChange}
        onClick={handleOpen}
        disabled={isDisabled || loading}
        className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        {isDisabled ? (
          <option value="">Seleccioná un centro de datos primero</option>
        ) : loading && clusters.length === 0 ? (
          <option value="">Cargando clusters...</option>
        ) : clusters.length === 0 && !error ? (
          <option value="">Abrí el selector para cargar</option>
        ) : clusters.length === 0 ? (
          <option value="">No hay clusters disponibles</option>
        ) : (
          <>
            <option value="">Seleccionar cluster...</option>
            {clusters.map((cluster) => (
              <option key={cluster.name} value={cluster.name}>
                {cluster.name}
              </option>
            ))}
          </>
        )}
      </select>

      {error && retryable && (
        <p className="mt-1 text-xs text-gray-500">
          No se pudo obtener la lista de clusters.
          <button
            type="button"
            onClick={fetch}
            className="ml-2 text-indigo-600 hover:text-indigo-800 underline"
          >
            Reintentar
          </button>
        </p>
      )}
    </div>
  );
};
