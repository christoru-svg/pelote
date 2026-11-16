import { useEffect, useMemo, useState } from 'react';
import { api, type PanierItem } from '../api';
import { Face } from '../components/Cat';
import { Icon } from '../components/Icon';
import { autotag, domainOf, URL_RE } from '../lib/autotag';
import { parseStamp } from '../lib/dates';
import { useApp } from '../store';

const DAY = 86400000;
const RECRE_MIN = 20;

function ago(s: string) {
  const d = Math.floor((Date.now() - parseStamp(s).getTime()) / DAY);
  if (d <= 0) return "aujourd'hui";
  if (d === 1) return 'hier';
  return `il y a ${d} j`;
}

export function Panier() {
  const { me, fil, openCapture, version, setPanierCount, notify, fail, recreEnd, setRecreEnd } = useApp();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<PanierItem[]>([]);
  const [filter, setFilter] = useState<string>('Tout');
  const [, tick] = useState(0);

  useEffect(() => {
    api.panier().then(async (list) => {
      // « Ça s'effiloche » : jamais ouvert en 30 jours → archivé en douceur.
      const old = list.filter((p) => !p.opened_at && Date.now() - parseStamp(p.created_at).getTime() > 30 * DAY);
      await Promise.all(old.map((p) => api.updatePanier(p.id, { archived: 1 })));
      const kept = list.filter((p) => !old.includes(p));
      setItems(kept);
      setPanierCount(kept.length);
      if (old.length) notify(`${old.length} trouvaille${old.length > 1 ? 's' : ''} rangée${old.length > 1 ? 's' : ''} au grenier`, 'Pas ouvertes depuis 30 jours. Rien n’est perdu, c’est dans ton export.');
    }).catch(() => {});
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!recreEnd) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [recreEnd]);

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((p) => p.tag && counts.set(p.tag, (counts.get(p.tag) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);
  const stale = items.filter((p) => !p.opened_at && Date.now() - parseStamp(p.created_at).getTime() > 21 * DAY);

  let shown = filter === 'Tout' ? items : filter === '__stale' ? stale : items.filter((p) => p.tag === filter);
  if (recreEnd) shown = [...items].filter((p) => !p.opened_at).sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(0, 6);

  async function open(p: PanierItem) {
    if (!p.opened_at) {
      const opened_at = new Date().toISOString();
      setItems((xs) => xs.map((x) => (x.id === p.id ? { ...x, opened_at } : x)));
      api.updatePanier(p.id, { opened_at }).catch(() => {});
    }
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
  /** « Lâcher » range au grenier (archive) : rien n'est effacé, et c'est annulable. */
  async function letGo(p: PanierItem) {
    setItems((xs) => xs.filter((x) => x.id !== p.id));
    setPanierCount(items.length - 1);
    try { await api.updatePanier(p.id, { archived: 1 }); } catch {
      setItems((xs) => [p, ...xs]); setPanierCount(items.length); fail('La trouvaille n’a pas été lâchée'); return;
    }
    notify('Lâché, rangé au grenier', 'Rien n’est effacé : c’est dans ton export.', {
      action: {
        label: 'Annuler',
        run: () => {
          api.updatePanier(p.id, { archived: 0 }).then(() => {
            setItems((xs) => [p, ...xs].sort((a, b) => b.created_at.localeCompare(a.created_at)));
            setPanierCount(items.length);
          }).catch(() => fail());
        },
      },
    });
  }

  async function deposit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const url = text.match(URL_RE)?.[0] ?? null;
    const body = text.replace(URL_RE, '').trim();
    setBusy(true);
    try {
      const item = await api.addPanier({
        title: (body || url || text).split('\n')[0].slice(0, 120), body: body || null, url,
        tag: autotag(text, url), context: fil ? `pendant ${fil.title}` : 'hors fil',
      });
      setItems((xs) => [item, ...xs]);
      setPanierCount(items.length + 1);
      setDraft('');
      notify('Hop, dans le Panier', fil ? `Retour au fil : ${fil.title}` : undefined);
    } catch { fail('La trouvaille n’a pas été déposée'); } finally { setBusy(false); }
  }

  const left = recreEnd ? Math.max(0, recreEnd - Date.now()) : 0;

  return (
    <main className="page">
      <div className="cols" style={{ alignItems: 'stretch' }}>
        <div className="col-main" style={{ justifyContent: 'center', gap: 6 }}>
          <h1 style={{ fontSize: 'clamp(34px, 5vw, 64px)' }}>Le Panier</h1>
          <p className="lede" style={{ maxWidth: 640 }}>Tout ce qui t’a fait de l’œil. Pas maintenant : pendant la récré. Tu captures, {me?.cat_name ?? 'Pilou'} range.</p>
        </div>
        <section className="card pink col-side" aria-label="La récré">
          {recreEnd ? (
            <>
              <span className="eyebrow">Récré en cours</span>
              <div style={{ fontFamily: 'var(--titre)', fontSize: 44, fontWeight: 800 }} aria-live="off">
                {String(Math.floor(left / 60000)).padStart(2, '0')}:{String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}
              </div>
              <div className="actions"><button type="button" className="btn primary" onClick={() => setRecreEnd(null)}>Terminer la récré</button></div>
            </>
          ) : (
            <>
              <span className="eyebrow">Prochaine récré · {me?.recre}</span>
              <div style={{ fontFamily: 'var(--titre)', fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>{RECRE_MIN} min pour ressortir {Math.min(6, items.filter((p) => !p.opened_at).length) || 'tes'} trouvailles, sans culpabilité.</div>
              <div className="actions">
                <button type="button" className="btn desk-only" onClick={() => openCapture({ kind: 'panier' })}>Capture</button>
                <button type="button" className="btn primary" disabled={!items.length} onClick={() => setRecreEnd(Date.now() + RECRE_MIN * 60000)}>Ouvrir maintenant</button>
              </div>
            </>
          )}
        </section>
      </div>

      {!recreEnd && (
        <form className="bigbar" onSubmit={deposit}>
          <label htmlFor="panier-depot" className="sr-only">Déposer dans le Panier</label>
          <input id="panier-depot" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Colle un lien ou note une trouvaille…" autoComplete="off" />
          <button type="submit" className="btn primary" disabled={busy || !draft.trim()}>Déposer</button>
        </form>
      )}

      {!recreEnd && (
        <div className="filters" role="group" aria-label="Filtres">
          <button type="button" className="filter" aria-pressed={filter === 'Tout'} onClick={() => setFilter('Tout')}>Tout <span className="muted">{items.length}</span></button>
          {tags.map(([t, n]) => (
            <button key={t} type="button" className="filter" aria-pressed={filter === t} onClick={() => setFilter(t)}>{t} <span className="muted">{n}</span></button>
          ))}
          {stale.length > 0 && <button type="button" className="filter" aria-pressed={filter === '__stale'} onClick={() => setFilter('__stale')}>Pas ouvert depuis 3 sem. <span className="muted">{stale.length}</span></button>}
        </div>
      )}

      {items.length === 0 ? (
        <div className="card" style={{ alignItems: 'center', textAlign: 'center' }}>
          <Face mood={5} size={64} light={false} />
          <h2>Le Panier est vide</h2>
          <p className="muted" style={{ margin: 0 }}>Un rabbit hole qui pointe son nez ? <kbd>⌘⇧9</kbd>, colle un lien, ou le bouton +.</p>
        </div>
      ) : (
        <div className="masonry">
          {shown.map((p) => (
            <article key={p.id} className="pcard">
              {p.image_url && <img src={p.image_url} alt={p.title} loading="lazy" />}
              <div className="body">
                {p.kind === 'texte' && p.body && p.body !== p.title && <blockquote>« {p.body.length > 220 ? p.body.slice(0, 220) + '…' : p.body} »</blockquote>}
                <strong style={{ fontSize: 15, overflowWrap: 'anywhere' }}>{p.title}</strong>
                {p.url && (
                  <a href={p.url} target="_blank" rel="noopener noreferrer" onClick={() => open(p)} className="small" style={{ fontWeight: 600 }}>
                    {domainOf(p.url)} ↗<span className="sr-only"> (nouvel onglet)</span>
                  </a>
                )}
                <div className="ctx"><Icon name="fil" size={14} /><span>{p.context ?? 'hors fil'} · {ago(p.created_at)}</span></div>
                {p.why && <div className="pilou" style={{ fontSize: 21 }}>{p.why}</div>}
                <div className="row">
                  {p.tag && <span className="chip">{p.tag}</span>}
                  {!p.opened_at && <span className="chip" style={{ background: 'var(--beurre-pale)' }}>pas ouvert</span>}
                  <span className="spacer" />
                  <button type="button" className="iconbtn" style={{ width: 38, height: 38 }} aria-label={`Transformer en tâche : ${p.title}`} title="Transformer en tâche" onClick={() => toTask(p)}><Icon name="check" size={16} /></button>
                  <button type="button" className="iconbtn" style={{ width: 38, height: 38 }} aria-label={`Lâcher (ranger au grenier) : ${p.title}`} title="Lâcher : ranger au grenier, annulable" onClick={() => letGo(p)}><Icon name="close" size={16} /></button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
