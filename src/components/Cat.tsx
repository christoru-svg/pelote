import { useApp } from '../store';
// Pilou, en pied (8 robes) et en tête (5 humeurs).

const T = 'transparent';
const INK = '#1F1A3D';
const GREEN = '#7FBF6A', AMBER = '#F2B33D', BLUE = '#7FB3E6';

export type Coat = {
  id: string; name: string; line: string;
  head: string; body: string; chest: string; paws: string; muzzle: string; tail: string;
  patchA: string; patchB: string; bodyPatch: string; stripe: string; eye: string; mouth: string;
};

function coat(id: string, name: string, line: string, o: Partial<Coat> & { head: string }): Coat {
  return {
    id, name, line, body: o.head, chest: o.head, paws: o.head, muzzle: o.head, tail: o.head,
    patchA: T, patchB: T, bodyPatch: T, stripe: T, eye: AMBER, mouth: INK, ...o,
  };
}

export const COATS: Coat[] = [
  coat('calico', 'Calico', 'trois couleurs, zéro règle', { head: '#FFFFFF', patchA: '#F29A4A', patchB: '#2B2440', bodyPatch: '#F29A4A', tail: '#2B2440', eye: GREEN }),
  coat('gris', 'Gris chaussettes', 'gris, museau et chaussettes blanches', { head: '#8E8AA3', chest: '#FFFFFF', paws: '#FFFFFF', muzzle: '#FFFFFF' }),
  coat('blanc', 'Blanc', 'tout blanc, tout doux', { head: '#FFFFFF', eye: BLUE }),
  coat('noir', 'Noir', 'noir comme minuit, porte-bonheur', { head: '#2B2440', eye: '#FFD25E', mouth: '#F6F2FF' }),
  coat('ecaille', 'Écaille', 'écaille de tortue, caractère garanti', { head: '#3A2B2B', patchA: '#D9823B', patchB: '#8A4B2A', bodyPatch: '#D9823B', mouth: '#F6F2FF' }),
  coat('tuxedo', 'Tuxedo', 'toujours bien habillé', { head: '#2B2440', chest: '#FFFFFF', paws: '#FFFFFF', muzzle: '#FFFFFF', eye: '#8EDDBE' }),
  coat('orange', 'Orange', '100 % énergie zoomies', { head: '#F29A4A', chest: '#F7C99A', paws: '#F7C99A', muzzle: '#F7C99A', stripe: '#C96A22', eye: GREEN }),
  coat('tabby', 'Tabby', 'rayé et rusé', { head: '#9C8A73', chest: '#D3C4AC', paws: '#D3C4AC', muzzle: '#D3C4AC', stripe: '#4A3C30', eye: GREEN }),
];
export const coatOf = (id?: string) => COATS.find((c) => c.id === id) ?? COATS[5];

