/* Browser-safe Supabase client foundation. The publishable/anon key is safe
   for browser use only when Row Level Security (RLS) is enabled. */
window.createSupabaseClient = function () {
  if (!window.supabase || !window.SUPABASE_CONFIG?.url || !window.SUPABASE_CONFIG?.publishableKey) return null;
  return window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.publishableKey);
};
