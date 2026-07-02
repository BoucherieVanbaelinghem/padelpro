'use strict';

/* ═══════════════════════════════════════════════════════════════
   STORAGE — Couche de persistance Firestore

   Remplace l'ancien backend localStorage. Le reste de l'app (app.js,
   js/modules/*) continue d'appeler ces fonctions de façon synchrone
   (ex: Storage.getActive(), Storage.saveTournament(t)) sans rien
   changer à son code : la synchronicité est simulée via un cache en
   mémoire tenu à jour en temps réel par des listeners Firestore
   (onSnapshot). Les écritures partent vers Firestore en arrière-plan
   (non bloquant) et mettent aussi à jour le cache immédiatement pour
   un rendu instantané.

   Point d'entrée obligatoire au démarrage : Storage.ready() — une
   Promise à attendre avant le premier rendu (voir App.init()).
   ═══════════════════════════════════════════════════════════════ */

const Storage = (() => {

  // Valeurs par défaut
  const DEFAULT_SETTINGS = {
    tournament: {
      name: 'Tournoi de Padel',
      date: new Date().toISOString().split('T')[0],
      venue: '',
      logo: null,
      startTime: '09:00',
      endTime: '19:00',
      breakEnabled: false,
      breakStart: '12:00',
      breakEnd: '13:00'
    },
    courts: [
      { id: 'court-1', name: 'Terrain 1', available: true },
      { id: 'court-2', name: 'Terrain 2', available: true }
    ],
    levels: [
      { id: 'level-1', name: 'Niveau 1', value: 1, color: '#22c55e' },
      { id: 'level-2', name: 'Niveau 2', value: 2, color: '#3b82f6' },
      { id: 'level-3', name: 'Niveau 3', value: 3, color: '#f59e0b' }
    ],
    matchFormats: [
      { id: 'fmt-1', name: '6 Jeux', sets: 1, gamesPerSet: 6, tiebreak: true, goldenPoint: false, estimatedDuration: 45 },
      { id: 'fmt-2', name: '2 Sets de 4 Jeux', sets: 2, gamesPerSet: 4, tiebreak: true, goldenPoint: false, estimatedDuration: 50 },
      { id: 'fmt-3', name: '9 Jeux', sets: 1, gamesPerSet: 9, tiebreak: false, goldenPoint: true, estimatedDuration: 60 }
    ],
    game: {
      playersPerTeam: 2,
      maxTeams: 16,
      activeFormatId: 'fmt-1',
      poolCount: 2,
      qualificationMethod: 'top',
      qualificationCount: 2,
      rankingCriteria: ['wins', 'points', 'setDiff', 'gameDiff', 'headToHead'],
      pointsWin: 3,
      pointsLoss: 0,
      pointsDraw: 1,
      teamCreationMode: 'balanced',
      hasFinalTable: true,
      hasPetiteFinale: true,
      bracketSize: 8
    },
    theme: {
      primaryColor: '#2563eb',
      secondaryColor: '#7c3aed',
      font: 'Inter'
    }
  };

  // ── Pont vers firebase-init.js ───────────────────────────────────
  const _fb = () => window.FirebaseSvc;

  const _waitForFirebase = () => new Promise((resolve, reject) => {
    if (window.FirebaseSvc && window.FirebaseSvc.ready) return resolve();
    if (window.FirebaseSvc && window.FirebaseSvc.authError) return reject(window.FirebaseSvc.authError);
    window.addEventListener('firebase:ready', () => resolve(), { once: true });
    window.addEventListener('firebase:error', (e) => reject(e.detail), { once: true });
  });

  // Firestore refuse les valeurs "undefined" et les fonctions : on passe
  // toute donnée par un aller-retour JSON avant écriture, par sécurité.
  const _sanitize = (obj) => JSON.parse(JSON.stringify(obj));

  // ── État des dernières erreurs (diagnostic côté App) ──────────────
  let _lastWriteError = null;
  const getLastWriteError = () => _lastWriteError;
  let _writeErrorCallbacks = [];
  // Les écritures Firestore sont asynchrones : contrairement à l'ancien
  // localStorage synchrone, un échec (hors ligne, règles de sécurité,
  // etc.) n'est connu qu'après coup. onWriteError() permet à App de s'y
  // abonner pour prévenir l'utilisateur même dans ce cas différé.
  const onWriteError = (cb) => { _writeErrorCallbacks.push(cb); };
  const _handleWriteError = (context, err) => {
    console.error(`Firestore — erreur (${context}) :`, err);
    _lastWriteError = { context, message: err?.message || String(err) };
    _writeErrorCallbacks.forEach(cb => { try { cb(_lastWriteError); } catch (e) { console.error(e); } });
  };

  // ── Caches en mémoire (tenus à jour par les listeners Firestore) ─
  let _tournamentsCache = {};
  let _playersCache = {};
  let _auditCache = [];
  let _prefsCache = { sidebarCollapsed: false };
  let _activeId = null;

  let _remoteChangeCallbacks = [];
  // Permet à App de se réabonner aux changements distants (autre appareil,
  // ou écho de nos propres écritures) pour rafraîchir l'affichage.
  const onRemoteChange = (cb) => { _remoteChangeCallbacks.push(cb); };
  const _notifyRemoteChange = () => {
    _remoteChangeCallbacks.forEach(cb => { try { cb(); } catch (e) { console.error(e); } });
  };

  // ── Initialisation + écoute temps réel ────────────────────────────
  let _readyPromise = null;
  let _readyResolve = null;
  const _initFlags = { tournaments: false, players: false, meta: false, audit: false };

  const _checkAllReady = () => {
    if (Object.values(_initFlags).every(Boolean) && _readyResolve) {
      const resolve = _readyResolve;
      _readyResolve = null;
      resolve();
    }
  };

  const _startListeners = () => {
    const fb = _fb();
    const { db, collection, doc, onSnapshot, query, orderBy, limit } = fb;

    onSnapshot(collection(db, 'tournaments'), (snap) => {
      const next = {};
      snap.forEach(d => { next[d.id] = d.data(); });
      _tournamentsCache = next;
      _initFlags.tournaments = true;
      _checkAllReady();
      _notifyRemoteChange();
    }, (err) => { _handleWriteError('listen:tournaments', err); _initFlags.tournaments = true; _checkAllReady(); });

    onSnapshot(collection(db, 'players'), (snap) => {
      const next = {};
      snap.forEach(d => { next[d.id] = d.data(); });
      _playersCache = next;
      _initFlags.players = true;
      _checkAllReady();
      _notifyRemoteChange();
    }, (err) => { _handleWriteError('listen:players', err); _initFlags.players = true; _checkAllReady(); });

    onSnapshot(doc(db, 'meta', 'state'), (d) => {
      _activeId = d.exists() ? (d.data().activeTournamentId || null) : null;
      _initFlags.meta = true;
      _checkAllReady();
      _notifyRemoteChange();
    }, (err) => { _handleWriteError('listen:meta', err); _initFlags.meta = true; _checkAllReady(); });

    onSnapshot(doc(db, 'meta', 'preferences'), (d) => {
      _prefsCache = d.exists() ? d.data() : { sidebarCollapsed: false };
    }, (err) => { _handleWriteError('listen:preferences', err); });

    onSnapshot(query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(500)), (snap) => {
      _auditCache = snap.docs.map(d => d.data());
      _initFlags.audit = true;
      _checkAllReady();
    }, (err) => { _handleWriteError('listen:audit', err); _initFlags.audit = true; _checkAllReady(); });
  };

  // Migration unique : si l'ancienne version (localStorage) avait déjà des
  // données sur cet appareil et que Firestore est encore vide, on les
  // bascule automatiquement une fois puis on nettoie le localStorage.
  const _migrateLocalIfNeeded = async () => {
    try {
      const hasCloudData = Object.keys(_tournamentsCache).length > 0 || Object.keys(_playersCache).length > 0;
      if (hasCloudData) return;

      const localRaw = localStorage.getItem('pp_tournaments');
      const localPlayersRaw = localStorage.getItem('pp_global_players');
      if (!localRaw && !localPlayersRaw) return;

      const localTournaments = localRaw ? JSON.parse(localRaw) : {};
      const localPlayers = localPlayersRaw ? JSON.parse(localPlayersRaw) : {};
      if (Object.keys(localTournaments).length === 0 && Object.keys(localPlayers).length === 0) return;

      const localActiveIdRaw = localStorage.getItem('pp_active_id');
      const localActiveId = localActiveIdRaw ? JSON.parse(localActiveIdRaw) : null;

      const fb = _fb();
      const { db, doc, writeBatch } = fb;
      const batch = writeBatch(db);
      Object.values(localTournaments).forEach(t => {
        if (t && t.id) batch.set(doc(db, 'tournaments', t.id), _sanitize(t));
      });
      Object.values(localPlayers).forEach(p => {
        if (p && p.id) batch.set(doc(db, 'players', p.id), _sanitize(p));
      });
      if (localActiveId) batch.set(doc(db, 'meta', 'state'), { activeTournamentId: localActiveId });
      await batch.commit();

      // Mise à jour immédiate du cache local (pas besoin d'attendre l'écho onSnapshot).
      _tournamentsCache = _sanitize(localTournaments);
      _playersCache = _sanitize(localPlayers);
      if (localActiveId) _activeId = localActiveId;

      ['pp_tournaments', 'pp_global_players', 'pp_active_id', 'pp_audit', 'pp_preferences'].forEach(k => localStorage.removeItem(k));
      console.info('PadelPro — données locales migrées vers Firestore avec succès.');
    } catch (err) {
      console.error('Migration locale → Firestore échouée :', err);
    }
  };

  const ready = () => {
    if (_readyPromise) return _readyPromise;
    _readyPromise = new Promise((resolve, reject) => {
      _readyResolve = resolve;
      _waitForFirebase()
        .then(() => {
          _startListeners();
          // Filet de sécurité : si un listener ne répond jamais (ex : hors
          // ligne au tout premier chargement), on ne bloque pas l'app indéfiniment.
          setTimeout(() => {
            if (_readyResolve) { const r = _readyResolve; _readyResolve = null; r(); }
          }, 8000);
        })
        .catch(reject);
    }).then(() => _migrateLocalIfNeeded());
    return _readyPromise;
  };

  // ── Tournaments ────────────────────────────────────────────────
  const getAllTournaments = () => ({ ..._tournamentsCache });

  const getTournament = (id) => _tournamentsCache[id] || null;

  const saveTournament = (tournament) => {
    const toSave = { ...tournament, updatedAt: Utils.now() };
    if (toSave.players) delete toSave.players;
    _tournamentsCache = { ..._tournamentsCache, [tournament.id]: toSave };
    tournament.updatedAt = toSave.updatedAt;

    const fb = _fb();
    if (!fb || !fb.ready) { _handleWriteError('saveTournament', new Error('Firebase non initialisé')); return false; }
    fb.setDoc(fb.doc(fb.db, 'tournaments', tournament.id), _sanitize(toSave))
      .then(() => { _lastWriteError = null; })
      .catch(err => _handleWriteError('saveTournament', err));
    return true;
  };

  const deleteTournament = (id) => {
    const next = { ..._tournamentsCache };
    delete next[id];
    _tournamentsCache = next;

    const fb = _fb();
    if (fb && fb.ready) {
      fb.deleteDoc(fb.doc(fb.db, 'tournaments', id)).catch(err => _handleWriteError('deleteTournament', err));
    }
    if (_activeId === id) clearActiveId();
  };

  // ── Active Tournament ──────────────────────────────────────────
  const getActiveId = () => _activeId;

  const setActiveId = (id) => {
    _activeId = id;
    const fb = _fb();
    if (fb && fb.ready) {
      fb.setDoc(fb.doc(fb.db, 'meta', 'state'), { activeTournamentId: id })
        .catch(err => _handleWriteError('setActiveId', err));
    }
    return true;
  };

  const clearActiveId = () => { setActiveId(null); };

  // Retourne le tournoi actif (crée si besoin)
  const getActive = () => {
    if (_activeId) {
      const t = getTournament(_activeId);
      if (t) return t;
    }
    return createNewTournament();
  };

  const saveActive = (tournament) => {
    tournament.id = tournament.id || Utils.uuid();
    setActiveId(tournament.id);
    return saveTournament(tournament);
  };

  // ── Nouveau tournoi ────────────────────────────────────────────
  const createNewTournament = () => {
    const id = Utils.uuid();
    const t = {
      id,
      settings: Utils.clone(DEFAULT_SETTINGS),
      playerIds: [],
      playerPresence: {},
      teams: [],
      pools: [],
      matches: [],
      bracket: null,
      status: 'setup',
      createdAt: Utils.now(),
      updatedAt: Utils.now()
    };
    setActiveId(id);
    saveTournament(t);
    return t;
  };

  const duplicateTournament = (id) => {
    const src = getTournament(id);
    if (!src) return null;
    const newId = Utils.uuid();
    const dup = Utils.clone(src);
    dup.id = newId;
    dup.settings.tournament.name = src.settings.tournament.name + ' (copie)';
    dup.createdAt = Utils.now();
    dup.updatedAt = Utils.now();
    dup.status = 'setup';
    // Garder les mêmes joueurs inscrits, réinitialiser la présence
    dup.playerPresence = {};
    dup.teams = [];
    dup.pools = [];
    dup.matches = [];
    dup.bracket = null;
    saveTournament(dup);
    return dup;
  };

  // ── Base joueurs globale ───────────────────────────────────────
  // Les joueurs vivent ici, indépendamment des tournois.
  // Chaque tournoi référence les joueurs via t.playerIds[]
  // et stocke la présence dans t.playerPresence{}

  const getGlobalPlayers = () => ({ ..._playersCache });

  // Remplacement complet de la base joueurs (utilisé par l'import global).
  const saveGlobalPlayers = (players) => {
    _playersCache = { ...players };
    const fb = _fb();
    if (!fb || !fb.ready) { _handleWriteError('saveGlobalPlayers', new Error('Firebase non initialisé')); return false; }
    const batch = fb.writeBatch(fb.db);
    Object.values(players).forEach(p => {
      if (p && p.id) batch.set(fb.doc(fb.db, 'players', p.id), _sanitize(p));
    });
    batch.commit().catch(err => _handleWriteError('saveGlobalPlayers', err));
    return true;
  };

  const getAllPlayersList = () => Object.values(_playersCache);

  const upsertPlayer = (player) => {
    _playersCache = { ..._playersCache, [player.id]: { ...player } };
    const fb = _fb();
    if (fb && fb.ready) {
      fb.setDoc(fb.doc(fb.db, 'players', player.id), _sanitize(player)).catch(err => _handleWriteError('upsertPlayer', err));
    }
    return player;
  };

  const deleteGlobalPlayer = (id) => {
    const next = { ..._playersCache };
    delete next[id];
    _playersCache = next;
    const fb = _fb();
    if (fb && fb.ready) {
      fb.deleteDoc(fb.doc(fb.db, 'players', id)).catch(err => _handleWriteError('deleteGlobalPlayer', err));
    }
  };

  // Retourne les joueurs inscrits à un tournoi, avec leur statut de présence injecté
  const getTournamentPlayers = (t) => {
    const ids = t.playerIds || [];
    const presence = t.playerPresence || {};
    return ids
      .map(id => _playersCache[id])
      .filter(Boolean)
      .map(p => ({ ...p, present: presence[p.id] === true }));
  };

  // ── Migration automatique depuis l'ancien format t.players[] ──
  // Conservée pour compatibilité (ex : réimport d'une très ancienne
  // sauvegarde) — agit sur le cache/Firestore, plus sur localStorage.
  const migrateToGlobalPlayers = () => {
    let migrated = false;
    Object.values(_tournamentsCache).forEach(t => {
      if (t.players && t.players.length > 0 && !t.playerIds) {
        t.playerIds = t.players.map(p => p.id).filter(Boolean);
        t.playerPresence = {};
        t.players.forEach(p => {
          if (p && p.id) {
            const { present, ...playerData } = p;
            upsertPlayer(playerData);
            t.playerPresence[p.id] = present === true;
          }
        });
        delete t.players;
        saveTournament(t);
        migrated = true;
      } else if (!t.playerIds) {
        t.playerIds = [];
        t.playerPresence = {};
        saveTournament(t);
        migrated = true;
      }
    });
    return migrated;
  };

  // ── Audit ─────────────────────────────────────────────────────
  const getAudit = () => [..._auditCache];

  const addAuditEntry = (entry) => {
    const full = { ...entry, id: Utils.uuid(), timestamp: Utils.now() };
    _auditCache = [full, ..._auditCache].slice(0, 500);
    const fb = _fb();
    if (fb && fb.ready) {
      fb.setDoc(fb.doc(fb.db, 'auditLogs', full.id), _sanitize(full)).catch(err => _handleWriteError('addAuditEntry', err));
    }
  };

  const clearAudit = () => {
    const toDelete = [..._auditCache];
    _auditCache = [];
    const fb = _fb();
    if (fb && fb.ready && toDelete.length > 0) {
      const batch = fb.writeBatch(fb.db);
      toDelete.forEach(e => batch.delete(fb.doc(fb.db, 'auditLogs', e.id)));
      batch.commit().catch(err => _handleWriteError('clearAudit', err));
    }
  };

  // ── Preferences ───────────────────────────────────────────────
  const getPreferences = () => ({ ..._prefsCache });

  const savePreferences = (prefs) => {
    _prefsCache = { ...prefs };
    const fb = _fb();
    if (fb && fb.ready) {
      fb.setDoc(fb.doc(fb.db, 'meta', 'preferences'), _sanitize(prefs)).catch(err => _handleWriteError('savePreferences', err));
    }
    return true;
  };

  // ── Statistiques (informatif — n'a plus le sens d'un quota local) ─
  const storageSize = () =>
    `${Object.keys(_tournamentsCache).length} tournoi(s), ${Object.keys(_playersCache).length} joueur(s) — Firestore`;

  // ── Export / Import ───────────────────────────────────────────
  const exportAll = () => ({
    version: 2,
    exportDate: Utils.now(),
    tournaments: getAllTournaments(),
    globalPlayers: getGlobalPlayers(),
    audit: getAudit()
  });

  const importAll = async (data) => {
    const fb = _fb();
    if (!fb || !fb.ready) throw new Error('Firebase non initialisé — réessayez dans quelques secondes.');

    const tournaments = data.tournaments || {};
    const globalPlayers = data.globalPlayers || {};
    const audit = data.audit || [];

    const entries = [
      ...Object.values(tournaments).filter(t => t && t.id).map(t => ({ col: 'tournaments', id: t.id, data: t })),
      ...Object.values(globalPlayers).filter(p => p && p.id).map(p => ({ col: 'players', id: p.id, data: p })),
      ...audit.map(a => ({ col: 'auditLogs', id: a.id || Utils.uuid(), data: a }))
    ];

    // Firestore limite les batches à 500 opérations : on découpe par sécurité.
    for (let i = 0; i < entries.length; i += 400) {
      const chunk = entries.slice(i, i + 400);
      const batch = fb.writeBatch(fb.db);
      chunk.forEach(e => batch.set(fb.doc(fb.db, e.col, e.id), _sanitize(e.data)));
      await batch.commit();
    }

    if (data.version === 1) migrateToGlobalPlayers();
  };

  return {
    DEFAULT_SETTINGS,
    // Initialisation
    ready, onRemoteChange, onWriteError,
    // Tournaments
    getAllTournaments, saveTournament, getTournament, deleteTournament,
    getActiveId, setActiveId, clearActiveId,
    getActive, saveActive, createNewTournament, duplicateTournament,
    // Joueurs globaux
    getGlobalPlayers, saveGlobalPlayers, getAllPlayersList,
    upsertPlayer, deleteGlobalPlayer, getTournamentPlayers,
    migrateToGlobalPlayers,
    // Audit
    getAudit, addAuditEntry, clearAudit,
    // Préférences
    getPreferences, savePreferences,
    // Utilitaires
    storageSize, exportAll, importAll, getLastWriteError
  };
})();
