import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type PanierItem, type Reminder, type Thought } from '../api';
import { Face } from '../components/Cat';
import { Highlight } from '../components/Highlight';
import { Icon } from '../components/Icon';
import { useDeposit } from '../components/useDeposit';
import { domainOf } from '../lib/autotag';
import { PLACE_LABEL, classify } from '../lib/classify';
import { addDays, formatDay, hhmm, parseStamp, today, ymd } from '../lib/dates';
import { parseTask, parseThought } from '../lib/parse';
import { useApp } from '../store';

const DAY = 86400000;
const RECRE_MIN = 20;
const ago = (s: string) => {
  const d = Math.floor((Date.now() - parseStamp(s).getTime()) / DAY);
  return d <= 0 ? "aujourd'hui" : d === 1 ? 'hier' : `il y a ${d} j`;
};

/**
 * La Boîte : un seul endroit pour vider sa tête. Tu déposes, Pelote range dans
 * Ce soir (rappels), À explorer (liens, images, idées : pour la récré) ou Notes.
 */
export function Boite() {
  const { me, version, setPanierCount, notify, fail, recreEnd, setRecreEnd } = useApp();
  const send = useDeposit();
  const ref = today();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [tonight, setTonight] = useState<Reminder[]>([]);
  const [items, setItems] = useState<PanierItem[]>([]);
  const [notes, setNotes] = useState<Thought[]>([]);
  const [allReminders, setAllReminders] = useState<Reminder[]>([]);
  const [view, setView] = useState<'tout' | 'explorer' | 'notes'>('tout');
  const [search, setSearch] = useState('');
  const [allExplore, setAllExplore] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    Promise.all([api.reminders(ymd(ref)), api.panier(), api.thoughts(addDays(ref, -365).toISOString())])
      .then(async ([r, p, th]) => {
        setTonight(r);
        // « Ça s'effiloche » : jamais ouvert en 30 jours → rangé au grenier, sans rien perdre.
        const old = p.filter((x) => !x.opened_at && Date.now() - parseStamp(x.created_at).getTime() > 30 * DAY);
        await Promise.all(old.map((x) => api.updatePanier(x.id, { archived: 1 }).catch(() => {})));
        const kept = p.filter((x) => !old.includes(x));
        setItems(kept);
        setPanierCount(kept.length);
        setNotes(th.thoughts);
        setAllReminders(th.reminders);
        setLoaded(true);
      })
      .catch(() => { setLoaded(true); fail('La Boîte n’a pas pu être chargée'); });
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!recreEnd) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [recreEnd]);

  const place = draft.trim() ? classify(draft, ref) : null;
  const pureNotes = notes.filter((t) => !allReminders.some((r) => r.thought_id === t.id));
  const q = search.trim().toLowerCase();
  const foundNotes = q ? pureNotes.filter((t) => t.text.toLowerCase().includes(q)) : pureNotes;

  async function noteToTask(t: Thought) {
    const parsed = parseTask(t.text, ref);
    try {
      await api.addTask({ title: parsed.title.slice(0, 300), due_date: parsed.due_date, due_time: parsed.due_time, minutes: parsed.minutes, tag: parsed.tag, important: parsed.important ? 1 : 0 });
      await api.deleteThought(t.id);
    } catch { fail('La note n’est pas devenue une tâche'); return; }
    setNotes((xs) => xs.filter((x) => x.id !== t.id));
    notify('C’est une tâche', 'Elle t’attend dans Aujourd’hui.');
  }

  async function submit(e: React.FormEvent | React.KeyboardEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setBusy(true);
    if (await send(draft)) {
      setDraft('');
      const el = document.getElementById('boite-depot') as HTMLTextAreaElement | null;
      if (el) el.style.height = 'auto';
    }
    setBusy(false);
  }

  async function reminder(r: Reminder, status: 'fait' | 'demain') {
    setTonight((xs) => xs.filter((x) => x.id !== r.id));
    try {
      await api.updateReminder(r.id, status === 'demain' ? { status, remind_on: ymd(addDays(ref, 1)) } : { status });
      if (status === 'fait') notify('Fait !', 'Un truc de moins dans ta tête.');
    } catch { setTonight((xs) => [...xs, r]); fail(); }
  }

  function open(p: PanierItem) {
    if (p.opened_at) return;
    const opened_at = new Date().toISOString();
    setItems((xs) => xs.map((x) => (x.id === p.id ? { ...x, opened_at } : x)));
    api.updatePanier(p.id, { opened_at }).catch(() => {});
  }
  async function toTask(p: PanierItem) {
    try {
      await api.addTask({ title: p.title, tag: p.tag });
      await api.updatePanier(p.id, { archived: 1 });
    } catch { fail('Ce n’est pas devenu une tâche'); return; }
    setItems((xs) => xs.filter((x) => x.id !== p.id));
    setPanierCount(items.length - 1);
    notify('Transformé en tâche', 'Il t’attend dans Aujourd’hui.');
  }
  async function letGo(p: PanierItem) {
    setItems((xs) => xs.filter((x) => x.id !== p.id));
    setPanierCount(items.length - 1);
    try { await api.updatePanier(p.id, { archived: 1 }); } catch {
      setItems((xs) => [p, ...xs]); fail('Ce n’a pas été lâché'); return;
    }
    notify('Lâché, rangé au grenier', 'Rien n’est effacé : c’est dans ton export.', {
      action: { label: 'Annuler', run: () => {
        api.updatePanier(p.id, { archived: 0 }).then(() => setItems((xs) => [p, ...xs])).catch(() => fail());
      } },
    });
  }

  const left = recreEnd ? Math.max(0, recreEnd - Date.now()) : 0;
  const shownExplore = recreEnd
    ? [...items].filter((p) => !p.opened_at).sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(0, 6)
    : allExplore ? items : items.slice(0, 6);

  // Le fil de la conversation : tes messages (pensées + trouvailles des 14 derniers jours), du plus ancien au plus récent.
  const since = addDays(ref, -14).getTime();
  const thread = [
    ...notes.filter((t) => parseStamp(t.created_at).getTime() >= since).map((t) => ({ kind: 'thought' as const, at: parseStamp(t.created_at), t })),
    ...items.filter((p) => parseStamp(p.created_at).getTime() >= since).map((p) => ({ kind: 'panier' as const, at: parseStamp(p.created_at), p })),
  ].sort((x, y) => x.at.getTime() - y.at.getTime());
  const remindersOf = (id: string) => allReminders.filter((r) => r.thought_id === id);
  const cat = me?.cat_name ?? 'Pilou';
  let lastDay = '';

  return (
    <main className="page boite" style={{ maxWidth: 820 }}>
      <div className="row" style={{ gap: 12 }}>
        <Face mood={4} size={48} light={false} />
        <div className="stack spacer" style={{ gap: 0 }}>
          <h1 style={{ fontSize: 'clamp(26px, 4vw, 36px)' }}>Écris à {cat}</h1>
          <span className="small muted">Tu écris, {cat} range : rappels du soir, trucs à explorer, notes.</span>
        </div>
      </div>

      {loaded && (thread.length > 0 || items.length > 0 || pureNotes.length > 0) && (
        <div className="filters" role="group" aria-label="Afficher">
          <button type="button" className="filter" aria-pressed={view === 'tout'} onClick={() => setView('tout')}>Tout</button>
          <button type="button" className="filter" aria-pressed={view === 'explorer'} onClick={() => setView(view === 'explorer' ? 'tout' : 'explorer')}>
            <span className="dot" style={{ background: 'var(--coussinet)', width: 10, height: 10 }} aria-hidden="true" />À explorer <span className="muted">{items.length}</span>
          </button>
          <button type="button" className="filter" aria-pressed={view === 'notes'} onClick={() => setView(view === 'notes' ? 'tout' : 'notes')}>
            <span className="dot" style={{ background: 'var(--lavande)', width: 10, height: 10 }} aria-hidden="true" />Notes <span className="muted">{pureNotes.length}</span>
          </button>
        </div>
      )}

      {view === 'explorer' && items.length === 0 && (
        <div className="card" style={{ alignItems: 'center', textAlign: 'center', flex: '1 1 auto', justifyContent: 'center' }}>
          <Face mood={4} size={56} light={false} />
          <h2>Rien à explorer pour l’instant</h2>
          <p className="muted" style={{ margin: 0, maxWidth: 420 }}>
            Les liens, les images et les messages qui commencent par « idée : » ou « et si… » arrivent ici. Tu les ressors pendant la récré.
          </p>
        </div>
      )}
      {view === 'notes' && pureNotes.length === 0 && (
        <div className="card" style={{ alignItems: 'center', textAlign: 'center', flex: '1 1 auto', justifyContent: 'center' }}>
          <Face mood={4} size={56} light={false} />
          <h2>Pas encore de notes</h2>
          <p className="muted" style={{ margin: 0, maxWidth: 420 }}>Tout ce qui n’est ni un rappel ni un truc à explorer est gardé ici.</p>
        </div>
      )}

      {view === 'explorer' && items.length > 0 && (
        <section className="stack card" aria-label="À explorer" style={{ gap: 10, background: 'var(--coussinet-pale)', border: 'none' }}>
          <div className="row wrap">
            <span className="small spacer" style={{ fontWeight: 600 }}>
              {recreEnd ? 'Récré en cours, profites-en.' : `Récré à ${me?.recre} · ${RECRE_MIN} min`}
            </span>
            {recreEnd
              ? <button type="button" className="btn small" onClick={() => setRecreEnd(null)}>Terminer</button>
              : <button type="button" className="btn small" onClick={() => setRecreEnd(Date.now() + RECRE_MIN * 60000)}>Commencer la récré</button>}
          </div>
          <div className="masonry">
            {shownExplore.map((p) => (
              <article key={p.id} className="pcard">
                {p.image_url && <img src={p.image_url} alt={p.title} loading="lazy" />}
                <div className="body" style={{ gap: 6 }}>
                  <strong style={{ fontSize: 15, overflowWrap: 'anywhere' }}>{p.title}</strong>
                  {p.url && (
                    <a href={p.url} target="_blank" rel="noopener noreferrer" onClick={() => open(p)} className="small" style={{ fontWeight: 600 }}>
                      {domainOf(p.url)} ↗<span className="sr-only"> (nouvel onglet)</span>
                    </a>
                  )}
                  <span className="small muted">{p.context ?? 'hors fil'} · {ago(p.created_at)}</span>
                  <div className="row">
                    {p.tag && <span className="chip">{p.tag}</span>}
                    <span className="spacer" />
                    <button type="button" className="iconbtn" style={{ width: 38, height: 38 }} aria-label={`Transformer en tâche : ${p.title}`} title="Transformer en tâche" onClick={() => toTask(p)}><Icon name="check" size={16} /></button>
                    <button type="button" className="iconbtn" style={{ width: 38, height: 38 }} aria-label={`Lâcher (ranger au grenier) : ${p.title}`} title="Lâcher, annulable" onClick={() => letGo(p)}><Icon name="close" size={16} /></button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {!recreEnd && items.length > 6 && (
            <button type="button" className="btn ghost small" style={{ alignSelf: 'flex-start' }} onClick={() => setAllExplore(!allExplore)}>
              {allExplore ? 'Voir moins' : `Tout voir (${items.length})`}
            </button>
          )}
        </section>
      )}

      {view === 'notes' && pureNotes.length > 0 && (
        <section className="stack" aria-label="Notes" style={{ gap: 10, flex: '1 1 auto' }}>
          {pureNotes.length > 6 && (
            <input type="search" className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Chercher dans tes notes…" aria-label="Chercher dans tes notes" />
          )}
          {foundNotes.length === 0 && <p className="muted" style={{ margin: 0 }}>Aucune note ne contient « {search} ».</p>}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, background: 'var(--blanc)', border: '1.5px solid var(--trait)', borderRadius: 20 }}>
            {foundNotes.map((t, i) => {
              const at = parseStamp(t.created_at);
              return (
                <li key={t.id} className="row" style={{ alignItems: 'flex-start', gap: 12, padding: '12px 12px 12px 16px', borderTop: i ? '1px solid var(--trait-doux)' : 'none' }}>
                  <div className="stack spacer" style={{ gap: 2, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, overflowWrap: 'anywhere' }}>{t.text}</p>
                    <span className="small muted">{ymd(at) === ymd(ref) ? `aujourd’hui · ${hhmm(at)}` : formatDay(ymd(at), ref)}</span>
                  </div>
                  <button type="button" className="btn ghost small" onClick={() => noteToTask(t)} aria-label={`En faire une tâche : ${t.text.slice(0, 60)}`}>
                    <Icon name="check" size={14} />Tâche
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {view === 'tout' && <ol className="thread" aria-label={`Conversation avec ${cat}`}>
        {loaded && thread.length === 0 && (
          <li className="msg cat">
            <Face mood={5} size={34} light={false} />
            <div className="bubble">
              {`Coucou ! Écris-moi tout ce qui te passe par la tête : un « faut que j’appelle… », une idée, un lien. Je range, tu oublies.`}
            </div>
          </li>
        )}
        {thread.map((m) => {
          const day = ymd(m.at);
          const showDay = day !== lastDay;
          lastDay = day;
          const reply = m.kind === 'panier'
            ? 'rangé dans À explorer'
            : remindersOf(m.t.id).length
              ? `je te le rappelle ce soir (${remindersOf(m.t.id).map((r) => r.label).join(', ')})`
              : 'noté';
          return (
            <li key={m.kind + (m.kind === 'panier' ? m.p.id : m.t.id)} className="msg-group">
              {showDay && <div className="day">{formatDay(day, ref)}</div>}
              <div className="msg me">
                <div className="bubble">
                  {m.kind === 'thought'
                    ? <Highlight text={m.t.text} marks={parseThought(m.t.text, new Date(m.at.getFullYear(), m.at.getMonth(), m.at.getDate())).marks} />
                    : <>
                        {m.p.image_url && <img src={m.p.image_url} alt={m.p.title} />}
                        <span>{m.p.body || m.p.title}</span>
                        {m.p.url && <a href={m.p.url} target="_blank" rel="noopener noreferrer" onClick={() => open(m.p)}>{domainOf(m.p.url)} ↗</a>}
                      </>}
                  <span className="time">{hhmm(m.at)}</span>
                </div>
              </div>
              <div className="msg cat">
                <Face mood={4} size={28} light={false} />
                <div className="bubble reply">{reply.charAt(0).toUpperCase() + reply.slice(1)}</div>
              </div>
            </li>
          );
        })}
      </ol>}

      <form className="composer" onSubmit={submit}>
        {place && <span className="small muted composer-hint" aria-live="polite">→ {PLACE_LABEL[place]}</span>}
        <div className="composer-row">
          <label htmlFor="boite-depot" className="sr-only">{`Écrire à ${cat}`}</label>
          <textarea id="boite-depot" value={draft} rows={1}
            onChange={(e) => {
              setDraft(e.target.value);
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = `${Math.min(el.scrollHeight, window.innerHeight * 0.45)}px`;
            }}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e); }}
            placeholder={`Écris à ${cat}…`} />
          <button type="submit" className="send" disabled={busy || !draft.trim()} aria-label="Envoyer" title="Envoyer (⌘ Entrée)">
            <Icon name="arrow" size={20} color="#F6F2FF" stroke={2.4} />
          </button>
        </div>
      </form>
    </main>
  );
}
