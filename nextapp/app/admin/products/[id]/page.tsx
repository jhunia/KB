'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import type { Product } from '@/lib/types';
import ProductForm from '@/components/admin/ProductForm';
import { Card, EmptyState, SkeletonRows } from '@/components/admin/ui';

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const productId = Number(id);
  const [product, setProduct] = useState<Product | null | undefined>(undefined);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    (async () => {
      await db.init();
      await db._loadProducts(); // edit the latest saved version
      setProduct(db.getProductById(productId) || null);
    })();
  }, [productId]);

  if (product === undefined) return <SkeletonRows rows={8} />;
  if (product === null) {
    return (
      <Card>
        <EmptyState title="Product not found"><Link className="adm-link" href="/admin/products">Back to products</Link></EmptyState>
      </Card>
    );
  }
  // Remounting after a save resets the form to the saved values
  return <ProductForm key={`${product.id}-${version}`} product={product} onSaved={p => { setProduct({ ...p }); setVersion(v => v + 1); }} />;
}
