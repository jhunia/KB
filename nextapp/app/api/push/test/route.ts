import { createClient } from '@/lib/supabase/server';
import { pushConfigured, sendToAdmins } from '@/lib/push';

/* "Send a test alert" button in the admin — sends only to the signed-in admin's own devices */
export async function POST() {
  if (!pushConfigured()) {
    return Response.json({ error: 'Order alerts aren’t set up on the server yet (missing keys).' }, { status: 503 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return Response.json({ error: 'Admins only.' }, { status: 403 });

  const result = await sendToAdmins(
    { title: 'Order alerts are on ✓', body: 'You’ll get a notification like this whenever an order is paid.', url: '/admin/orders', tag: 'test' },
    user.id,
  );
  if (!result.sent) return Response.json({ error: 'No device received it — turn alerts off and on again.' }, { status: 404 });
  return Response.json(result);
}
