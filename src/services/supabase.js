import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

// This client uses the service-role key and must NEVER be imported by
// anything that ships to the browser. It only exists on the server.
export const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});
