'use strict';

const CACHE_NAME = 'padelpro-v7';
const ASSETS = [
  './index.html',
  './style.css',
  './utils.js',
  './firebase-init.js',
  './storage.js',
  './audit.js',
  './app.js',
  './dashboard.js',
  './players.js',
  './settings.js',
  './teams.js',
  './formats.js',
  './pools.js',
  './schedule.js',
  './courts.js',
  './scores.js',
  './rankings.js',
  './bracket.js',
  './display.js',
  './history.js',
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

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
