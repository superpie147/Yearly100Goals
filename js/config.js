// Supabase connection config + shared client.
// The anon key is a *public* key by design — safe to ship in a static site.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const SUPABASE_URL = 'https://jfkfisiyszhjwokhhsbm.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impma2Zpc2l5c3poandva2hoc2JtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2OTM0ODAsImV4cCI6MjA5OTI2OTQ4MH0.yWv1Gs3IOXmoR8NDLb7wGSSI580Nv3mPgUhqeEcAf44';

export const STORAGE_BUCKET = 'goal-screenshots';

// detectSessionInUrl lets supabase-js pick up the OAuth token after the
// Google redirect. We use hash routing, so we clean up the URL ourselves once
// the session is parsed (see auth.js).
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});

export const PRESET_CATEGORIES = [
  '健康與運動',
  '旅行與體驗',
  '學習與成長',
  '人際與家庭',
  '財務與理財',
  '興趣與娛樂',
  '生活習慣',
  '工作與事業',
];

export const GOAL_TARGET = 100;
