import { useCallback } from 'react';
import { deposit, move, PLACE_LABEL, type Deposited } from '../lib/depot';
import { today } from '../lib/dates';
import { useApp } from '../store';

/** Déposer dans la Boîte, avec le toast « Rangé dans … · Plutôt … » pour corriger en un tap. */
export function useDeposit() {
  const { fil, me, notify, fail, bump, setPanierCount, panierCount } = useApp();

  const announce = useCallback((d: Deposited) => {
    const other = d.place === 'explorer' ? 'Plutôt une note' : 'Plutôt à explorer';
    const text = d.place === 'soir' ? `${me?.cat_name ?? 'Pilou'} te le rappellera à ${me?.soir ?? '18:00'}.`
      : d.place === 'explorer' ? 'Pour la récré, sans culpabilité.' : 'Ta tête a moins à porter.';
    notify(`Rangé dans ${PLACE_LABEL[d.place]}`, text, {
      action: {
        label: other,
        run: () => {
          move(d, today(), fil?.title)
            .then((m) => {
              setPanierCount(Math.max(0, panierCount + (m.place === 'explorer' ? 1 : -1)));
              bump();
              notify(`Rangé dans ${PLACE_LABEL[m.place]}`, 'C’est corrigé.');
            })
            .catch(() => fail('Le changement n’a pas été enregistré'));
        },
      },
    });
  }, [fil, me, notify, fail, bump, setPanierCount, panierCount]);

  return useCallback(async (text: string, image?: File | null) => {
    try {
      const d = await deposit({ text, image, ref: today(), context: fil?.title });
      if (d.place === 'explorer') setPanierCount(panierCount + 1);
      bump();
      announce(d);
      return true;
    } catch {
      fail('Ça n’a pas été déposé');
      return false;
    }
  }, [fil, bump, announce, fail, setPanierCount, panierCount]);
}
