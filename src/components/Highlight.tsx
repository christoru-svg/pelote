import { segments, type Mark } from '../lib/parse';

/** Affiche un texte avec les morceaux compris par Pilou surlignés. */
export function Highlight({ text, marks }: { text: string; marks: Mark[] }) {
  return (
    <>
      {segments(text, marks).map((s, i) =>
        s.kind ? <mark key={i} className={`mark-${s.kind}`} style={{ color: s.kind === 'important' ? undefined : 'inherit' }}>{s.text}</mark> : <span key={i}>{s.text}</span>,
      )}
    </>
  );
}
