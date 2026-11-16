import { api } from '../api';
import { Icon } from '../components/Icon';
import { logout } from '../firebase';
import { ProfileLayout } from '../components/ProfileLayout';
import { useApp } from '../store';

export function Donnees() {
  const { me, fail } = useApp();
  async function download() {
    try {
      const data = await api.exportAll();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: 'pelote-export.json' });
      a.click();
      URL.revokeObjectURL(url);
    } catch { fail('L’export n’a pas pu être préparé'); }
  }
  if (!me) return null;
  return (
    <ProfileLayout title="Compte & données" lede="Où tu te connectes, et ce que tu gardes.">
      <div className="grid-auto">
        <section className="card" aria-labelledby="connexion">
          <h2 id="connexion">Connexion</h2>
          <div className="row" style={{ borderTop: '1px solid var(--trait-doux)', paddingTop: 10 }}>
            <span className="stack spacer" style={{ gap: 0 }}><strong>{me.email}</strong><span className="small muted">via ton compte Google</span></span>
          </div>
          <p className="small muted" style={{ margin: 0 }}>Pas de mot de passe stocké par Pelote : la connexion passe par ton compte Google.</p>
        </section>

        <section className="card" aria-labelledby="donnees">
          <h2 id="donnees">Tes données</h2>
          <p className="small muted" style={{ margin: 0, lineHeight: 1.5 }}>Tâches, pensées, humeurs et captures sont stockées sur ton compte (Firebase) et synchronisées entre tes appareils, même après un passage hors ligne.</p>
          <div className="actions">
            <button type="button" className="btn primary" onClick={download}><Icon name="telecharger" />Exporter (JSON)</button>
          </div>
        </section>

        <section className="card" aria-labelledby="sources">
          <h2 id="sources">Sources connectées</h2>
          <p className="small muted" style={{ margin: 0 }}>Bientôt : ta to-do Confluence en lecture seule.</p>
        </section>
      </div>
      <div className="row wrap">
        <span className="pilou spacer">{me.cat_name} garde tout au chaud en ton absence</span>
        <button type="button" className="btn" onClick={() => logout()}>Se déconnecter</button>
      </div>
    </ProfileLayout>
  );
}
