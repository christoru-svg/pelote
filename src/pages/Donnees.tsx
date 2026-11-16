import { Icon } from '../components/Icon';
import { ProfileLayout } from '../components/ProfileLayout';
import { useApp } from '../store';

export function Donnees() {
  const { me } = useApp();
  if (!me) return null;
  return (
    <ProfileLayout title="Compte & données" lede="Où tu te connectes, et ce que tu gardes.">
      <div className="grid-auto">
        <section className="card" aria-labelledby="connexion">
          <h2 id="connexion">Connexion</h2>
          <div className="row" style={{ borderTop: '1px solid var(--trait-doux)', paddingTop: 10 }}>
            <span className="stack spacer" style={{ gap: 0 }}><strong>{me.email}</strong><span className="small muted">via Cloudflare Access</span></span>
          </div>
          <p className="small muted" style={{ margin: 0 }}>Pas de mot de passe stocké par Pelote : la connexion passe par ton compte (Google ou code par email).</p>
        </section>

        <section className="card" aria-labelledby="donnees">
          <h2 id="donnees">Tes données</h2>
          <p className="small muted" style={{ margin: 0, lineHeight: 1.5 }}>Tâches, pensées, humeurs et captures sont stockées sur ton compte (Cloudflare D1 et R2) et synchronisées entre tes appareils.</p>
          <div className="actions">
            <a className="btn primary" href="/api/export" download><Icon name="telecharger" />Exporter (JSON)</a>
          </div>
        </section>

        <section className="card" aria-labelledby="sources">
          <h2 id="sources">Sources connectées</h2>
          <p className="small muted" style={{ margin: 0 }}>Bientôt : ta to-do Confluence en lecture seule.</p>
        </section>
      </div>
      <div className="row wrap">
        <span className="pilou spacer">{me.cat_name} garde tout au chaud en ton absence</span>
        <a className="btn" href="/cdn-cgi/access/logout">Se déconnecter</a>
      </div>
    </ProfileLayout>
  );
}
