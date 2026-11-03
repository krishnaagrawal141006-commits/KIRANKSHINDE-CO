/* Browser-safe Supabase client foundation. The publishable/anon key is safe
   for browser use only when Row Level Security (RLS) is enabled. */
window.createSupabaseClient = async function () {
  if (!window.supabase) return null;
  if (!window.SUPABASE_CONFIG?.url || !window.SUPABASE_CONFIG?.publishableKey) {
    try {
      const response = await fetch('/api/supabase-config');
      if (response.ok) window.SUPABASE_CONFIG = await response.json();
    } catch (error) { /* local static server uses supabase-config.js */ }
  }
  if (!window.SUPABASE_CONFIG?.url || !window.SUPABASE_CONFIG?.publishableKey) return null;
  return window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.publishableKey);
};
