import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { coatOf, Face, ENERGIES, MOODS } from './Cat';
import { CaptureSheet } from './CaptureSheet';
import { EtatSheet } from './EtatSheet';
import { Icon } from './Icon';
import { useApp } from '../store';
import { URL_RE } from '../lib/autotag';
import { today, ymd } from '../lib/dates';
import { Login } from '../pages/Login';

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

function Logo() {
  return (
    <svg width="34" height="34" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M10 30 L13 6 L28 17 Z M54 30 L51 6 L36 17 Z" fill="#1F1A3D" />
      <ellipse cx="32" cy="37" rx="23" ry="20" fill="#1F1A3D" />
      <path d="M21 35 Q24 31.5 27 35 M37 35 Q40 31.5 43 35" fill="none" stroke="#FFD25E" strokeWidth="3" strokeLinecap="round" />
      <path d="M30 41 L34 41 L32 43.5 Z" fill="#FF8FB1" />
    </svg>
  );
}

export function Shell() {
  const app = useApp();
  const { me, fil, latest, statesLoaded, capture, openCapture, etatOpen, setEtatOpen, toast, dismissToast, panierCount, recreEnd, error, needsLogin } = app;
  const [, tick] = useState(0);
  useEffect(() => { if (!recreEnd) return; const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, [recreEnd]);
  const nav = useNavigate();
  const loc = useLocation();
  const [askFil, setAskFil] = useState(false);
  const [soirReady, setSoirReady] = useState(false);
  const hiddenAt = useRef<number | null>(null);

  // Première connexion → accueil.
  useEffect(() => {
    if (me && !me.onboarded && loc.pathname !== '/bienvenue') nav('/bienvenue', { replace: true });
  }, [me, loc.pathname, nav]);

  // Raccourcis : ⌘⇧9 Panier, ⌘⇧8 Pensée, N nouveau sujet.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.shiftKey && (e.code === 'Digit9' || e.key === '9')) { e.preventDefault(); openCapture({ kind: 'panier' }); }
      else if (e.metaKey && e.shiftKey && (e.code === 'Digit8' || e.key === '8')) { e.preventDefault(); openCapture({ kind: 'pensee' }); }
      else if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'n' && !isTyping(e.target) && !capture) {
        e.preventDefault();
        const quick = document.getElementById('ajout-rapide') as HTMLInputElement | null;
        if (quick) quick.focus(); else openCapture({ kind: 'tache' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openCapture, capture]);

  // Coller une image ou un lien n'importe où (hors champ) → Panier.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target) || capture) return;
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
      const text = e.clipboardData?.getData('text') ?? '';
      if (file) openCapture({ kind: 'panier', image: file });
      else if (URL_RE.test(text)) openCapture({ kind: 'panier', text });
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [openCapture, capture]);

  // Retour sur l'app après 3 min ailleurs avec un fil en cours → « toujours dessus ? »
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) hiddenAt.current = Date.now();
      else if (fil && hiddenAt.current && Date.now() - hiddenAt.current > 3 * 60 * 1000) setAskFil(true);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [fil]);

  // Bilan du soir : à l'heure choisie, s'il reste des rappels.
  useEffect(() => {
    if (!me) return;
    const check = async () => {
      const [h, m] = me.soir.split(':').map(Number);
      const n = new Date();
      if (n.getHours() * 60 + n.getMinutes() < h * 60 + m) return;
      if (localStorageGet('soir-vu') === ymd(today())) return;
      const r = await api.reminders(ymd(today())).catch(() => []);
      if (r.length) {
        setSoirReady(true);
        if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
          new Notification(`${me.cat_name} a ton bilan du soir`, { body: `${r.length} chose${r.length > 1 ? 's' : ''} à faire avant de fermer.`, icon: '/icon-192.png' });
        }
      }
    };
    check();
    const t = window.setInterval(check, 5 * 60 * 1000);
    return () => window.clearInterval(t);
  }, [me]);

  // Partage depuis le téléphone (/partage?title&text&url) → capture Panier.
  useEffect(() => {
    const q = new URLSearchParams(loc.search);
    if (loc.pathname === '/partage') {
      const text = [q.get('title'), q.get('text'), q.get('url')].filter(Boolean).join(' ');
      nav('/', { replace: true });
      openCapture({ kind: 'panier', text });
    } else if (q.get('deposer')) { nav(loc.pathname, { replace: true }); openCapture({}); }
    else if (q.get('etat')) { nav(loc.pathname, { replace: true }); setEtatOpen(true); }
  }, [loc.pathname, loc.search, nav, openCapture, setEtatOpen]);

  if (needsLogin) return <Login />;
  if (error) {
    return (
      <main className="page" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', textAlign: 'center' }}>
        <Face mood={2} size={96} light={false} />
        <h1>Oups</h1>
        <p className="lede">{error}</p>
      </main>
    );
  }
  if (!me) return <main className="page" aria-busy="true"><p className="pilou">Pilou s’étire…</p></main>;
  if (loc.pathname === '/bienvenue') return <Outlet />;

  const coat = coatOf(me.cat_coat);
  const subPage = loc.pathname === '/bilan' || (loc.pathname.startsWith('/moi/'));
  const link = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : '');

  return (
    <div className="app">
      <div className="page" style={{ paddingBottom: 0 }}>
        <header className={`topbar${subPage ? ' sub' : ''}`}>
          <Link to="/" className="brand"><Logo />Pelote</Link>
          <nav className="pillnav" aria-label="Navigation principale">
            <NavLink to="/" end className={link}>Aujourd’hui</NavLink>
            <NavLink to="/panier" className={link}>Le Panier {panierCount > 0 && <span className="count">{panierCount}</span>}</NavLink>
            <NavLink to="/pensees" className={link}>Pensées</NavLink>
          </nav>
          <div className="row desk-only">
            <button type="button" className="btn ghost" onClick={() => setEtatOpen(true)} aria-label="Humeur et énergie : modifier" aria-busy={!statesLoaded}>
              {latest?.mood ? <Face mood={latest.mood} size={26} light={false} /> : <Icon name="humeur" />}
              {!statesLoaded ? '…' : <>{latest?.mood ? MOODS[latest.mood - 1] : 'Humeur'} · {latest?.energy ? ENERGIES[latest.energy - 1].name : 'Énergie'}</>}
            </button>
            <button type="button" className="btn primary" onClick={() => openCapture({})} aria-label="Déposer (⌘⇧9)"><Icon name="plus" />Déposer</button>
            <NavLink to="/moi" className="avatar-link" aria-label={`Mon profil (${me.cat_name})`}>
              <svg width="30" height="30" viewBox="0 0 64 64" aria-hidden="true">
                <path d="M10 30 L13 6 L28 17 Z M54 30 L51 6 L36 17 Z" fill={coat.head === '#2B2440' ? '#F6F2FF' : coat.head} />
                <ellipse cx="32" cy="37" rx="23" ry="20" fill={coat.head === '#2B2440' ? '#F6F2FF' : coat.head} />
                <path d="M21 35 Q24 31.5 27 35 M37 35 Q40 31.5 43 35" fill="none" stroke="#1F1A3D" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </NavLink>
          </div>
        </header>
      </div>

      {recreEnd && (
        <div className="page" style={{ paddingTop: 12, paddingBottom: 0 }}>
          <Link to="/panier" className="banner" style={{ background: 'var(--coussinet)', textDecoration: 'none', color: 'var(--nuit)' }}>
            <Icon name="horloge" />
            <span style={{ flex: '1 1 auto', fontWeight: 700 }}>Récré en cours</span>
            <span style={{ fontFamily: 'var(--titre)', fontWeight: 800, fontSize: 20 }} aria-label="temps restant">
              {String(Math.floor(Math.max(0, recreEnd - Date.now()) / 60000)).padStart(2, '0')}:{String(Math.floor((Math.max(0, recreEnd - Date.now()) % 60000) / 1000)).padStart(2, '0')}
            </span>
          </Link>
        </div>
      )}
      {askFil && fil && (
        <div className="page" style={{ paddingTop: 12, paddingBottom: 0 }}>
          <div className="banner ask" role="status">
            <Face mood={3} size={32} light />
            <span style={{ flex: '1 1 240px' }}>Te revoilà ! Toujours sur <strong>{fil.title}</strong> ?</span>
            <div className="actions">
              <button type="button" className="btn inv small" onClick={() => { setAskFil(false); nav('/?noeud=1'); }}>Non, faire un nœud</button>
              <button type="button" className="btn yellow small" onClick={() => setAskFil(false)}>Oui, j’y retourne</button>
            </div>
          </div>
        </div>
      )}
      {soirReady && loc.pathname !== '/bilan' && (
        <div className="page" style={{ paddingTop: 12, paddingBottom: 0 }}>
          <div className="banner" style={{ background: 'var(--lavande)' }} role="status">
            <Icon name="lune" />
            <span style={{ flex: '1 1 240px', fontWeight: 600 }}>Ton bilan du soir est prêt.</span>
            <div className="actions">
              <button type="button" className="btn small" onClick={() => { localStorageSet('soir-vu', ymd(today())); setSoirReady(false); }}>Plus tard</button>
              <Link className="btn primary small" to="/bilan" onClick={() => setSoirReady(false)}>Ouvrir</Link>
            </div>
          </div>
        </div>
      )}

      <Outlet />

      <nav className="tabbar" aria-label="Navigation principale">
        <NavLink to="/" end className={link}><Icon name="liste" size={22} />Aujourd’hui</NavLink>
        <NavLink to="/panier" className={link}><Icon name="panier" size={22} />Panier</NavLink>
        <NavLink to="/pensees" className={link}><Icon name="pensee" size={22} />Pensées</NavLink>
        <NavLink to="/moi" className={link}><Icon name="moi" size={22} />Moi</NavLink>
      </nav>

      {capture && <CaptureSheet key={JSON.stringify({ k: capture.kind, t: capture.text, i: !!capture.image })} />}
      {etatOpen && <EtatSheet />}
      {toast && (
        <div className="toast" role={toast.tone === 'error' ? 'alert' : 'status'} aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
          style={toast.tone === 'error' ? { background: '#8A1F45' } : undefined}>
          <Face mood={toast.tone === 'error' ? 2 : 4} size={36} light />
          <div className="stack spacer" style={{ gap: 2 }}>
            <strong>{toast.title}</strong>
            {toast.text && <span className="small" style={{ color: toast.tone === 'error' ? '#FFE3EC' : 'var(--texte-inv)' }}>{toast.text}</span>}
          </div>
          {toast.action && (
            <button type="button" className="btn yellow small" onClick={() => { toast.action!.run(); dismissToast(); }}>{toast.action.label}</button>
          )}
        </div>
      )}
    </div>
  );
}

// localStorage peut être indisponible (navigation privée) : on ne casse jamais l'app pour ça.
export function localStorageGet(k: string) { try { return localStorage.getItem(k); } catch { return null; } }
export function localStorageSet(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* rien */ } }