export function Cat({ coat, size = 120, label, outline = INK }: { coat: Coat; size?: number; label?: string; outline?: string }) {
  const c = coat;
  return (
    <svg width={size} height={size * (140 / 120)} viewBox="0 0 120 140" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <path d="M84 122 Q116 116 110 84 Q107 70 98 74" fill="none" stroke={outline} strokeWidth="14" strokeLinecap="round" />
      <path d="M84 122 Q116 116 110 84 Q107 70 98 74" fill="none" stroke={c.tail} strokeWidth="9" strokeLinecap="round" />
      <ellipse cx="60" cy="102" rx="34" ry="30" fill={c.body} stroke={outline} strokeWidth="2.5" />
      <ellipse cx="82" cy="98" rx="13" ry="17" fill={c.bodyPatch} />
      <ellipse cx="60" cy="104" rx="15" ry="22" fill={c.chest} />
      <path d="M34 94 Q41 98 38 108 M86 94 Q79 98 82 108 M32 104 Q38 108 36 116 M88 104 Q82 108 84 116" fill="none" stroke={c.stripe} strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="46" cy="129" rx="11" ry="7" fill={c.paws} stroke={outline} strokeWidth="2.5" />
      <ellipse cx="74" cy="129" rx="11" ry="7" fill={c.paws} stroke={outline} strokeWidth="2.5" />
      <path d="M28 54 L31 14 L55 34 Z M92 54 L89 14 L65 34 Z" fill={c.head} stroke={outline} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M35 42 L36 25 L47 35 Z M85 42 L84 25 L73 35 Z" fill="#FF8FB1" />
      <ellipse cx="60" cy="58" rx="35" ry="28" fill={c.head} />
      <path d="M30 50 Q38 33 56 32 Q52 50 32 62 Z" fill={c.patchA} />
      <path d="M66 34 Q80 35 91 50 Q78 55 68 44 Z" fill={c.patchB} />
      <path d="M50 36 L54 43 L60 37 L66 43 L70 36" fill="none" stroke={c.stripe} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M27 60 L36 61 M28 67 L36 66 M93 60 L84 61 M92 67 L84 66" stroke={c.stripe} strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="60" cy="71" rx="15" ry="10" fill={c.muzzle} />
      <ellipse cx="60" cy="58" rx="35" ry="28" fill="none" stroke={outline} strokeWidth="2.5" />
      <ellipse cx="46" cy="57" rx="4.5" ry="5.5" fill={c.eye} stroke={INK} strokeWidth="1.5" />
      <ellipse cx="74" cy="57" rx="4.5" ry="5.5" fill={c.eye} stroke={INK} strokeWidth="1.5" />
      <path d="M46 54 L46 60 M74 54 L74 60" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      <path d="M57 66 L63 66 L60 69.5 Z" fill="#FF8FB1" />
      <path d="M54 72 Q57 75 60 72 Q63 75 66 72" fill="none" stroke={c.mouth} strokeWidth="2" strokeLinecap="round" />
      <path d="M12 64 L28 67 M12 72 L28 71 M108 64 L92 67 M108 72 L92 71" stroke="#6B6390" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export const MOODS = ['Grognon', 'Bof', 'Ça va', 'Content', 'Ronron'];
export const ENERGIES = [
  { name: 'Sieste', desc: 'batterie basse' },
  { name: 'Ronron', desc: 'rythme tranquille' },
  { name: 'Zoomies', desc: 'à fond, profites-en' },
];
const EYES_OPEN = 'M21 35 a3 3.6 0 1 0 6 0 a3 3.6 0 1 0 -6 0 M37 35 a3 3.6 0 1 0 6 0 a3 3.6 0 1 0 -6 0';
const EYES_CLOSED = 'M21 35 Q24 31.5 27 35 M37 35 Q40 31.5 43 35';
const FACES = [
  { eyes: 'M20 32 L27 35 M44 32 L37 35', fill: 'none', mouth: 'M26 49 Q32 44.5 38 49' },
  { eyes: EYES_OPEN, fill: INK, mouth: 'M27 47 L37 47' },
  { eyes: EYES_OPEN, fill: INK, mouth: 'M27 46 Q32 49.5 37 46' },
  { eyes: EYES_OPEN, fill: INK, mouth: 'M26 45.5 Q29 49 32 45.5 Q35 49 38 45.5' },
  { eyes: EYES_CLOSED, fill: 'none', mouth: 'M26 45.5 Q29 49 32 45.5 Q35 49 38 45.5' },
];

const isDark = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b < 110;
};

/**
 * Tête du chat choisi à l'onboarding, avec une expression par humeur (1..5).
 * `light` = posée sur un fond foncé : le contour devient blanc pour rester lisible.
 */
export function Face({ mood, size = 40, light = true, coat: forced }: { mood: number; size?: number; light?: boolean; coat?: Coat }) {
  const { me } = useApp();
  const c = forced ?? coatOf(me?.cat_coat);
  const f = FACES[Math.min(4, Math.max(0, mood - 1))];
  const outline = light ? '#F6F2FF' : INK;
  const eyeInk = isDark(c.head) ? '#F6F2FF' : INK;
  const mouthInk = isDark(c.muzzle) ? '#F6F2FF' : INK;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M10 30 L13 6 L28 17 Z M54 30 L51 6 L36 17 Z" fill={c.head} stroke={outline} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M14.5 14 L15.5 21 L22 17 Z M49.5 14 L48.5 21 L42 17 Z" fill="#FF8FB1" />
      <ellipse cx="32" cy="37" rx="23" ry="20" fill={c.head} />
      <path d="M13 33 Q17 21 29 20 Q27 31 14 40 Z" fill={c.patchA} />
      <path d="M36 20 Q47 21 52 31 Q44 35 38 27 Z" fill={c.patchB} />
      <path d="M27 21 L29 25.5 L32 22 L35 25.5 L37 21" fill="none" stroke={c.stripe} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <ellipse cx="32" cy="45" rx="9.5" ry="6" fill={c.muzzle} />
      <ellipse cx="32" cy="37" rx="23" ry="20" fill="none" stroke={outline} strokeWidth="2.2" />
      <path d={f.eyes} fill={f.fill === 'none' ? 'none' : eyeInk} stroke={eyeInk} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M30 41 L34 41 L32 43.5 Z" fill="#FF8FB1" />
      <path d={f.mouth} fill="none" stroke={mouthInk} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function EnergyBars({ level, on }: { level: number; on: boolean }) {
  const full = on ? INK : '#FFD25E';
  const empty = on ? 'rgba(31,26,61,0.25)' : '#4F4870';
  return (
    <span className="bars" aria-hidden="true">
      {[12, 18, 24].map((h, i) => <span key={h} style={{ height: h, background: i < level ? full : empty }} />)}
    </span>
  );
}
