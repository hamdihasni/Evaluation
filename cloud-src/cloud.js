// Couche cloud : Firebase Authentication + Cloud Firestore (avec cache hors-ligne)
import { initializeApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, sendPasswordResetEmail
} from 'firebase/auth';
import {
  initializeFirestore, persistentLocalCache, doc, getDoc, getDocFromCache, setDoc,
  onSnapshot, runTransaction
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

// Écoute en temps réel : le PC et le téléphone se mettent à jour dès que l'un des deux enregistre.
export function listen(uid, cb, onErr) {
  return onSnapshot(doc(db, 'dossiers', uid),
    snap => { if (snap.metadata.hasPendingWrites) return; cb(snap.exists() ? snap.data() : null, snap.metadata.fromCache); },
    e => { if (onErr) onErr(e); });
}
// Synchronisation sûre : lecture + fusion + écriture dans UNE transaction, pour ne jamais écraser
// les modifications faites entre-temps depuis un autre appareil. mergeFn(remote) doit renvoyer
// { write, json, updatedAt, ... } ; l'objet est renvoyé tel quel à l'appelant.
export async function sync(uid, mergeFn, device) {
  const ref = doc(db, 'dossiers', uid);
  return runTransaction(db, async tx => {
    const s = await tx.get(ref);
    const res = mergeFn(s.exists() ? s.data() : null);
    if (res && res.write) tx.set(ref, { data: res.json, updatedAt: res.updatedAt, schema: 2, by: device || '' });
    return res;
  });
}
