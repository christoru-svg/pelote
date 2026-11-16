// Client de l'API /api. Types alignés sur migrations/0001_init.sql.

export type Me = {
  email: string; cat_name: string; cat_coat: string; checkin: string; recre: string; soir: string;
  onboarded: number; created_at: string; fil: Fil | null;
};
export type Fil = { user: string; task_id: string | null; title: string; started_at: string };
export type Task = {
  id: string; title: string; due_date: string | null; due_time: string | null; minutes: number | null;
  tag: string | null; important: number; done: number; done_at: string | null;
  where_note: string | null; next_note: string | null; created_at: string;
};
export type Thought = { id: string; text: string; created_at: string };
export type Reminder = {
  id: string; thought_id: string | null; label: string; due_date: string | null; due_time: string | null;
  status: 'soir' | 'fait' | 'demain'; remind_on: string; created_at: string;
};
export type PanierItem = {
  id: string; kind: 'texte' | 'lien' | 'image'; title: string; body: string | null; url: string | null;
  image_key: string | null; tag: string | null; why: string | null; context: string | null;
  opened_at: string | null; created_at: string;
};
export type State = { id: string; mood: number | null; energy: number | null; note: string | null; created_at: string };
export type Stats = { done: number; panier: number; knots: number; thoughts: number; since: string };

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function call<T>(method: string, path: string, data?: unknown): Promise<T> {
  const init: RequestInit = { method, headers: {} };
  if (data instanceof FormData) init.body = data;
  else if (data !== undefined) {
    init.body = JSON.stringify(data);
    (init.headers as Record<string, string>)['content-type'] = 'application/json';
  }
  const res = await fetch(path, init);
  if (!res.ok) {
    const msg = await res.json().then((b) => b.error).catch(() => res.statusText);
    throw new ApiError(res.status, msg || 'Erreur');
  }
  return res.json() as Promise<T>;
}

export const api = {
  me: () => call<Me>('GET', '/api/me'),
  updateMe: (patch: Partial<Me>) => call<Me>('PUT', '/api/me', patch),
  stats: () => call<Stats>('GET', '/api/stats'),

  tasks: (doneSince: string) => call<Task[]>('GET', `/api/tasks?doneSince=${encodeURIComponent(doneSince)}`),
  addTask: (t: Partial<Task> & { title: string }) => call<Task>('POST', '/api/tasks', t),
  updateTask: (id: string, patch: Partial<Task>) => call<Task>('PATCH', `/api/tasks/${id}`, patch),
  deleteTask: (id: string) => call<{ ok: true }>('DELETE', `/api/tasks/${id}`),

  setFil: (f: { task_id?: string | null; title: string; knot?: { where?: string; next?: string } }) => call<Fil>('PUT', '/api/fil', f),
  clearFil: () => call<{ ok: true }>('DELETE', '/api/fil'),

  thoughts: (since: string) => call<{ thoughts: Thought[]; reminders: Reminder[] }>('GET', `/api/thoughts?since=${encodeURIComponent(since)}`),
  addThought: (t: {
    text: string; context?: string; ideas: string[];
    reminders: Array<{ label: string; due_date: string | null; due_time: string | null; remind_on: string }>;
  }) => call<{ id: string }>('POST', '/api/thoughts', t),
  reminders: (day: string) => call<Reminder[]>('GET', `/api/reminders?day=${day}`),
  updateReminder: (id: string, patch: { status: Reminder['status']; remind_on?: string }) => call('PATCH', `/api/reminders/${id}`, patch),

  panier: () => call<PanierItem[]>('GET', '/api/panier'),
  addPanier: (data: FormData | Partial<PanierItem>) => call<PanierItem>('POST', '/api/panier', data),
  updatePanier: (id: string, patch: Partial<PanierItem> & { archived?: number }) => call('PATCH', `/api/panier/${id}`, patch),
  deletePanier: (id: string) => call('DELETE', `/api/panier/${id}`),

  states: (since: string) => call<State[]>('GET', `/api/states?since=${encodeURIComponent(since)}`),
  addState: (s: { mood?: number | null; energy?: number | null; note?: string }) => call<State>('POST', '/api/states', s),
};

export const imageUrl = (key: string) => `/api/files/${key}`;
