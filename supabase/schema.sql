-- Tanu Xai Session Generator - Supabase Schema
-- This schema creates the necessary tables for storing WhatsApp authentication state

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sessions table: tracks session lifecycle and metadata
CREATE TABLE IF NOT EXISTS sessions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id varchar(50) UNIQUE NOT NULL,
    phone_number varchar(20) NOT NULL,
    whatsapp_jid varchar(100),
    whatsapp_name varchar(255),
    status varchar(50) NOT NULL DEFAULT 'created',
    pairing_code_requested_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    disconnected_at timestamptz,
    error_message text
);

-- Index for fast session lookups
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);

-- Auth credentials table: stores Baileys authentication credentials
-- Uses JSONB to store the complex nested credential structure
CREATE TABLE IF NOT EXISTS auth_credentials (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id varchar(50) UNIQUE NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    creds jsonb NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Index for fast credential lookups
CREATE INDEX IF NOT EXISTS idx_auth_creds_session_id ON auth_credentials(session_id);

-- Auth keys table: stores Signal protocol keys (pre-keys, sessions, sender-keys, etc.)
-- Each key is stored as a separate row to allow targeted updates without race conditions
CREATE TABLE IF NOT EXISTS auth_keys (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id varchar(50) NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    key_type varchar(50) NOT NULL,  -- e.g., 'pre-key', 'session', 'sender-key', 'app-state-sync-key'
    key_id varchar(255) NOT NULL,   -- Key identifier within the type
    key_data jsonb NOT NULL,        -- Actual key data (serialized with Buffer support)
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(session_id, key_type, key_id)  -- Prevent duplicate keys
);

-- Indexes for efficient key queries
CREATE INDEX IF NOT EXISTS idx_auth_keys_session_id ON auth_keys(session_id);
CREATE INDEX IF NOT EXISTS idx_auth_keys_type ON auth_keys(key_type);
CREATE INDEX IF NOT EXISTS idx_auth_keys_session_type ON auth_keys(session_id, key_type);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to auto-update updated_at
DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_auth_creds_updated_at ON auth_credentials;
CREATE TRIGGER update_auth_creds_updated_at
    BEFORE UPDATE ON auth_credentials
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_auth_keys_updated_at ON auth_keys;
CREATE TRIGGER update_auth_keys_updated_at
    BEFORE UPDATE ON auth_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
-- Since we're using service role key from backend, RLS is bypassed
-- But it's good practice to set up proper policies for future security

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_keys ENABLE ROW LEVEL SECURITY;

-- Allow all operations via service role (backend only)
CREATE POLICY "Service role has full access to sessions" ON sessions
    FOR ALL USING (true);

CREATE POLICY "Service role has full access to auth_credentials" ON auth_credentials
    FOR ALL USING (true);

CREATE POLICY "Service role has full access to auth_keys" ON auth_keys
    FOR ALL USING (true);

-- Comments for documentation
COMMENT ON TABLE sessions IS 'Tracks WhatsApp session lifecycle and metadata';
COMMENT ON TABLE auth_credentials IS 'Stores Baileys authentication credentials (creds)';
COMMENT ON TABLE auth_keys IS 'Stores Signal protocol keys for WhatsApp encryption';
COMMENT ON COLUMN auth_keys.key_type IS 'Type of key: pre-key, session, sender-key, app-state-sync-key, app-state-sync-version, lid-mapping, device-list, identity-key, tctoken';
