import { useState } from 'react';
import { api } from '../api';
import { hhmm, parseStamp } from '../lib/dates';
import { useApp } from '../store';
import { ENERGIES, EnergyBars, Face, MOODS } from './Cat';
import { Dialog } from './Dialog';

function MoodPicker({ mood, onMood }: { mood: number | null; onMood: (n: number) => void }) {
  return (
    <div className="moods" role="radiogroup" aria-label="Humeur">
      {MOODS.map((m, i) => (
        <button key={m} type="button" role="radio" aria-checked={mood === i + 1} className="mood" onClick={() => onMood(i + 1)}>
          <Face mood={i + 1} size={40} />{m}
        </button>
      ))}
    </div>
  );
}

function EnergyPicker({ energy, onEnergy }: { energy: number | null; onEnergy: (n: number) => void }) {
  return (
    <div className="energies" role="radiogroup" aria-label="Énergie">
      {ENERGIES.map((e, i) => (
        <button key={e.name} type="button" role="radio" aria-checked={energy === i + 1} className="energy" onClick={() => onEnergy(i + 1)}>
          <EnergyBars level={i + 1} on={energy === i + 1} />
          <strong>{e.name}</strong>
          <span className="small">{e.desc}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Trois usages :
 *  - 'mood' / 'energy' : une seule question, un tap enregistre et ferme (l'autre valeur est conservée) ;
 *  - 'both' : le check-in complet, avec un mot facultatif et un bouton Enregistrer.
 */
export function EtatSheet() {
  const { latest, etatOpen, setEtatOpen, refreshStates, notify, fail } = useApp();
  const mode = etatOpen || 'both';
  const [mood, setMood] = useState<number | null>(latest?.mood ?? null);
  const [energy, setEnergy] = useState<number | null>(latest?.energy ?? null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const close = () => setEtatOpen(false);

  async function save(m = mood, e = energy, n = note) {
    setBusy(true);
    try {
      await api.addState({ mood: m, energy: e, note: n.trim() || undefined });
      await refreshStates();
      notify('C’est noté', e === 1 && mode !== 'mood' ? 'Mode Sieste : les petites tâches remontent.' : undefined);
      close();
    } catch { fail('Ce n’a pas été enregistré'); } finally { setBusy(false); }
  }

  const since = latest ? `Dernière mise à jour à ${hhmm(parseStamp(latest.created_at))}. ` : '';

  if (mode === 'mood') {
    return (
      <Dialog onClose={close} dark labelledBy="etat-titre">
        <div>
          <h2 id="etat-titre" style={{ fontSize: 28, fontWeight: 800 }}>Ton humeur</h2>
          <p className="lede" style={{ color: 'var(--texte-inv)' }}>{since}Un tap suffit.</p>
        </div>
        <MoodPicker mood={mood} onMood={(n) => { setMood(n); if (!busy) save(n, latest?.energy ?? null, ''); }} />
        <div className="actions"><button type="button" className="btn inv" onClick={close}>Plus tard</button></div>
      </Dialog>
    );
  }
  if (mode === 'energy') {
    return (
      <Dialog onClose={close} dark labelledBy="etat-titre">
        <div>
          <h2 id="etat-titre" style={{ fontSize: 28, fontWeight: 800 }}>Ton énergie</h2>
          <p className="lede" style={{ color: 'var(--texte-inv)' }}>{since}Pelote adapte l’ordre de tes tâches.</p>
        </div>
        <EnergyPicker energy={energy} onEnergy={(n) => { setEnergy(n); if (!busy) save(latest?.mood ?? null, n, ''); }} />
        <div className="actions"><button type="button" className="btn inv" onClick={close}>Plus tard</button></div>
      </Dialog>
    );
  }

  return (
    <Dialog onClose={close} dark labelledBy="etat-titre">
      <div>
        <h2 id="etat-titre" style={{ fontSize: 28, fontWeight: 800 }}>Et là, ça va ?</h2>
        <p className="lede" style={{ color: 'var(--texte-inv)' }}>{since}Change quand tu veux.</p>
      </div>
      <MoodPicker mood={mood} onMood={setMood} />
      <div className="stack" style={{ gap: 8 }}>
        <span className="eyebrow" style={{ color: 'var(--beurre)' }}>Énergie</span>
        <EnergyPicker energy={energy} onEnergy={setEnergy} />
      </div>
      <div className="field">
        <label htmlFor="etat-note">Un mot sur pourquoi ? <span style={{ fontWeight: 500, color: 'var(--texte-inv)' }}>(facultatif)</span></label>
        <input id="etat-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="mal dormi, réunion longue…"
          style={{ background: 'var(--nuit-2)', borderColor: '#4f4870', color: 'var(--lait)' }} />
      </div>
      <div className="actions">
        <button type="button" className="btn inv" onClick={close}>Plus tard</button>
        <button type="button" className="btn yellow" disabled={busy || (!mood && !energy)} onClick={() => save()}>Enregistrer</button>
      </div>
    </Dialog>
  );
}
