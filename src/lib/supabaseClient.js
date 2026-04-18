import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Returns null when env vars are absent — callers degrade gracefully
export const supabase = (supabaseUrl && supabaseAnon)
    ? createClient(supabaseUrl, supabaseAnon)
    : null;
