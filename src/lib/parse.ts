/**
 * Le « cerveau » de Pilou : comprend le français libre.
 *  - parseTask : « Kick-off lundi 10h #équipe 1h » → titre, date, heure, tag, durée
 *  - parseThought : repère les actions (appeler, écrire à…), les dates et les idées
 *  - horizonOf : range une tâche dans Aujourd'hui / Cette semaine / …
 */
import { addDays, endOfMonth, endOfWeek, fromYmd, startOfWeek, ymd } from './dates';

export type Mark = { start: number; end: number; kind: 'date' | 'time' | 'tag' | 'duration' | 'important' | 'action' | 'idea' };

const L = '\\p{L}';
const before = `(?<![${L}\\d])`;
const after = `(?![${L}])`;

const WEEKDAYS: Record<string, number> = {
  dimanche: 0, dim: 0, lundi: 1, lun: 1, mardi: 2, mar: 2, mercredi: 3, mer: 3,
  jeudi: 4, jeu: 4, vendredi: 5, ven: 5, samedi: 6, sam: 6,
};
const MONTHS: Record<string, number> = {
  janvier: 0, janv: 0, 'février': 1, fevrier: 1, 'févr': 1, fevr: 1, 'fév': 1, fev: 1, mars: 2, avril: 3, avr: 3,
  mai: 4, juin: 5, juillet: 6, juil: 6, 'août': 7, aout: 7, septembre: 8, sept: 8, octobre: 9, oct: 9,
  novembre: 10, nov: 10, 'décembre': 11, decembre: 11, 'déc': 11, dec: 11,
};
const WD = '(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|lun|mar|mer|jeu|ven|sam|dim)\\.?';
const MO = `(${Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|')})\\.?`;

type DateHit = { start: number; end: number; date: Date };

