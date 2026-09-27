import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Set when the page was opened from a password-reset email link. The listener is
// attached as soon as the client exists, so the PASSWORD_RECOVERY event fired while
// the client exchanges the link's code can't be missed by components mounting later.
let _passwordRecovery = false;
export const isPasswordRecovery = () => _passwordRecovery;
export const clearPasswordRecovery = () => { _passwordRecovery = false; };

// Singleton for client-side use
let _client: ReturnType<typeof createClient> | null = null;
export function getClient() {
  if (!_client) {
    _client = createClient();
    _client.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') _passwordRecovery = true;
      if (event === 'SIGNED_OUT') _passwordRecovery = false;
    });
  }
  return _client;
}
