import { describe, expect, it } from 'vitest';
import { classify } from './classify';

const REF = new Date(2026, 10, 16);

describe('classify', () => {
  it('range les actions et dates en rappel du soir', () => {
    expect(classify('appeler Léa pour le resto', REF)).toBe('soir');
    expect(classify('envoyer le devis à Marc avant jeudi 14h', REF)).toBe('soir');
  });
  it('range liens, images et idées dans À explorer', () => {
    expect(classify('https://fonts.google.com/specimen/Recursive', REF)).toBe('explorer');
    expect(classify('trop bien ce shader', REF, true)).toBe('explorer');
    expect(classify('Idée : une vue semaine en frise', REF)).toBe('explorer');
    expect(classify('Et si Pilou changeait de tête ?', REF)).toBe('explorer');
  });
  it('le reste devient une note', () => {
    expect(classify('journée un peu lourde, besoin de calme', REF)).toBe('note');
  });
});
