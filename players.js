'use strict';

/* ═══════════════════════════════════════════════════════════════
   PLAYERS MODULE — Gestion des joueurs (base globale)
   ═══════════════════════════════════════════════════════════════ */

const PlayersModule = (() => {

  let _sortKey = 'lastName';
  let _sortDir = 'asc';
  let _searchTerm = '';
  let _container = null;
  let _showAll = false; // false = seulement inscrits, true = toute la base

  const getFiltered = (players, levels) => {
    let list = [...players];
    if (_searchTerm) {
      const q = Utils.normalize(_searchTerm);
      list = list.filter(p =>
        Utils.normalize(p.firstName || '').includes(q) ||
        Utils.normalize(p.lastName || '').includes(q) ||
        Utils.normalize(p.club || '').includes(q) ||
        Utils.normalize(p.classementFFT || '').includes(q)
      );
    }
    list = Utils.sortBy(list, (p) => {
      if (_sortKey === 'level') {
        const lv = levels.find(l => l.id === p.levelId);
        return lv?.value ?? 0;
      }
      if (_sortKey === 'name') return `${p.lastName} ${p.firstName}`;
      return p[_sortKey] || '';
    }, _sortDir);
    return list;
  };

  const render = (container) => {
    _container = container;
    container.innerHTML = '';
    _renderPage();
  };

  const _renderPage = () => {
    const t = App.getTournament();
    const levels = t.settings?.levels || [];

    // Joueurs inscrits à ce tournoi
    const enrolled = App.getPlayers(t); // avec present injecté
    const enrolledIds = new Set(t.playerIds || []);

    // Tous les joueurs de la base globale
    const allGlobal = Storage.getAllPlayersList();

    // Selon le mode d'affichage
    const displayList = _showAll
      ? allGlobal.map(p => ({ ...p, enrolled: enrolledIds.has(p.id), present: (t.playerPresence || {})[p.id] === true }))
      : enrolled.map(p => ({ ...p, enrolled: true }));

    const filtered = getFiltered(displayList, levels);
    const presentCount = enrolled.filter(p => p.present === true).length;

    _container.innerHTML = `
      <div class="animate-fade-in">
        <div class="page-header">
          <div class="page-header-left">
            <h2 class="page-title">👥 Joueurs</h2>
            <p class="page-subtitle">
              <strong>${enrolled.length}</strong> inscrit${enrolled.length > 1 ? 's' : ''} à ce tournoi
              · <strong>${presentCount}</strong> présent${presentCount > 1 ? 's' : ''}
              · ${allGlobal.length} dans la base
            </p>
          </div>
          <div class="page-header-actions">
            <button class="btn btn-secondary" id="btn-import-players">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Importer JSON
            </button>
            <button class="btn btn-secondary" id="btn-export-players">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Exporter
            </button>
            <button class="btn btn-secondary" id="btn-demo-players" title="Ajouter des joueurs fictifs pour tester">
              🎭 Démo
            </button>
            <button class="btn btn-primary" id="btn-add-player">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Ajouter un joueur
            </button>
          </div>
        </div>

        <!-- Bandeau présence -->
        ${enrolled.length > 0 ? `
        <div class="card mb-4" style="background:var(--color-success-bg);border-color:var(--color-success)">
          <div class="card-body" style="padding:var(--space-3) var(--space-4);display:flex;align-items:center;gap:var(--space-3)">
            <span style="font-size:var(--font-size-sm);color:var(--color-success);font-weight:600">
              ✅ ${presentCount} / ${enrolled.length} joueurs présents aujourd'hui
            </span>
            <div style="flex:1"></div>
            <button class="btn btn-sm btn-success" id="btn-check-all">✅ Tous présents</button>
            <button class="btn btn-sm btn-secondary" id="btn-uncheck-all">⬜ Aucun présent</button>
          </div>
        </div>` : ''}

        <!-- Barre de filtres + mode d'affichage -->
        <div class="card mb-4">
          <div class="card-body" style="padding:var(--space-3) var(--space-4)">
            <div style="display:flex;align-items:center;gap:var(--space-3);flex-wrap:wrap">
              <input type="text" id="search-players" class="form-control" placeholder="Rechercher…"
                value="${Utils.escHtml(_searchTerm)}" style="max-width:220px">

              <!-- Toggle mode affichage -->
              <div style="display:flex;gap:var(--space-1);background:var(--color-bg-alt);padding:3px;border-radius:var(--radius-md)">
                <button class="btn btn-sm ${!_showAll ? 'btn-primary' : 'btn-ghost'}" id="btn-mode-enrolled">
                  🏆 Inscrits (${enrolled.length})
                </button>
                <button class="btn btn-sm ${_showAll ? 'btn-primary' : 'btn-ghost'}" id="btn-mode-all">
                  👥 Toute la base (${allGlobal.length})
                </button>
              </div>

              <div style="flex:1"></div>
              ${_showAll && allGlobal.length > 0 ? `
                <button class="btn btn-sm btn-secondary" id="btn-enroll-all">➕ Tous inscrire</button>
                <button class="btn btn-sm btn-secondary" id="btn-unenroll-all">➖ Tous désinscrire</button>
              ` : ''}
              ${enrolled.length > 0 ? `
                <button class="btn btn-danger btn-sm" id="btn-delete-all-players">🗑️ Tout supprimer du tournoi</button>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- Tableau -->
        ${filtered.length === 0 ? `
          <div class="card"><div class="card-body">
            <div class="empty-state" id="players-empty">
              <div class="empty-state-icon">👥</div>
              <h3>${_showAll ? 'Base vide' : 'Aucun joueur inscrit'}</h3>
              <p>${_showAll ? 'Cliquez sur "Ajouter un joueur" pour commencer.' : 'Inscrivez des joueurs depuis la base globale ou ajoutez-en de nouveaux.'}</p>
              <button class="btn btn-primary" id="btn-add-first">➕ Ajouter un joueur</button>
            </div>
          </div></div>` :
        `<div class="card"><div style="overflow-x:auto">
          <table class="table">
            <thead>
              <tr>
                <th style="width:40px">✓</th>
                <th data-sort="lastName" class="${_sortKey === 'lastName' ? 'sorted sorted-' + _sortDir : ''}">Nom</th>
                <th data-sort="firstName" class="${_sortKey === 'firstName' ? 'sorted sorted-' + _sortDir : ''}">Prénom</th>
                <th data-sort="level" class="${_sortKey === 'level' ? 'sorted sorted-' + _sortDir : ''}">Niveau</th>
                <th data-sort="classementFFT">FFT</th>
                <th data-sort="gender">Sexe</th>
                <th data-sort="club" class="${_sortKey === 'club' ? 'sorted sorted-' + _sortDir : ''}">Club</th>
                <th>Contact</th>
                <th style="width:120px">Équipe</th>
                ${_showAll ? '<th style="width:100px">Tournoi</th>' : ''}
                <th style="width:100px">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(p => renderRow(p, levels, t)).join('')}
            </tbody>
          </table>
        </div></div>`}

        <input type="file" id="import-players-file" accept=".json" style="display:none">
      </div>`;

    _bindEvents(t, enrolled, allGlobal);
  };

  const renderRow = (p, levels, t) => {
    const level = levels.find(l => l.id === p.levelId);
    const teams = t.teams || [];
    const team = teams.find(tm => (tm.playerIds || []).includes(p.id));
    const isEnrolled = p.enrolled !== false; // undefined = inscrit (mode inscrits seulement)

    return `<tr class="${p.present ? 'present-row' : ''}" data-id="${p.id}">
      <!-- Présence -->
      <td style="text-align:center">
        ${isEnrolled
          ? `<input type="checkbox" class="check-present" data-id="${p.id}" ${p.present ? 'checked' : ''} title="Présent aujourd'hui">`
          : `<button class="btn btn-sm btn-primary btn-enroll-one" data-id="${p.id}" style="padding:2px 8px;font-size:11px">+</button>`}
      </td>
      <td style="font-weight:${isEnrolled ? '600' : '400'};color:${isEnrolled ? 'var(--color-text)' : 'var(--color-text-muted)'}">
        ${Utils.escHtml(p.lastName || '')}
      </td>
      <td>${Utils.escHtml(p.firstName || '')}</td>
      <td>
        ${level ? `<span class="badge" style="background:${level.color}22;color:${level.color};">${Utils.escHtml(level.name)}</span>` : '<span class="text-muted">—</span>'}
      </td>
      <td><span style="font-size:var(--font-size-xs);font-weight:700;color:var(--color-primary)">${Utils.escHtml(p.classementFFT || 'NC')}</span></td>
      <td>${p.gender === 'M' ? '♂️' : p.gender === 'F' ? '♀️' : '—'}</td>
      <td>${Utils.escHtml(p.club || '—')}</td>
      <td style="font-size:var(--font-size-xs);color:var(--color-text-muted)">
        ${p.email ? `<div>${Utils.escHtml(p.email)}</div>` : ''}
        ${p.phone ? `<div>${Utils.escHtml(p.phone)}</div>` : ''}
        ${!p.email && !p.phone ? '—' : ''}
      </td>
      <td>
        ${team
          ? `<span class="badge badge-primary" style="font-size:10px">${Utils.escHtml(team.name || '?')}</span>`
          : (isEnrolled ? '<span class="text-muted" style="font-size:11px">Sans équipe</span>' : '')}
      </td>
      ${p.enrolled !== undefined ? `<td>
        ${isEnrolled
          ? `<button class="btn btn-sm btn-ghost btn-unenroll-one" data-id="${p.id}" title="Désinscrire de ce tournoi" style="font-size:11px">−</button>`
          : `<button class="btn btn-sm btn-primary btn-enroll-one" data-id="${p.id}" style="font-size:11px">+ Inscrire</button>`}
      </td>` : ''}
      <td style="white-space:nowrap">
        <button class="btn btn-ghost btn-sm btn-edit-player" data-id="${p.id}" title="Modifier">✏️</button>
        <button class="btn btn-ghost btn-sm btn-delete-player" data-id="${p.id}" title="Supprimer de la base">🗑️</button>
      </td>
    </tr>`;
  };

  const _bindEvents = (t, enrolled, allGlobal) => {
    const levels = t.settings?.levels || [];

    // Recherche
    Utils.el('#search-players', _container)?.addEventListener('input', e => {
      _searchTerm = e.target.value;
      _renderPage();
    });

    // Mode d'affichage
    Utils.el('#btn-mode-enrolled', _container)?.addEventListener('click', () => { _showAll = false; _renderPage(); });
    Utils.el('#btn-mode-all', _container)?.addEventListener('click', () => { _showAll = true; _renderPage(); });

    // Tri colonnes
    _container.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        if (_sortKey === th.dataset.sort) _sortDir = _sortDir === 'asc' ? 'desc' : 'asc';
        else { _sortKey = th.dataset.sort; _sortDir = 'asc'; }
        _renderPage();
      });
    });

    // Présence individuelle
    _container.querySelectorAll('.check-present').forEach(cb => {
      cb.addEventListener('change', () => {
        const t2 = App.getTournament();
        if (!t2.playerPresence) t2.playerPresence = {};
        t2.playerPresence[cb.dataset.id] = cb.checked;
        App.saveTournament(t2);
      });
    });

    // Tous présents / aucun présent
    Utils.el('#btn-check-all', _container)?.addEventListener('click', () => {
      const t2 = App.getTournament();
      if (!t2.playerPresence) t2.playerPresence = {};
      (t2.playerIds || []).forEach(id => { t2.playerPresence[id] = true; });
      App.saveTournament(t2);
      _renderPage();
    });

    Utils.el('#btn-uncheck-all', _container)?.addEventListener('click', () => {
      const t2 = App.getTournament();
      if (!t2.playerPresence) t2.playerPresence = {};
      (t2.playerIds || []).forEach(id => { t2.playerPresence[id] = false; });
      App.saveTournament(t2);
      _renderPage();
    });

    // Inscrire tous (mode base globale)
    Utils.el('#btn-enroll-all', _container)?.addEventListener('click', () => {
      const t2 = App.getTournament();
      const allIds = Storage.getAllPlayersList().map(p => p.id);
      const existing = new Set(t2.playerIds || []);
      allIds.forEach(id => existing.add(id));
      t2.playerIds = [...existing];
      App.saveTournament(t2);
      App.toast(`${allIds.length} joueurs inscrits`, 'success');
      _renderPage();
    });

    // Désinscrire tous
    Utils.el('#btn-unenroll-all', _container)?.addEventListener('click', async () => {
      const ok = await App.confirm('Désinscrire tous', 'Tous les joueurs seront retirés de ce tournoi (ils restent dans la base globale).', { icon: '➖' });
      if (!ok) return;
      const t2 = App.getTournament();
      t2.playerIds = [];
      t2.playerPresence = {};
      App.saveTournament(t2);
      _renderPage();
    });

    // Inscrire un joueur au tournoi
    _container.querySelectorAll('.btn-enroll-one').forEach(btn => {
      btn.addEventListener('click', () => {
        const t2 = App.getTournament();
        if (!t2.playerIds) t2.playerIds = [];
        if (!t2.playerIds.includes(btn.dataset.id)) {
          t2.playerIds.push(btn.dataset.id);
        }
        App.saveTournament(t2);
        _renderPage();
      });
    });

    // Désinscrire un joueur du tournoi
    _container.querySelectorAll('.btn-unenroll-one').forEach(btn => {
      btn.addEventListener('click', async () => {
        const t2 = App.getTournament();
        t2.playerIds = (t2.playerIds || []).filter(id => id !== btn.dataset.id);
        if (t2.playerPresence) delete t2.playerPresence[btn.dataset.id];
        App.saveTournament(t2);
        _renderPage();
      });
    });

    // Boutons ajouter
    Utils.el('#btn-add-player', _container)?.addEventListener('click', () => openForm());
    Utils.el('#btn-add-first', _container)?.addEventListener('click', () => openForm());

    // Supprimer du tournoi (désinscription en masse)
    Utils.el('#btn-delete-all-players', _container)?.addEventListener('click', async () => {
      const ok = await App.confirm(
        'Désinscrire tous les joueurs',
        'Ils resteront dans la base globale mais seront retirés de ce tournoi.',
        { icon: '🗑️', okClass: 'btn-danger', okLabel: 'Désinscrire' }
      );
      if (!ok) return;
      const t2 = App.getTournament();
      t2.playerIds = [];
      t2.playerPresence = {};
      App.saveTournament(t2);
      App.toast('Joueurs désinscrits du tournoi', 'warning');
      _renderPage();
    });

    // Modifier un joueur
    _container.querySelectorAll('.btn-edit-player').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = Storage.getGlobalPlayers()[btn.dataset.id];
        if (p) openForm(p);
      });
    });

    // Supprimer de la base globale
    _container.querySelectorAll('.btn-delete-player').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await App.confirm(
          'Supprimer de la base globale',
          'Ce joueur sera supprimé de tous les tournois. Cette action est irréversible.',
          { icon: '🗑️', okClass: 'btn-danger', okLabel: 'Supprimer' }
        );
        if (!ok) return;
        const id = btn.dataset.id;
        Storage.deleteGlobalPlayer(id);
        // Retirer de ce tournoi aussi
        const t2 = App.getTournament();
        t2.playerIds = (t2.playerIds || []).filter(x => x !== id);
        if (t2.playerPresence) delete t2.playerPresence[id];
        App.saveTournament(t2);
        Audit.log(Audit.ACTIONS.DELETE, 'player', '');
        App.toast('Joueur supprimé', 'success');
        _renderPage();
      });
    });

    // Export
    Utils.el('#btn-export-players', _container)?.addEventListener('click', () => {
      Utils.downloadJSON(enrolled, `joueurs-${t.settings?.tournament?.name || 'export'}.json`);
      App.toast('Export téléchargé', 'success');
    });

    // Import
    Utils.el('#btn-import-players', _container)?.addEventListener('click', () => {
      Utils.el('#import-players-file', _container)?.click();
    });

    Utils.el('#import-players-file', _container)?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = await Utils.readJSONFile(file);
        const players = Array.isArray(data) ? data : [data];
        const t2 = App.getTournament();
        let added = 0;
        players.forEach(p => {
          if (!p.firstName && !p.lastName) return;
          const id = p.id || Utils.uuid();
          const player = { ...p, id };
          delete player.present;
          Storage.upsertPlayer(player);
          if (!t2.playerIds) t2.playerIds = [];
          if (!t2.playerIds.includes(id)) { t2.playerIds.push(id); added++; }
        });
        App.saveTournament(t2);
        App.toast(`${added} joueur(s) importé(s)`, 'success');
        _renderPage();
      } catch (err) {
        App.toast('Erreur import : ' + err.message, 'error');
      }
    });

    // Joueurs démo
    Utils.el('#btn-demo-players', _container)?.addEventListener('click', async () => {
      const ok = await App.confirm('Ajouter joueurs démo', 'Des joueurs fictifs seront ajoutés à la base et inscrits à ce tournoi.', { icon: '🎭', okClass: 'btn-primary', okLabel: 'Ajouter' });
      if (!ok) return;
      const DEMO_PLAYERS = [
        { firstName: 'Julien', lastName: 'MARTIN', gender: 'M', club: 'Padel Club Lyon', classementFFT: 'P100' },
        { firstName: 'Sophie', lastName: 'BERNARD', gender: 'F', club: 'Tennis Padel Paris', classementFFT: 'P50' },
        { firstName: 'Thomas', lastName: 'DUBOIS', gender: 'M', club: 'Padel Club Lyon', classementFFT: 'P25' },
        { firstName: 'Marie', lastName: 'LEROY', gender: 'F', club: 'Padel Bordeaux', classementFFT: 'P100' },
        { firstName: 'Nicolas', lastName: 'MOREAU', gender: 'M', club: 'AS Padel Marseille', classementFFT: 'P250' },
        { firstName: 'Camille', lastName: 'SIMON', gender: 'F', club: 'Tennis Padel Paris', classementFFT: 'P25' },
        { firstName: 'Alexandre', lastName: 'LAURENT', gender: 'M', club: 'Padel Club Lille', classementFFT: 'P50' },
        { firstName: 'Laura', lastName: 'PETIT', gender: 'F', club: 'Padel Bordeaux', classementFFT: 'P100' },
        { firstName: 'Maxime', lastName: 'GARCIA', gender: 'M', club: 'AS Padel Marseille', classementFFT: 'P25' },
        { firstName: 'Emilie', lastName: 'ROUX', gender: 'F', club: 'Padel Club Lyon', classementFFT: 'P50' },
        { firstName: 'Romain', lastName: 'FOURNIER', gender: 'M', club: 'Padel Club Lille', classementFFT: 'P100' },
        { firstName: 'Clara', lastName: 'GIRARD', gender: 'F', club: 'Tennis Padel Paris', classementFFT: 'P25' },
        { firstName: 'Baptiste', lastName: 'MOREL', gender: 'M', club: 'Padel Bordeaux', classementFFT: 'P50' },
        { firstName: 'Lucie', lastName: 'BONNET', gender: 'F', club: 'Padel Club Lyon', classementFFT: 'P100' },
        { firstName: 'Florian', lastName: 'DUPONT', gender: 'M', club: 'AS Padel Marseille', classementFFT: 'P250' },
        { firstName: 'Manon', lastName: 'LAMBERT', gender: 'F', club: 'Padel Club Lille', classementFFT: 'P50' },
        { firstName: 'Kevin', lastName: 'FONTAINE', gender: 'M', club: 'Tennis Padel Paris', classementFFT: 'P25' },
        { firstName: 'Pauline', lastName: 'ROUSSEAU', gender: 'F', club: 'Padel Bordeaux', classementFFT: 'P100' },
        { firstName: 'Antoine', lastName: 'VINCENT', gender: 'M', club: 'Padel Club Lyon', classementFFT: 'P25' },
        { firstName: 'Elise', lastName: 'MULLER', gender: 'F', club: 'AS Padel Marseille', classementFFT: 'P50' },
        { firstName: 'Sebastien', lastName: 'LECOMTE', gender: 'M', club: 'Padel Club Lille', classementFFT: 'P100' },
        { firstName: 'Charlotte', lastName: 'MASSON', gender: 'F', club: 'Tennis Padel Paris', classementFFT: 'P25' },
        { firstName: 'Damien', lastName: 'BLANC', gender: 'M', club: 'Padel Bordeaux', classementFFT: 'P50' },
        { firstName: 'Aurelie', lastName: 'GUERIN', gender: 'F', club: 'Padel Club Lyon', classementFFT: 'P100' },
      ];
      const t2 = App.getTournament();
      if (!t2.playerIds) t2.playerIds = [];
      if (!t2.playerPresence) t2.playerPresence = {};
      const levels = t2.settings?.levels || [];
      DEMO_PLAYERS.forEach(dp => {
        const id = Utils.uuid();
        const level = levels[Math.floor(Math.random() * levels.length)];
        const player = { id, ...dp, levelId: level?.id || '' };
        Storage.upsertPlayer(player);
        if (!t2.playerIds.includes(id)) {
          t2.playerIds.push(id);
          t2.playerPresence[id] = true;
        }
      });
      App.saveTournament(t2);
      App.toast(`${DEMO_PLAYERS.length} joueurs démo ajoutés`, 'success');
      _renderPage();
    });
  };

  const openForm = (player = null) => {
    const t = App.getTournament();
    const levels = t.settings?.levels || [];
    const isEdit = !!player;

    const html = `
      <form id="player-form" class="form-section">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Nom <span class="required">*</span></label>
            <input name="lastName" class="form-control" required value="${Utils.escHtml(player?.lastName || '')}" placeholder="Dupont">
          </div>
          <div class="form-group">
            <label class="form-label">Prénom <span class="required">*</span></label>
            <input name="firstName" class="form-control" required value="${Utils.escHtml(player?.firstName || '')}" placeholder="Jean">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Niveau</label>
            <select name="levelId" class="form-control">
              <option value="">-- Choisir --</option>
              ${levels.map(l => `<option value="${l.id}" ${player?.levelId === l.id ? 'selected' : ''}>${Utils.escHtml(l.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Sexe</label>
            <select name="gender" class="form-control">
              <option value="" ${!player?.gender ? 'selected' : ''}>Non précisé</option>
              <option value="M" ${player?.gender === 'M' ? 'selected' : ''}>Masculin</option>
              <option value="F" ${player?.gender === 'F' ? 'selected' : ''}>Féminin</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Club</label>
            <input name="club" class="form-control" value="${Utils.escHtml(player?.club || '')}" placeholder="Nom du club">
          </div>
          <div class="form-group">
            <label class="form-label">Classement FFT</label>
            <select name="classementFFT" class="form-control">
              <option value="">NC</option>
              ${['P25','P50','P100','P250','P500','P1000'].map(c =>
                `<option value="${c}" ${player?.classementFFT === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input name="email" type="email" class="form-control" value="${Utils.escHtml(player?.email || '')}" placeholder="email@exemple.fr">
          </div>
          <div class="form-group">
            <label class="form-label">Téléphone</label>
            <input name="phone" type="tel" class="form-control" value="${Utils.escHtml(player?.phone || '')}" placeholder="06 12 34 56 78">
          </div>
        </div>
        ${!isEdit ? `
        <div class="form-group">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:400">
            <input type="checkbox" name="enrollNow" checked>
            Inscrire immédiatement à ce tournoi
          </label>
        </div>` : ''}
      </form>`;

    App.modal.open(isEdit ? '✏️ Modifier le joueur' : '➕ Ajouter un joueur', html, {
      buttons: [
        { label: 'Annuler', class: 'btn-ghost', onClick: () => App.modal.close() },
        { label: isEdit ? 'Enregistrer' : 'Ajouter', class: 'btn-primary', id: 'btn-save-player' }
      ]
    });

    Utils.el('#btn-save-player')?.addEventListener('click', () => {
      const form = Utils.el('#player-form');
      const data = Utils.formData(form);

      if (!data.lastName?.trim() || !data.firstName?.trim()) {
        App.toast('Nom et prénom obligatoires', 'error');
        return;
      }

      if (isEdit) {
        // Mettre à jour dans la base globale
        const existing = Storage.getGlobalPlayers()[player.id] || {};
        Storage.upsertPlayer({ ...existing, ...data, id: player.id });
        Audit.log(Audit.ACTIONS.UPDATE, 'player', Utils.fullName(data));
        App.toast('Joueur modifié', 'success');
      } else {
        // Créer dans la base globale
        const id = Utils.uuid();
        const newPlayer = { id, ...data };
        delete newPlayer.enrollNow;
        Storage.upsertPlayer(newPlayer);
        Audit.log(Audit.ACTIONS.CREATE, 'player', Utils.fullName(newPlayer));

        // Inscrire au tournoi si coché
        if (data.enrollNow !== 'false') {
          const t2 = App.getTournament();
          if (!t2.playerIds) t2.playerIds = [];
          if (!t2.playerIds.includes(id)) {
            t2.playerIds.push(id);
            if (!t2.playerPresence) t2.playerPresence = {};
            t2.playerPresence[id] = true;
          }
          App.saveTournament(t2);
        }
        App.toast('Joueur ajouté', 'success');
      }

      App.modal.close();
      _renderPage();
    });
  };

  return { render };
})();
