import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

/*
 * Landing page for links in Supabase auth emails (sign-up confirmation, password reset).
 *
 * The email templates point here with a one-time token_hash. We verify it on the server
 * and set the login cookies, so the customer is signed in no matter which browser or
 * device opens the link — e.g. the Gmail app's built-in browser, which the default
 * Supabase link (tied to the browser used to sign up) can't sign in.
 *
 * Email template links (Supabase → Authentication → Emails):
 *   Confirm sign up:  {{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email
 *   Reset password:   {{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;

  const to = (path: string) => NextResponse.redirect(new URL(path, url.origin));

  // Older-style links (email templates not updated yet) arrive with ?code=… instead.
  // These only work in the browser that started the sign-up/reset, so try, and explain if it fails.
  const code = url.searchParams.get('code');
  if (!tokenHash && code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) {
      return to('/auth?error_code=other_browser&error_description=' + encodeURIComponent(
        'Your email is confirmed, but this link was opened in a different browser or app, so we couldn’t sign you in. Please log in below.'));
    }
    if ((data as { redirectType?: string | null }).redirectType === 'recovery') return to('/auth?mode=reset');
    return to('/profile?welcome=1');
  }

  if (!tokenHash || !type) {
    return to('/auth?error_code=invalid_link&error_description=' + encodeURIComponent('That link is incomplete. Please request a new one.'));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error || !data.user) {
    // Expired or already-used links: the /auth page turns this into a friendly message
    const code = /expired|invalid/i.test(error?.message || '') ? 'otp_expired' : 'verify_failed';
    return to(`/auth?error_code=${code}&error_description=${encodeURIComponent(error?.message || 'Could not verify the link.')}`);
  }

  // Password reset: signed in with a temporary session — show the "set a new password" form
  if (type === 'recovery') return to('/auth?mode=reset');

  // Sign-up confirmed: straight into the account (admins to the dashboard)
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  return to(profile?.role === 'admin' ? '/admin' : '/profile?welcome=1');
}
