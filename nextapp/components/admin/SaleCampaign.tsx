'use client';
/* Admin → Promotions: the homepage sale campaign (ad image in the hero + sale banner) */
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { db } from '@/lib/db';
import { getPromo, savePromo, isPromoLive, settingsTableExists, DEFAULT_PROMO, PROMO_LINKS, type PromoSettings } from '@/lib/promo';
import { Card, Badge, SkeletonRows } from './ui';
import { useFeedback } from './Feedback';

// <input type="datetime-local"> works in local time without a timezone
const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function SaleCampaign() {
  const { toast } = useFeedback();
  const [saved, setSaved] = useState<PromoSettings | null>(null);
  const [form, setForm] = useState<PromoSettings>(DEFAULT_PROMO);
  const [tableMissing, setTableMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getPromo(), settingsTableExists()]).then(([p, exists]) => {
      if (cancelled) return;
      setSaved(p); setForm(p); setTableMissing(!exists);
    });
    return () => { cancelled = true; };
  }, []);

  const set = <K extends keyof PromoSettings>(k: K, v: PromoSettings[K]) => setForm(f => ({ ...f, [k]: v }));
  const dirty = saved !== null && JSON.stringify(form) !== JSON.stringify(saved);

  const upload = async (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      set('image', await db.uploadProductImage(file, 'promos'));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast(`Upload failed: ${msg}${/bucket/i.test(msg) ? ' — run app/supabase_storage_patch.sql in Supabase.' : ''}`, 'error');
    }
    setUploading(false);
  };

  const save = async (next: PromoSettings = form) => {
    if (next.active && !next.image) { toast('Upload the ad image before switching the promo on.', 'error'); return; }
    if (next.active && next.endsAt && new Date(next.endsAt).getTime() <= Date.now()) { toast('The end date is in the past — pick a later date or clear it.', 'error'); return; }
    setBusy(true);
    const ok = await savePromo(next);
    setBusy(false);
    if (!ok) {
      toast(tableMissing ? 'Can’t save yet: run app/supabase_site_settings.sql in the Supabase SQL editor first.' : 'Could not save the campaign. Please try again.', 'error');
      return;
    }
    setSaved(next); setForm(next);
    toast(isPromoLive(next) ? 'Promo is live on the homepage.' : 'Saved.');
  };

  if (!saved) return <Card title="Homepage promo"><SkeletonRows rows={3} /></Card>;

  const live = isPromoLive(saved);
  const ended = saved.active && !live;
  const status = live
    ? <Badge tone="green">Live{saved.endsAt ? ` · ends ${new Date(saved.endsAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}</Badge>
    : ended ? <Badge tone="amber">Ended</Badge> : <Badge>Off</Badge>;

  return (
    <Card title={<>Homepage promo {status}</>} actions={<a className="adm-link adm-small" href="/" target="_blank" rel="noopener noreferrer">View homepage ↗</a>}>
      {tableMissing && (
        <div className="adm-callout" role="alert">
          <div><strong>Settings table missing.</strong> <span className="adm-muted">Run <code>app/supabase_site_settings.sql</code> in the Supabase SQL editor, then reload this page. Until then the promo can&apos;t be switched on.</span></div>
        </div>
      )}

      <div className="adm-color-row" style={{ borderBottom: '1px solid #F3F4F6', paddingBottom: 16, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <strong>{form.active ? 'Promo switched on' : 'Promo switched off'}</strong>
          <div className="adm-muted adm-small">When on, your ad takes the place of the big photo at the top of the homepage. Nothing else on the page changes.</div>
        </div>
        <button type="button" role="switch" className="adm-switch" aria-checked={form.active} aria-label="Promo switched on" disabled={busy || tableMissing}
          onClick={() => save({ ...form, active: !form.active })} />
      </div>

      <div className="adm-form-grid">
        <div className="adm-field adm-span-2">
          <span className="adm-label">Ad image (replaces the homepage photo)</span>
          {form.image ? (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <figure style={{ margin: 0 }}>
                <div style={{ width: 160, aspectRatio: '4 / 5', borderRadius: 10, overflow: 'hidden', background: '#F3F4F6', position: 'relative' }}>
                  <Image src={form.image} alt="Sale ad preview (desktop)" fill sizes="160px" style={{ objectFit: 'cover' }} />
                </div>
                <figcaption className="adm-muted adm-small" style={{ marginTop: 4 }}>Computer</figcaption>
              </figure>
              <figure style={{ margin: 0 }}>
                <div style={{ width: 200, aspectRatio: '375 / 350', borderRadius: 10, overflow: 'hidden', background: '#F3F4F6', position: 'relative' }}>
                  <Image src={form.image} alt="Sale ad preview (phone)" fill sizes="200px" style={{ objectFit: 'cover' }} />
                </div>
                <figcaption className="adm-muted adm-small" style={{ marginTop: 4 }}>Phone</figcaption>
              </figure>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="adm-btn adm-btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? 'Uploading…' : 'Replace'}</button>
                <button type="button" className="adm-btn adm-btn-sm adm-btn-ghost-danger" onClick={() => set('image', null)}>Remove</button>
              </div>
            </div>
          ) : (
            <button type="button" className="adm-dropzone" style={{ aspectRatio: 'auto', minHeight: 120, maxWidth: 420 }} onClick={() => fileRef.current?.click()} disabled={uploading}>
              <strong style={{ fontSize: 22 }}>+</strong>
              {uploading ? 'Uploading…' : 'Upload ad image'}
              <span className="adm-small">Portrait works best (e.g. 1200 × 1500). Keep text away from the edges — phones crop it.</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { upload(e.target.files?.[0]); e.target.value = ''; }} />
        </div>

        <div className="adm-field">
          <label htmlFor="promo-link">Tapping the ad opens</label>
          <select id="promo-link" className="adm-select" value={form.ctaHref} onChange={e => set('ctaHref', e.target.value)}>
            {PROMO_LINKS.map(l => <option key={l.href} value={l.href}>{l.label}</option>)}
          </select>
        </div>
        <div className="adm-field">
          <label htmlFor="promo-ends">Ends <span className="adm-muted">(optional)</span></label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input id="promo-ends" className="adm-input" type="datetime-local" value={toLocalInput(form.endsAt)}
              onChange={e => set('endsAt', e.target.value ? new Date(e.target.value).toISOString() : null)} />
            {form.endsAt && <button type="button" className="adm-btn" onClick={() => set('endsAt', null)}>Clear</button>}
          </div>
          <span className="adm-hint">The usual photo comes back automatically at this time.</span>
        </div>
        <div className="adm-field adm-span-2">
          <label htmlFor="promo-title">Short description of the ad</label>
          <input id="promo-title" className="adm-input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. End of season sale — up to 40% off" />
          <span className="adm-hint">Read aloud to visually impaired shoppers and shown if the image can&apos;t load.</span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        {dirty && <span className="adm-dirty" style={{ marginRight: 'auto', color: '#92400E', fontWeight: 600, fontSize: 13, alignSelf: 'center' }}>Unsaved changes</span>}
        {dirty && <button type="button" className="adm-btn" onClick={() => setForm(saved)} disabled={busy}>Discard</button>}
        <button type="button" className="adm-btn adm-btn-primary" onClick={() => save()} disabled={busy || uploading || !dirty || tableMissing}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </Card>
  );
}
