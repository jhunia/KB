'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { db } from '@/lib/db';
import { PRODUCT_COLORS, colorName, swatchColor } from '@/lib/colors';
import { CATEGORIES, categoryLabel, SIZE_PRESETS, BRANDS, GENDERS, STYLES, fmtMoney } from '@/lib/admin';
import type { Product } from '@/lib/types';
import { Card, PageHeader } from './ui';
import { useFeedback } from './Feedback';

type FormState = {
  name: string; description: string; images: string[];
  price: string; originalPrice: string;
  category: string; brand: string; gender: string; style: string; tag: string;
  sizes: string[]; colors: string[]; colorStock: Record<string, boolean>; inStock: boolean;
};
type Errors = Partial<Record<'name' | 'images' | 'price' | 'originalPrice' | 'sizes' | 'colors', string>>;

const EMPTY: FormState = {
  name: '', description: '', images: [], price: '', originalPrice: '',
  category: 'tshirts', brand: '', gender: 'Uni-sex', style: 'casual', tag: 'new',
  sizes: [], colors: [], colorStock: {}, inStock: true,
};

function fromProduct(p: Product): FormState {
  return {
    name: p.name, description: p.description || '', images: [...p.images],
    price: String(p.price), originalPrice: p.originalPrice ? String(p.originalPrice) : '',
    category: p.category || 'tshirts', brand: p.brand || '', gender: p.gender || 'Uni-sex', style: p.style || 'casual', tag: p.tag || '',
    sizes: [...p.sizes], colors: [...p.colors], colorStock: { ...(p.colorStock || {}) }, inStock: p.inStock !== false,
  };
}

function presetFor(category: string) {
  if (category === 'shoes' || category === 'sandals') return 'shoes';
  if (category === 'jeans') return 'trousers';
  if (category === 'accessories') return 'other';
  return 'clothing';
}

