import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { log } from './logger.ts'

// Ensure environment variables are available
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl) {
  log.error('Missing environment variable: SUPABASE_URL');
  throw new Error('Missing environment variable: SUPABASE_URL');
}
if (!supabaseServiceKey) {
  log.error('Missing environment variable: SUPABASE_SERVICE_ROLE_KEY');
  throw new Error('Missing environment variable: SUPABASE_SERVICE_ROLE_KEY');
}

// Create and export the Supabase client
// Use the service_role key for backend operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    // Automatically persist user sessions was not specified,
    // but the service key implies backend use where sessions aren't typical.
    // If user context is needed later, this might need adjustment.
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

log.info('Supabase admin client initialized.');
