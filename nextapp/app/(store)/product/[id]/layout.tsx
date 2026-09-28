import type { Metadata } from 'next';

type ProductMeta = { name: string; description: string | null; price: number; images: string[] | null };

// Looks the product up on the server so the browser tab, search results and
// WhatsApp/social link previews show the real product name, price and photo.
async function fetchProduct(id: string): Promise<ProductMeta | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !/^\d+$/.test(id)) return null;
  try {
    const res = await fetch(`${url}/rest/v1/products?id=eq.${id}&select=name,description,price,images`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      next: { revalidate: 300 }, // refresh at most every 5 minutes
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as ProductMeta[];
    return rows[0] || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = await fetchProduct(id);
  if (!p) return { title: 'Product' };
  const description = (p.description?.trim() || `Shop ${p.name} at KB.ENT.`) + ` GH₵${Number(p.price).toFixed(2)}.`;
  // Embedded (data:) images can't be used in link previews
  const image = p.images?.find(src => !src.startsWith('data:'));
  return {
    title: p.name,
    description,
    openGraph: { title: p.name, description, type: 'website', images: image ? [image] : undefined },
  };
}

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return children;
}
