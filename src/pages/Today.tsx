import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api, type PanierItem, type Task } from '../api';
import { ENERGIES, EnergyBars, Face, MOODS } from '../components/Cat';
import { Dialog } from '../components/Dialog';
import { Highlight } from '../components/Highlight';
import { Icon } from '../components/Icon';
import { formatDay, formatLong, formatMinutes, hhmm, parseStamp, today, ymd } from '../lib/dates';
import { HORIZONS, horizonOf, parseTask, type Horizon } from '../lib/parse';
import { useApp } from '../store';

const HORIZON_LABEL: Record<Horizon, string> = Object.fromEntries(HORIZONS.map((h) => [h.id, h.name])) as Record<Horizon, string>;

function sinceLabel(start: string) {
  const min = Math.max(0, Math.round((Date.now() - parseStamp(start).getTime()) / 60000));
  return min < 60 ? `depuis ${min} min` : `depuis ${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}

export function Today() {
  const { me, fil, setFil, latest, statesLoaded, setEtatOpen, notify, fail, version, openCapture } = useApp();
  const ref = today();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [quick, setQuick] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [noeudFor, setNoeudFor] = useState<{ task?: Task } | null>(null);
  const [panier, setPanier] = useState<PanierItem[]>([]);
  const [, tick] = useState(0);
  const pendingDeletes = useRef(new Map<string, number>());
  const loc = useLocation();
  const nav = useNavigate();

  const load = useCallback(async () => {
    try {
      setTasks(await api.tasks(ref.toISOString()));
      setLoadError(false);
    } catch { setLoadError(true); }
    setLoaded(true);
  }, [ref.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load, version]);
  useEffect(() => { api.panier().then((p) => setPanier(p.slice(0, 3))).catch(() => {}); }, [version]);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 60000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (new URLSearchParams(loc.search).get('noeud') && fil) { setNoeudFor({}); nav('/', { replace: true }); }
  }, [loc.search, fil, nav]);
  // Si on quitte la page avant la fin du délai d'annulation, la suppression part quand même.
  useEffect(() => () => {
    pendingDeletes.current.forEach((timer, id) => { window.clearTimeout(timer); api.deleteTask(id).catch(() => {}); });
  }, []);

  const parsed = quick.trim() ? parseTask(quick, ref) : null;
  const filTask = tasks.find((t) => t.id === fil?.task_id);
  const sieste = latest?.energy === 1;

  const groups = useMemo(() => {
    const g: Record<Horizon, Task[]> = { today: [], week: [], nextweek: [], month: [], later: [], year: [] };
    for (const t of tasks) g[horizonOf(t, ref)].push(t);
    if (sieste) g.today.sort((a, b) => a.done - b.done || (a.minutes ?? 999) - (b.minutes ?? 999));
    return g;
  }, [tasks, sieste]); // eslint-disable-line react-hooks/exhaustive-deps

  const todayDone = groups.today.filter((t) => t.done).length;
  const todayTotal = groups.today.length;

  async function addQuick(asFil = false) {
    if (!parsed) return;
    try {
      const t = await api.addTask({ title: parsed.title, due_date: parsed.due_date, due_time: parsed.due_time, minutes: parsed.minutes, tag: parsed.tag, important: parsed.important ? 1 : 0 });
      setTasks((xs) => [...xs, t]);
      setQuick('');
      if (asFil) {
        setFil(await api.setFil({ task_id: t.id, title: t.title }));
        notify('C’est ton fil', `${me?.cat_name ?? 'Pilou'} garde la porte.`);
      } else {
        notify('Sujet ajouté', `Rangé dans ${HORIZON_LABEL[horizonOf(t, ref)]}.`);
      }
    } catch { fail('Le sujet n’a pas été ajouté'); }
  }

  const quickHelp = parsed ? (
    <div id="ajout-aide" className="row wrap small" aria-live="polite">
      <span><Highlight text={quick} marks={parsed.marks} /></span>
      <span className="muted">→</span>
      <span className="chip" style={{ background: 'var(--lait)' }}>
        {HORIZON_LABEL[horizonOf({ due_date: parsed.due_date, important: parsed.important }, ref)]}
        {parsed.due_date && ` · ${formatDay(parsed.due_date)}`}{parsed.due_time && ` ${parsed.due_time}`}
      </span>
      {parsed.tag && <span className="chip">{parsed.tag}</span>}
      {parsed.minutes && <span className="chip" style={{ background: 'var(--menthe-pale)' }}>{formatMinutes(parsed.minutes)}</span>}
    </div>
  ) : (
    <p id="ajout-aide" className="small muted" style={{ margin: 0 }}>
      Ex. « Kick-off lundi 10h #équipe 1h » : une date dans le titre et c’est rangé.
    </p>
  );

  async function toggle(t: Task) {
    const next = t.done ? 0 : 1;
    setTasks((xs) => xs.map((x) => (x.id === t.id ? { ...x, done: next } : x)));
    try {
      await api.updateTask(t.id, { done: next });
    } catch {
      setTasks((xs) => xs.map((x) => (x.id === t.id ? { ...x, done: t.done } : x)));
      fail('La tâche n’a pas été cochée');
      return;
    }
    if (next) {
      const left = groups.today.filter((x) => !x.done && x.id !== t.id).length;
      notify('Bouclé !', left ? `Encore ${left} pour aujourd’hui, à ton rythme.` : 'Journée bouclée. Pilou ronronne.');
      if (fil?.task_id === t.id) { await api.clearFil().catch(() => {}); setFil(null); }
    }
  }

  function remove(t: Task) {
    setEditing(null);
    setTasks((xs) => xs.filter((x) => x.id !== t.id));
    const timer = window.setTimeout(() => {
      pendingDeletes.current.delete(t.id);
      api.deleteTask(t.id).catch(() => { setTasks((xs) => [...xs, t]); fail('La tâche n’a pas été supprimée'); });
    }, 6000);
    pendingDeletes.current.set(t.id, timer);
    notify('Tâche supprimée', t.title, {
      action: {
        label: 'Annuler',
        run: () => {
          window.clearTimeout(pendingDeletes.current.get(t.id));
          pendingDeletes.current.delete(t.id);
          setTasks((xs) => [...xs, t]);
        },
      },
    });
  }

  async function save(t: Task, patch: Partial<Task>) {
    const before = t;
    setTasks((xs) => xs.map((x) => (x.id === t.id ? { ...x, ...patch } : x)));
    setEditing(null);
    try {
      const saved = await api.updateTask(t.id, patch);
      setTasks((xs) => xs.map((x) => (x.id === t.id ? saved : x)));
      if (fil?.task_id === t.id && patch.title) setFil({ ...fil, title: patch.title });
    } catch {
      setTasks((xs) => xs.map((x) => (x.id === t.id ? before : x)));
      fail('La modification n’a pas été enregistrée');
    }
  }

  async function startFil(t: Task) {
    if (fil && fil.task_id !== t.id) { setNoeudFor({ task: t }); return; }
    try { setFil(await api.setFil({ task_id: t.id, title: t.title })); } catch { fail('Le fil n’a pas été posé'); }
  }

  async function boucle() {
    if (filTask) await toggle(filTask);
    else {
      try { await api.clearFil(); setFil(null); notify('Bouclé !'); } catch { fail(); }
    }
  }

  const checkinDue = statesLoaded && me && !latest?.created_at?.startsWith(ymd(ref)) && (() => {
    const [h, m] = me.checkin.split(':').map(Number);
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes() >= h * 60 + m;
  })();
  const suggestion = !fil ? [...groups.today].filter((t) => !t.done).sort((a, b) => sieste ? (a.minutes ?? 999) - (b.minutes ?? 999) : 0)[0] : null;

  return (
    <main className="page">
      <div className="row wrap" style={{ alignItems: 'flex-end' }}>
        <div className="spacer">
          <p className="muted" style={{ margin: 0, fontWeight: 600 }}>{formatLong(ref)}</p>
          <h1>Aujourd’hui</h1>
        </div>
        {todayTotal > 0 && <span className="chip" style={{ background: 'var(--blanc)', border: '1.5px solid var(--trait)', fontSize: 14 }}>{todayDone} sur {todayTotal} bouclés</span>}
      </div>

      {/* Humeur et énergie à portée de pouce sur mobile */}
      <div className="mob-only" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        <button type="button" className="tile" onClick={() => setEtatOpen('mood')} aria-label={`Humeur : ${latest?.mood ? MOODS[latest.mood - 1] : 'pas notée'}. Modifier`}
          style={{ background: 'var(--coussinet-pale)', border: 'none', flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, cursor: 'pointer', textAlign: 'left' }}>
          {latest?.mood ? <Face mood={latest.mood} size={34} light={false} /> : <Icon name="humeur" size={28} />}
          <span className="stack spacer" style={{ gap: 0 }}><span className="small" style={{ fontWeight: 700, color: 'var(--texte-3)' }}>Humeur</span>
            <strong style={{ fontFamily: 'var(--titre)', fontSize: 17 }}>{!statesLoaded ? '…' : latest?.mood ? MOODS[latest.mood - 1] : 'À noter'}</strong></span>
          <Icon name="chevron" size={16} />
        </button>
        <button type="button" className="tile" onClick={() => setEtatOpen('energy')} aria-label={`Énergie : ${latest?.energy ? ENERGIES[latest.energy - 1].name : 'pas notée'}. Modifier`}
          style={{ background: 'var(--menthe-pale)', border: 'none', flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, cursor: 'pointer', textAlign: 'left' }}>
          <EnergyBars level={latest?.energy ?? 0} on />
          <span className="stack spacer" style={{ gap: 0 }}><span className="small" style={{ fontWeight: 700, color: 'var(--texte-3)' }}>Énergie</span>
            <strong style={{ fontFamily: 'var(--titre)', fontSize: 17 }}>{!statesLoaded ? '…' : latest?.energy ? ENERGIES[latest.energy - 1].name : 'À noter'}</strong></span>
          <Icon name="chevron" size={16} />
        </button>
      </div>

      {checkinDue && (
        <div className="banner" style={{ background: 'var(--nuit)', color: 'var(--lait)' }}>
          <Face mood={4} size={40} />
          <span style={{ flex: '1 1 220px' }}><strong>Salut !</strong> Ça dit quoi ce matin ? Humeur et énergie en 2 taps.</span>
          <button type="button" className="btn yellow small" onClick={() => setEtatOpen(true)}>Faire le check-in</button>
        </div>
      )}

      <section aria-label="Le fil" className={`fil${fil ? '' : ' empty'}`}>
        <Icon name="fil" size={36} />
        {fil ? (
          <>
            <div style={{ flex: '999 1 300px', minWidth: 0 }}>
              <div className="eyebrow">Le fil · {sinceLabel(fil.started_at)}</div>
              <div className="fil-title">{fil.title}</div>
              {filTask?.next_note && <div className="small" style={{ marginTop: 4 }}>Prochaine action : <strong>{filTask.next_note}</strong></div>}
            </div>
            <span className="pilou desk-only" style={{ color: 'var(--nuit)' }}>{me?.cat_name ?? 'Pilou'} garde la porte</span>
            <div className="actions">
              <button type="button" className="btn" onClick={() => setNoeudFor({})}>Faire un nœud et changer</button>
              <button type="button" className="btn primary" onClick={boucle}>C’est bouclé</button>
            </div>
          </>
        ) : (
          <form className="stack" style={{ flex: '999 1 300px', minWidth: 0, gap: 10 }} onSubmit={(e) => { e.preventDefault(); addQuick(true); }}>
            <div>
              <div className="eyebrow">Le fil</div>
              <label htmlFor="ajout-rapide" className="fil-title" style={{ fontSize: 20, display: 'block' }}>Sur quoi tu te poses maintenant ?</label>
            </div>
            <div className="row" style={{ background: 'var(--blanc)', border: '2px solid var(--nuit)', borderRadius: 18, padding: '4px 4px 4px 14px' }}>
              <input id="ajout-rapide" value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="Nouveau sujet…" autoComplete="off" aria-describedby="ajout-aide"
                style={{ flex: '1 1 auto', minWidth: 0, border: 'none', background: 'transparent', fontSize: 17, minHeight: 44, outline: 'none' }} />
              <kbd className="desk-only">N</kbd>
            </div>
            {quickHelp}
            <div className="row wrap">
              {suggestion && !quick && (
                <button type="button" className="btn ghost small" onClick={() => startFil(suggestion)} style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <Icon name="fil" size={16} />Reprendre : {suggestion.title}
                </button>
              )}
              <span className="spacer" />
              <div className="actions">
                <button type="button" className="btn small" disabled={!parsed} onClick={() => addQuick(false)}>Juste l’ajouter</button>
                <button type="submit" className="btn primary small" disabled={!parsed}>C’est mon fil</button>
              </div>
            </div>
          </form>
        )}
      </section>

      <div className="cols">
        <div className="col-main">
          {fil && (
          <section aria-label="Ajout rapide" className="bigbar" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
            <form className="row" onSubmit={(e) => { e.preventDefault(); addQuick(); }}>
              <label htmlFor="ajout-rapide" className="sr-only">Nouveau sujet</label>
              <span style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--nuit)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <Icon name="plus" color="#F6F2FF" stroke={2.4} />
              </span>
              <input id="ajout-rapide" value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="Nouveau sujet…" autoComplete="off" aria-describedby="ajout-aide" />
              <kbd className="desk-only">N</kbd>
              <button type="submit" className="btn primary" disabled={!parsed}>Ajouter</button>
            </form>
            <div style={{ paddingLeft: 46 }}>{quickHelp}</div>
          </section>
          )}

          {!loaded && (
            <div className="card" aria-busy="true"><p className="pilou" style={{ margin: 0 }}>{me?.cat_name ?? 'Pilou'} rassemble tes tâches…</p></div>
          )}
          {loaded && loadError && (
            <div className="card" role="alert" style={{ borderColor: '#8A1F45' }}>
              <strong>Tes tâches n’ont pas pu être chargées.</strong>
              <div className="actions"><button type="button" className="btn primary" onClick={() => { setLoaded(false); load(); }}>Réessayer</button></div>
            </div>
          )}
          {loaded && !loadError && tasks.length === 0 && (
            <div className="card" style={{ alignItems: 'center', textAlign: 'center' }}>
              <Face mood={5} size={64} light={false} />
              <h2>Rien à faire pour l’instant</h2>
              <p className="muted" style={{ margin: 0 }}>Ajoute un sujet ci-dessus, avec une date si tu veux : {me?.cat_name ?? 'Pilou'} le range.</p>
            </div>
          )}

          {HORIZONS.map((h) => {
            const list = groups[h.id];
            if (!list.length) return null;
            const done = list.filter((t) => t.done).length;
            return (
              <section key={h.id} className="card" aria-labelledby={`h-${h.id}`}>
                <div className="row wrap">
                  <span className="dot" style={{ background: h.color }} aria-hidden="true" />
                  <h2 id={`h-${h.id}`}>{h.name}</h2>
                  <span className="muted small">{list.length - done} à faire{done ? ` · ${done} bouclé${done > 1 ? 's' : ''}` : ''}</span>
                  <span className="spacer" />
                  {h.id === 'today' && sieste && <span className="pilou">mode Sieste : petits morceaux d’abord</span>}
                  {h.id === 'today' && !sieste && done > 0 && <span className="pilou">déjà {done}, bien joué</span>}
                </div>
                {h.id === 'today' && list.length > 0 && (
                  <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={list.length} aria-valuenow={done} aria-label="Avancement du jour">
                    <div style={{ width: `${(done / list.length) * 100}%` }} />
                  </div>
                )}
                <ul className="tasklist">
                  {list.map((t) => editing === t.id ? (
                    <TaskEditor key={t.id} task={t} onCancel={() => setEditing(null)} onSave={(patch) => save(t, patch)} onDelete={() => remove(t)} />
                  ) : (
                    <li key={t.id} className={`task${t.done ? ' done' : ''}`}>
                      <button type="button" className="check" aria-pressed={!!t.done} aria-label={t.done ? `Rouvrir : ${t.title}` : `Boucler : ${t.title}`} onClick={() => toggle(t)}>
                        <span>{t.done ? <Icon name="check" size={14} stroke={3} /> : null}</span>
                      </button>
                      <button type="button" className="task-title" onClick={() => setEditing(t.id)} aria-label={`Modifier : ${t.title}`} title="Modifier">
                        {t.title}
                      </button>
                      {fil?.task_id === t.id && <span className="chip" style={{ background: 'var(--beurre)', color: 'var(--nuit)', whiteSpace: 'nowrap' }}>sur le fil</span>}
                      {t.tag && <span className="chip desk-only">{t.tag}</span>}
                      {t.due_date && h.id !== 'today' && <span className="task-meta">{formatDay(t.due_date, ref)}{t.due_time ? ` ${t.due_time}` : ''}</span>}
                      {t.due_time && h.id === 'today' && <span className="task-meta">{t.due_time}</span>}
                      {t.minutes ? <span className="task-meta">{formatMinutes(t.minutes)}</span> : null}
                      {!t.done && fil?.task_id !== t.id && (
                        <button type="button" className="btn ghost small" aria-label={`Mettre sur le fil : ${t.title}`} onClick={() => startFil(t)} style={{ minHeight: 38 }}>
                          <Icon name="fil" size={16} />Fil
                        </button>
                      )}
                      <button type="button" className="iconbtn desk-only" style={{ width: 38, height: 38 }} aria-label={`Supprimer : ${t.title}`} title="Supprimer (annulable)" onClick={() => remove(t)}>
                        <Icon name="poubelle" size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <aside className="col-side desk-only">
          <section className="card dark">
            <div className="row"><h2 className="spacer">Comment ça va ?</h2>
              {latest && <span className="small muted">màj {hhmm(parseStamp(latest.created_at))}</span>}</div>
            <div className="row">
              {latest?.mood ? <Face mood={latest.mood} size={52} /> : null}
              <div className="stack spacer" style={{ gap: 2 }}>
                <strong style={{ fontFamily: 'var(--titre)', fontSize: 20 }}>{!statesLoaded ? '…' : latest?.mood ? MOODS[latest.mood - 1] : 'Pas encore noté'}</strong>
                <span className="small muted">Énergie : {latest?.energy ? ENERGIES[latest.energy - 1].name : '—'}</span>
              </div>
              <button type="button" className="btn yellow small" onClick={() => setEtatOpen(true)}>Changer</button>
            </div>
            <p className="small muted" style={{ margin: 0 }}>
              {latest?.energy === 1 ? 'Mode Sieste : les tâches courtes remontent en haut.' : latest?.energy === 3 ? 'Zoomies : bon moment pour un gros morceau.' : 'Note ton état quand il change, sans te justifier.'}
            </p>
          </section>

          <section className="card">
            <div className="row"><h2 className="spacer">Boîte à pensées</h2><kbd>⌘⇧8</kbd></div>
            <p className="small muted" style={{ margin: 0 }}>Vide ta tête : « appeler », « écrire à », une date… {me?.cat_name ?? 'Pilou'} te le rappelle ce soir.</p>
            <div className="actions"><button type="button" className="btn primary" onClick={() => openCapture({ kind: 'pensee' })}><Icon name="pensee" />Déposer une pensée</button></div>
          </section>

          <section className="card">
            <div className="row"><h2 className="spacer">Le Panier</h2><Link to="/panier" className="small" style={{ fontWeight: 600 }}>Tout voir</Link></div>
            {panier.length === 0 ? <p className="small muted" style={{ margin: 0 }}>Vide pour l’instant. <kbd>⌘⇧9</kbd> ou colle un lien n’importe où.</p> : (
              <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 6 }}>
                {panier.map((p) => <li key={p.id} className="small" style={{ fontWeight: 600 }}>{p.title}</li>)}
              </ul>
            )}
            <div className="banner" style={{ background: 'var(--beurre-pale)', padding: '10px 12px' }}>
              <Icon name="horloge" /><span className="small" style={{ fontWeight: 600 }}>Récré à {me?.recre} · 20 min</span>
            </div>
          </section>
        </aside>
      </div>

      {noeudFor && fil && (
        <NoeudDialog
          from={fil.title}
          target={noeudFor.task}
          tasks={tasks.filter((t) => !t.done && t.id !== fil.task_id)}
          onClose={() => setNoeudFor(null)}
          onError={() => fail('Le nœud n’a pas été enregistré')}
          onDone={(f) => { setFil(f); setNoeudFor(null); load(); notify('Nœud fait', 'Tu pourras reprendre exactement où tu en étais.'); }}
        />
      )}
    </main>
  );
}

/** Édition d'une tâche sur place : titre, date, heure, importance. */
function TaskEditor({ task, onCancel, onSave, onDelete }: {
  task: Task; onCancel: () => void; onSave: (patch: Partial<Task>) => void; onDelete: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [date, setDate] = useState(task.due_date ?? '');
  const [time, setTime] = useState(task.due_time ?? '');
  const [important, setImportant] = useState(!!task.important);
  const id = `edit-${task.id}`;
  const submit = () => {
    if (!title.trim()) return;
    onSave({ title: title.trim(), due_date: date || null, due_time: date && time ? time : null, important: important ? 1 : 0 });
  };
  return (
    <li className="task" style={{ display: 'block', padding: '12px 0' }}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); submit(); }} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel(); } }}>
        <div className="field">
          <label htmlFor={`${id}-t`}>Titre</label>
          <input id={`${id}-t`} className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </div>
        <div className="row wrap">
          <div className="field" style={{ flex: '1 1 160px' }}>
            <label htmlFor={`${id}-d`}>Date <span className="muted" style={{ fontWeight: 500 }}>(vide = aujourd’hui)</span></label>
            <input id={`${id}-d`} type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field" style={{ flex: '1 1 120px' }}>
            <label htmlFor={`${id}-h`}>Heure</label>
            <input id={`${id}-h`} type="time" className="input" value={time} disabled={!date} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <label className="row small" style={{ fontWeight: 600, minHeight: 44, cursor: 'pointer' }}>
          <input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} style={{ width: 20, height: 20 }} />
          Grande chasse de l’année (important)
        </label>
        <div className="row wrap">
          <button type="button" className="btn small" onClick={onDelete} style={{ borderColor: '#8A1F45', color: '#8A1F45' }}>
            <Icon name="poubelle" size={16} />Supprimer
          </button>
          <span className="spacer" />
          <div className="actions">
            <button type="button" className="btn small" onClick={onCancel}>Annuler</button>
            <button type="submit" className="btn primary small" disabled={!title.trim()}>Enregistrer</button>
          </div>
        </div>
      </form>
    </li>
  );
}

function NoeudDialog({ from, target, tasks, onClose, onDone, onError }: {
  from: string; target?: Task; tasks: Task[]; onClose: () => void; onError: () => void;
  onDone: (f: Awaited<ReturnType<typeof api.setFil>>) => void;
}) {
  const [where, setWhere] = useState('');
  const [next, setNext] = useState('');
  const [to, setTo] = useState<string>(target?.id ?? tasks[0]?.id ?? '__libre');
  const [free, setFree] = useState('');
  const [busy, setBusy] = useState(false);
  const toTask = tasks.find((t) => t.id === to) ?? target;

  async function go() {
    const title = to === '__libre' ? free.trim() : toTask?.title;
    if (!title) return;
    setBusy(true);
    try {
      onDone(await api.setFil({ task_id: to === '__libre' ? null : to, title, knot: { where: where.trim() || undefined, next: next.trim() || undefined } }));
    } catch { onError(); } finally { setBusy(false); }
  }

  return (
    <Dialog onClose={onClose} labelledBy="noeud-titre">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <span style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--lavande)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name="noeud" size={28} /></span>
        <div>
          <h2 id="noeud-titre" style={{ fontSize: 26, fontWeight: 800 }}>Avant de changer, fais un nœud</h2>
          <p className="lede" style={{ marginTop: 2 }}>20 secondes maintenant, 10 minutes gagnées à la reprise.</p>
        </div>
      </div>
      <div className="row wrap small" style={{ fontWeight: 600 }}>
        <span className="chip" style={{ background: 'var(--beurre)', color: 'var(--nuit)', fontSize: 14 }}>{from}</span>
        <Icon name="arrow" />
        {target ? <span className="chip" style={{ background: 'var(--blanc)', fontSize: 14 }}>{target.title}</span> : null}
      </div>
      {!target && (
        <div className="field">
          <label htmlFor="noeud-vers">Vers quoi tu changes ?</label>
          <select id="noeud-vers" className="input" value={to} onChange={(e) => setTo(e.target.value)}>
            {tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            <option value="__libre">Autre chose…</option>
          </select>
          {to === '__libre' && <input className="input" aria-label="Nouveau fil" value={free} onChange={(e) => setFree(e.target.value)} placeholder="Ex. répondre aux mails" />}
        </div>
      )}
      <div className="field">
        <label htmlFor="noeud-ou">Où j’en suis</label>
        <textarea id="noeud-ou" className="input" rows={2} value={where} onChange={(e) => setWhere(e.target.value)} placeholder="Ex. écran 3 calé, il manque l’état d’erreur" />
      </div>
      <div className="field">
        <label htmlFor="noeud-next">Prochaine action concrète</label>
        <input id="noeud-next" className="input" value={next} onChange={(e) => setNext(e.target.value)} placeholder="Ex. dupliquer l’écran 3 et dessiner l’erreur" />
      </div>
      <div className="row wrap">
        <span className="pilou spacer">c’est ok de changer, tant qu’on note où on était</span>
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>Je reste sur le fil</button>
          <button type="button" className="btn primary" disabled={busy || (to === '__libre' && !free.trim())} onClick={go}>Nouer et changer</button>
        </div>
      </div>
    </Dialog>
  );
}
