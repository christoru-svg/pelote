// Petites fonctions de dates en heure locale (pas de fuseau UTC : on raisonne
// comme la personne, « aujourd'hui » = sa journée à elle).

export const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const fromYmd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Lundi de la semaine de d. */
export const startOfWeek = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));
/** Dimanche de la semaine de d. */
export const endOfWeek = (d: Date) => addDays(startOfWeek(d), 6);
export const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

export const today = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
};

const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export const formatDay = (s: string, ref = today()) => {
  const d = fromYmd(s);
  const diff = Math.round((d.getTime() - ref.getTime()) / 86400000);
  if (diff === 0) return "aujourd'hui";
  if (diff === 1) return 'demain';
  if (diff > 1 && diff < 7) return DAYS[d.getDay()];
  return `${DAYS[d.getDay()].slice(0, 3)}. ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

export const formatLong = (d: Date) =>
  `${DAYS[d.getDay()][0].toUpperCase()}${DAYS[d.getDay()].slice(1)} ${d.getDate()} ${['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][d.getMonth()]}`;

export const formatMinutes = (m?: number | null) => {
  if (!m) return '';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r}` : `${h} h`;
};

/** "2026-11-16 09:12:33" (UTC SQLite) ou ISO → Date locale. */
export const parseStamp = (s: string) => new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
export const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
