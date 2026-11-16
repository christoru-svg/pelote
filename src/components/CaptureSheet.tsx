import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { autotag, URL_RE } from '../lib/autotag';
import { today, ymd } from '../lib/dates';
import { parseTask, parseThought } from '../lib/parse';
import { useApp, type CaptureKind } from '../store';
import { Dialog } from './Dialog';
import { Highlight } from './Highlight';
import { Icon } from './Icon';

const KINDS: Array<{ id: CaptureKind; label: string; icon: 'check' | 'pensee' | 'panier' }> = [
  { id: 'tache', label: 'Tâche', icon: 'check' },
  { id: 'pensee', label: 'Pensée', icon: 'pensee' },
  { id: 'panier', label: 'Panier', icon: 'panier' },
];

/** Capture une frame de l'écran (le navigateur demande quelle fenêtre partager). */
async function grabScreen(): Promise<File | null> {
  if (!navigator.mediaDevices?.getDisplayMedia) return null;
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  try {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    await new Promise((r) => setTimeout(r, 250));
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
    return blob ? new File([blob], 'capture.png', { type: 'image/png' }) : null;
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

export function CaptureSheet() {
  const { capture, closeCapture, fil, notify, bump, setPanierCount, panierCount } = useApp();
  const [kind, setKind] = useState<CaptureKind>(capture?.kind ?? 'panier');
  const [text, setText] = useState(capture?.text ?? (capture?.url ? capture.url : ''));
  const [image, setImage] = useState<File | null>(capture?.image ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ref = today();

  const preview = useMemo(() => (image ? URL.createObjectURL(image) : null), [image]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const task = kind === 'tache' && text ? parseTask(text, ref) : null;
  const thought = kind === 'pensee' && text ? parseThought(text, ref) : null;
  const url = text.match(URL_RE)?.[0] ?? null;
  const tag = kind === 'panier' ? autotag(text, url) : null;

  async function submit() {
    if (!text.trim() && !image) return;
    setBusy(true);
    setErr(null);
    try {
      if (kind === 'tache' && task) {
        await api.addTask({ title: task.title, due_date: task.due_date, due_time: task.due_time, minutes: task.minutes, tag: task.tag, important: task.important ? 1 : 0 });
        notify('Sujet ajouté', 'Pilou l’a rangé au bon endroit.');
      } else if (kind === 'pensee' && thought) {
        await api.addThought({
          text, context: fil?.title, ideas: thought.ideas,
          reminders: thought.actions.map((a) => ({ ...a, remind_on: ymd(ref) })),
        });
        const n = thought.actions.length;
        notify('Pensée déposée', n ? `${n} rappel${n > 1 ? 's' : ''} pour ce soir.` : 'Ta tête a moins à porter.');
      } else {
        const form = new FormData();
        const body = text.replace(URL_RE, '').trim();
        if (capture?.title) form.set('title', capture.title);
        else if (body) form.set('title', body.split('\n')[0].slice(0, 120));
        if (body) form.set('body', body);
        if (url) form.set('url', url);
        if (tag) form.set('tag', tag);
        form.set('context', fil ? `pendant ${fil.title}` : 'hors fil');
        if (image) form.set('image', image);
        await api.addPanier(form);
        setPanierCount(panierCount + 1);
        notify('Hop, dans le Panier', fil ? `Retour au fil : ${fil.title}` : undefined);
      }
      bump();
      closeCapture();
    } catch (e) {
      setErr((e as Error).message || 'Ça n’a pas marché, réessaie.');
    } finally {
      setBusy(false);
    }
  }

  const placeholder = kind === 'tache' ? 'Ex. Kick-off app mobile lundi 10h #équipe 1h'
    : kind === 'pensee' ? 'Vide ta tête… « appeler Léa », « jeudi 14h », « idée : … »'
    : 'Colle un lien, un texte, ou ajoute une image';

  return (
    <Dialog onClose={closeCapture} labelledBy="capture-titre">
      <h2 id="capture-titre" style={{ fontSize: 28, fontWeight: 800 }}>Dépose ici</h2>
      <div className="seg" role="radiogroup" aria-label="Type" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {KINDS.map((k) => (
          <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} onClick={() => setKind(k.id)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Icon name={k.icon} size={16} />{k.label}
          </button>
        ))}
      </div>
      <div className="field">
        <label htmlFor="capture-texte">
          {kind === 'tache' ? 'Le sujet (une date ou une heure dans le titre suffit)' : kind === 'pensee' ? 'Ta pensée' : 'Qu’est-ce que tu gardes pour plus tard ?'}
        </label>
        <textarea id="capture-texte" className="input" rows={3} value={text} placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            const file = [...e.clipboardData.files].find((f) => f.type.startsWith('image/'));
            if (file) { e.preventDefault(); setImage(file); if (kind !== 'panier') setKind('panier'); }
          }}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }} />
        {kind === 'panier' && <span className="small muted">Pour coller : <span className="desk-only">⌘V dans le champ</span><span className="mob-only">appui long dans le champ, puis « Coller »</span>.</span>}
      </div>

      {task && (
        <p className="small muted" style={{ margin: 0 }} aria-live="polite">
          <Highlight text={text} marks={task.marks} />
        </p>
      )}
      {thought && (thought.actions.length > 0 || thought.ideas.length > 0) && (
        <div className="row wrap small" aria-live="polite">
          {thought.actions.map((a, i) => <span key={i} className="chip" style={{ background: 'var(--beurre-pale)' }}>Rappel ce soir : {a.label}</span>)}
          {thought.ideas.map((x, i) => <span key={i} className="chip" style={{ background: 'var(--coussinet-pale)' }}>Idée → Panier</span>)}
        </div>
      )}

      {kind === 'panier' && (
        <>
          {preview && (
            <div style={{ position: 'relative' }}>
              <img src={preview} alt="Image à déposer" style={{ width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 16, background: 'var(--blanc)' }} />
              <button type="button" className="iconbtn" aria-label="Retirer l’image" onClick={() => setImage(null)} style={{ position: 'absolute', top: 8, right: 8 }}><Icon name="close" /></button>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
            <label className="btn ghost" style={{ cursor: 'pointer' }}>
              <Icon name="photo" />Image
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
            </label>
            <button type="button" className="btn ghost desk-only" onClick={async () => {
              try { const f = await grabScreen(); if (f) setImage(f); } catch { /* annulé */ }
            }}><Icon name="ecran" />Écran</button>
          </div>
          {tag && <div className="row small"><span className="muted">Pilou range dans</span><span className="chip">{tag}</span></div>}
        </>
      )}

      {err && <p role="alert" style={{ margin: 0, color: '#8A1F45', fontWeight: 600 }}>{err}</p>}
      <div className="actions">
        <button type="button" className="btn" onClick={closeCapture}>Annuler</button>
        <button type="button" className="btn primary" disabled={busy || (!text.trim() && !image)} onClick={submit}>
          {kind === 'tache' ? 'Ajouter' : kind === 'pensee' ? 'Déposer' : 'Dans le Panier'}
        </button>
      </div>
      <span className="pilou" style={{ textAlign: 'center' }}><span className="desk-only">⌘ Entrée pour valider, </span>et hop, tu retournes à ton fil</span>
    </Dialog>
  );
}
