'use client';
import { useEffect, useState } from 'react';
import SaleCampaign from '@/components/admin/SaleCampaign';
import { listPromoCodes, createPromoCode, updatePromoCode, setPromoActive, deletePromoCode, promoState, type PromoCode } from '@/lib/admin';
import { PageHeader, Card, Badge, EmptyState, SkeletonRows } from '@/components/admin/ui';
import { useFeedback } from '@/components/admin/Feedback';

// Codes the store itself advertises — warn if they don't exist, or customers get "invalid code"
const ADVERTISED = [{ code: 'WELCOME10', where: 'the thank-you screen shown to guest shoppers after checkout' }];

/* Dates are picked as whole days in the admin's own time zone: a code set for 24–26 Dec
   runs from 24 Dec 00:00 until 27 Dec 00:00 (ends_at is stored as the moment it stops). */
const DAY = 86_400_000;
const toStartIso = (d: string) => (d ? new Date(`${d}T00:00`).toISOString() : null);
const toEndIso = (d: string) => (d ? new Date(new Date(`${d}T00:00`).getTime() + DAY).toISOString() : null);
const toInput = (iso: string | null, end = false) => {
  if (!iso) return '';
  const t = new Date(new Date(iso).getTime() - (end ? 1 : 0));
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};
const short = (iso: string, end = false) =>
  new Date(new Date(iso).getTime() - (end ? 1 : 0)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const dateRange = (c: PromoCode) =>
  c.startsAt && c.endsAt ? `${short(c.startsAt)} – ${short(c.endsAt, true)}`
    : c.startsAt ? `From ${short(c.startsAt)}`
      : c.endsAt ? `Until ${short(c.endsAt, true)}`
        : 'No end date';
const todayInput = () => toInput(new Date().toISOString());

export default function PromotionsPage() {
  const { toast, confirm } = useFeedback();
  const [codes, setCodes] = useState<PromoCode[] | null>(null);
  const [newCode, setNewCode] = useState('');
  const [newPct, setNewPct] = useState('10');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [editing, setEditing] = useState<PromoCode | null>(null); // set = the form edits this code
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

  const resetForm = () => {
    setEditing(null); setNewCode(''); setNewPct('10'); setStartDate(''); setEndDate(''); setFormError('');
  };

  const startEdit = (c: PromoCode) => {
    setEditing(c);
    setNewCode(c.code);
    setNewPct(String(c.discountPercent));
    setStartDate(toInput(c.startsAt));
    setEndDate(toInput(c.endsAt, true));
    setFormError('');
    document.getElementById('promo-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = newCode.trim().toUpperCase();
    const pct = Number(newPct);
    if (!editing && !/^[A-Z0-9_-]{3,20}$/.test(code)) { setFormError('Use 3–20 letters or numbers, no spaces.'); return; }
    if (!Number.isInteger(pct) || pct < 1 || pct > 90) { setFormError('Discount must be a whole number from 1 to 90.'); return; }
    if (startDate && endDate && endDate < startDate) { setFormError('The end date is before the start date.'); return; }
    if (endDate && endDate < todayInput()) { setFormError('The end date has already passed.'); return; }
    const dates = { startsAt: toStartIso(startDate), endsAt: toEndIso(endDate) };
    setBusy(true);
    try {
      if (editing) {
        await updatePromoCode(editing.id, { discountPercent: pct, ...dates });
        toast(`${editing.code} updated.`);
      } else {
        await createPromoCode(code, pct, dates);
        toast(`Code ${code} created.`);
      }
      resetForm();
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save the code.');
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

  const missing = codes ? ADVERTISED.filter(a => !codes.some(c => c.code === a.code && promoState(c) === 'active')) : [];

  return (
    <>
      <PageHeader title="Promotions" subtitle="The homepage promo and discount codes." />

      <div style={{ marginBottom: 16 }}><SaleCampaign /></div>

      {missing.map(m => (
        <div key={m.code} className="adm-callout">
          <div><strong>{m.code} is advertised but not active.</strong> <span className="adm-muted">It&apos;s offered on {m.where}, so customers who try it are told it&apos;s invalid.</span></div>
          <button type="button" className="adm-btn adm-btn-primary" onClick={() => { resetForm(); setNewCode(m.code); document.getElementById('promo-code')?.focus(); }}>Set it up</button>
        </div>
      ))}

      <div className="adm-grid adm-grid-main">
        <Card title="Discount codes">
          {codes === null ? <SkeletonRows rows={3} /> : codes.length === 0 ? (
            <EmptyState title="No discount codes yet">Create one on the right.</EmptyState>
          ) : (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead><tr><th>Code</th><th>Discount</th><th>Status</th><th>Runs</th><th className="num">Times used</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {codes.map(c => (
                    <tr key={c.id} style={{ cursor: 'default' }}>
                      <td className="adm-td-main"><strong className="adm-mono" style={{ fontSize: 14 }}>{c.code}</strong></td>
                      <td data-label="Discount">{c.discountPercent}% off</td>
                      <td data-label="Status"><PromoBadge code={c} /></td>
                      <td data-label="Runs">{dateRange(c)}</td>
                      <td data-label="Times used" className="num">{c.uses}</td>
                      <td data-label="">
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button type="button" className="adm-btn adm-btn-sm" onClick={() => startEdit(c)}>Edit</button>
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
          <p className="adm-muted adm-small" style={{ marginTop: 12 }}>Only logged-in customers can use codes, once each. Codes with dates switch on and off by themselves.</p>
        </Card>

        <div className="adm-stack">
          <Card title={editing ? `Edit ${editing.code}` : 'New discount code'}>
            <form id="promo-form" onSubmit={submit} className="adm-stack" noValidate>
              <div className="adm-field">
                <label htmlFor="promo-code">Code</label>
                <input id="promo-code" className="adm-input adm-mono" style={{ textTransform: 'uppercase', fontSize: 14 }} value={newCode} onChange={e => { setNewCode(e.target.value); setFormError(''); }} placeholder="e.g. XMAS20" aria-invalid={!!formError} disabled={!!editing} />
                {editing && <span className="adm-hint">A code’s name can’t be changed. Create a new one instead.</span>}
              </div>
              <div className="adm-field">
                <label htmlFor="promo-pct">Discount</label>
                <div className="adm-prefix"><span>%</span><input id="promo-pct" className="adm-input" type="number" min="1" max="90" value={newPct} onChange={e => { setNewPct(e.target.value); setFormError(''); }} /></div>
              </div>
              <div className="adm-form-grid">
                <div className="adm-field">
                  <label htmlFor="promo-start">Starts <span className="adm-muted">(optional)</span></label>
                  <input id="promo-start" type="date" className="adm-input" value={startDate} onChange={e => { setStartDate(e.target.value); setFormError(''); }} />
                </div>
                <div className="adm-field">
                  <label htmlFor="promo-end">Ends <span className="adm-muted">(optional)</span></label>
                  <input id="promo-end" type="date" className="adm-input" value={endDate} min={startDate || undefined} onChange={e => { setEndDate(e.target.value); setFormError(''); }} />
                </div>
              </div>
              <span className="adm-hint">
                {startDate || endDate
                  ? `Works ${startDate ? `from the start of ${short(toStartIso(startDate)!)}` : 'from now'}${endDate ? ` until the end of ${short(toEndIso(endDate)!, true)}` : ', with no end date'}.`
                  : 'Leave both empty to start now and run until you pause it.'}
              </span>
              {formError && <span className="adm-error" style={{ color: '#B91C1C', fontWeight: 600, fontSize: 13 }}>{formError}</span>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="adm-btn adm-btn-primary" disabled={busy || !newCode.trim()}>{editing ? 'Save changes' : 'Create code'}</button>
                {editing && <button type="button" className="adm-btn" onClick={resetForm}>Cancel</button>}
              </div>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}

/** Active / Scheduled / Ended / Paused, taking the code's dates into account */
function PromoBadge({ code }: { code: PromoCode }) {
  const st = promoState(code);
  if (st === 'active') return <Badge tone="green">Active</Badge>;
  if (st === 'scheduled') return <Badge tone="blue">Scheduled</Badge>;
  if (st === 'ended') return <Badge>Ended</Badge>;
  return <Badge>Paused</Badge>;
}
