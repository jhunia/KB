'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { db } from '@/lib/db';
import type { Product } from '@/lib/types';
import ProductForm from '@/components/admin/ProductForm';
import { SkeletonRows } from '@/components/admin/ui';

export default function NewProductPage() {
  const params = useSearchParams();
  const fromId = Number(params.get('from')) || null; // "Duplicate" pre-fills from another product
  const [source, setSource] = useState<Product | null | undefined>(fromId ? undefined : null);

  useEffect(() => {
    if (!fromId) return;
    (async () => {
      await db.init();
      setSource(db.getProductById(fromId) || null);
    })();
  }, [fromId]);

  if (source === undefined) return <SkeletonRows rows={8} />;
  return <ProductForm key={fromId ?? 'new'} duplicateOf={source || undefined} />;
}
