import { describe, expect, it } from 'vitest';
import { horizonOf, parseTask, parseThought } from './parse';

// Lundi 16 novembre 2026
const REF = new Date(2026, 10, 16);

describe('parseTask', () => {
  it('comprend date, heure, tag et durée dans le titre', () => {
    const t = parseTask('Kick-off app mobile lundi 10h #équipe 1h', REF);
    expect(t).toMatchObject({ title: 'Kick-off app mobile', due_date: '2026-11-23', due_time: '10:00', tag: 'Équipe', minutes: 60 });
  });
  it('jour de la semaine = prochaine occurrence', () => {
    expect(parseTask('Préparer la démo jeudi', REF).due_date).toBe('2026-11-19');
    expect(parseTask('Point équipe lundi prochain', REF).due_date).toBe('2026-11-23');
  });
  it('demain, après-demain', () => {
    expect(parseTask('Appeler le véto demain', REF)).toMatchObject({ title: 'Appeler le véto', due_date: '2026-11-17' });
    expect(parseTask('Courses après-demain', REF).due_date).toBe('2026-11-18');
  });
  it('dates écrites et numériques', () => {
    expect(parseTask('Bilan accessibilité le 3 décembre', REF).due_date).toBe('2026-12-03');
    expect(parseTask('Facture 5/1', REF).due_date).toBe('2027-01-05');
  });
  it('heure seule = aujourd’hui', () => {
    expect(parseTask('Envoyer le devis à 14h', REF)).toMatchObject({ title: 'Envoyer le devis', due_date: '2026-11-16', due_time: '14:00' });
  });
  it('durée seule et importance', () => {
    expect(parseTask('Lire le brief 30 min', REF)).toMatchObject({ minutes: 30, due_date: null });
    expect(parseTask('Donner un talk en conf UX !!', REF)).toMatchObject({ important: true, title: 'Donner un talk en conf UX' });
  });
  it('ne confond pas « mer » avec mercredi', () => {
    expect(parseTask('Photos de la mer', REF).due_date).toBeNull();
  });
});

describe('horizonOf', () => {
  const h = (d: string | null, important = false) => horizonOf({ due_date: d, important }, REF);
  it('range selon la date', () => {
    expect(h(null)).toBe('today');
    expect(h('2026-11-10')).toBe('today');
    expect(h('2026-11-22')).toBe('week');
    expect(h('2026-11-25')).toBe('nextweek');
    expect(h('2026-11-29')).toBe('nextweek');
    expect(h('2026-12-10')).toBe('month');
    expect(h('2027-01-30')).toBe('later');
    expect(h('2027-01-30', true)).toBe('year');
  });
});

describe('parseThought', () => {
  it('repère les actions, leurs dates et les idées', () => {
    const p = parseThought(
      'Penser à appeler Léa pour le resto. Et envoyer le devis à Marc avant jeudi 14h. Idée : une vue semaine en frise ?',
      REF,
    );
    expect(p.actions).toEqual([
      { label: 'Appeler Léa', due_date: null, due_time: null },
      { label: 'Envoyer le devis à Marc', due_date: '2026-11-19', due_time: '14:00' },
    ]);
    expect(p.ideas).toEqual(['Une vue semaine en frise']);
  });
  it('« et si » est une idée, « écrire à » une action', () => {
    const p = parseThought('Écrire à la compta. Et si Pilou changeait de tête selon mon énergie ?', REF);
    expect(p.actions.map((a) => a.label)).toEqual(['Écrire à la compta']);
    expect(p.ideas).toEqual(['Et si Pilou changeait de tête selon mon énergie']);
  });
  it('reconnaît les verbes conjugués après je / j\'', () => {
    const p = parseThought('Il faut que j\'appelle Paupiette demain', REF);
    expect(p.actions).toEqual([{ label: 'Appeler Paupiette demain', due_date: '2026-11-17', due_time: null }]);
    expect(parseThought('je relance Marc pour le devis', REF).actions[0].label).toBe('Relancer Marc');
  });
  it('ne prend pas un nom pour un verbe', () => {
    expect(parseThought('ma commande est arrivée', REF).actions).toEqual([]);
  });
  it('les tournures d’obligation deviennent des rappels', () => {
    expect(parseThought('mmmh intéressant, il faudra que je pense à arroser les plantes', REF).actions[0].label).toBe('Arroser les plantes');
    expect(parseThought('je dois finir le moodboard', REF).actions[0].label).toBe('Finir le moodboard');
    expect(parseThought('ne pas oublier de sortir les poubelles', REF).actions[0].label).toBe('Sortir les poubelles');
  });
  it('une date seule devient un rappel', () => {
    expect(parseThought('Dîner chez Lola samedi', REF).actions).toEqual([{ label: 'Dîner chez Lola samedi', due_date: '2026-11-21', due_time: null }]);
  });
  it('rien à détecter', () => {
    expect(parseThought('Journée calme.', REF)).toMatchObject({ actions: [], ideas: [] });
  });
});
