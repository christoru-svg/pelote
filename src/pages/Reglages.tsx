import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Icon } from '../components/Icon';
import { ProfileLayout } from '../components/ProfileLayout';
import { useApp } from '../store';

const RHYTHMS = [
  ['checkin', 'Check-in du matin', 'humeur, énergie, premier fil', 'var(--beurre)'],
  ['recre', 'La récré', '20 min pour le Panier', 'var(--coussinet)'],
  ['soir', 'Bilan du soir', 'rappels tirés des pensées', 'var(--lavande)'],
] as const;

export function Reglages() {
  const { me, setMe, fail } = useApp();
  const [saved, setSaved] = useState<Record<string, 'saving' | 'ok' | undefined>>({});
  const [perm, setPerm] = useState<NotificationPermission | 'absent'>('Notification' in window ? Notification.permission : 'absent');
  if (!me) return null;

  async function save(field: 'checkin' | 'recre' | 'soir', value: string) {
    if (!value) return;
    setSaved((s) => ({ ...s, [field]: 'saving' }));
    try {
      setMe(await api.updateMe({ [field]: value }));
      setSaved((s) => ({ ...s, [field]: 'ok' }));
    } catch { setSaved((s) => ({ ...s, [field]: undefined })); fail('L’horaire n’a pas été enregistré'); }
  }

  return (
    <ProfileLayout title="Réglages" lede={`Les passages de ${me.cat_name}, tes raccourcis et tes notifications.`}>
      <div className="grid-auto">
        <section className="card" aria-labelledby="rythmes">
          <h2 id="rythmes">Rythmes</h2>
          <p className="small muted" style={{ margin: 0 }}>Chaque horaire s’enregistre tout seul dès que tu le changes.</p>
          {RHYTHMS.map(([field, label, desc, color]) => (
            <div key={field} className="row" style={{ borderTop: '1px solid var(--trait-doux)', paddingTop: 10 }}>
              <span className="dot" style={{ background: color, width: 10, height: 10 }} aria-hidden="true" />
              <label htmlFor={`r-${field}`} className="stack spacer" style={{ gap: 0 }}>
                <span style={{ fontWeight: 600 }}>{label}</span>
                <span className="small muted">{desc}</span>
              </label>
              <input id={`r-${field}`} type="time" className="input" style={{ width: 120, minHeight: 44 }} defaultValue={me[field]} aria-describedby={`r-${field}-etat`}
                onChange={(e) => e.target.value && e.target.value !== me[field] && save(field, e.target.value)} />
              <span id={`r-${field}-etat`} className="small" aria-live="polite" style={{ width: 84, fontWeight: 600, color: saved[field] === 'ok' ? '#1F7A55' : 'var(--texte-2)' }}>
                {saved[field] === 'saving' ? 'enregistre…' : saved[field] === 'ok' ? '✓ enregistré' : ''}
              </span>
            </div>
          ))}
        </section>

        <section className="card" aria-labelledby="raccourcis">
          <h2 id="raccourcis">Raccourcis</h2>
          {[['Capturer dans le Panier', '⌘⇧9'], ['Déposer une pensée', '⌘⇧8'], ['Ajouter un sujet', 'N'], ['Coller un lien ou une image', '⌘V']].map(([l, k]) => (
            <div key={l} className="row" style={{ borderTop: '1px solid var(--trait-doux)', paddingTop: 10, minHeight: 44 }}>
              <span className="spacer" style={{ fontWeight: 600 }}>{l}</span><kbd>{k}</kbd>
            </div>
          ))}
          <p className="small muted" style={{ margin: 0 }}>Ils marchent quand Pelote est au premier plan. Le raccourci global (depuis n’importe quelle app) arrivera avec l’app Mac.</p>
        </section>

        <section className="card" aria-labelledby="notifs">
          <h2 id="notifs">Notifications</h2>
          <p className="small muted" style={{ margin: 0 }}>
            {perm === 'granted' ? 'Activées : le bilan du soir te prévient, tant que Pelote est ouvert dans un onglet ou installé.'
              : perm === 'denied' ? 'Bloquées dans ton navigateur. Tu peux les réautoriser depuis les réglages du site.'
              : perm === 'absent' ? 'Ce navigateur ne gère pas les notifications.'
              : 'Pour être prévenu·e du bilan du soir.'}
          </p>
          {perm === 'default' && <div className="actions"><button type="button" className="btn primary" onClick={() => Notification.requestPermission().then(setPerm)}>Activer</button></div>}
        </section>

        <section className="card cream" aria-labelledby="rejouer">
          <h2 id="rejouer">Rejouer l’accueil</h2>
          <p className="small" style={{ margin: 0, lineHeight: 1.5 }}>Reprends les 3 étapes du début : ton chat, tes rythmes, tes raccourcis. Rien n’est effacé.</p>
          <span className="pilou">utile après une pause, ou quand tes journées changent</span>
          <div className="actions" style={{ marginTop: 'auto' }}><Link className="btn primary" to="/bienvenue"><Icon name="rejouer" />Rejouer l’accueil</Link></div>
        </section>
      </div>
    </ProfileLayout>
  );
}
