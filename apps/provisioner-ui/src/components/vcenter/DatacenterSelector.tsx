import React, { useCallback } from 'react';
import { useDatacenters } from '../../hooks/vcenter/useDatacenters';

interface DatacenterSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hasVcenter?: boolean;
}

export const DatacenterSelector: React.FC<DatacenterSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  hasVcenter = true,
}) => {
  const {
    datacenters,
    loading,
    error,
    retryable,
    fetch,
  } = useDatacenters();

  const handleOpen = useCallback(() => {
    if (!loading && datacenters.length === 0 && !error && hasVcenter) {
      fetch();
    }
  }, [loading, datacenters.length, error, hasVcenter, fetch]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  };

  const isDisabled = disabled || !hasVcenter;

  return (
    <div className="mb-4">
      <label
        htmlFor="datacenter"
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        Centro de Datos
        {loading && <span className="ml-2 text-xs text-gray-400">(cargando...)</span>}
        {error && <span className="ml-2 text-xs text-yellow-600">(sin conexión)</span>}
      </label>

      <select
        id="datacenter"
        value={value}
        onChange={handleChange}
        onClick={handleOpen}
        disabled={isDisabled || loading}
        className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        {isDisabled ? (
          <option value="">Seleccioná un vCenter primero</option>
        ) : loading && datacenters.length === 0 ? (
          <option value="">Cargando centros de datos...</option>
        ) : datacenters.length === 0 && !error ? (
          <option value="">Abrí el selector para cargar</option>
        ) : datacenters.length === 0 ? (
          <option value="">No hay centros de datos disponibles</option>
        ) : (
          <>
            <option value="">Seleccionar centro de datos...</option>
            {datacenters.map((dc) => (
              <option key={dc.name} value={dc.name}>
                {dc.name}
              </option>
            ))}
          </>
        )}
      </select>

      {error && retryable && (
        <p className="mt-1 text-xs text-gray-500">
          No se pudo obtener la lista de centros de datos.
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