/** Finds every date expression in the text, earliest first, without overlaps. */
export function findDates(text: string, ref: Date): DateHit[] {
  const hits: DateHit[] = [];
  const add = (re: RegExp, fn: (m: RegExpExecArray) => Date | null) => {
    for (const m of text.matchAll(re)) {
      const start = m.index!, end = start + m[0].length;
      if (hits.some((h) => start < h.end && end > h.start)) continue;
      const date = fn(m as RegExpExecArray);
      if (date) hits.push({ start, end, date });
    }
  };
  add(new RegExp(`${before}apr[eè]s[- ]demain${after}`, 'giu'), () => addDays(ref, 2));
  add(new RegExp(`${before}demain${after}`, 'giu'), () => addDays(ref, 1));
  add(new RegExp(`${before}(aujourd'hui|aujourd’hui|ce soir|ce matin|ce midi|tout à l'heure)${after}`, 'giu'), () => ref);
  add(new RegExp(`${before}${WD}\\s+prochain${after}`, 'giu'), (m) =>
    addDays(startOfWeek(ref), 7 + ((WEEKDAYS[m[1].toLowerCase()] + 6) % 7)));
  add(new RegExp(`${before}(?:le\\s+)?(\\d{1,2})(?:er)?\\s+${MO}(?:\\s+(\\d{4}))?${after}`, 'giu'), (m) => {
    const day = +m[1], month = MONTHS[m[2].toLowerCase()];
    if (month === undefined || day < 1 || day > 31) return null;
    let d = new Date(m[3] ? +m[3] : ref.getFullYear(), month, day);
    if (!m[3] && d < ref) d = new Date(ref.getFullYear() + 1, month, day);
    return d;
  });
  add(new RegExp(`${before}(?:le\\s+)?(\\d{1,2})/(\\d{1,2})(?:/(\\d{2,4}))?(?![\\d/])`, 'gu'), (m) => {
    const day = +m[1], month = +m[2] - 1;
    if (month < 0 || month > 11 || day < 1 || day > 31) return null;
    const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : ref.getFullYear();
    let d = new Date(y, month, day);
    if (!m[3] && d < ref) d = new Date(y + 1, month, day);
    return d;
  });
  add(new RegExp(`${before}(?:(?:ce|cette)\\s+)?${WD}${after}`, 'giu'), (m) => {
    const target = WEEKDAYS[m[1].toLowerCase()];
    // « mar », « mer », « sam »… ne comptent que s'ils sont suivis d'un chiffre ou d'une heure,
    // sinon « mer » (la mer) ou « mar » deviendraient des dates.
    if (m[1].length <= 3) {
      const rest = text.slice(m.index! + m[0].length);
      if (!/^\s*(\d|à\s*\d)/u.test(rest)) return null;
    }
    let diff = (target - ref.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    return addDays(ref, diff);
  });
  add(new RegExp(`${before}la\\s+semaine\\s+prochaine${after}|${before}semaine\\s+prochaine${after}`, 'giu'), () =>
    addDays(startOfWeek(ref), 11)); // vendredi prochain
  add(new RegExp(`${before}cette\\s+semaine${after}`, 'giu'), () => {
    const fri = addDays(startOfWeek(ref), 4);
    return fri >= ref ? fri : endOfWeek(ref);
  });
  add(new RegExp(`${before}(ce\\s+mois(?:-ci)?|fin\\s+du\\s+mois|d'ici\\s+la\\s+fin\\s+du\\s+mois)${after}`, 'giu'), () => endOfMonth(ref));
  return hits.sort((a, b) => a.start - b.start);
}

type TimeHit = { start: number; end: number; time?: string; minutes?: number };

/** Hours and durations. "10h" after a date or "à" is a time; "1h", "30 min" are durations. */
function findTimes(text: string, dates: DateHit[]): TimeHit[] {
  const hits: TimeHit[] = [];
  let hasTime = false;
  const re = /(?<![\p{L}\d])(à\s*)?(\d{1,2})\s*(?:h|:)\s*(\d{2})?(?![\p{L}\d])|(?<![\p{L}\d])(midi|minuit)(?![\p{L}])/giu;
  for (const m of text.matchAll(re)) {
    const start = m.index!, end = start + m[0].length;
    if (m[4]) {
      hits.push({ start, end, time: m[4].toLowerCase() === 'midi' ? '12:00' : '00:00' });
      hasTime = true;
      continue;
    }
    const h = +m[2], min = m[3] ? +m[3] : 0;
    const colon = m[0].includes(':');
    const glued = dates.some((d) => /^\s*$/.test(text.slice(d.end, start)));
    const anchored = !!m[1] || colon || glued;
    if (!hasTime && h <= 23 && min < 60 && (anchored || h >= 7)) {
      hits.push({ start, end, time: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}` });
      hasTime = true;
    } else {
      hits.push({ start, end, minutes: h * 60 + min });
    }
  }
  for (const m of text.matchAll(/(?<![\p{L}\d])(\d{1,3})\s*(?:min|mn|minutes?)(?![\p{L}])/giu)) {
    hits.push({ start: m.index!, end: m.index! + m[0].length, minutes: +m[1] });
  }
  return hits;
}

export type ParsedTask = {
  title: string;
  due_date: string | null;
  due_time: string | null;
  minutes: number | null;
  tag: string | null;
  important: boolean;
  marks: Mark[];
};

export function parseTask(input: string, ref: Date): ParsedTask {
  const marks: Mark[] = [];
  const dates = findDates(input, ref);
  const times = findTimes(input, dates);
  const date = dates[0]?.date ?? null;
  const time = times.find((t) => t.time)?.time ?? null;
  const minutes = times.find((t) => t.minutes)?.minutes ?? null;
  dates.slice(0, 1).forEach((d) => marks.push({ start: d.start, end: d.end, kind: 'date' }));
  times.forEach((t) => marks.push({ start: t.start, end: t.end, kind: t.time ? 'time' : 'duration' }));

  let tag: string | null = null;
  for (const m of input.matchAll(/#([\p{L}\d_-]+)/gu)) {
    tag ??= m[1][0].toUpperCase() + m[1].slice(1);
    marks.push({ start: m.index!, end: m.index! + m[0].length, kind: 'tag' });
  }
  let important = false;
  for (const m of input.matchAll(/!!+|(?<![\p{L}])important(?![\p{L}])/giu)) {
    important = true;
    marks.push({ start: m.index!, end: m.index! + m[0].length, kind: 'important' });
  }

  // Le titre = le texte sans les morceaux compris.
  let title = '';
  let cursor = 0;
  const sorted = [...marks].sort((a, b) => a.start - b.start);
  for (const mk of sorted) {
    if (mk.start < cursor) continue;
    title += input.slice(cursor, mk.start) + ' ';
    cursor = mk.end;
  }
  title += input.slice(cursor);
  title = title.replace(/\s+/g, ' ').replace(/(\s+(à|le|pour|avant|d'ici))+\s*$/iu, '').replace(/[\s,;:–-]+$/u, '').trim();

  return {
    title: title || input.trim(),
    due_date: date ? ymd(date) : time ? ymd(ref) : null,
    due_time: time,
    minutes,
    tag,
    important,
    marks: sorted,
  };
}

export type ParsedThought = {
  actions: Array<{ label: string; due_date: string | null; due_time: string | null }>;
  ideas: string[];
  marks: Mark[];
};

// Verbes d'action : l'infinitif seul (« appeler Léa »), ou conjugué après je / j' / tu
// (« il faut que j'appelle Léa », « je relance Marc »). Le libellé repasse à l'infinitif.
const VERBS: Array<[string, string, string]> = [
  // [infinitif affiché, infinitif reconnu, formes conjuguées]
  ['Appeler', 'appeler', 'appelle|appelles'],
  ['Rappeler', 'rappeler', 'rappelle|rappelles'],
  ['Téléphoner à', 't[ée]l[ée]phoner\\s+[àa]', 't[ée]l[ée]phones?\\s+[àa]'],
  ['Écrire à', '[ée]crire\\s+(?:[àa]|au|aux)', '[ée]cris\\s+(?:[àa]|au|aux)'],
  ['Envoyer', 'envoyer', 'envoies?'],
  ['Relancer', 'relancer', 'relances?'],
  ['Répondre à', 'r[ée]pondre\\s+(?:[àa]|au|aux)', 'r[ée]ponds\\s+(?:[àa]|au|aux)'],
  ['Prendre rendez-vous', 'prendre\\s+(?:un\\s+)?(?:rdv|rendez-vous)', 'prends\\s+(?:un\\s+)?(?:rdv|rendez-vous)'],
  ['Réserver', 'r[ée]server', 'r[ée]serves?'],
  ['Payer', 'payer', 'paie|paies|paye|payes'],
  ['Commander', 'commander', 'commandes?'],
  ['Acheter', 'acheter', 'ach[eè]tes?'],
];
const INF = VERBS.map((v) => v[1]).join('|');
const CONJ = VERBS.map((v) => v[2]).join('|');
const ACTION = new RegExp(
  `(?<![\\p{L}])(?:(?:penser\\s+[àa]\\s+|ne\\s+pas\\s+oublier\\s+d['’]\\s*)?(${INF})|(?:j['’]\\s*|je\\s+|tu\\s+)(${CONJ}))(?![\\p{L}])`,
  'giu',
);
const infinitiveOf = (verb: string) =>
  VERBS.find(([, inf, conj]) => new RegExp(`^(?:${inf}|${conj})$`, 'iu').test(verb.trim()))?.[0] ?? verb;
const STOP = /[.,;!?\n]|\s(?:pour|et|avant|car|parce|puis|mais|sinon|d'ici)\s/iu;

export function parseThought(text: string, ref: Date): ParsedThought {
  const marks: Mark[] = [];
  const actions: ParsedThought['actions'] = [];
  const dates = findDates(text, ref);
  const times = findTimes(text, dates).filter((t) => t.time);

  for (const m of text.matchAll(ACTION)) {
    const start = m.index!;
    if (marks.some((mk) => start < mk.end && start >= mk.start)) continue;
    const rest = text.slice(start);
    const stop = rest.slice(m[0].length).search(STOP);
    const end = start + m[0].length + (stop === -1 ? rest.length - m[0].length : stop);
    const verb = m[1] ?? m[2];
    const verbAt = start + m[0].length - verb.length;
    const label = (infinitiveOf(verb) + ' ' + text.slice(verbAt + verb.length, end)).replace(/\s+/g, ' ').trim();
    marks.push({ start, end, kind: 'action' });
    // une date dans la même phrase, après le verbe
    const sentenceEnd = (() => { const i = text.slice(start).search(/[.!?\n]/); return i === -1 ? text.length : start + i; })();
    const d = dates.find((h) => h.start >= start && h.start <= sentenceEnd);
    const t = times.find((h) => h.start >= start && h.start <= sentenceEnd);
    actions.push({ label, due_date: d ? ymd(d.date) : null, due_time: t?.time ?? null });
  }
  // « il faut que je… », « je dois… », « penser à… » : une obligation, même sans verbe connu.
  if (!actions.length) {
    const CUE = /(?<![\p{L}])(?:(?:il\s+)?fau(?:t|dra|drait)\s+(?:que\s+(?:je\s+|j['’]\s*)|qu['’]\s*(?:je\s+|j['’]\s*))|je\s+(?:dois|devrais|devrai)\s+|(?:ne\s+pas\s+oublier|n['’]oublie\s+pas)\s+(?:de\s+|d['’]\s*)|(?:penser|pense)\s+[àa]\s+)/iu;
    const m = CUE.exec(text);
    if (m) {
      const startRest = m.index + m[0].length;
      const stop = text.slice(startRest).search(STOP);
      let rest = text.slice(startRest, stop === -1 ? text.length : startRest + stop).trim();
      rest = rest.replace(/^(?:penser|pense)\s+[àa]\s+/iu, '').replace(/^(?:ne\s+pas\s+oublier|n['’]oublie\s+pas)\s+(?:de\s+|d['’]\s*)/iu, '');
      if (rest.length > 2) {
        const end = startRest + (stop === -1 ? text.length - startRest : stop);
        marks.push({ start: m.index, end, kind: 'action' });
        const d = dates[0];
        actions.push({ label: rest[0].toUpperCase() + rest.slice(1), due_date: d ? ymd(d.date) : null, due_time: times[0]?.time ?? null });
      }
    }
  }
  // Une date sans verbe d'action (« dîner chez Lola samedi ») mérite quand même un rappel.
  if (!actions.length && dates.length) {
    const d = dates[0];
    const from = Math.max(0, text.lastIndexOf('.', d.start) + 1);
    const toDot = text.slice(d.end).search(/[.!?\n]/);
    const sentence = text.slice(from, toDot === -1 ? text.length : d.end + toDot).trim();
    const label = sentence.length > 80 ? sentence.slice(0, 79) + '…' : sentence;
    actions.push({ label: label[0].toUpperCase() + label.slice(1), due_date: ymd(d.date), due_time: times[0]?.time ?? null });
  }
  dates.forEach((d) => marks.push({ start: d.start, end: d.end, kind: 'date' }));
  times.forEach((t) => marks.push({ start: t.start, end: t.end, kind: 'time' }));

  const ideas: string[] = [];
  for (const m of text.matchAll(/(?:^|[.!?\n]\s*)((id[ée]e\s*:|et si(?![\p{L}]))([^.!?\n]*))/giu)) {
    const markerStart = m.index! + m[0].indexOf(m[2]);
    marks.push({ start: markerStart, end: markerStart + m[2].length, kind: 'idea' });
    const idea = (/^et si/iu.test(m[2]) ? m[1] : m[3]).trim();
    if (idea) ideas.push(idea[0].toUpperCase() + idea.slice(1));
  }
  return { actions, ideas, marks: marks.sort((a, b) => a.start - b.start) };
}

/** Splits text into segments for highlighting, from non-overlapping marks. */
export function segments(text: string, marks: Mark[]): Array<{ text: string; kind?: Mark['kind'] }> {
  const out: Array<{ text: string; kind?: Mark['kind'] }> = [];
  let cursor = 0;
  for (const mk of [...marks].sort((a, b) => a.start - b.start)) {
    if (mk.start < cursor) continue;
    if (mk.start > cursor) out.push({ text: text.slice(cursor, mk.start) });
    out.push({ text: text.slice(mk.start, mk.end), kind: mk.kind });
    cursor = mk.end;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor) });
  return out;
}

export type Horizon = 'today' | 'week' | 'nextweek' | 'month' | 'later' | 'year';

export const HORIZONS: Array<{ id: Horizon; name: string; color: string }> = [
  { id: 'today', name: "Aujourd'hui", color: 'var(--beurre)' },
  { id: 'week', name: 'Cette semaine', color: 'var(--coussinet)' },
  { id: 'nextweek', name: 'Semaine prochaine', color: 'var(--lavande)' },
  { id: 'month', name: 'Ce mois-ci', color: 'var(--menthe)' },
  { id: 'later', name: 'Plus tard', color: 'var(--gris)' },
  { id: 'year', name: "Les grandes chasses de l'année", color: 'var(--nuit)' },
];

export function horizonOf(t: { due_date: string | null; important: number | boolean }, ref: Date): Horizon {
  if (t.important) return 'year';
  if (!t.due_date) return 'today';
  const d = fromYmd(t.due_date);
  if (d <= ref) return 'today';
  if (d <= endOfWeek(ref)) return 'week';
  if (d <= addDays(endOfWeek(ref), 7)) return 'nextweek';
  if (d <= endOfMonth(ref) || d <= addDays(ref, 31)) return 'month';
  return 'later';
}
