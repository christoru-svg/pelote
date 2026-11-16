import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Cat, COATS, coatOf } from '../components/Cat';
import { useApp } from '../store';

const IDEAS = ['Pilou', 'Miso', 'Biscotte', 'Moustache', 'Gribouille'];
const RHYTHMS = [
  ['checkin', 'Check-in du matin', 'humeur, énergie, premier fil', ['08:30', '09:00', '09:30', '10:00']],
  ['recre', 'La récré', '20 min pour le Panier', ['12:30', '16:00', '17:30', '18:00']],
  ['soir', 'Bilan du soir', 'les rappels tirés de tes pensées', ['17:00', '18:00', '19:00', '21:00']],
] as const;

export function Onboarding() {
  const { me, setMe, fail } = useApp();
  const replay = !!me?.onboarded;
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [coat, setCoat] = useState(me?.cat_coat ?? 'tuxedo');
  const [name, setName] = useState(me?.cat_name ?? 'Pilou');
  const [times, setTimes] = useState({ checkin: me?.checkin ?? '09:00', recre: me?.recre ?? '17:30', soir: me?.soir ?? '18:00' });
  const [busy, setBusy] = useState(false);
  const c = coatOf(coat);
  const display = name.trim() || 'ton chat';

  async function finish() {
    setBusy(true);
    try {
      setMe(await api.updateMe({ cat_coat: coat, cat_name: name.trim() || 'Pilou', ...times, onboarded: 1 }));
      nav(replay ? '/moi' : '/', { replace: true });
    } catch { fail('Tes choix n’ont pas été enregistrés'); } finally { setBusy(false); }
  }

  const mobileTips: Array<[string, string, string]> = [
    ['Humeur et énergie', 'un tap sur les tuiles en haut d’Aujourd’hui', 'var(--coussinet)'],
    ['Sur l’écran d’accueil', 'Partager → « Sur l’écran d’accueil » : Pelote s’ouvre comme une app', 'var(--beurre)'],
    ['Partager vers Pelote', 'depuis une autre app, un lien part direct dans le Panier (Android)', 'var(--menthe)'],
  ];

  return (
    <main className="page ob">
      <header className="row wrap" style={{ justifyContent: 'space-between' }}>
        <span className="brand">Pelote</span>
        <div className="row">
          {replay && <button type="button" className="btn small" onClick={() => nav(-1)}>Quitter</button>}
          <span className="small" style={{ fontWeight: 600 }}>Étape {step} sur 3</span>
          <div className="row" style={{ gap: 6 }} aria-hidden="true">
            {[1, 2, 3].map((n) => <span key={n} className="ob-bar" style={{ background: n <= step ? 'var(--nuit)' : 'var(--trait)' }} />)}
          </div>
        </div>
      </header>

      <div className="cols ob-body" style={{ alignItems: 'stretch' }}>
        <section className="card lav desk-only" aria-label="Aperçu de ton chat" style={{ flex: '1 1 340px', alignItems: 'center', justifyContent: 'center', minHeight: 420, textAlign: 'center' }}>
          <Cat coat={c} size={220} label={`${display}, ${c.name.toLowerCase()}`} />
          <div style={{ fontFamily: 'var(--titre)', fontSize: 44, fontWeight: 800, letterSpacing: '-0.03em' }}>{display}</div>
          <div className="pilou" style={{ color: 'var(--nuit)', fontSize: 26 }}>{c.line}</div>
        </section>

        <section className="ob-main" style={{ flex: '999 1 480px', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {step === 1 && (
            <>
              <div>
                <h1>Choisis ton chat</h1>
                <p className="lede desk-only">Il tiendra ton fil, gardera tes trouvailles et te rappellera tes trucs le soir.</p>
              </div>
              <div className="mob-only card lav" aria-hidden="true" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: '10px 14px', boxShadow: 'none' }}>
                <Cat coat={c} size={58} />
                <div className="stack" style={{ gap: 0 }}>
                  <strong style={{ fontFamily: 'var(--titre)', fontSize: 24 }}>{display}</strong>
                  <span className="small" style={{ fontWeight: 600 }}>{c.line}</span>
                </div>
              </div>
              <div role="radiogroup" aria-label="Robe du chat" className="ob-coats">
                {COATS.map((k) => (
                  <button key={k.id} type="button" role="radio" aria-checked={coat === k.id} onClick={() => setCoat(k.id)} className="ob-coat"
                    style={{ border: `2.5px solid ${coat === k.id ? 'var(--nuit)' : 'var(--trait)'}`, background: coat === k.id ? 'var(--beurre-pale)' : 'var(--blanc)' }}>
                    <Cat coat={k} size={60} />{k.name}
                  </button>
                ))}
              </div>
              <div className="field">
                <label htmlFor="nom">Son nom</label>
                <input id="nom" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} style={{ fontSize: 18, fontWeight: 600, borderColor: 'var(--nuit)', borderWidth: 2 }} />
                <div className="row ob-ideas"><span className="small muted">Idées :</span>
                  {IDEAS.map((n) => <button key={n} type="button" className="btn ghost small" onClick={() => setName(n)}>{n}</button>)}
                </div>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <div>
                <h1>Tes rythmes</h1>
                <p className="lede">Quand est-ce que {display} passe te voir ? Modifiable à tout moment.</p>
              </div>
              {RHYTHMS.map(([field, label, desc, opts]) => (
                <div key={field} className="card ob-rhythm" role="radiogroup" aria-label={label}>
                  <div className="row wrap" style={{ gap: 6 }}><strong style={{ fontFamily: 'var(--titre)', fontSize: 18 }}>{label}</strong><span className="small muted">{desc}</span></div>
                  <div className="ob-chips">
                    {opts.map((o) => (
                      <button key={o} type="button" role="radio" aria-checked={times[field] === o} className={`btn small ${times[field] === o ? 'primary' : 'ghost'}`} onClick={() => setTimes({ ...times, [field]: o })}>{o.replace(/^0/, '')}</button>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
          {step === 3 && (
            <>
              <div className="desk-only">
                <h1>Trois raccourcis, c’est tout</h1>
                <p className="lede">Pas besoin de les apprendre : {display} te les soufflera les premiers jours.</p>
              </div>
              <div className="mob-only">
                <h1>Trois réflexes, c’est tout</h1>
                <p className="lede">{display} te les rappellera les premiers jours.</p>
              </div>
              {[['⌘⇧9', 'Capturer dans le Panier', 'un lien, un texte, une image, ou une capture d’écran', 'var(--coussinet)'],
                ['⌘⇧8', 'Déposer une pensée', 'tu tapes, Entrée, c’est rangé', 'var(--beurre)'],
                ['N', 'Ajouter un sujet', 'une date dans le titre et il se range tout seul', 'var(--menthe)']].map(([k, l, d, bg]) => (
                <div key={k} className="card desk-only" style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
                  <kbd style={{ minWidth: 96, textAlign: 'center', background: bg, borderRadius: 14, padding: '12px 14px', fontSize: 22, boxShadow: '0 4px 0 var(--nuit)' }}>{k}</kbd>
                  <div className="stack" style={{ gap: 2 }}><strong style={{ fontFamily: 'var(--titre)', fontSize: 19 }}>{l}</strong><span className="small muted">{d}</span></div>
                </div>
              ))}
              {mobileTips.map(([l, d, bg]) => (
                <div key={l} className="card mob-only" style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: '12px 14px' }}>
                  <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: 999, background: bg, border: '2px solid var(--nuit)', flex: 'none' }} />
                  <div className="stack" style={{ gap: 2 }}><strong style={{ fontFamily: 'var(--titre)', fontSize: 17 }}>{l}</strong><span className="small muted">{d}</span></div>
                </div>
              ))}
            </>
          )}
        </section>
      </div>

      <div className="ob-foot">
        <div className="actions">
          {step > 1 && <button type="button" className="btn" onClick={() => setStep(step - 1)}>Retour</button>}
          {step < 3
            ? <button type="button" className="btn primary" onClick={() => setStep(step + 1)}>Continuer</button>
            : <button type="button" className="btn yellow" disabled={busy} onClick={finish} style={{ boxShadow: '0 5px 0 var(--nuit)' }}>{replay ? 'Enregistrer' : `C’est parti avec ${display}`}</button>}
        </div>
      </div>
    </main>
  );
}
