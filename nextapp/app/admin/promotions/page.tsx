'use client';
import { useEffect, useState } from 'react';
import SaleCampaign from '@/components/admin/SaleCampaign';
import { listPromoCodes, createPromoCode, setPromoActive, deletePromoCode, fmtDate, type PromoCode } from '@/lib/admin';
import { PageHeader, Card, Badge, EmptyState, SkeletonRows } from '@/components/admin/ui';
import { useFeedback } from '@/components/admin/Feedback';

// Codes the store itself advertises — warn if they don't exist, or customers get "invalid code"
const ADVERTISED = [{ code: 'WELCOME10', where: 'the thank-you screen shown to guest shoppers after checkout' }];

export default function PromotionsPage() {
  const { toast, confirm } = useFeedback();
  const [codes, setCodes] = useState<PromoCode[] | null>(null);
  const [newCode, setNewCode] = useState('');
  const [newPct, setNewPct] = useState('10');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);
  const load = () => setReloadKey(k => k + 1);

  useEffect(() => {
    let cancelled = false;
    listPromoCodes()
      .then(c => { if (!cancelled) setCodes(c); })
      .catch(e => {
        if (cancelled) return;
        toast(e instanceof Error ? e.message : 'Could not load promo codes.', 'error');
        setCodes([]);
      });
    return () => { cancelled = true; };
  }, [reloadKey, toast]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = newCode.trim().toUpperCase();
    const pct = Number(newPct);
    if (!/^[A-Z0-9_-]{3,20}$/.test(code)) { setFormError('Use 3–20 letters or numbers, no spaces.'); return; }
    if (!Number.isInteger(pct) || pct < 1 || pct > 90) { setFormError('Discount must be a whole number from 1 to 90.'); return; }
    setBusy(true);
    try {
      await createPromoCode(code, pct);
      setNewCode(''); setFormError('');
      toast(`Code ${code} created.`);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create the code.');
    }
    setBusy(false);
  };

  const toggle = async (c: PromoCode) => {
    try {
      await setPromoActive(c.id, !c.isActive);
      setCodes(list => list?.map(x => x.id === c.id ? { ...x, isActive: !c.isActive } : x) || null);
      toast(`${c.code} ${c.isActive ? 'paused' : 'activated'}.`);
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not update.', 'error'); }
  };

  const remove = async (c: PromoCode) => {
    const ok = await confirm({ title: `Delete ${c.code}?`, message: c.uses ? `It has been used ${c.uses} time(s). Pausing it keeps the history.` : undefined, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await deletePromoCode(c.id);
      setCodes(list => list?.filter(x => x.id !== c.id) || null);
      toast(`${c.code} deleted.`);
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not delete.', 'error'); }
  };

  const missing = codes ? ADVERTISED.filter(a => !codes.some(c => c.code === a.code && c.isActive)) : [];

  return (
    <>
      <PageHeader title="Promotions" subtitle="The homepage promo and discount codes." />

      <div style={{ marginBottom: 16 }}><SaleCampaign /></div>

      {missing.map(m => (
        <div key={m.code} className="adm-callout">
          <div><strong>{m.code} is advertised but not active.</strong> <span className="adm-muted">It&apos;s offered on {m.where}, so customers who try it are told it&apos;s invalid.</span></div>
          <button type="button" className="adm-btn adm-btn-primary" onClick={() => { setNewCode(m.code); setNewPct('10'); document.getElementById('promo-code')?.focus(); }}>Set it up</button>
        </div>
      ))}

      <div className="adm-grid adm-grid-main">
        <Card title="Discount codes">
          {codes === null ? <SkeletonRows rows={3} /> : codes.length === 0 ? (
            <EmptyState title="No discount codes yet">Create one on the right.</EmptyState>
          ) : (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead><tr><th>Code</th><th>Discount</th><th>Status</th><th className="num">Times used</th><th>Created</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {codes.map(c => (
                    <tr key={c.id} style={{ cursor: 'default' }}>
                      <td className="adm-td-main"><strong className="adm-mono" style={{ fontSize: 14 }}>{c.code}</strong></td>
                      <td data-label="Discount">{c.discountPercent}% off</td>
                      <td data-label="Status">{c.isActive ? <Badge tone="green">Active</Badge> : <Badge>Paused</Badge>}</td>
                      <td data-label="Times used" className="num">{c.uses}</td>
                      <td data-label="Created">{fmtDate(c.createdAt)}</td>
                      <td data-label="">
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button type="button" className="adm-btn adm-btn-sm" onClick={() => toggle(c)}>{c.isActive ? 'Pause' : 'Activate'}</button>
                          <button type="button" className="adm-btn adm-btn-sm adm-btn-ghost-danger" onClick={() => remove(c)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="adm-muted adm-small" style={{ marginTop: 12 }}>Each customer can use a code once. Customers must be logged in to apply codes.</p>
        </Card>

        <div className="adm-stack">
          <Card title="New discount code">
            <form onSubmit={create} className="adm-stack" noValidate>
              <div className="adm-field">
                <label htmlFor="promo-code">Code</label>
                <input id="promo-code" className="adm-input adm-mono" style={{ textTransform: 'uppercase', fontSize: 14 }} value={newCode} onChange={e => { setNewCode(e.target.value); setFormError(''); }} placeholder="e.g. EASTER15" aria-invalid={!!formError} />
              </div>
              <div className="adm-field">
                <label htmlFor="promo-pct">Discount</label>
                <div className="adm-prefix"><span>%</span><input id="promo-pct" className="adm-input" type="number" min="1" max="90" value={newPct} onChange={e => { setNewPct(e.target.value); setFormError(''); }} /></div>
              </div>
              {formError && <span className="adm-error" style={{ color: '#B91C1C', fontWeight: 600, fontSize: 13 }}>{formError}</span>}
              <button type="submit" className="adm-btn adm-btn-primary" disabled={busy || !newCode.trim()}>Create code</button>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
