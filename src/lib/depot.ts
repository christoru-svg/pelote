/**
 * Le dépôt unique : tu déposes, Pelote range.
 *  - une action ou une date (« appeler Léa », « jeudi 14h ») → rappel du soir
 *  - un lien, une image, « idée : … », « et si… »            → À explorer (récré)
 *  - le reste                                                → Note
 * Et on peut toujours changer d'avis en un tap (move).
 */
import { api, type PanierItem } from '../api';
import { autotag, URL_RE } from './autotag';
import { ymd } from './dates';
import { parseThought } from './parse';

import { classify, type Place } from './classify';
export { classify, PLACE_LABEL, type Place } from './classify';

export type Deposited =
  | { place: 'explorer'; kind: 'panier'; id: string; text: string }
  | { place: 'soir' | 'note'; kind: 'thought'; id: string; text: string };

export async function deposit(opts: { text: string; image?: File | null; ref: Date; context?: string | null }): Promise<Deposited> {
  const text = opts.text.trim();
  const place = classify(text, opts.ref, !!opts.image);
  const ctx = opts.context ? `pendant ${opts.context}` : 'hors fil';

  if (place === 'explorer') {
    const url = text.match(URL_RE)?.[0] ?? null;
    const body = text.replace(URL_RE, '').replace(/^id[ée]e\s*:\s*/iu, '').trim();
    const form = new FormData();
    form.set('title', (body || url || 'Capture').split('\n')[0].slice(0, 120));
    if (body) form.set('body', body);
    if (url) form.set('url', url);
    const tag = /^(id[ée]e\s*:|et si)/iu.test(text) ? 'Idées' : autotag(text, url);
    if (tag) form.set('tag', tag);
    form.set('context', ctx);
    if (opts.image) form.set('image', opts.image);
    const item = await api.addPanier(form);
    return { place, kind: 'panier', id: item.id, text };
  }

  const p = parseThought(text, opts.ref);
  const { id } = await api.addThought({
    text, context: opts.context ?? undefined, ideas: p.ideas,
    reminders: p.actions.map((a) => ({ ...a, remind_on: ymd(opts.ref) })),
  });
  return { place, kind: 'thought', id, text };
}

/** Reclasser : une trouvaille devient une note, ou une pensée part dans À explorer. */
export async function move(d: Deposited, ref: Date, context?: string | null): Promise<Deposited> {
  if (d.kind === 'panier') {
    await api.deletePanier(d.id);
    const { id } = await api.addThought({ text: d.text, context: context ?? undefined, ideas: [], reminders: [] });
    return { place: 'note', kind: 'thought', id, text: d.text };
  }
  await api.deleteThought(d.id);
  const url = d.text.match(URL_RE)?.[0] ?? null;
  const body = d.text.replace(URL_RE, '').trim();
  const item: PanierItem = await api.addPanier({
    title: (body || url || d.text).split('\n')[0].slice(0, 120), body: body || null, url,
    tag: autotag(d.text, url), context: context ? `pendant ${context}` : 'hors fil',
  });
  void ref;
  return { place: 'explorer', kind: 'panier', id: item.id, text: d.text };
}
