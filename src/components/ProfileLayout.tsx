import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { BackButton } from './BackButton';

const PAGES = [
  ['/moi', 'Moi'],
  ['/moi/tendances', 'Tes tendances'],
  ['/moi/reglages', 'Réglages'],
  ['/moi/donnees', 'Compte & données'],
] as const;

export function ProfileLayout({ title, lede, children }: { title: string; lede: string; children: ReactNode }) {
  const loc = useLocation();
  return (
    <main className="page">
      {loc.pathname !== '/moi' && <BackButton fallback="/moi" label="Moi" />}
      <div className="cols">
        <nav aria-label="Mon profil" className="desk-only" style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="eyebrow muted" style={{ marginBottom: 8 }}>Mon profil</span>
          {PAGES.map(([to, label]) => (
            <NavLink key={to} to={to} end
              style={({ isActive }) => ({
                textDecoration: 'none', minHeight: 44, display: 'flex', alignItems: 'center', padding: '0 14px', borderRadius: 14,
                fontWeight: 600, background: isActive ? 'var(--nuit)' : 'transparent', color: isActive ? 'var(--lait)' : 'var(--nuit)',
              })}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="col-main" style={{ flex: '999 1 640px' }}>
          <div>
            <h1>{title}</h1>
            <p className="lede">{lede}</p>
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
