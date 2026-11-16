// Icônes au trait, une seule taille de trait pour tout le produit.
const PATHS = {
  fil: 'M2 14c3-5 5 3 8-1s5-5 8 0 M20 11a2 2 0 1 1 0 4a2 2 0 1 1 0-4z',
  panier: 'M3 10h18l-2 9H5z M8 10l3-6 M16 10l-3-6',
  noeud: 'M3 12h6 M15 12h6 M12 9a3 3 0 1 1 0 6a3 3 0 1 1 0-6z M10 14l-3 5 M14 14l3 5',
  pensee: 'M4 5h16v11h-9l-5 4v-4H4z',
  liste: 'M4 6h16 M4 12h16 M4 18h10',
  moi: 'M12 3.5a4 4 0 1 1 0 8a4 4 0 1 1 0-8z M4 21c1-4 4-6 8-6s7 2 8 6',
  plus: 'M12 5v14 M5 12h14',
  check: 'M5 12l5 5 9-10',
  close: 'M6 6l12 12 M18 6L6 18',
  chevron: 'M9 6l6 6-6 6',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  horloge: 'M12 4a8 8 0 1 1 0 16a8 8 0 1 1 0-16z M12 8v4l3 2',
  eclair: 'M13 3 L5 14 h6 l-1 7 8-11 h-6 z',
  humeur: 'M12 4a8 8 0 1 1 0 16a8 8 0 1 1 0-16z M9 14c1.5 1.5 4.5 1.5 6 0 M9.5 10h0.01 M14.5 10h0.01',
  photo: 'M4 7h4l2-3h4l2 3h4v13H4z M12 10a3.5 3.5 0 1 1 0 7a3.5 3.5 0 1 1 0-7z',
  ecran: 'M3 4h18v12H3z M8 20h8 M12 16v4',
  coller: 'M9 4h6v3H9z M7 5H5v15h14V5h-2',
  micro: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3 M5 11a7 7 0 0 0 14 0 M12 18v3',
  lien: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  poubelle: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13',
  rejouer: 'M4 12a8 8 0 1 0 2.5-5.8 M4 4v5h5',
  tendance: 'M4 18l5-6 4 3 7-9',
  reglages: 'M4 7h10 M18 7h2 M4 17h4 M12 17h8 M14 4v6 M8 14v6',
  bouclier: 'M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z',
  telecharger: 'M12 4v11 M7 10l5 5 5-5 M5 20h14',
  lune: 'M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, color = 'currentColor', stroke = 2 }: { name: IconName; size?: number; color?: string; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
