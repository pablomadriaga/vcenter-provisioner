import React from 'react';

interface RetryBannerProps {
  visible: boolean;
  attempt: number;
  maxAttempts: number;
  countdown: number;
  message?: string;
  onCancel?: () => void;
}

export const RetryBanner: React.FC<RetryBannerProps> = ({
  visible,
  attempt,
  maxAttempts,
  countdown,
  message = 'Reintentando conexión...',
  onCancel,
}) => {
  if (!visible) return null;

  return (
    <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="animate-spin h-4 w-4 border-2 border-amber-500 border-t-transparent rounded-full" />
          <div>
            <p className="text-sm text-amber-800 font-medium">{message}</p>
            <p className="text-xs text-amber-600">
              Intento {attempt} de {maxAttempts} • Esperando {countdown}s...
            </p>
          </div>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-amber-600 hover:text-amber-800 underline"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
};

interface ErrorBannerProps {
  visible: boolean;
  message: string;
  onRetry?: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  visible,
  message,
  onRetry,
}) => {
  if (!visible) return null;

  return (
    <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            className="h-5 w-5 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm text-red-700">{message}</p>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="text-sm text-red-600 hover:text-red-800 font-medium"
          >
            Reintentar
          </button>
        )}
      </div>
    </div>
  );
};

interface SuccessBannerProps {
  visible: boolean;
  message?: string;
}

export const SuccessBanner: React.FC<SuccessBannerProps> = ({
  visible,
  message = 'Cargado exitosamente',
}) => {
  if (!visible) return null;

  return (
    <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
      <div className="flex items-center gap-2">
        <svg
          className="h-5 w-5 text-green-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
        <p className="text-sm text-green-700">{message}</p>
      </div>
    </div>
  );
};
