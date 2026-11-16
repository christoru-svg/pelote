import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Reminder, type Thought } from '../api';
import { Highlight } from '../components/Highlight';
import { Icon } from '../components/Icon';
import { addDays, formatDay, hhmm, parseStamp, today, ymd } from '../lib/dates';
import { parseThought } from '../lib/parse';
import { useApp } from '../store';

type Filter = 'traiter' | 'rappels' | 'idees' | 'tout';
const STATUS: Record<Reminder['status'], { label: string; bg: string }> = {
  soir: { label: 'rappel ce soir', bg: 'var(--beurre-pale)' },
  demain: { label: 'demain matin', bg: 'var(--lavande-pale)' },
  fait: { label: 'fait', bg: 'var(--menthe-pale)' },
};

export function Pensees() {
  const { me, fil, notify, fail, version, bump } = useApp();
  const ref = today();
  const [text, setText] = useState('');
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [tonight, setTonight] = useState<Reminder[]>([]);
  const [filter, setFilter] = useState<Filter>('tout');

  useEffect(() => {
    api.thoughts(addDays(ref, -14).toISOString()).then((r) => { setThoughts(r.thoughts); setReminders(r.reminders); }).catch(() => {});
    api.reminders(ymd(ref)).then(setTonight).catch(() => {});
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  const live = text.trim() ? parseThought(text, ref) : null;

  async function submit() {
    if (!live) return;
    try {
      await api.addThought({ text, context: fil?.title, ideas: live.ideas, reminders: live.actions.map((a) => ({ ...a, remind_on: ymd(ref) })) });
    } catch { fail('La pensée n’a pas été déposée'); return; }
    setText('');
    const n = live.actions.length;
    notify('Pensée déposée', n ? `${n} rappel${n > 1 ? 's' : ''} ce soir à ${me?.soir}.` : live.ideas.length ? 'L’idée est partie dans le Panier.' : 'Ta tête a moins à porter.');
    bump();
  }

  const byThought = useMemo(() => {
    const m = new Map<string, Reminder[]>();
    reminders.forEach((r) => r.thought_id && m.set(r.thought_id, [...(m.get(r.thought_id) ?? []), r]));
    return m;
  }, [reminders]);

  const items = thoughts.map((t) => {
    const at = parseStamp(t.created_at);
    const p = parseThought(t.text, new Date(at.getFullYear(), at.getMonth(), at.getDate()));
    const rs = byThought.get(t.id) ?? [];
    return { t, at, p, rs };
  }).filter(({ p, rs }) =>
    filter === 'tout' ? true
    : filter === 'rappels' ? rs.length > 0
    : filter === 'idees' ? p.ideas.length > 0
    : rs.some((r) => r.status !== 'fait'));

  const days = new Map<string, typeof items>();
  items.forEach((it) => { const k = ymd(it.at); days.set(k, [...(days.get(k) ?? []), it]); });

  return (
    <main className="page">
      <div className="row wrap" style={{ alignItems: 'flex-end' }}>
        <h1 className="spacer" style={{ fontSize: 'clamp(34px, 5vw, 64px)' }}>Pensées</h1>
        <Link to="/bilan" className="btn"><Icon name="lune" />Bilan du soir</Link>
      </div>
      <form className="bigbar" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <label htmlFor="pensee" className="sr-only">Nouvelle pensée</label>
        <input id="pensee" value={text} onChange={(e) => setText(e.target.value)} placeholder="Qu’est-ce qui te passe par la tête ?" autoComplete="off" />
        <button type="submit" className="btn primary" disabled={!live}>Déposer</button>
      </form>
      {live && (live.actions.length > 0 || live.ideas.length > 0) ? (
        <p className="small" style={{ margin: 0 }} aria-live="polite"><Highlight text={text} marks={live.marks} /></p>
      ) : (
        <span className="pilou">écris comme ça vient, {me?.cat_name ?? 'Pilou'} repère les actions, les dates et les idées</span>
      )}

      <div className="filters" role="group" aria-label="Filtres">
        {([['traiter', 'À traiter'], ['rappels', 'Rappels'], ['idees', 'Idées'], ['tout', 'Tout']] as const).map(([k, l]) => (
          <button key={k} type="button" className="filter" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      <div className="cols">
        <div className="col-main">
          {items.length === 0 && <div className="card"><p className="muted" style={{ margin: 0 }}>Rien ici pour l’instant.</p></div>}
          {[...days.entries()].map(([day, list]) => (
            <section key={day} className="stack">
              <h2>{formatDay(day, ref).replace(/^./, (c) => c.toUpperCase())}</h2>
              {list.map(({ t, at, p, rs }) => (
                <article key={t.id} className="card" style={{ flexDirection: 'row', gap: 16 }}>
                  <span className="small" style={{ fontWeight: 700, color: 'var(--texte-2)', width: 44, flex: 'none', paddingTop: 3 }}>{hhmm(at)}</span>
                  <div className="stack spacer" style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, overflowWrap: 'anywhere' }}><Highlight text={t.text} marks={p.marks} /></p>
                    {(rs.length > 0 || p.ideas.length > 0) && (
                      <div className="row wrap">
                        {rs.map((r) => (
                          <span key={r.id} className="chip" style={{ background: 'var(--lait)', fontSize: 13 }}>
                            {r.label}{r.due_date ? ` · ${formatDay(r.due_date, ref)}${r.due_time ? ' ' + r.due_time : ''}` : ''}
                            <span className="chip" style={{ background: STATUS[r.status].bg, padding: '2px 8px' }}>{STATUS[r.status].label}</span>
                          </span>
                        ))}
                        {p.ideas.map((x, i) => <span key={i} className="chip" style={{ background: 'var(--coussinet-pale)', fontSize: 13 }}>Idée · dans le Panier</span>)}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </section>
          ))}
        </div>
        <aside className="col-side">
          <section className="card dark">
            <span className="eyebrow" style={{ color: 'var(--beurre)' }}>Ce soir · {me?.soir}</span>
            <h2>{tonight.length ? `${me?.cat_name ?? 'Pilou'} te rappellera ${tonight.length} chose${tonight.length > 1 ? 's' : ''}` : 'Aucun rappel ce soir'}</h2>
            {tonight.map((r) => (
              <div key={r.id} className="row" style={{ background: 'var(--nuit-2)', borderRadius: 14, padding: '10px 12px' }}>
                <span className="dot" style={{ background: r.due_date ? 'var(--lavande)' : 'var(--beurre)', width: 10, height: 10 }} aria-hidden="true" />
                <span className="spacer" style={{ fontWeight: 600, fontSize: 14 }}>{r.label}</span>
                {r.due_date && <span className="small muted">{formatDay(r.due_date, ref)}{r.due_time ? ` ${r.due_time}` : ''}</span>}
              </div>
            ))}
          </section>
          <section className="card">
            <h2>Ce que {me?.cat_name ?? 'Pilou'} repère</h2>
            <div className="row" style={{ alignItems: 'flex-start' }}><mark className="mark-action small" style={{ fontWeight: 700, color: 'inherit' }}>Actions</mark><span className="small muted">appeler, écrire à, envoyer, relancer, répondre à, prendre rdv… deviennent des rappels du soir.</span></div>
            <div className="row" style={{ alignItems: 'flex-start' }}><mark className="mark-date small" style={{ fontWeight: 700, color: 'inherit' }}>Dates</mark><span className="small muted">jeudi 14h, demain, le 3 déc… s’accrochent au rappel.</span></div>
            <div className="row" style={{ alignItems: 'flex-start' }}><mark className="mark-idea small" style={{ fontWeight: 700, color: 'inherit' }}>Idées</mark><span className="small muted">« idée : », « et si… » partent dans le Panier.</span></div>
          </section>
          <p className="small muted" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="pensee" size={16} />Raccourci partout : <kbd>⌘⇧8</kbd></p>
        </aside>
      </div>
    </main>
  );
}
