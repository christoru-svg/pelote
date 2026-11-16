import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { firebaseConfig, isConfigured } from './firebase-config';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Cache local persistant : l'app marche hors ligne et se resynchronise toute seule.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
export const storage = getStorage(app);
export { isConfigured };

let current: User | null = null;
const ready = new Promise<void>((resolve) => {
  onAuthStateChanged(auth, (u) => { current = u; resolve(); });
});

/** L'utilisateur connecté (attend la première réponse de Firebase Auth). */
export async function currentUser(): Promise<User> {
  await ready;
  if (!current) throw Object.assign(new Error('non connecté'), { status: 401 });
  return current;
}

export const signInWithGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());
export const logout = () => signOut(auth);
export const watchUser = (fn: (u: User | null) => void) => onAuthStateChanged(auth, fn);
