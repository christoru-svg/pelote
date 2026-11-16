import { useEffect, useState } from 'react';
import { api, type Reminder } from '../api';
import { ENERGIES, Face, MOODS } from '../components/Cat';
import { localStorageSet } from '../components/Shell';
import { addDays, formatDay, parseStamp, today, ymd } from '../lib/dates';
import { useApp } from '../store';

export function Bilan() {
  const { me, latest, setEtatOpen, notify, fail } = useApp();
  const ref = today();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [wins, setWins] = useState({ done: 0, panier: 0, thoughts: 0 });
  const [perm, setPerm] = useState<NotificationPermission | 'absent'>('Notification' in window ? Notification.permission : 'absent');

  useEffect(() => {
    localStorageSet('soir-vu', ymd(ref));
    api.reminders(ymd(ref)).then(setReminders).catch(() => {});
    Promise.all([api.tasks(ref.toISOString()), api.panier(), api.thoughts(ref.toISOString())]).then(([t, p, th]) => {
      setWins({
        done: t.filter((x) => x.done).length,
        panier: p.filter((x) => parseStamp(x.created_at) >= ref).length,
        thoughts: th.thoughts.length,
      });
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function set(r: Reminder, status: 'fait' | 'demain') {
    try {
      await api.updateReminder(r.id, status === 'demain' ? { status: 'demain', remind_on: ymd(addDays(ref, 1)) } : { status });
    } catch { fail(); return; }
    setReminders((xs) => xs.filter((x) => x.id !== r.id));
    if (status === 'fait') notify('Fait !', 'Un truc de moins dans ta tête.');
  }

  return (
    <main className="page" style={{ maxWidth: 760 }}>
      <div className="row">
        <Face mood={4} size={56} light={false} />
        <div>
          <p className="muted" style={{ margin: 0, fontWeight: 600 }}>{formatDay(ymd(ref)).replace(/^./, (c) => c.toUpperCase())} · {me?.soir}</p>
          <h1>Bilan du soir</h1>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
        <div className="tile" style={{ background: 'var(--menthe)' }}><span className="big">{wins.done}</span><span className="small" style={{ fontWeight: 600 }}>trucs bouclés</span></div>
        <div className="tile" style={{ background: 'var(--coussinet)' }}><span className="big">{wins.panier}</span><span className="small" style={{ fontWeight: 600 }}>trouvailles gardées</span></div>
        <div className="tile" style={{ background: 'var(--lavande)' }}><span className="big">{wins.thoughts}</span><span className="small" style={{ fontWeight: 600 }}>pensées vidées</span></div>
      </div>

      <section className="stack" aria-labelledby="avant-fermer">
        <div className="row"><h2 id="avant-fermer" className="spacer">Avant de fermer</h2><span className="small muted">tiré de tes pensées</span></div>
        {reminders.length === 0 && <div className="card"><p className="muted" style={{ margin: 0 }}>Rien à rappeler. Tu peux fermer l’ordi l’esprit léger.</p></div>}
        {reminders.map((r) => (
          <div key={r.id} className="card" style={{ gap: 10 }}>
            <div className="stack" style={{ gap: 2 }}>
              <strong style={{ fontSize: 17 }}>{r.label}</strong>
              <span className="small muted">
                {r.due_date ? `prévu ${formatDay(r.due_date, ref)}${r.due_time ? ' à ' + r.due_time : ''}` : 'pensée du jour'}
                {r.status === 'demain' ? ' · reporté' : ''}
              </span>
            </div>
            <div className="actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              <button type="button" className="btn" onClick={() => set(r, 'demain')}>Demain matin</button>
              <button type="button" className="btn primary" onClick={() => set(r, 'fait')}>C’est fait</button>
            </div>
          </div>
        ))}
      </section>

      <section className="card dark">
        <div className="row wrap">
          <div className="stack spacer" style={{ gap: 2 }}>
            <strong>Et là, comment tu te sens ?</strong>
            <span className="pilou" style={{ color: 'var(--beurre)', fontSize: 20 }}>
              dernier relevé : {latest?.mood ? MOODS[latest.mood - 1] : '—'} · énergie {latest?.energy ? ENERGIES[latest.energy - 1].name : '—'}
            </span>
          </div>
          <button type="button" className="btn yellow" onClick={() => setEtatOpen(true)}>Noter</button>
        </div>
      </section>

      {perm === 'default' && (
        <section className="card cream">
          <strong>Recevoir le bilan même quand Pelote est en arrière-plan ?</strong>
          <p className="small muted" style={{ margin: 0 }}>Le navigateur te demandera la permission. Ça marche tant que l’onglet ou l’app installée est ouvert.</p>
          <div className="actions"><button type="button" className="btn primary" onClick={() => Notification.requestPermission().then(setPerm)}>Activer les notifications</button></div>
        </section>
      )}
    </main>
  );
}
