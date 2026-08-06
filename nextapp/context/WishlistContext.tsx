'use client';
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { db } from '@/lib/db';
import type { Product } from '@/lib/types';

interface WishlistContextValue {
  wishlistIds: number[];
  wishlistProducts: Product[];
  toggle: (productId: number) => void;
  isLiked: (productId: number) => boolean;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [wishlistIds, setWishlistIds] = useState<number[]>([]);
  const [wishlistProducts, setWishlistProducts] = useState<Product[]>([]);

  // Load wishlist after db is initialised
  useEffect(() => {
    db.init().then(() => {
      const ids = db.getWishlist();
      setWishlistIds(ids);
      setWishlistProducts(ids.map(id => db.getProductById(id)).filter(Boolean) as Product[]);
    });
  }, []);

  const toggle = useCallback((productId: number) => {
    db.toggleWishlist(productId);
    const newIds = db.getWishlist();
    setWishlistIds([...newIds]);
    setWishlistProducts(newIds.map(id => db.getProductById(id)).filter(Boolean) as Product[]);
  }, []);

  const isLiked = useCallback((productId: number) => wishlistIds.includes(productId), [wishlistIds]);

  return (
    <WishlistContext.Provider value={{ wishlistIds, wishlistProducts, toggle, isLiked }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}
