const config = window.APP_CONFIG;

export function configIsValid() {
  return Boolean(
    config?.supabaseUrl?.startsWith("https://") &&
    config?.supabaseAnonKey &&
    !config.supabaseAnonKey.startsWith("HIER_")
  );
}

export const db = configIsValid()
  ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;

export const storageBucket = config?.storageBucket || "book-covers";
