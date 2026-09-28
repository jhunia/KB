'use client';
/* In-app toasts and confirm dialogs for the admin, replacing the browser's
   alert()/confirm() boxes (which look broken on phones and can't be styled). */
import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';

type Toast = { id: number; message: string; tone: 'success' | 'error' | 'info' };
type ConfirmOptions = { title: string; message?: string; confirmLabel?: string; danger?: boolean };

const FeedbackContext = createContext<{
  toast: (message: string, tone?: Toast['tone']) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
} | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);
  const confirmBtn = useRef<HTMLButtonElement>(null);

  const toast = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message, tone }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), tone === 'error' ? 7000 : 3500);
  }, []);

  const confirm = useCallback((opts: ConfirmOptions) => new Promise<boolean>(resolve => setDialog({ ...opts, resolve })), []);

  const close = useCallback((ok: boolean) => {
    setDialog(d => { d?.resolve(ok); return null; });
  }, []);

  useEffect(() => {
    if (!dialog) return;
    confirmBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dialog, close]);

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}
      <div className="adm-toasts" role="status" aria-live="polite">
        {toasts.map(t => <div key={t.id} className={`adm-toast adm-toast-${t.tone}`}>{t.message}</div>)}
      </div>
      {dialog && (
        <div className="adm-overlay" onClick={e => e.target === e.currentTarget && close(false)}>
          <div className="adm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="adm-dialog-title">
            <h2 id="adm-dialog-title">{dialog.title}</h2>
            {dialog.message && <p>{dialog.message}</p>}
            <div className="adm-dialog-actions">
              <button type="button" className="adm-btn" onClick={() => close(false)}>Cancel</button>
              <button type="button" ref={confirmBtn} className={`adm-btn ${dialog.danger ? 'adm-btn-danger' : 'adm-btn-primary'}`} onClick={() => close(true)}>
                {dialog.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback must be used inside the admin layout');
  return ctx;
}
