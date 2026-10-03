'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { db } from '@/lib/db';
import type { User } from '@/lib/types';
import { isPasswordRecovery, clearPasswordRecovery } from '@/lib/supabase/client';

interface AuthContextValue {
  user: User | null;
  initialized: boolean;
  /** True when the page was opened from a password-reset email link and the new password hasn't been set yet. */
  passwordRecovery: boolean;
  finishPasswordRecovery: () => void;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  signup: (name: string, email: string, password: string, phone: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; message?: string }>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; message?: string }>;
  /** My Account: name, phone, saved address */
  updateProfile: (changes: { name: string; phone: string; address: string }) => Promise<{ success: boolean; message?: string }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    (async () => {
      await db.init();
      setUser(db.getCurrentUser());
      setPasswordRecovery(isPasswordRecovery());
      setInitialized(true);
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await db.login(email, password);
    if (res.success) setUser(db.getCurrentUser());
    return res;
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string, phone: string) => {
    const res = await db.signup(name, email, password, phone);
    if (res.success) setUser(db.getCurrentUser());
    return res;
  }, []);

  const logout = useCallback(async () => {
    await db.logout();
    clearPasswordRecovery();
    setPasswordRecovery(false);
    setUser(null);
  }, []);

  const requestPasswordReset = useCallback((email: string) => db.requestPasswordReset(email), []);
  const updatePassword = useCallback((newPassword: string) => db.updatePassword(newPassword), []);
  const finishPasswordRecovery = useCallback(() => { clearPasswordRecovery(); setPasswordRecovery(false); }, []);
  const updateProfile = useCallback(async (changes: { name: string; phone: string; address: string }) => {
    const res = await db.updateProfile(changes);
    if (res.success) setUser(db.getCurrentUser());
    return res;
  }, []);

  return (
    <AuthContext.Provider value={{ user, initialized, passwordRecovery, finishPasswordRecovery, login, signup, logout, requestPasswordReset, updatePassword, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
