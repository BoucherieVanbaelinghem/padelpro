'use strict';

// IMPORTANT : incrémenter CACHE_NAME à CHAQUE déploiement de fichiers modifiés.
// Le Service Worker sert tout en "cache-first" (voir fetch ci-dessous) : tant
// que ce nom ne change pas, le navigateur continue de servir les anciens
// fichiers mis en cache, même si les fichiers sur le serveur/disque ont été
// corrigés entre-temps — la mise à jour de index.html (ex: les paramètres
// ?v=... anti-cache) ne sert à rien tant que ce Service Worker n'est pas
// lui-même invalidé. C'est ce qui a fait réapparaître le bug de création de
// tournois fantômes malgré le correctif de storage.js : le navigateur
// continuait d'exécuter l'ancienne version en cache.
const CACHE_NAME = 'padelpro-v12-20260713e';
const ASSETS = [
  './index.html',
  './style.css?v=20260713e',
  './utils.js?v=20260713e',
  './firebase-init.js?v=20260713e',
  './storage.js?v=20260713e',
  './audit.js?v=20260713e',
  './app.js?v=20260713e',
  './dashboard.js?v=20260713e',
  './players.js?v=20260713e',
  './settings.js?v=20260713e',
  './teams.js?v=20260713e',
  './formats.js?v=20260713e',
  './pools.js?v=20260713e',
  './schedule.js?v=20260713e',
  './courts.js?v=20260713e',
  './scores.js?v=20260713e',
  './rankings.js?v=20260713e',
  './bracket.js?v=20260713e',
  './stats.js?v=20260713e',
  './display.js?v=20260713e',
  './history.js?v=20260713e',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    // Pas de self.skipWaiting() automatique ici : on laisse la nouvelle
    // version "en attente" jusqu'à ce que la page en cours (app.js,
    // registerServiceWorker) demande explicitement l'activation — via un
    // message postMessage({type:'SKIP_WAITING'}) après confirmation de
    // l'utilisateur dans la modale "Nouvelle version disponible". Sans ça,
    // la mise à jour s'appliquait immédiatement et rechargeait la page sans
    // prévenir, ce qui pouvait couper une saisie en cours.
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Navigation (chargement de index.html) : réseau en priorité, cache en
// secours (hors-ligne uniquement). C'est l'inverse du "cache-first" utilisé
// pour le reste : la page d'entrée doit toujours refléter la dernière
// version déployée quand une connexion est disponible, pour ne plus jamais
// rejouer le scénario où du code déjà corrigé restait invisible pour
// l'utilisateur pendant des jours à cause du cache.
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
