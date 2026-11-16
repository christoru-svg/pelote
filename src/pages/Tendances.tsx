import { useEffect, useMemo, useState } from 'react';
import { api, type State } from '../api';
import { ENERGIES, MOODS } from '../components/Cat';
import { ProfileLayout } from '../components/ProfileLayout';
import { addDays, parseStamp, today, ymd } from '../lib/dates';

const PERIODS = [7, 14, 90] as const;
const jours = (n: number) => `${n} jour${n > 1 ? 's' : ''}`;
const WEEKDAY = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const ENERGY_COLORS = ['var(--lavande)', 'var(--menthe)', 'var(--beurre)'];

type Day = { date: Date; mood: number | null; energy: number | null };

export function Tendances() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(14);
  const [states, setStates] = useState<State[]>([]);
  const ref = today();
  useEffect(() => { api.states(ymd(addDays(ref, -period))).then(setStates).catch(() => {}); }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  // Une valeur par jour : le dernier relevé de la journée.
  const days: Day[] = useMemo(() => {
    const out: Day[] = [];
    for (let i = period - 1; i >= 0; i--) {
      const d = addDays(ref, -i);
      const key = ymd(d);
      const own = states.filter((s) => ymd(parseStamp(s.created_at)) === key);
      out.push({ date: d, mood: [...own].reverse().find((s) => s.mood)?.mood ?? null, energy: [...own].reverse().find((s) => s.energy)?.energy ?? null });
    }
    return out;
  }, [states, period]); // eslint-disable-line react-hooks/exhaustive-deps

  const withMood = days.filter((d) => d.mood);
  const withEnergy = days.filter((d) => d.energy);
  const moodCounts = [1, 2, 3, 4, 5].map((m) => withMood.filter((d) => d.mood === m).length);
  const topMood = moodCounts.indexOf(Math.max(...moodCounts)) + 1;
  const good = withMood.filter((d) => (d.mood ?? 0) >= 4).length;
  const energyCounts = [1, 2, 3].map((e) => withEnergy.filter((d) => d.energy === e).length);
  const topEnergy = energyCounts.indexOf(Math.max(...energyCounts)) + 1;
  const zoomDays = WEEKDAY.map((_, wd) => withEnergy.filter((d) => d.date.getDay() === wd && d.energy === 3).length);
  const zoomBest = zoomDays.indexOf(Math.max(...zoomDays));

  // Courbe d'humeur
  const W = 720, H = 236, x0 = 104, x1 = 700, yOf = (m: number) => 180 - (m - 1) * 38;
  const step = days.length > 1 ? (x1 - x0 - 16) / (days.length - 1) : 0;
  const pts = days.map((d, i) => ({ x: x0 + 16 + i * step, y: d.mood ? yOf(d.mood) : null, d }));
  const path = pts.reduce((acc, p, i) => {
    if (p.y === null) return acc;
    const prev = pts[i - 1];
    return acc + `${prev && prev.y !== null ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y} `;
  }, '');
  const labelEvery = days.length > 31 ? 14 : days.length > 14 ? 2 : 1;

  return (
    <ProfileLayout title="Tes tendances" lede="Ton humeur et ton énergie, sans note ni jugement.">
      <section className="card" aria-labelledby="stats-titre">
        <div className="row wrap">
          <h2 id="stats-titre" className="spacer">Humeur &amp; énergie</h2>
          <div className="seg" role="group" aria-label="Période affichée">
            {PERIODS.map((p) => <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)}>{p === 90 ? '3 mois' : `${p} jours`}</button>)}
          </div>
        </div>

        {withMood.length === 0 && withEnergy.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Pas encore de relevé sur cette période. Note ton humeur et ton énergie quelques jours : les tendances apparaîtront ici.</p>
        ) : (
          <>
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.55, maxWidth: 760 }}>
              Sur {period === 90 ? 'les 3 derniers mois' : `les ${period} derniers jours`}, ton humeur a surtout été <strong>« {MOODS[topMood - 1]} »</strong> ({jours(moodCounts[topMood - 1])})
              {withMood.length > 0 && <> et elle a été <strong>bonne ou très bonne {jours(good)} sur {withMood.length}</strong></>}.
              {withEnergy.length > 0 && <> Côté énergie, tu étais le plus souvent en <strong>{ENERGIES[topEnergy - 1].name}</strong> ({jours(energyCounts[topEnergy - 1])}).</>}
            </p>

            <figure style={{ margin: 0 }} className="stack">
              <figcaption style={{ fontWeight: 700 }}>Humeur, jour par jour</figcaption>
              <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Courbe de l’humeur. Le détail est dans le tableau sous les graphiques." style={{ maxWidth: 860 }}>
                <path d="M104 28 H700 M104 66 H700 M104 104 H700 M104 142 H700 M104 180 H700" stroke="#E4DDF7" strokeWidth="1.5" />
                {MOODS.map((m, i) => <text key={m} x="94" y={yOf(i + 1) + 4} textAnchor="end" fontSize="13" fontWeight="600" fill="#4F4870" fontFamily="Figtree, sans-serif">{m}</text>)}
                <path d={path} fill="none" stroke="#1F1A3D" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                {pts.map((p, i) => p.y !== null && (
                  <circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 8 : 5.5} fill={i === pts.length - 1 ? '#FFD25E' : '#FF8FB1'} stroke="#1F1A3D" strokeWidth="2" />
                ))}
                {pts.map((p, i) => (i % labelEvery === 0 || i === pts.length - 1) && (
                  <text key={i} x={p.x} y="214" textAnchor="middle" fontSize="12" fill={i === pts.length - 1 ? '#1F1A3D' : '#4F4870'} fontWeight={i === pts.length - 1 ? 800 : 400} fontFamily="Figtree, sans-serif">
                    {p.d.date.getDate()}
                  </text>
                ))}
              </svg>
            </figure>

            {withEnergy.length > 0 && (
              <figure style={{ margin: 0 }} className="stack">
                <figcaption style={{ fontWeight: 700 }}>Énergie, répartition</figcaption>
                <div aria-hidden="true" style={{ display: 'flex', gap: 4, height: 56 }}>
                  {energyCounts.map((n, i) => n > 0 && (
                    <div key={i} style={{ flex: `${n} 1 0`, minWidth: 0, background: ENERGY_COLORS[i], border: '2px solid var(--nuit)', borderRadius: 14, display: 'flex', alignItems: 'center', padding: '0 12px', fontWeight: 700, fontSize: 14, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {ENERGIES[i].name}
                    </div>
                  ))}
                </div>
                <ul className="row wrap" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 20 }}>
                  {energyCounts.map((n, i) => (
                    <li key={i} className="row" style={{ gap: 8 }}>
                      <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: 4, background: ENERGY_COLORS[i], border: '2px solid var(--nuit)' }} />
                      <strong>{ENERGIES[i].name}</strong> {jours(n)} ({withEnergy.length ? Math.round((n / withEnergy.length) * 100) : 0} %)
                    </li>
                  ))}
                </ul>
              </figure>
            )}

            <details style={{ border: '1.5px solid var(--trait)', borderRadius: 16, padding: '0 16px' }}>
              <summary style={{ minHeight: 44, display: 'flex', alignItems: 'center', fontWeight: 700, cursor: 'pointer' }}>Voir les données en tableau</summary>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, margin: '4px 0 14px' }}>
                <caption style={{ textAlign: 'left', color: 'var(--texte-2)', fontSize: 13, paddingBottom: 6 }}>Dernier relevé de chaque jour</caption>
                <thead><tr>{['Jour', 'Humeur', 'Énergie'].map((h) => <th key={h} scope="col" style={{ textAlign: 'left', padding: 8, borderBottom: '1.5px solid var(--nuit)' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {[...days].reverse().map((d) => (
                    <tr key={ymd(d.date)}>
                      <th scope="row" style={{ textAlign: 'left', fontWeight: 600, padding: '6px 8px', borderBottom: '1px solid var(--trait-doux)' }}>{WEEKDAY[d.date.getDay()]} {d.date.getDate()}/{d.date.getMonth() + 1}</th>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--trait-doux)' }}>{d.mood ? MOODS[d.mood - 1] : '—'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--trait-doux)' }}>{d.energy ? ENERGIES[d.energy - 1].name : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              {withMood.length > 0 && <div className="tile" style={{ background: 'var(--coussinet-pale)' }}><span className="big">{MOODS[topMood - 1]}</span><span className="small">ton humeur la plus fréquente</span></div>}
              {zoomDays[zoomBest] > 0 && <div className="tile" style={{ background: 'var(--beurre-pale)' }}><span className="big">Le {WEEKDAY[zoomBest]}</span><span className="small">ton jour Zoomies le plus régulier</span></div>}
              {withEnergy.length > 0 && <div className="tile" style={{ background: 'var(--lavande-pale)' }}><span className="big">{energyCounts[0]} j sur {withEnergy.length}</span><span className="small">en mode Sieste, et c’est ok</span></div>}
            </div>
          </>
        )}
        <span className="pilou">pas de note, pas de jugement : juste de quoi mieux te connaître</span>
      </section>
    </ProfileLayout>
  );
}
