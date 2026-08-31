import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  sessionNamespace: process.env.SESSION_NAMESPACE || 'tanu-xai',
  pairingTimeoutMs: parseInt(process.env.PAIRING_TIMEOUT_MS || '300000', 10), // 5 min
  isProduction: (process.env.NODE_ENV || 'development') === 'production'
};
