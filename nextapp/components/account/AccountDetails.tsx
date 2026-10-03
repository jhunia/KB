'use client';
import { useState } from 'react';
import Link from 'next/link';
import { db } from '@/lib/db';
import { useAuth } from '@/context/AuthContext';

/*
 * My Account → Account details: name / phone / delivery address and password (needs the
 * current one). The email can't be changed once the account exists — it's the account's
 * identity (sign-in, order history, promo codes). Profile security rules: app/supabase_profile_patch.sql.
 */

type Note = { tone: 'ok' | 'error'; msg: string } | null;
const PHONE_OK = (v: string) => !v.trim() || v.replace(/\D/g, '').length >= 9;

function Notice({ note }: { note: Note }) {
  if (!note) return null;
  return <p className={`account-note ${note.tone}`} role={note.tone === 'error' ? 'alert' : 'status'}>{note.msg}</p>;
}

export default function AccountDetails() {
  const { user, updateProfile } = useAuth();

  // Personal details
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState(user?.address || '');
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsNote, setDetailsNote] = useState<Note>(null);
  const detailsDirty = name !== (user?.name || '') || phone !== (user?.phone || '') || address !== (user?.address || '');

  // Password
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [pwNote, setPwNote] = useState<Note>(null);

  if (!user) return null;

  const saveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setDetailsNote(null);
    if (!name.trim()) { setDetailsNote({ tone: 'error', msg: 'Please enter your name.' }); return; }
    if (!PHONE_OK(phone)) { setDetailsNote({ tone: 'error', msg: 'That phone number looks too short. Include your country code if you’re outside Ghana.' }); return; }
    setSavingDetails(true);
    const res = await updateProfile({ name, phone, address });
    setSavingDetails(false);
    setDetailsNote(res.success ? { tone: 'ok', msg: res.message || 'Saved. Your new details will be used for your next orders.' } : { tone: 'error', msg: res.message || 'Couldn’t save. Please try again.' });
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwNote(null);
    if (newPw.length < 8) { setPwNote({ tone: 'error', msg: 'Your new password needs at least 8 characters.' }); return; }
    if (newPw !== confirmPw) { setPwNote({ tone: 'error', msg: 'The new passwords don’t match.' }); return; }
    setSavingPw(true);
    const res = await db.changePassword(currentPw, newPw);
    setSavingPw(false);
    if (res.success) {
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setPwNote({ tone: 'ok', msg: 'Password changed.' });
    } else {
      setPwNote({ tone: 'error', msg: res.message || 'Couldn’t change your password.' });
    }
  };

  return (
    <div className="account-sections">
      <form className="account-card" onSubmit={saveDetails} noValidate>
        <h3>Personal details</h3>
        <p className="account-hint">Used to pre-fill checkout. Orders you’ve already placed keep the details they were placed with.</p>
        <div className="account-grid">
          <label className="account-field">
            <span>Full name</span>
            <input value={name} onChange={e => setName(e.target.value)} autoComplete="name" required />
          </label>
          <label className="account-field">
            <span>Phone number</span>
            <input type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" placeholder="e.g. 024 123 4567" />
          </label>
          <label className="account-field account-span-2">
            <span>Delivery address</span>
            <textarea rows={2} value={address} onChange={e => setAddress(e.target.value)} autoComplete="street-address" placeholder="House number, street, area, city" />
          </label>
        </div>
        <Notice note={detailsNote} />
        <button type="submit" className="btn btn-primary btn-sm" disabled={savingDetails || !detailsDirty}>{savingDetails ? 'Saving…' : 'Save details'}</button>
      </form>

      <div className="account-card">
        <h3>Email</h3>
        <p className="account-hint">
          You log in with <strong>{user.email}</strong>, and order updates are sent there. Your email can’t be changed —
          if you’ve lost access to it, <Link href="/support" className="legal-link">contact us</Link>.
        </p>
      </div>

      <form className="account-card" onSubmit={savePassword} noValidate>
        <h3>Password</h3>
        <div className="account-grid">
          <label className="account-field account-span-2">
            <span>Current password</span>
            <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} autoComplete="current-password" required />
          </label>
          <label className="account-field">
            <span>New password</span>
            <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} autoComplete="new-password" minLength={8} required />
          </label>
          <label className="account-field">
            <span>Confirm new password</span>
            <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} autoComplete="new-password" required />
          </label>
        </div>
        <p className="account-hint">At least 8 characters. Forgot your current one? Log out and use “Forgot your password?”.</p>
        <Notice note={pwNote} />
        <button type="submit" className="btn btn-primary btn-sm" disabled={savingPw || !currentPw || !newPw}>{savingPw ? 'Changing…' : 'Change password'}</button>
      </form>
    </div>
  );
}
