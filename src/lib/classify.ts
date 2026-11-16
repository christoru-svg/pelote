// Où ranger un dépôt, sans rien enregistrer (pur : testable, utilisable pour l'aperçu).
import { URL_RE } from './autotag';
import { parseThought } from './parse';

export type Place = 'soir' | 'explorer' | 'note';
export const PLACE_LABEL: Record<Place, string> = { soir: 'Ce soir', explorer: 'À explorer', note: 'Notes' };

/** Où Pelote rangerait ce texte (pour l'aperçu, avant de déposer). */
export function classify(text: string, ref: Date, hasImage = false): Place {
  const t = text.trim();
  if (hasImage || URL_RE.test(t)) return 'explorer';
  const p = parseThought(t, ref);
  if (p.actions.length) return 'soir';
  if (/^(id[ée]e\s*:|et si(?![\p{L}]))/iu.test(t)) return 'explorer';
  return 'note';
}

