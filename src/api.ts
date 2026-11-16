// Accès aux données de Pelote, sur Firebase.
// Tout est rangé sous users/{uid}/… (voir firestore.rules). Les pages n'ont pas à
// connaître Firebase : elles utilisent seulement l'objet `api` ci-dessous.
import {
  collection, deleteDoc, doc, getCountFromServer, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { currentUser, db, storage } from './firebase';

export type Me = {
  email: string; cat_name: string; cat_coat: string; checkin: string; recre: string; soir: string;
  onboarded: number; created_at: string; fil: Fil | null;
};
export type Fil = { task_id: string | null; title: string; started_at: string };
export type Task = {
  id: string; title: string; due_date: string | null; due_time: string | null; minutes: number | null;
  tag: string | null; important: number; done: number; done_at: string | null;
  where_note: string | null; next_note: string | null; created_at: string;
};
export type Thought = { id: string; text: string; context: string | null; created_at: string };
export type Reminder = {
  id: string; thought_id: string | null; label: string; due_date: string | null; due_time: string | null;
  status: 'soir' | 'fait' | 'demain'; remind_on: string; created_at: string;
};
export type PanierItem = {
  id: string; kind: 'texte' | 'lien' | 'image'; title: string; body: string | null; url: string | null;
  image_path: string | null; image_url: string | null; tag: string | null; why: string | null; context: string | null;
  opened_at: string | null; archived: number; created_at: string;
};
export type State = { id: string; mood: number | null; energy: number | null; note: string | null; created_at: string };
export type Stats = { done: number; panier: number; knots: number; thoughts: number; since: string };

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID();

async function home() {
  const u = await currentUser();
  return { u, me: doc(db, 'users', u.uid), col: (name: string) => collection(db, 'users', u.uid, name) };
}

async function list<T>(name: string, ...filters: ReturnType<typeof where>[]): Promise<T[]> {
  const { col } = await home();
  const snap = await getDocs(filters.length ? query(col(name), ...filters) : col(name));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
}

async function add<T extends { id: string }>(name: string, data: Omit<T, 'id'>): Promise<T> {
  const { col } = await home();
  const id = newId();
  await setDoc(doc(col(name), id), data);
  return { id, ...data } as T;
}

async function patch(name: string, id: string, data: Record<string, any>) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { col } = await home();
  await updateDoc(doc(col(name), id), data);
}

const byCreated = <T extends { created_at: string }>(xs: T[], desc = false) =>
  xs.sort((a, b) => (desc ? b.created_at.localeCompare(a.created_at) : a.created_at.localeCompare(b.created_at)));

/** "since" peut être une date (YYYY-MM-DD) ou un ISO complet : on compare des ISO. */
const isoSince = (s: string) => (s.length === 10 ? new Date(s + 'T00:00:00').toISOString() : s);

const DEFAULT_ME = { cat_name: 'Pilou', cat_coat: 'tuxedo', checkin: '09:00', recre: '17:30', soir: '18:00', onboarded: 0, fil: null };

