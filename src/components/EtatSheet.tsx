import { useState } from 'react';
import { api } from '../api';
import { hhmm, parseStamp } from '../lib/dates';
import { useApp } from '../store';
import { ENERGIES, EnergyBars, Face, MOODS } from './Cat';
import { Dialog } from './Dialog';

export function MoodEnergyPicker({ mood, energy, onMood, onEnergy }: {
  mood: number | null; energy: number | null; onMood: (n: number) => void; onEnergy: (n: number) => void;
}) {
  return (
    <>
      <div className="moods" role="radiogroup" aria-label="Humeur">
        {MOODS.map((m, i) => (
          <button key={m} type="button" role="radio" aria-checked={mood === i + 1} className="mood" onClick={() => onMood(i + 1)}>
            <Face mood={i + 1} size={40} />{m}
          </button>
        ))}
      </div>
      <div className="stack" style={{ gap: 8 }}>
        <span className="eyebrow" style={{ color: 'var(--beurre)' }}>Énergie</span>
        <div className="energies" role="radiogroup" aria-label="Énergie">
          {ENERGIES.map((e, i) => (
            <button key={e.name} type="button" role="radio" aria-checked={energy === i + 1} className="energy" onClick={() => onEnergy(i + 1)}>
              <EnergyBars level={i + 1} on={energy === i + 1} />
              <strong>{e.name}</strong>
              <span className="small">{e.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export function EtatSheet() {
  const { latest, setEtatOpen, refreshStates, notify, fail } = useApp();
  const [mood, setMood] = useState<number | null>(latest?.mood ?? null);
  const [energy, setEnergy] = useState<number | null>(latest?.energy ?? null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const close = () => setEtatOpen(false);

  async function save() {
    setBusy(true);
    try {
      await api.addState({ mood, energy, note: note.trim() || undefined });
      await refreshStates();
      notify('C’est noté', energy === 1 ? 'Mode Sieste : les petites tâches remontent.' : undefined);
      close();
    } catch { fail('Ton humeur n’a pas été enregistrée'); } finally { setBusy(false); }
  }

  return (
    <Dialog onClose={close} dark labelledBy="etat-titre">
      <div>
        <h2 id="etat-titre" style={{ fontSize: 28, fontWeight: 800 }}>Et là, ça va ?</h2>
        <p className="lede" style={{ color: 'var(--texte-inv)' }}>
          {latest ? `Dernière mise à jour à ${hhmm(parseStamp(latest.created_at))}. ` : ''}Change quand tu veux.
        </p>
      </div>
      <MoodEnergyPicker mood={mood} energy={energy} onMood={setMood} onEnergy={setEnergy} />
      <div className="field">
        <label htmlFor="etat-note">Un mot sur pourquoi ? <span style={{ fontWeight: 500, color: 'var(--texte-inv)' }}>(facultatif)</span></label>
        <input id="etat-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="mal dormi, réunion longue…"
          style={{ background: 'var(--nuit-2)', borderColor: '#4f4870', color: 'var(--lait)' }} />
      </div>
      <div className="actions">
        <button type="button" className="btn inv" onClick={close}>Plus tard</button>
        <button type="button" className="btn yellow" disabled={busy || (!mood && !energy)} onClick={save}>Enregistrer</button>
      </div>
    </Dialog>
  );
}
