import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Stats } from '../api';
import { Cat, coatOf, ENERGIES, MOODS } from '../components/Cat';
import { Icon, type IconName } from '../components/Icon';
import { ProfileLayout } from '../components/ProfileLayout';
import { hhmm, parseStamp } from '../lib/dates';
import { useApp } from '../store';

export function Moi() {
  const { me, latest, fil, setEtatOpen } = useApp();
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => { api.stats().then(setStats).catch(() => {}); }, []);
  if (!me) return null;
  const coat = coatOf(me.cat_coat);
  const days = stats ? Math.max(1, Math.round((Date.now() - parseStamp(stats.since).getTime()) / 86400000)) : 1;

  return (
    <ProfileLayout title="Moi" lede="Qui tu es, et qui veille sur toi.">
      {/* Mobile : version compacte, dans l'ordre email → chat → en ce moment → stats → réglages */}
      <div className="mob-only stack" style={{ gap: 10 }}>
        <div className="row" style={{ gap: 10 }}>
          <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 999, background: 'var(--beurre)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--titre)', fontWeight: 800 }}>
            {me.email[0]?.toUpperCase()}
          </span>
          <span className="small spacer" style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{me.email}</span>
        </div>

        <section className="card lav" aria-labelledby="chat-nom-m" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: '12px 14px', boxShadow: '0 4px 0 var(--nuit)' }}>
          <Cat coat={coat} size={64} label={`${me.cat_name}, ${coat.name.toLowerCase()}`} />
          <div className="stack spacer" style={{ gap: 0, minWidth: 0 }}>
            <h2 id="chat-nom-m" style={{ fontSize: 24, fontWeight: 800 }}>{me.cat_name}</h2>
            <span className="small" style={{ fontWeight: 600 }}>{coat.name} · {days} jour{days > 1 ? 's' : ''} ensemble</span>
          </div>
          <Link className="btn primary small" to="/bienvenue">Changer</Link>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
          <button type="button" className="tile" onClick={() => setEtatOpen('mood')} style={{ background: 'var(--coussinet-pale)', border: 'none', textAlign: 'left', cursor: 'pointer', minHeight: 56 }}>
            <span className="small" style={{ fontWeight: 700 }}>Humeur</span>
            <strong style={{ fontFamily: 'var(--titre)', fontSize: 17 }}>{latest?.mood ? MOODS[latest.mood - 1] : 'À noter'}</strong>
          </button>
          <button type="button" className="tile" onClick={() => setEtatOpen('energy')} style={{ background: 'var(--menthe-pale)', border: 'none', textAlign: 'left', cursor: 'pointer', minHeight: 56 }}>
            <span className="small" style={{ fontWeight: 700 }}>Énergie</span>
            <strong style={{ fontFamily: 'var(--titre)', fontSize: 17 }}>{latest?.energy ? ENERGIES[latest.energy - 1].name : 'À noter'}</strong>
          </button>
        </div>

        <dl className="card dark" style={{ margin: 0, padding: '10px 12px', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 4 }}>
          {[
            [stats?.done ?? 0, 'bouclés', 'var(--menthe)'],
            [stats?.panier ?? 0, 'trouvailles', 'var(--coussinet)'],
            [stats?.knots ?? 0, 'nœuds', 'var(--lavande)'],
            [stats?.thoughts ?? 0, 'pensées', 'var(--beurre)'],
          ].map(([n, label, color]) => (
            <div key={label as string} style={{ display: 'flex', flexDirection: 'column-reverse', alignItems: 'center' }}>
              <dt style={{ fontSize: 12, color: 'var(--texte-inv)' }}>{label}</dt>
              <dd style={{ margin: 0, fontFamily: 'var(--titre)', fontSize: 22, fontWeight: 800, color: color as string }}>{n}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="cols desk-only" style={{ alignItems: 'stretch' }}>
        <section className="card lav" aria-labelledby="chat-nom" style={{ flex: '1 1 300px', alignItems: 'center', textAlign: 'center' }}>
          <span className="eyebrow" style={{ alignSelf: 'flex-start' }}>Ton chat</span>
          <Cat coat={coat} size={180} label={`${me.cat_name}, ${coat.name.toLowerCase()}`} />
          <h2 id="chat-nom" style={{ fontSize: 44, fontWeight: 800 }}>{me.cat_name}</h2>
          <span className="pilou" style={{ color: 'var(--nuit)', fontSize: 26 }}>{coat.line}</span>
          <span className="small" style={{ fontWeight: 600 }}>à tes côtés depuis {days} jour{days > 1 ? 's' : ''}</span>
          <div className="actions" style={{ alignSelf: 'stretch', marginTop: 'auto' }}>
            <Link className="btn primary" to="/bienvenue">Changer de robe ou de nom</Link>
          </div>
        </section>

        <div className="stack" style={{ flex: '999 1 400px', gap: 16 }}>
          <section className="card" style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
            <span aria-hidden="true" style={{ width: 60, height: 60, borderRadius: 999, background: 'var(--beurre)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--titre)', fontSize: 24, fontWeight: 800 }}>
              {me.email[0]?.toUpperCase()}
            </span>
            <div className="stack spacer" style={{ gap: 2 }}>
              <strong style={{ fontFamily: 'var(--titre)', fontSize: 20 }}>{me.email.split('@')[0]}</strong>
              <span className="small muted">{me.email}</span>
            </div>
          </section>

          <section className="card" aria-labelledby="maintenant">
            <div className="row wrap">
              <h2 id="maintenant" className="spacer">En ce moment</h2>
              {latest && <span className="small muted">mis à jour à {hhmm(parseStamp(latest.created_at))}</span>}
              <button type="button" className="btn primary small" onClick={() => setEtatOpen(true)}>Mettre à jour</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              <div className="tile" style={{ background: 'var(--coussinet-pale)' }}><span className="small" style={{ fontWeight: 700 }}>Humeur</span><span className="big">{latest?.mood ? MOODS[latest.mood - 1] : '—'}</span></div>
              <div className="tile" style={{ background: 'var(--menthe-pale)' }}><span className="small" style={{ fontWeight: 700 }}>Énergie</span><span className="big">{latest?.energy ? ENERGIES[latest.energy - 1].name : '—'}</span></div>
              <div className="tile" style={{ background: 'var(--beurre-pale)' }}><span className="small" style={{ fontWeight: 700 }}>Le fil</span><span style={{ fontFamily: 'var(--titre)', fontWeight: 700, fontSize: 17 }}>{fil?.title ?? 'aucun pour l’instant'}</span></div>
            </div>
          </section>

          <section className="card dark" aria-labelledby="ensemble">
            <h2 id="ensemble">{me.cat_name} &amp; toi, depuis le début</h2>
            <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
              {[
                [stats?.done ?? 0, 'trucs bouclés', 'var(--menthe)'],
                [stats?.panier ?? 0, 'trouvailles au Panier', 'var(--coussinet)'],
                [stats?.knots ?? 0, 'nœuds faits', 'var(--lavande)'],
                [stats?.thoughts ?? 0, 'pensées vidées', 'var(--beurre)'],
              ].map(([n, label, color]) => (
                <div key={label as string} style={{ background: 'var(--nuit-2)', borderRadius: 18, padding: '12px 14px', display: 'flex', flexDirection: 'column-reverse' }}>
                  <dt className="small" style={{ color: 'var(--texte-inv)' }}>{label}</dt>
                  <dd style={{ margin: 0, fontFamily: 'var(--titre)', fontSize: 30, fontWeight: 800, color: color as string }}>{n}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>

      <nav aria-label="Mon profil" className="card" style={{ padding: '4px 18px', gap: 0 }}>
        {([
          ['/bilan', 'Bilan du soir', 'lune'],
          ['/moi/tendances', 'Tes tendances', 'tendance'],
          ['/moi/reglages', 'Réglages', 'reglages'],
          ['/moi/donnees', 'Compte & données', 'bouclier'],
          ['/bienvenue', 'Rejouer l’accueil', 'rejouer'],
        ] as Array<[string, string, IconName]>).map(([to, label, icon], i, all) => (
          <Link key={to} to={to} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12, minHeight: 52, borderBottom: i < all.length - 1 ? '1px solid var(--trait-doux)' : 'none' }}>
            <Icon name={icon} /><span className="spacer" style={{ fontWeight: 600 }}>{label}</span><Icon name="chevron" size={16} />
          </Link>
        ))}
      </nav>
    </ProfileLayout>
  );
}
