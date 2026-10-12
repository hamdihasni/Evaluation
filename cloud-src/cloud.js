// Couche cloud : Firebase Authentication + Cloud Firestore (avec cache hors-ligne)
import { initializeApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, sendPasswordResetEmail
} from 'firebase/auth';
import {
  initializeFirestore, persistentLocalCache, doc, getDoc, getDocFromCache, setDoc
} from 'firebase/firestore';
import { firebaseConfig } from './firebase-config.js';

export const available = !!firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('COLLEZ');

let auth = null, db = null;
if (available) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = initializeFirestore(app, { localCache: persistentLocalCache({}) });
}

export function onUser(cb) {
  if (!available) { cb(null); return () => {}; }
  return onAuthStateChanged(auth, u => cb(u ? { uid: u.uid, email: u.email } : null));
}
export const login = (e, p) => signInWithEmailAndPassword(auth, e, p);
export const register = (e, p) => createUserWithEmailAndPassword(auth, e, p);
export const logout = () => signOut(auth);
export const reset = e => sendPasswordResetEmail(auth, e);

// Le dossier complet est stocké sous forme de chaîne JSON dans un seul document.
export async function pull(uid) {
  const ref = doc(db, 'dossiers', uid);
  let snap;
  try { snap = await getDoc(ref); } catch (e) { snap = await getDocFromCache(ref); }
  return snap.exists() ? snap.data() : null;
}
export async function push(uid, json, updatedAt) {
  await setDoc(doc(db, 'dossiers', uid), { data: json, updatedAt, schema: 1 });
}
