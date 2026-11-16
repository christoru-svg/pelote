import { useState } from 'react';
import { Cat, coatOf } from '../components/Cat';
import { signInWithGoogle } from '../firebase';

export function Login() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setErr(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setErr(code === 'auth/popup-blocked'
          ? 'Le navigateur a bloqué la fenêtre de connexion. Autorise les pop-ups pour ce site et réessaie.'
          : 'La connexion n’a pas abouti. Réessaie dans un instant.');
      }
    } finally { setBusy(false); }
  }

  return (
    <main style={{ minHeight: '100dvh', display: 'flex', flexWrap: 'wrap' }}>
      <section style={{ flex: '1 1 420px', background: 'var(--nuit)', color: 'var(--lait)', padding: '48px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 28 }}>
        <span style={{ fontFamily: 'var(--titre)', fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>Pelote</span>
        <div className="stack" style={{ gap: 18 }}>
          <Cat coat={coatOf('tuxedo')} size={200} label="Pilou, chat tuxedo assis" outline="#F6F2FF" />
          <h1 style={{ fontSize: 'clamp(36px, 5vw, 56px)' }}>Garde le fil.<br />Démêle ta journée.</h1>
          <span className="pilou" style={{ color: 'var(--beurre)', fontSize: 26 }}>Pilou t’attendait, il a gardé ta place au chaud</span>
        </div>
        <span className="small" style={{ color: 'var(--texte-inv)' }}>Ordinateur · téléphone · tes données restent à toi</span>
      </section>
      <section style={{ flex: '1 1 420px', padding: '48px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="stack" style={{ width: '100%', maxWidth: 420, gap: 16 }}>
          <h2 style={{ fontSize: 40, fontWeight: 800 }}>Content de te revoir</h2>
          <p className="lede" style={{ margin: 0 }}>Pas de mot de passe à retenir. Ta tête a déjà assez à porter.</p>
          <button type="button" className="btn primary" disabled={busy} onClick={go} style={{ minHeight: 52, fontSize: 16, boxShadow: '0 5px 0 var(--lavande)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.6 M20 12h-8" /></svg>
            {busy ? 'Connexion…' : 'Continuer avec Google'}
          </button>
          {err && <p role="alert" style={{ margin: 0, color: '#8A1F45', fontWeight: 600 }}>{err}</p>}
          <p className="small muted" style={{ margin: 0 }}>Pelote est privé : seules les adresses autorisées peuvent l’ouvrir.</p>
        </div>
      </section>
    </main>
  );
}
