require('dotenv').config();

module.exports = {
    port: process.env.PORT || 3000,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    sessionNamespace: process.env.SESSION_NAMESPACE || 'tanu-xai',
    nodeEnv: process.env.NODE_ENV || 'development',
    sessionEncryptionKey: process.env.SESSION_ENCRYPTION_KEY
};