export default function ProductForm({ product, duplicateOf, onSaved }: { product?: Product; duplicateOf?: Product; onSaved?: (p: Product) => void }) {
  const router = useRouter();
  const { toast, confirm } = useFeedback();
  const editing = !!product;

  const initial = useMemo<FormState>(() => {
    if (product) return fromProduct(product);
    if (duplicateOf) return { ...fromProduct(duplicateOf), name: `${duplicateOf.name} (copy)` };
    return EMPTY;
  }, [product, duplicateOf]);

  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [drag, setDrag] = useState(false);
  const [customSize, setCustomSize] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const savedRef = useRef(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  // Warn before closing the tab with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => { if (!savedRef.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(f => ({ ...f, [key]: value }));
    if (key in errors) setErrors(e => ({ ...e, [key]: undefined }));
  };

  /* ---------- Images ---------- */
  const upload = async (files: FileList | File[] | null) => {
    const images = Array.from(files || []).filter(f => f.type.startsWith('image/'));
    if (!images.length) return;
    setUploading(n => n + images.length);
    await Promise.all(images.map(async file => {
      try {
        const url = await db.uploadProductImage(file);
        setForm(f => ({ ...f, images: [...f.images, url] }));
        setErrors(e => ({ ...e, images: undefined }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast(`Couldn't upload ${file.name}: ${msg}${/bucket/i.test(msg) ? ' — run app/supabase_storage_patch.sql in Supabase.' : ''}`, 'error');
      } finally {
        setUploading(n => n - 1);
      }
    }));
  };
  const moveImage = (from: number, to: number) => setForm(f => {
    const images = [...f.images];
    const [img] = images.splice(from, 1);
    images.splice(to, 0, img);
    return { ...f, images };
  });

  /* ---------- Variants ---------- */
  const toggleSize = (s: string) => set('sizes', form.sizes.includes(s) ? form.sizes.filter(x => x !== s) : [...form.sizes, s]);
  const addCustomSize = () => {
    const s = customSize.trim();
    if (s && !form.sizes.includes(s)) set('sizes', [...form.sizes, s]);
    setCustomSize('');
  };
  const toggleColor = (name: string) => {
    const has = form.colors.includes(name);
    setForm(f => ({
      ...f,
      colors: has ? f.colors.filter(c => c !== name) : [...f.colors, name],
      colorStock: has ? f.colorStock : { ...f.colorStock, [name]: f.colorStock[name] ?? true },
    }));
    setErrors(e => ({ ...e, colors: undefined }));
  };

  /* ---------- Pricing helpers ---------- */
  const price = parseFloat(form.price);
  const original = parseFloat(form.originalPrice);
  const discountPct = Number.isFinite(price) && Number.isFinite(original) && original > price ? Math.round((1 - price / original) * 100) : null;

  /* ---------- Save ---------- */
  const validate = (): Errors => {
    const e: Errors = {};
    if (!form.name.trim()) e.name = 'Give the product a name.';
    if (!form.images.length) e.images = 'Add at least one photo.';
    if (!Number.isFinite(price) || price <= 0) e.price = 'Enter a price above 0.';
    if (form.originalPrice && (!Number.isFinite(original) || original <= price)) e.originalPrice = 'The "was" price must be higher than the selling price — or leave it empty.';
    if (!form.sizes.length) e.sizes = 'Choose at least one size.';
    if (!form.colors.length) e.colors = 'Choose at least one colour.';
    return e;
  };

  const save = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      toast('Please fix the highlighted fields.', 'error');
      document.querySelector('[aria-invalid="true"], .adm-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSaving(true);
    const data: Partial<Product> = {
      name: form.name.trim(), description: form.description.trim(), images: form.images,
      price, originalPrice: discountPct !== null ? original : null, discount: discountPct,
      category: form.category, brand: form.brand.trim() || null, gender: form.gender, style: form.style, tag: form.tag || null,
      sizes: form.sizes, colors: form.colors,
      colorStock: Object.fromEntries(form.colors.map(c => [c, form.colorStock[c] !== false])),
      inStock: form.inStock,
    };
    const saved = editing ? await db.updateProduct(product!.id, data) : await db.addProduct(data);
    setSaving(false);
    if (!saved) { toast('Could not save the product. Check your connection and try again.', 'error'); return; }
    toast(editing ? 'Product saved.' : 'Product created.');
    if (editing) {
      onSaved?.(saved); // parent swaps in the saved product, which resets the form
    } else {
      savedRef.current = true;
      router.replace(`/admin/products/${saved.id}`);
    }
  };

  // Never ordered → deleted for good; ordered → removed from the shop, kept in past orders (db.deleteProduct)
  const remove = async () => {
    if (!product) return;
    const ok = await confirm({
      title: `Delete “${product.name}”?`,
      message: 'If nobody has ordered it, it’s deleted for good. If it has been ordered, it’s removed from the shop but stays in past orders — you can restore it later.',
      confirmLabel: 'Delete', danger: true,
    });
    if (!ok) return;
    const res = await db.deleteProduct(product.id);
    if (!res.success) { toast(res.message || 'Could not delete.', 'error'); return; }
    savedRef.current = true;
    toast(res.archived ? 'Removed from the shop — kept in past orders. Find it under Products → Archived.' : 'Product deleted.');
    router.replace('/admin/products');
  };

  const [archived, setArchived] = useState(!!product?.archived);
  const restore = async () => {
    if (!product) return;
    if (await db.restoreProduct(product.id)) { setArchived(false); toast('Back in the shop.'); }
    else toast('Could not restore the product.', 'error');
  };

  const preset = presetFor(form.category);
  const sizeOptions = Array.from(new Set([...SIZE_PRESETS[preset], ...form.sizes]));

  return (
    <>
      <PageHeader
        back={{ href: '/admin/products', label: 'Products' }}
        title={editing ? product!.name : duplicateOf ? 'Duplicate product' : 'Add product'}
        actions={editing && (
          <>
            <a className="adm-btn" href={`/product/${product!.id}`} target="_blank" rel="noopener noreferrer">View in store</a>
            <Link className="adm-btn" href={`/admin/products/new?from=${product!.id}`}>Duplicate</Link>
          </>
        )}
      />

      {editing && archived && (
        <div className="adm-callout" role="status">
          <span><strong>Archived.</strong> This product is hidden from the shop but still shows in past orders.</span>
          <button type="button" className="adm-btn adm-btn-primary adm-btn-sm" onClick={restore}>Restore to shop</button>
        </div>
      )}

      <form onSubmit={e => { e.preventDefault(); save(); }} noValidate>
        <div className="adm-grid adm-grid-main">
          <div className="adm-stack">
            <Card title="Details">
              <div className="adm-form-grid">
                <div className="adm-field adm-span-2">
                  <label htmlFor="p-name">Name</label>
                  <input id="p-name" className="adm-input" value={form.name} onChange={e => set('name', e.target.value)} aria-invalid={!!errors.name} placeholder="e.g. Slim Fit Blazer" />
                  {errors.name && <span className="adm-error">{errors.name}</span>}
                </div>
                <div className="adm-field adm-span-2">
                  <label htmlFor="p-desc">Description</label>
                  <textarea id="p-desc" className="adm-textarea" rows={4} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Fabric, fit, care instructions…" />
                </div>
              </div>
            </Card>

            <Card title="Photos" actions={<span className="adm-muted adm-small">First photo is the cover</span>}>
              <div className="adm-images">
                {form.images.map((src, i) => (
                  <div key={src + i} className="adm-image">
                    <Image src={src} alt={`Photo ${i + 1}`} width={240} height={240} />
                    {i === 0 && <span className="adm-image-cover">Cover</span>}
                    <div className="adm-image-actions">
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button type="button" onClick={() => moveImage(i, i - 1)} disabled={i === 0} aria-label={`Move photo ${i + 1} left`}>←</button>
                        <button type="button" onClick={() => moveImage(i, i + 1)} disabled={i === form.images.length - 1} aria-label={`Move photo ${i + 1} right`}>→</button>
                      </div>
                      <button type="button" onClick={() => set('images', form.images.filter((_, j) => j !== i))} aria-label={`Remove photo ${i + 1}`}>✕</button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className={`adm-dropzone${drag ? ' drag' : ''}`}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDrag(true); }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={e => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
                >
                  <strong style={{ fontSize: 22 }}>+</strong>
                  {uploading ? `Uploading ${uploading}…` : 'Add photos'}
                  <span className="adm-small">or drop them here</span>
                </button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => { upload(e.target.files); e.target.value = ''; }} />
              {errors.images && <p className="adm-error adm-small" style={{ marginTop: 8, color: '#B91C1C', fontWeight: 600 }}>{errors.images}</p>}
              <p className="adm-muted adm-small" style={{ marginTop: 8 }}>Photos are resized automatically, so phone pictures are fine.</p>
            </Card>

            <Card title="Pricing">
              <div className="adm-form-grid">
                <div className="adm-field">
                  <label htmlFor="p-price">Selling price</label>
                  <div className="adm-prefix"><span>GH₵</span><input id="p-price" className="adm-input" type="number" inputMode="decimal" min="0.01" step="0.01" value={form.price} onChange={e => set('price', e.target.value)} aria-invalid={!!errors.price} /></div>
                  {errors.price && <span className="adm-error">{errors.price}</span>}
                </div>
                <div className="adm-field">
                  <label htmlFor="p-orig">Was price <span className="adm-muted">(optional)</span></label>
                  <div className="adm-prefix"><span>GH₵</span><input id="p-orig" className="adm-input" type="number" inputMode="decimal" min="0" step="0.01" value={form.originalPrice} onChange={e => set('originalPrice', e.target.value)} aria-invalid={!!errors.originalPrice} /></div>
                  {errors.originalPrice ? <span className="adm-error">{errors.originalPrice}</span>
                    : <span className="adm-hint">{discountPct !== null ? `Shows as ${discountPct}% off (was ${fmtMoney(original)})` : 'Fill in to show the item as on sale.'}</span>}
                </div>
              </div>
            </Card>

            <Card title="Sizes & colours">
              <div className="adm-field">
                <span className="adm-label">Sizes</span>
                <div className="adm-chips" role="group" aria-label="Sizes">
                  {sizeOptions.map(s => <button key={s} type="button" className="adm-chip" aria-pressed={form.sizes.includes(s)} onClick={() => toggleSize(s)}>{s}</button>)}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, maxWidth: 320 }}>
                  <input className="adm-input" value={customSize} onChange={e => setCustomSize(e.target.value)} placeholder="Other size, e.g. 46" aria-label="Add another size"
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomSize(); } }} />
                  <button type="button" className="adm-btn" onClick={addCustomSize}>Add</button>
                </div>
                {errors.sizes && <span className="adm-error">{errors.sizes}</span>}
              </div>

              <div className="adm-field" style={{ marginTop: 20 }}>
                <span className="adm-label">Colours</span>
                <div className="adm-color-pick" role="group" aria-label="Colours">
                  {PRODUCT_COLORS.map(c => (
                    <button key={c.name} type="button" aria-pressed={form.colors.includes(c.name)} onClick={() => toggleColor(c.name)}>
                      <span className="adm-swatch" style={{ background: c.hex }} />{c.name}
                    </button>
                  ))}
                </div>
                {errors.colors && <span className="adm-error">{errors.colors}</span>}
              </div>

              {form.colors.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <span className="adm-label">Stock per colour</span>
                  {form.colors.map(c => (
                    <div key={c} className="adm-color-row">
                      <span className="adm-swatch" style={{ background: swatchColor(c) }} />
                      <span style={{ flex: 1 }}>{colorName(c)}</span>
                      <span className="adm-muted adm-small">{form.colorStock[c] === false ? 'Sold out' : 'Available'}</span>
                      <button type="button" role="switch" className="adm-switch" aria-checked={form.colorStock[c] !== false} aria-label={`${colorName(c)} available`}
                        onClick={() => set('colorStock', { ...form.colorStock, [c]: form.colorStock[c] === false })} />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="adm-stack">
            <Card title="Availability">
              <div className="adm-color-row" style={{ borderBottom: 'none' }}>
                <div style={{ flex: 1 }}>
                  <strong>{form.inStock ? 'In stock' : 'Out of stock'}</strong>
                  <div className="adm-muted adm-small">{form.inStock ? 'Customers can buy it.' : 'Shown as sold out in the store.'}</div>
                </div>
                <button type="button" role="switch" className="adm-switch" aria-checked={form.inStock} aria-label="In stock" onClick={() => set('inStock', !form.inStock)} />
              </div>
            </Card>

            <Card title="Organisation">
              <div className="adm-stack">
                <div className="adm-field">
                  <label htmlFor="p-cat">Category</label>
                  <select id="p-cat" className="adm-select" value={form.category} onChange={e => set('category', e.target.value)}>
                    {/* keep a category already in use even if it is not in the standard list */}
                    {Array.from(new Set([...CATEGORIES, form.category])).map(c => <option key={c} value={c}>{categoryLabel(c)}</option>)}
                  </select>
                </div>
                <div className="adm-field">
                  <label htmlFor="p-brand">Brand</label>
                  <input id="p-brand" className="adm-input" list="brand-options" value={form.brand} onChange={e => set('brand', e.target.value)} placeholder="Type or pick a brand" />
                  <datalist id="brand-options">{BRANDS.map(b => <option key={b} value={b} />)}</datalist>
                </div>
                <div className="adm-field">
                  <label htmlFor="p-gender">For</label>
                  <select id="p-gender" className="adm-select" value={form.gender} onChange={e => set('gender', e.target.value)}>
                    {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="adm-field">
                  <label htmlFor="p-style">Style</label>
                  <select id="p-style" className="adm-select" value={form.style} onChange={e => set('style', e.target.value)}>
                    {STYLES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
                <div className="adm-field">
                  <label htmlFor="p-tag">Show on homepage</label>
                  <select id="p-tag" className="adm-select" value={form.tag} onChange={e => set('tag', e.target.value)}>
                    <option value="new">New arrivals</option>
                    <option value="top">Top selling</option>
                    <option value="">Not featured</option>
                  </select>
                </div>
              </div>
            </Card>

            {editing && (
              <Card title="Danger zone">
                <p className="adm-muted adm-small" style={{ marginBottom: 12 }}>
                  Never ordered: deleted for good, photos included. Already ordered: removed from the shop but kept in past orders, and you can restore it.
                </p>
                {!archived && <button type="button" className="adm-btn adm-btn-ghost-danger" onClick={remove}>Delete product</button>}
              </Card>
            )}
          </div>
        </div>

        <div className="adm-savebar">
          {dirty && <span className="adm-dirty">Unsaved changes</span>}
          <Link href="/admin/products" className="adm-btn">Cancel</Link>
          <button type="submit" className="adm-btn adm-btn-primary" disabled={saving || uploading > 0 || (editing && !dirty)}>
            {saving ? 'Saving…' : uploading ? 'Waiting for photos…' : editing ? 'Save changes' : 'Create product'}
          </button>
        </div>
      </form>
    </>
  );
}
