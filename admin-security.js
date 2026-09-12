/* VYBE Admin security bridge
   The actual authorization lives in Supabase RLS + bootstrap_vybe_admin().
   This bridge only makes the first authorised login bootstrap the database role.
*/
(() => {
  'use strict';
  if (!window.supabase?.createClient) return;
  if (window.__VYBE_ADMIN_SECURITY_BRIDGED) return;
  window.__VYBE_ADMIN_SECURITY_BRIDGED = true;

  const originalCreateClient = window.supabase.createClient.bind(window.supabase);
  window.supabase.createClient = (...args) => {
    const client = originalCreateClient(...args);
    if (client.__vybeSecurityWrapped) return client;
    client.__vybeSecurityWrapped = true;

    const originalGetUser = client.auth.getUser.bind(client.auth);
    client.auth.getUser = async (...gargs) => {
      const result = await originalGetUser(...gargs);
      const email = result?.data?.user?.email?.toLowerCase();
      if (!result?.error && email === 'shivgarg597@gmail.com') {
        try { await client.rpc('bootstrap_vybe_admin'); } catch (_) {}
      }
      return result;
    };

    const originalSignIn = client.auth.signInWithPassword.bind(client.auth);
    client.auth.signInWithPassword = async (...sargs) => {
      const result = await originalSignIn(...sargs);
      const email = result?.data?.user?.email?.toLowerCase();
      if (!result?.error && email === 'shivgarg597@gmail.com') {
        try { await client.rpc('bootstrap_vybe_admin'); } catch (_) {}
      }
      return result;
    };

    return client;
  };
})();
