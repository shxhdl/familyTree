import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://bgpgtalamvqqpbytpcxt.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_P3cQ3XkH5F3uajy3ZN5RxA__rzTnrou';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
