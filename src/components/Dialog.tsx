import { useEffect, useRef, type ReactNode } from 'react';

/** Fenêtre modale (bottom sheet sur mobile). Échap ferme, le focus reste dedans. */
export function Dialog({ title, onClose, children, dark, labelledBy }: {
  title?: string; onClose: () => void; children: ReactNode; dark?: boolean; labelledBy?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>('input, textarea, button, [href]');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && el) {
        const items = [...el.querySelectorAll<HTMLElement>('input, textarea, button, [href], select')].filter((n) => !n.hasAttribute('disabled'));
        if (!items.length) return;
        const a = items[0], z = items[items.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus(); };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`dialog${dark ? ' dark' : ''}`} role="dialog" aria-modal="true" aria-label={labelledBy ? undefined : title} aria-labelledby={labelledBy}>
        <span className="grabber" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}
