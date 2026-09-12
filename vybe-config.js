/* VYBE public Supabase configuration.
   The anon/publishable key is safe to expose in browser code only when
   Supabase Row Level Security (RLS) is enabled, as in supabase/schema.sql.
   Never put a Supabase service_role key here.
*/
window.VYBE_CONFIG = window.VYBE_CONFIG || {
  supabaseUrl: 'https://ilbwosnlobkxvlepcxha.supabase.co',
  supabaseAnonKey: 'sb_publishable_5MU9N1ki78vy-uvEiTTkdA_YRCI8_0j',
  musicBucket: 'music',
  artworkBucket: 'artwork',
  artistAssetsBucket: 'artist-assets'
};
