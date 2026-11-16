import { useEffect, useMemo, useState } from 'react';
import { PLACE_LABEL, classify } from '../lib/depot';
import { today } from '../lib/dates';
import { parseThought } from '../lib/parse';
import { IMAGES_ENABLED } from '../firebase-config';
import { useApp } from '../store';
import { Dialog } from './Dialog';
import { Highlight } from './Highlight';
import { Icon } from './Icon';
import { useDeposit } from './useDeposit';

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

/** La feuille « Dépose ici » : un seul champ, Pelote range tout seul. */
export function CaptureSheet() {
  const { capture, closeCapture, me } = useApp();
  const send = useDeposit();
  const [text, setText] = useState(capture?.text ?? (capture?.url ? capture.url : ''));
  const [image, setImage] = useState<File | null>(capture?.image ?? null);
  const [busy, setBusy] = useState(false);
  const ref = today();

  const preview = useMemo(() => (image ? URL.createObjectURL(image) : null), [image]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const ready = !!text.trim() || !!image;
  const place = ready ? classify(text, ref, !!image) : null;
  const marks = text.trim() ? parseThought(text, ref).marks : [];

  async function submit() {
    if (!ready) return;
    setBusy(true);
    const ok = await send(text, image);
    setBusy(false);
    if (ok) closeCapture();
  }

  return (
    <Dialog onClose={closeCapture} labelledBy="capture-titre">
      <div>
        <h2 id="capture-titre" style={{ fontSize: 28, fontWeight: 800 }}>Dépose ici</h2>
        <p className="lede" style={{ marginTop: 2 }}>Ce qui te passe par la tête, un lien, une image : {me?.cat_name ?? 'Pilou'} range.</p>
      </div>
      <div className="field">
        <label htmlFor="capture-texte" className="sr-only">Ce que tu déposes</label>
        <textarea id="capture-texte" className="input" rows={3} value={text}
          placeholder="« appeler Léa jeudi », un lien, une idée…"
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            const file = [...e.clipboardData.files].find((f) => f.type.startsWith('image/'));
            if (file && IMAGES_ENABLED) { e.preventDefault(); setImage(file); }
          }}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }} />
      </div>

      {preview && (
        <div style={{ position: 'relative' }}>
          <img src={preview} alt="Image à déposer" style={{ width: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 16, background: 'var(--blanc)' }} />
          <button type="button" className="iconbtn" aria-label="Retirer l’image" onClick={() => setImage(null)} style={{ position: 'absolute', top: 8, right: 8 }}><Icon name="close" /></button>
        </div>
      )}

      <div className="row wrap small" aria-live="polite" style={{ minHeight: 24 }}>
        {place ? (
          <>
            {text.trim() && <span style={{ overflowWrap: 'anywhere' }}><Highlight text={text} marks={marks} /></span>}
            <span className="muted">→</span>
            <span className="chip" style={{ background: place === 'soir' ? 'var(--beurre-pale)' : place === 'explorer' ? 'var(--coussinet-pale)' : 'var(--lavande-pale)' }}>{PLACE_LABEL[place]}</span>
          </>
        ) : (
          <span className="muted">Pour coller : <span className="desk-only">⌘V dans le champ</span><span className="mob-only">appui long dans le champ, puis « Coller »</span>.</span>
        )}
      </div>

      <div className="row wrap">
        {IMAGES_ENABLED && (<>
        <label className="btn ghost small" style={{ cursor: 'pointer' }}>
          <Icon name="photo" size={16} />Image
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
        </label>
        <button type="button" className="btn ghost small desk-only" onClick={async () => {
          try { const f = await grabScreen(); if (f) setImage(f); } catch { /* annulé */ }
        }}><Icon name="ecran" size={16} />Écran</button>
        </>)}
        <span className="spacer" />
        <div className="actions">
          <button type="button" className="btn" onClick={closeCapture}>Annuler</button>
          <button type="button" className="btn primary" disabled={busy || !ready} onClick={submit}>Déposer</button>
        </div>
      </div>
    </Dialog>
  );
}
