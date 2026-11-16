import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, type Fil, type Me, type State } from './api';
import { isConfigured, watchUser } from './firebase';
import { addDays, ymd, today } from './lib/dates';

export type CaptureKind = 'tache' | 'pensee' | 'panier';
export type CapturePrefill = { kind?: CaptureKind; text?: string; url?: string; image?: File | null; title?: string };
export type Toast = {
  title: string;
  text?: string;
  tone?: 'ok' | 'error';
  action?: { label: string; run: () => void };
};

type Ctx = {
  me: Me | null;
  setMe: (m: Me) => void;
  fil: Fil | null;
  setFil: (f: Fil | null) => void;
  latest: State | null;
  statesLoaded: boolean;
  refreshStates: () => Promise<void>;
  capture: CapturePrefill | null;
  openCapture: (p?: CapturePrefill) => void;
  closeCapture: () => void;
  etatOpen: boolean;
  setEtatOpen: (b: boolean) => void;
  toast: Toast | null;
  notify: (title: string, text?: string, opts?: Pick<Toast, 'tone' | 'action'>) => void;
  /** Toast d'erreur standard quand une action n'a pas pu être enregistrée. */
  fail: (what?: string) => void;
  dismissToast: () => void;
  panierCount: number;
  setPanierCount: (n: number) => void;
  recreEnd: number | null;
  setRecreEnd: (t: number | null) => void;
  version: number;      // incrémenté quand une capture change les données
  bump: () => void;
  error: string | null;
  /** null = on ne sait pas encore, false = connecté, true = écran de connexion. */
  needsLogin: boolean | null;
};

const C = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(C);
  if (!c) throw new Error('AppProvider manquant');
  return c;
};

const RECRE_KEY = 'pelote-recre-fin';
const readRecre = () => {
  try {
    const v = Number(localStorage.getItem(RECRE_KEY));
    return v > Date.now() ? v : null;
  } catch { return null; }
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [fil, setFil] = useState<Fil | null>(null);
  const [latest, setLatest] = useState<State | null>(null);
  const [statesLoaded, setStatesLoaded] = useState(false);
  const [capture, setCapture] = useState<CapturePrefill | null>(null);
  const [etatOpen, setEtatOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [panierCount, setPanierCount] = useState(0);
  const [recreEnd, setRecreEndState] = useState<number | null>(readRecre);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState<boolean | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const refreshStates = useCallback(async () => {
    const s = await api.states(ymd(addDays(today(), -2)));
    setLatest(s[s.length - 1] ?? null);
    setStatesLoaded(true);
  }, []);

  useEffect(() => {
    if (!isConfigured) { setNeedsLogin(false); setError('Pelote n’est pas encore relié à son projet Firebase (src/firebase-config.ts).'); return; }
    return watchUser((u) => {
      if (!u) { setNeedsLogin(true); setMe(null); return; }
      setNeedsLogin(false);
      setError(null);
      api.me()
        .then((m) => { setMe(m); setFil(m.fil); })
        .catch((e) => setError((e as { code?: string }).code === 'permission-denied'
          ? `Le compte ${u.email} n’est pas autorisé sur cette Pelote.`
          : 'Pelote n’arrive pas à joindre son serveur.'));
      refreshStates().catch(() => setStatesLoaded(true));
      api.panier().then((p) => setPanierCount(p.length)).catch(() => {});
    });
  }, [refreshStates]);

  const notify = useCallback((title: string, text?: string, opts?: Pick<Toast, 'tone' | 'action'>) => {
    window.clearTimeout(toastTimer.current);
    setToast({ title, text, ...opts });
    toastTimer.current = window.setTimeout(() => setToast(null), opts?.action ? 6000 : 4500);
  }, []);
  const fail = useCallback((what = 'Ça n’a pas été enregistré') => {
    notify(what, 'Vérifie ta connexion et réessaie. Rien n’a été perdu de ton côté.', { tone: 'error' });
  }, [notify]);
  const dismissToast = useCallback(() => { window.clearTimeout(toastTimer.current); setToast(null); }, []);

  const setRecreEnd = useCallback((t: number | null) => {
    setRecreEndState(t);
    try { if (t) localStorage.setItem(RECRE_KEY, String(t)); else localStorage.removeItem(RECRE_KEY); } catch { /* rien */ }
  }, []);

  // Fin de récré : signalée où que tu sois dans l'app.
  useEffect(() => {
    if (!recreEnd) return;
    const ms = recreEnd - Date.now();
    const t = window.setTimeout(() => {
      setRecreEnd(null);
      notify('Fin de la récré', fil ? `Retour au fil : ${fil.title}` : 'Retour au fil, tranquillement.');
      if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        new Notification('Fin de la récré', { body: fil ? `Retour au fil : ${fil.title}` : 'Retour au fil.', icon: '/icon-192.png' });
      }
    }, Math.max(0, ms));
    return () => window.clearTimeout(t);
  }, [recreEnd, fil, notify, setRecreEnd]);

  const value = useMemo<Ctx>(() => ({
    me, setMe, fil, setFil, latest, statesLoaded, refreshStates,
    capture, openCapture: (p = {}) => setCapture(p), closeCapture: () => setCapture(null),
    etatOpen, setEtatOpen, toast, notify, fail, dismissToast, panierCount, setPanierCount,
    recreEnd, setRecreEnd,
    version, bump: () => setVersion((v) => v + 1), error, needsLogin,
  }), [me, fil, latest, statesLoaded, refreshStates, capture, etatOpen, toast, notify, fail, dismissToast, panierCount, recreEnd, setRecreEnd, version, error, needsLogin]);

  return <C.Provider value={value}>{children}</C.Provider>;
}
