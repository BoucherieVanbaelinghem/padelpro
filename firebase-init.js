'use strict';

/* ═══════════════════════════════════════════════════════════════
   FIREBASE INIT — Bootstrap Firebase (script classique, SDK "compat")

   Version simplifiée : utilise le SDK Firebase "compat" (chargé en
   <script> classique dans index.html, PAS en type="module") pour que
   l'app fonctionne en double-cliquant directement sur index.html,
   sans serveur local — les navigateurs bloquent les scripts "module"
   sur les pages ouvertes en file://, mais pas les scripts classiques.

   Authentification anonyme : chaque appareil obtient une identité unique
   sans écran de connexion, pour satisfaire les règles Firestore
   (firestore.rules) qui exigent d'être authentifié — la base n'est donc
   pas ouverte publiquement, contrairement à Commandes Vanba.

   Ce fichier expose aussi un petit adaptateur qui imite l'API
   "modulaire" (v9+) utilisée par storage.js, pour ne pas avoir à le
   réécrire.
   ═══════════════════════════════════════════════════════════════ */

// Config du projet Firebase "padelpro-cfb4f".
const firebaseConfig = {
  apiKey: "AIzaSyDfVUG-da9JZkk8sDGVH4nW6ZvGlfePKw8",
  authDomain: "padelpro-cfb4f.firebaseapp.com",
  projectId: "padelpro-cfb4f",
  storageBucket: "padelpro-cfb4f.firebasestorage.app",
  messagingSenderId: "490738314817",
  appId: "1:490738314817:web:7197af702b03d1af8f60c0"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// ── Normalisation d'un DocumentSnapshot "compat" vers l'API modulaire ──
// (en compat, `exists` est une propriété booléenne ; en modulaire, une
// méthode `exists()`. On uniformise pour que storage.js n'ait pas à le
// savoir.)
const _wrapDocSnap = (raw) => ({ id: raw.id, exists: () => raw.exists, data: () => raw.data() });
const _wrapQuerySnap = (raw) => ({
  docs: raw.docs.map(_wrapDocSnap),
  forEach: (fn) => raw.forEach(d => fn(_wrapDocSnap(d)))
});

// ── Petit adaptateur imitant l'API modulaire Firestore v9+ ─────────
const collection = (db, name) => db.collection(name);
const doc = (db, colName, id) => db.collection(colName).doc(id);
const getDoc = (ref) => ref.get().then(_wrapDocSnap);
const getDocs = (ref) => ref.get().then(_wrapQuerySnap);
const setDoc = (ref, data) => ref.set(data);
const updateDoc = (ref, data) => ref.update(data);
const deleteDoc = (ref) => ref.delete();
const onSnapshot = (ref, cb, errCb) => ref.onSnapshot(
  (raw) => cb(typeof raw.forEach === 'function' && Array.isArray(raw.docs) ? _wrapQuerySnap(raw) : _wrapDocSnap(raw)),
  errCb
);
// query(ref, ...constraints) : chaque contrainte est une fonction (ref => ref modifiée)
const query = (ref, ...constraints) => constraints.reduce((acc, c) => c(acc), ref);
const orderBy = (field, dir) => (ref) => ref.orderBy(field, dir);
const limit = (n) => (ref) => ref.limit(n);
const serverTimestamp = () => firebase.firestore.FieldValue.serverTimestamp();
const writeBatch = (db) => db.batch(); // même API que la version modulaire (set/delete/update/commit)

// Pont exposé au reste de l'app (scripts classiques : storage.js, app.js…)
window.FirebaseSvc = {
  db, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, limit, serverTimestamp, writeBatch,
  auth,
  ready: false,
  authError: null
};

auth.signInAnonymously().catch((err) => {
  console.error('Firebase — échec de l\'authentification anonyme :', err);
  window.FirebaseSvc.authError = err;
  window.dispatchEvent(new CustomEvent('firebase:error', { detail: err }));
});

auth.onAuthStateChanged((user) => {
  if (user && !window.FirebaseSvc.ready) {
    window.FirebaseSvc.ready = true;
    window.dispatchEvent(new CustomEvent('firebase:ready'));
  }
});
