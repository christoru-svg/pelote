// Rangement automatique du Panier : un tag deviné à partir du texte et du lien.
const RULES: Array<[RegExp, string]> = [
  [/\b(typo|font|fonts\.google|typeface|police)/i, 'Typo'],
  [/\b(figma|dribbble|mobbin|behance|ui|ux|interface|composant|design system)\b/i, 'Inspi UI'],
  [/\b(ia|ai|gpt|claude|prompt|llm|agent)\b/i, 'Outils IA'],
  [/\b(chat|chaton|miaou|cat|kitten)s?\b/i, 'Chats'],
  [/\b(article|medium|substack|blog|thread|lire|newsletter)\b/i, 'À lire'],
  [/\b(youtube|vimeo|vidéo|video|podcast)\b/i, 'À regarder'],
];

export function autotag(...parts: Array<string | null | undefined>): string | null {
  const text = parts.filter(Boolean).join(' ');
  for (const [re, tag] of RULES) if (re.test(text)) return tag;
  return null;
}

export const URL_RE = /https?:\/\/[^\s<>"']+/i;

export const domainOf = (url: string) => {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
};
