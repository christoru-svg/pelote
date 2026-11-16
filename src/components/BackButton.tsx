import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from './Icon';

/** Retour en haut des sous-pages (mobile) : page précédente, sinon « Moi ». */
export function BackButton({ fallback = '/moi', label = 'Retour' }: { fallback?: string; label?: string }) {
  const nav = useNavigate();
  const loc = useLocation();
  // react-router garde un index d'historique : 0 = on est arrivé directement sur cette page.
  const canGoBack = (window.history.state as { idx?: number } | null)?.idx ? true : false;
  return (
    <button type="button" className="btn ghost small mob-only back" onClick={() => (canGoBack ? nav(-1) : nav(fallback))} data-from={loc.pathname}>
      <span style={{ display: 'inline-flex', transform: 'scaleX(-1)' }}><Icon name="chevron" size={16} /></span>
      {label}
    </button>
  );
}
