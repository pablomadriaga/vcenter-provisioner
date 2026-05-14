const env = (import.meta as any).env

export const FEATURES = {
  CUSTOM_CHARTS: env.VITE_FEATURE_CUSTOM_CHARTS === 'true',
  ADVANCED_STATS: env.VITE_FEATURE_ADVANCED_STATS !== 'false',
  BULK_IMPORT: env.VITE_FEATURE_BULK_IMPORT === 'true',
}
