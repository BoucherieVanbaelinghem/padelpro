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
const CACHE_NAME = 'padelpro-v9-20260703b';
const ASSETS = [
  './index.html',
  './style.css?v=20260703b',
  './utils.js?v=20260703b',
  './firebase-init.js?v=20260703b',
  './storage.js?v=20260703b',
  './audit.js?v=20260703b',
  './app.js?v=20260703b',
  './dashboard.js?v=20260703b',
  './players.js?v=20260703b',
  './settings.js?v=20260703b',
  './teams.js?v=20260703b',
  './formats.js?v=20260703b',
  './pools.js?v=20260703b',
  './schedule.js?v=20260703b',
  './courts.js?v=20260703b',
  './scores.js?v=20260703b',
  './rankings.js?v=20260703b',
  './bracket.js?v=20260703b',
  './stats.js?v=20260703b',
  './display.js?v=20260703b',
  './history.js?v=20260703b',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
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
