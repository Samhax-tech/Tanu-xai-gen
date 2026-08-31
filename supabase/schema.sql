-- Tanu-XAI Session Generator: Supabase schema
-- Run this once in the Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists sessions (
    id uuid primary key default gen_random_uuid(),
    session_id text unique not null,
    phone_number text not null,
    status text not null default 'created',
    pairing_code text,
    pairing_code_requested_at timestamptz,
    whatsapp_jid text,
    whatsapp_name text,
    error_message text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    authenticated_at timestamptz,
    disconnected_at timestamptz,
    expires_at timestamptz
);

create index if not exists idx_sessions_status on sessions(status);
create index if not exists idx_sessions_phone on sessions(phone_number);
create index if not exists idx_sessions_created_at on sessions(created_at);

create table if not exists auth_credentials (
    id uuid primary key default gen_random_uuid(),
    session_id text unique not null references sessions(session_id) on delete cascade,
    creds jsonb not null,
    updated_at timestamptz not null default now()
);

create index if not exists idx_auth_credentials_session on auth_credentials(session_id);

create table if not exists auth_keys (
    id uuid primary key default gen_random_uuid(),
    session_id text not null references sessions(session_id) on delete cascade,
    key_type text not null,
    key_id text not null,
    key_data jsonb,
    updated_at timestamptz not null default now(),
    unique(session_id, key_type, key_id)
);

create index if not exists idx_auth_keys_session on auth_keys(session_id);
create index if not exists idx_auth_keys_lookup on auth_keys(session_id, key_type, key_id);

-- Row Level Security: the app only ever talks to Supabase using the
-- service-role key from the backend, which bypasses RLS by design. Enabling
-- RLS with no permissive policies still blocks any accidental use of the
-- anon/public key from ever reading these tables.
alter table sessions enable row level security;
alter table auth_credentials enable row level security;
alter table auth_keys enable row level security;
