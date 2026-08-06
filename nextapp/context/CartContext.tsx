'use client';

import React, { createContext, useContext, useReducer, useEffect, useCallback, ReactNode } from 'react';
import { db } from '@/lib/db';
import type { CartItem, Product } from '@/lib/types';

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  initialized: boolean;
}

type CartAction =
  | { type: 'SET_ITEMS'; items: CartItem[] }
  | { type: 'ADD_ITEM'; item: CartItem }
  | { type: 'REMOVE_ITEM'; index: number }
  | { type: 'UPDATE_QTY'; index: number; quantity: number }
  | { type: 'CLEAR' }
  | { type: 'OPEN_DRAWER' }
  | { type: 'CLOSE_DRAWER' }
  | { type: 'SET_INITIALIZED' };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'SET_ITEMS': return { ...state, items: action.items };
    case 'ADD_ITEM': return { ...state, items: [...state.items] };
    case 'REMOVE_ITEM': return { ...state, items: state.items.filter((_, i) => i !== action.index) };
    case 'UPDATE_QTY':
      if (action.quantity <= 0) return { ...state, items: state.items.filter((_, i) => i !== action.index) };
      return { ...state, items: state.items.map((item, i) => i === action.index ? { ...item, quantity: action.quantity } : item) };
    case 'CLEAR': return { ...state, items: [] };
    case 'OPEN_DRAWER': return { ...state, isOpen: true };
    case 'CLOSE_DRAWER': return { ...state, isOpen: false };
    case 'SET_INITIALIZED': return { ...state, initialized: true };
    default: return state;
  }
}

interface CartContextValue {
  items: CartItem[];
  isOpen: boolean;
  initialized: boolean;
  cartCount: number;
  cartTotal: number;
  openDrawer: () => void;
  closeDrawer: () => void;
  addToCart: (productId: number, size: string, color: string, quantity?: number) => Promise<void>;
  removeFromCart: (index: number) => void;
  updateQuantity: (index: number, quantity: number) => void;
  clearCart: () => void;
  getProductById: (id: number) => Product | undefined;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [], isOpen: false, initialized: false });

  useEffect(() => {
    (async () => {
      await db.init();
      dispatch({ type: 'SET_ITEMS', items: db.getCart() });
      dispatch({ type: 'SET_INITIALIZED' });
    })();
  }, []);

  const cartCount = state.items.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = state.items.reduce((total, item) => {
    const p = db.getProductById(item.productId);
    return total + (p ? p.price * item.quantity : 0);
  }, 0);

  const openDrawer = useCallback(() => dispatch({ type: 'OPEN_DRAWER' }), []);
  const closeDrawer = useCallback(() => dispatch({ type: 'CLOSE_DRAWER' }), []);

  const addToCart = useCallback(async (productId: number, size: string, color: string, quantity = 1) => {
    await db.addToCart(productId, size, color, quantity);
    dispatch({ type: 'SET_ITEMS', items: [...db.getCart()] });
  }, []);

  const removeFromCart = useCallback((index: number) => {
    db.removeFromCart(index);
    dispatch({ type: 'SET_ITEMS', items: [...db.getCart()] });
  }, []);

  const updateQuantity = useCallback((index: number, quantity: number) => {
    db.updateCartQuantity(index, quantity);
    dispatch({ type: 'SET_ITEMS', items: [...db.getCart()] });
  }, []);

  const clearCart = useCallback(() => {
    db.clearCart();
    dispatch({ type: 'CLEAR' });
  }, []);

  const getProductById = useCallback((id: number) => db.getProductById(id), []);

  return (
    <CartContext.Provider value={{
      items: state.items, isOpen: state.isOpen, initialized: state.initialized,
      cartCount, cartTotal,
      openDrawer, closeDrawer,
      addToCart, removeFromCart, updateQuantity, clearCart, getProductById
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