export const api = {
  async me(): Promise<Me> {
    const { u, me } = await home();
    const snap = await getDoc(me);
    if (!snap.exists()) {
      const fresh = { ...DEFAULT_ME, email: u.email ?? '', created_at: now() };
      await setDoc(me, fresh);
      return fresh;
    }
    return { ...DEFAULT_ME, ...snap.data(), email: u.email ?? '' } as Me;
  },
  async updateMe(p: Partial<Me>): Promise<Me> {
    const { me } = await home();
    const allowed = ['cat_name', 'cat_coat', 'checkin', 'recre', 'soir', 'onboarded'] as const;
    const clean = Object.fromEntries(Object.entries(p).filter(([k]) => (allowed as readonly string[]).includes(k)));
    await setDoc(me, clean, { merge: true });
    return api.me();
  },
  async stats(): Promise<Stats> {
    const { col } = await home();
    const count = async (name: string, ...f: ReturnType<typeof where>[]) =>
      (await getCountFromServer(f.length ? query(col(name), ...f) : col(name))).data().count;
    const me = await api.me();
    return {
      done: await count('tasks', where('done', '==', 1)),
      panier: await count('panier', where('archived', '==', 0)),
      knots: await count('knots'),
      thoughts: await count('thoughts'),
      since: me.created_at,
    };
  },

  // Tâches ---------------------------------------------------------------
  async tasks(doneSince: string): Promise<Task[]> {
    const [open, doneRecently] = await Promise.all([
      list<Task>('tasks', where('done', '==', 0)),
      list<Task>('tasks', where('done_at', '>=', isoSince(doneSince))),
    ]);
    const all = [...open, ...doneRecently.filter((t) => t.done)];
    return all.sort((a, b) => a.done - b.done
      || (a.due_date ?? '0000').localeCompare(b.due_date ?? '0000')
      || (a.due_time ?? '').localeCompare(b.due_time ?? '')
      || a.created_at.localeCompare(b.created_at));
  },
  addTask: (t: Partial<Task> & { title: string }) => add<Task>('tasks', {
    title: t.title.slice(0, 300), due_date: t.due_date ?? null, due_time: t.due_time ?? null, minutes: t.minutes ?? null,
    tag: t.tag ?? null, important: t.important ? 1 : 0, done: 0, done_at: null, where_note: null, next_note: null, created_at: now(),
  }),
  async updateTask(id: string, p: Partial<Task>): Promise<Task> {
    const data: Record<string, unknown> = { ...p };
    delete data.id;
    if ('done' in p) data.done_at = p.done ? now() : null;
    await patch('tasks', id, data);
    const { col } = await home();
    const snap = await getDoc(doc(col('tasks'), id));
    return { id, ...snap.data() } as Task;
  },
  async deleteTask(id: string) {
    const { col } = await home();
    await deleteDoc(doc(col('tasks'), id));
    return { ok: true as const };
  },

  // Le Fil et le Nœud ---------------------------------------------------------
  async setFil(f: { task_id?: string | null; title: string; knot?: { where?: string; next?: string } }): Promise<Fil> {
    const { me, col } = await home();
    const prev = (await getDoc(me)).data()?.fil as Fil | null | undefined;
    const fil: Fil = { task_id: f.task_id ?? null, title: f.title, started_at: now() };
    const batch = writeBatch(db);
    if (prev && f.knot) {
      batch.set(doc(col('knots'), newId()), {
        from_title: prev.title, to_title: f.title, where_note: f.knot.where ?? null, next_note: f.knot.next ?? null, created_at: now(),
      });
      if (prev.task_id) {
        batch.update(doc(col('tasks'), prev.task_id), { where_note: f.knot.where ?? null, next_note: f.knot.next ?? null });
      }
    }
    batch.set(me, { fil }, { merge: true });
    await batch.commit();
    return fil;
  },
  async clearFil() {
    const { me } = await home();
    await setDoc(me, { fil: null }, { merge: true });
    return { ok: true as const };
  },

  // Pensées et rappels -----------------------------------------------------------
  async thoughts(since: string) {
    const s = isoSince(since);
    const [thoughts, reminders] = await Promise.all([
      list<Thought>('thoughts', where('created_at', '>=', s)),
      list<Reminder>('reminders', where('created_at', '>=', s)),
    ]);
    return { thoughts: byCreated(thoughts, true).slice(0, 200), reminders };
  },
  async addThought(t: {
    text: string; context?: string; ideas: string[];
    reminders: Array<{ label: string; due_date: string | null; due_time: string | null; remind_on: string }>;
  }) {
    const { col } = await home();
    const tid = newId();
    const batch = writeBatch(db);
    batch.set(doc(col('thoughts'), tid), { text: t.text.slice(0, 4000), context: t.context ?? null, created_at: now() });
    for (const r of t.reminders) {
      batch.set(doc(col('reminders'), newId()), {
        thought_id: tid, label: r.label.slice(0, 200), due_date: r.due_date, due_time: r.due_time, status: 'soir', remind_on: r.remind_on, created_at: now(),
      });
    }
    for (const idea of t.ideas) {
      batch.set(doc(col('panier'), newId()), {
        kind: 'texte', title: idea.slice(0, 200), body: idea, url: null, image_path: null, image_url: null, tag: 'Idées', why: null,
        context: t.context ? `pendant ${t.context}` : 'depuis Pensées', opened_at: null, archived: 0, created_at: now(),
      });
    }
    await batch.commit();
    return { id: tid };
  },
  /** Supprime une pensée et ses rappels (utilisé pour la reclasser). */
  async deleteThought(id: string) {
    const { col } = await home();
    const rs = await getDocs(query(col('reminders'), where('thought_id', '==', id)));
    const batch = writeBatch(db);
    rs.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(col('thoughts'), id));
    await batch.commit();
  },
  async reminders(day: string): Promise<Reminder[]> {
    const rs = await list<Reminder>('reminders', where('remind_on', '<=', day));
    return byCreated(rs.filter((r) => r.status !== 'fait'));
  },
  updateReminder: (id: string, p: { status: Reminder['status']; remind_on?: string }) => patch('reminders', id, p),

  // Le Panier -------------------------------------------------------------------
  async panier(): Promise<PanierItem[]> {
    return byCreated(await list<PanierItem>('panier', where('archived', '==', 0)), true);
  },
  /** Accepte un FormData (title, body, url, tag, why, context, image) ou un objet simple. */
  async addPanier(data: FormData | Partial<PanierItem>): Promise<PanierItem> {
    const { u } = await home();
    const get = (k: string) => (data instanceof FormData ? (data.get(k) as string | null) : ((data as Record<string, unknown>)[k] as string | null)) || null;
    const file = data instanceof FormData ? (data.get('image') as File | null) : null;
    const id = newId();
    let image_path: string | null = null;
    let image_url: string | null = null;
    if (file && typeof file !== 'string' && file.size) {
      if (file.size > 10 * 1024 * 1024) throw new ApiError(413, 'Image trop lourde (10 Mo max)');
      if (!file.type.startsWith('image/')) throw new ApiError(415, 'Seules les images sont acceptées');
      image_path = `users/${u.uid}/panier/${id}`;
      const r = storageRef(storage, image_path);
      await uploadBytes(r, file, { contentType: file.type });
      image_url = await getDownloadURL(r);
    }
    const url = get('url'), body = get('body');
    const item: Omit<PanierItem, 'id'> = {
      kind: image_path ? 'image' : url ? 'lien' : 'texte',
      title: (get('title') || url || (body || '').slice(0, 80) || 'Capture').slice(0, 200),
      body, url, image_path, image_url, tag: get('tag'), why: get('why'), context: get('context'),
      opened_at: null, archived: 0, created_at: now(),
    };
    const { col } = await home();
    await setDoc(doc(col('panier'), id), item);
    return { id, ...item };
  },
  updatePanier: (id: string, p: Partial<PanierItem>) => {
    const data: Record<string, unknown> = { ...p };
    delete data.id;
    return patch('panier', id, data);
  },
  async deletePanier(id: string) {
    const { col } = await home();
    const snap = await getDoc(doc(col('panier'), id));
    const path = snap.data()?.image_path as string | undefined;
    if (path) await deleteObject(storageRef(storage, path)).catch(() => {});
    await deleteDoc(doc(col('panier'), id));
  },

  // Humeur et énergie --------------------------------------------------------------
  async states(since: string): Promise<State[]> {
    return byCreated(await list<State>('states', where('created_at', '>=', isoSince(since))));
  },
  async addState(s: { mood?: number | null; energy?: number | null; note?: string }): Promise<State> {
    const mood = s.mood && s.mood >= 1 && s.mood <= 5 ? s.mood : null;
    const energy = s.energy && s.energy >= 1 && s.energy <= 3 ? s.energy : null;
    if (!mood && !energy) throw new ApiError(400, 'Humeur ou énergie requise');
    return add<State>('states', { mood, energy, note: s.note?.slice(0, 300) ?? null, created_at: now() });
  },

  // Export de toutes tes données --------------------------------------------------------
  async exportAll() {
    const names = ['tasks', 'thoughts', 'reminders', 'panier', 'states', 'knots'];
    const out: Record<string, unknown> = { user: await api.me() };
    for (const n of names) out[n] = await list(n);
    return out;
  },
};
