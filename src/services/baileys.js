import { initAuthCreds, BufferJSON } from '@whiskeysockets/baileys';
import { supabase } from './supabase.js';
import { child } from '../utils/logger.js';

const log = child({ module: 'auth-store' });

// Baileys' BufferJSON replacer/reviver correctly round-trips Buffers, typed
// arrays and the library's internal key shapes. We reuse it instead of a
// custom (fragile) serializer, but store the *parsed* JS object as jsonb
// rather than a JSON string, since Postgres already gives us jsonb.
function serialize(value) {
  // JSON.stringify -> JSON.parse via BufferJSON.replacer gives us a plain
  // object tree with Buffers turned into { type: 'Buffer', data: [...] }
  // wrappers, which is what jsonb wants to store.
  return JSON.parse(JSON.stringify(value, BufferJSON.replacer));
}

function deserialize(value) {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value), BufferJSON.reviver);
}

/**
 * Load (or initialize) the persistent credentials row for a session.
 */
async function loadCreds(sessionId) {
  const { data, error } = await supabase
    .from('auth_credentials')
    .select('creds')
    .eq('session_id', sessionId)
    .maybeSingle();

  if (error) {
    log.error({ err: error.message, sessionId }, 'Failed to load auth_credentials');
    throw error;
  }

  if (data?.creds) {
    return deserialize(data.creds);
  }

  const fresh = initAuthCreds();
  await saveCreds(sessionId, fresh);
  return fresh;
}

async function saveCreds(sessionId, creds) {
  const { error } = await supabase
    .from('auth_credentials')
    .upsert(
      {
        session_id: sessionId,
        creds: serialize(creds),
        updated_at: new Date().toISOString()
      },
      { onConflict: 'session_id' }
    );

  if (error) {
    log.error({ err: error.message, sessionId }, 'Failed to save auth_credentials');
    throw error;
  }
}

/**
 * Fetch a set of key ids for a given key type for one session.
 * Returns a map of id -> parsed key data (only for ids that exist).
 */
async function getKeys(sessionId, type, ids) {
  if (!ids.length) return {};

  const { data, error } = await supabase
    .from('auth_keys')
    .select('key_id, key_data')
    .eq('session_id', sessionId)
    .eq('key_type', type)
    .in('key_id', ids);

  if (error) {
    log.error({ err: error.message, sessionId, type }, 'Failed to load auth_keys');
    throw error;
  }

  const result = {};
  for (const row of data || []) {
    let value = deserialize(row.key_data);
    if (type === 'app-state-sync-key' && value) {
      // Baileys expects this shape to come back as the protobuf-decoded type;
      // it round-trips fine through BufferJSON as long as it was serialized
      // the same way going in.
    }
    result[row.key_id] = value;
  }
  return result;
}

/**
 * Apply a Baileys keys.set(...) batch: { [type]: { [id]: data | null } }.
 * A null value means "delete this key".
 */
async function setKeys(sessionId, data) {
  const upserts = [];
  const deletions = [];

  for (const type of Object.keys(data)) {
    for (const id of Object.keys(data[type])) {
      const value = data[type][id];
      if (value === null || value === undefined) {
        deletions.push({ type, id });
      } else {
        upserts.push({
          session_id: sessionId,
          key_type: type,
          key_id: id,
          key_data: serialize(value),
          updated_at: new Date().toISOString()
        });
      }
    }
  }

  if (upserts.length) {
    const { error } = await supabase
      .from('auth_keys')
      .upsert(upserts, { onConflict: 'session_id,key_type,key_id' });
    if (error) {
      log.error({ err: error.message, sessionId }, 'Failed to upsert auth_keys');
      throw error;
    }
  }

  for (const { type, id } of deletions) {
    const { error } = await supabase
      .from('auth_keys')
      .delete()
      .eq('session_id', sessionId)
      .eq('key_type', type)
      .eq('key_id', id);
    if (error) {
      log.error({ err: error.message, sessionId, type, id }, 'Failed to delete auth_key');
      throw error;
    }
  }
}

/**
 * Build a Baileys-compatible { state, saveCreds } pair for one session,
 * fully backed by Supabase. Nothing here touches the local filesystem.
 */
export async function useSupabaseAuthState(sessionId) {
  const creds = await loadCreds(sessionId);

  const state = {
    creds,
    keys: {
      get: async (type, ids) => getKeys(sessionId, type, ids),
      set: async (data) => setKeys(sessionId, data)
    }
  };

  const saveCredsFn = async () => saveCreds(sessionId, state.creds);

  return { state, saveCreds: saveCredsFn };
}

/** Remove all persisted auth material for a session (credentials + keys). */
export async function deleteAuthState(sessionId) {
  const { error: keysErr } = await supabase.from('auth_keys').delete().eq('session_id', sessionId);
  if (keysErr) log.error({ err: keysErr.message, sessionId }, 'Failed to delete auth_keys');

  const { error: credsErr } = await supabase
    .from('auth_credentials')
    .delete()
    .eq('session_id', sessionId);
  if (credsErr) log.error({ err: credsErr.message, sessionId }, 'Failed to delete auth_credentials');
}
