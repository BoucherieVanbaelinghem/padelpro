'use strict';

/* ═══════════════════════════════════════════════════════════════
   SETTINGS MODULE — Paramètres généraux
   ═══════════════════════════════════════════════════════════════ */

const SettingsModule = (() => {

  let _section = 'general';
  let _container = null;

  const SECTIONS = [
    { id: 'general',   icon: '📋', label: 'Général' },
    { id: 'courts',    icon: '🏟️', label: 'Terrains' },
    { id: 'levels',    icon: '📊', label: 'Niveaux' },
    { id: 'formats',   icon: '🎯', label: 'Formats de match' },
    { id: 'game',      icon: '⚙️', label: 'Règles du jeu' },
    { id: 'ranking',   icon: '🏆', label: 'Classement' },
    { id: 'theme',     icon: '🎨', label: 'Apparence' },
    { id: 'data',      icon: '💾', label: 'Données' }
  ];

  const render = (container) => {
    _container = container;
    _renderPage();
  };

  const _renderPage = () => {
    const t = App.getTournament();

    _container.innerHTML = `
      <div class="animate-fade-in">
        <div class="page-header">
          <div class="page-header-left">
            <h2 class="page-title">⚙️ Paramètres</h2>
            <p class="page-subtitle">Configurez tous les aspects du tournoi</p>
          </div>
        </div>
        <div class="settings-layout">
          <!-- Nav latérale -->
          <div class="settings-nav card" style="padding:var(--space-2)">
            ${SECTIONS.map(s => `
              <div class="settings-nav-item ${_section === s.id ? 'active' : ''}" data-section="${s.id}">
                <span>${s.icon}</span> ${s.label}
              </div>`).join('')}
          </div>
          <!-- Contenu -->
          <div id="settings-content">
            ${renderSection(_section, t)}
          </div>
        </div>
      </div>`;

    // Navigation sections
    _container.querySelectorAll('.settings-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        _section = item.dataset.section;
        Utils.el('#settings-content', _container).innerHTML = renderSection(_section, App.getTournament());
        _container.querySelectorAll('.settings-nav-item').forEach(i => i.classList.toggle('active', i.dataset.section === _section));
        bindSectionEvents();
      });
    });

    bindSectionEvents();
  };

  const renderSection = (section, t) => {
    const fns = {
      general: renderGeneral,
      courts:  renderCourts,
      levels:  renderLevels,
      formats: renderFormats,
      game:    renderGame,
      ranking: renderRanking,
      theme:   renderTheme,
      data:    renderData
    };
    return fns[section]?.(t) || '';
  };

  // ── GÉNÉRAL ───────────────────────────────────────────────────
  const renderGeneral = (t) => {
    const s = t.settings?.tournament || {};
    return `
      <div class="settings-section active" id="sec-general">
        <div><h3 class="settings-title">Informations générales</h3>
        <p class="settings-desc">Nom, date, lieu et logo du tournoi</p></div>
        <div class="card">
          <div class="card-body form-section">
            <div class="form-group">
              <label class="form-label">Nom du tournoi <span class="required">*</span></label>
              <input id="s-name" class="form-control" value="${Utils.escHtml(s.name || '')}" placeholder="Tournoi de Padel Open">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Date</label>
                <input id="s-date" type="date" class="form-control" value="${s.date || ''}">
              </div>
              <div class="form-group">
                <label class="form-label">Lieu / Salle</label>
                <input id="s-venue" class="form-control" value="${Utils.escHtml(s.venue || '')}" placeholder="Club de Padel, Ville">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Heure de début</label>
                <input id="s-start-time" type="time" class="form-control" value="${s.startTime || '09:00'}">
              </div>
              <div class="form-group">
                <label class="form-label">Heure de fin (limite)</label>
                <input id="s-end-time" type="time" class="form-control" value="${s.endTime || '19:00'}">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">
                <span style="display:flex;align-items:center;gap:var(--space-2)">
                  Pause déjeuner
                  <label class="toggle"><input type="checkbox" id="s-break-enabled" ${s.breakEnabled ? 'checked' : ''}><span class="toggle-slider"></span></label>
                </span>
              </label>
              <div id="break-times" style="${s.breakEnabled ? '' : 'display:none'}">
                <div class="form-row" style="margin-top:var(--space-2)">
                  <div class="form-group">
                    <label class="form-label">Début de pause</label>
                    <input id="s-break-start" type="time" class="form-control" value="${s.breakStart || '12:00'}">
                  </div>
                  <div class="form-group">
                    <label class="form-label">Fin de pause</label>
                    <input id="s-break-end" type="time" class="form-control" value="${s.breakEnd || '13:00'}">
                  </div>
                </div>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Logo du tournoi</label>
              <div style="display:flex;align-items:center;gap:var(--space-3)">
                ${s.logo ? `<img src="${s.logo}" style="height:64px;width:64px;object-fit:contain;border:1px solid var(--color-border);border-radius:var(--radius-md)">` : ''}
                <div>
                  <input type="file" id="s-logo-file" accept="image/*" style="display:none">
                  <button class="btn btn-secondary" id="btn-upload-logo">📁 Choisir un logo</button>
                  ${s.logo ? `<button class="btn btn-ghost btn-sm" id="btn-remove-logo" style="margin-left:var(--space-2)">Supprimer</button>` : ''}
                </div>
              </div>
            </div>
          </div>
          <div class="card-footer">
            <button class="btn btn-primary" id="btn-save-general">💾 Enregistrer</button>
          </div>
        </div>
      </div>`;
  };

  // ── TERRAINS ──────────────────────────────────────────────────
  const renderCourts = (t) => {
    const courts = t.settings?.courts || [];
    return `
      <div class="settings-section active" id="sec-courts">
        <div><h3 class="settings-title">Terrains</h3>
        <p class="settings-desc">Gérez les terrains disponibles</p></div>
        <div class="card">
          <div class="card-header">
            <span class="card-title">🏟️ Liste des terrains</span>
            <button class="btn btn-primary btn-sm" id="btn-add-court">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Ajouter
            </button>
          </div>
          <div class="card-body" id="courts-list">
            ${courts.length === 0 ? `<div class="empty-state"><div class="empty-state-icon">🏟️</div><h3>Aucun terrain</h3></div>` :
              courts.map((c, i) => `
                <div class="list-item" data-id="${c.id}">
                  <div class="list-item-content">
                    <div class="list-item-title">${Utils.escHtml(c.name)}</div>
                  </div>
                  <label class="toggle" title="${c.available ? 'Disponible' : 'Indisponible'}">
                    <input type="checkbox" class="court-toggle" data-id="${c.id}" ${c.available ? 'checked' : ''}>
                    <span class="toggle-slider"></span>
                  </label>
                  <div class="list-item-actions">
                    <button class="btn btn-sm btn-secondary btn-rename-court" data-id="${c.id}" data-name="${Utils.escHtml(c.name)}" title="Renommer">✏️</button>
                    <button class="btn btn-sm btn-danger btn-del-court" data-id="${c.id}" title="Supprimer">🗑️</button>
                  </div>
                </div>`).join('')}
          </div>
        </div>
      </div>`;
  };

  // ── NIVEAUX ───────────────────────────────────────────────────
  const renderLevels = (t) => {
    const levels = t.settings?.levels || [];
    return `
      <div class="settings-section active" id="sec-levels">
        <div><h3 class="settings-title">Niveaux de jeu</h3>
        <p class="settings-desc">Définissez les niveaux de joueurs (ex: Débutant, Intermédiaire, Confirmé)</p></div>
        <div class="card">
          <div class="card-header">
            <span class="card-title">📊 Niveaux</span>
            <button class="btn btn-primary btn-sm" id="btn-add-level">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Ajouter
            </button>
          </div>
          <div class="card-body" id="levels-list">
            ${levels.length === 0 ? `<div class="empty-state"><div class="empty-state-icon">📊</div><h3>Aucun niveau</h3></div>` :
              levels.map((l, i) => `
                <div class="list-item" data-id="${l.id}">
                  <div style="width:14px;height:14px;border-radius:50%;background:${l.color};flex-shrink:0"></div>
                  <div class="list-item-content">
                    <div class="list-item-title">${Utils.escHtml(l.name)}</div>
                    <div class="list-item-sub">Valeur : ${l.value}</div>
                  </div>
                  <div class="list-item-actions">
                    <button class="btn btn-sm btn-secondary btn-edit-level" data-id="${l.id}" title="Modifier">✏️</button>
                    <button class="btn btn-sm btn-danger btn-del-level" data-id="${l.id}" title="Supprimer">🗑️</button>
                  </div>
                </div>`).join('')}
          </div>
        </div>
      </div>`;
  };

  // ── FORMATS ───────────────────────────────────────────────────
  const renderFormats = (t) => {
    const formats = t.settings?.matchFormats || [];
    const activeId = t.settings?.game?.activeFormatId;
    return `
      <div class="settings-section active" id="sec-formats">
        <div><h3 class="settings-title">Formats de match</h3>
        <p class="settings-desc">Définissez les différents formats de match disponibles</p></div>
        <div class="card">
          <div class="card-header">
            <span class="card-title">🎯 Formats</span>
            <button class="btn btn-primary btn-sm" id="btn-add-format">➕ Ajouter</button>
          </div>
          <div class="card-body" id="formats-list">
            ${formats.length === 0 ? `<div class="empty-state"><div class="empty-state-icon">🎯</div><h3>Aucun format</h3></div>` :
              formats.map(f => `
                <div class="list-item" data-id="${f.id}">
                  <div class="list-item-content">
                    <div class="list-item-title">
                      ${Utils.escHtml(f.name)}
                      ${activeId === f.id ? `<span class="badge badge-primary" style="margin-left:8px">Actif</span>` : ''}
                    </div>
                    <div class="list-item-sub">
                      ${f.sets} set(s) × ${f.gamesPerSet} jeux
                      ${f.tiebreak ? ' • Tie-break' : ''}
                      ${f.goldenPoint ? ' • Golden Point' : ''}
                      • ≈ ${f.estimatedDuration} min
                    </div>
                  </div>
                  <div class="list-item-actions">
                    <button class="btn btn-sm btn-secondary btn-use-format" data-id="${f.id}" title="Utiliser ce format">✅ Utiliser</button>
                    <button class="btn btn-sm btn-secondary btn-edit-format" data-id="${f.id}">✏️</button>
                    <button class="btn btn-sm btn-danger btn-del-format" data-id="${f.id}">🗑️</button>
                  </div>
                </div>`).join('')}
          </div>
        </div>
      </div>`;
  };

  // ── RÈGLES DU JEU ─────────────────────────────────────────────
  const renderGame = (t) => {
    const g = t.settings?.game || {};
    return `
      <div class="settings-section active">
        <div><h3 class="settings-title">Règles du jeu</h3>
        <p class="settings-desc">Paramètres généraux du tournoi</p></div>
        <div class="card">
          <div class="card-body form-section">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Joueurs par équipe</label>
                <input id="g-players-per-team" type="number" min="1" max="4" class="form-control" value="${g.playersPerTeam || 2}">
              </div>
              <div class="form-group">
                <label class="form-label">Nombre max d'équipes</label>
                <input id="g-max-teams" type="number" min="2" max="128" class="form-control" value="${g.maxTeams || 16}">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Nombre de poules</label>
                <input id="g-pool-count" type="number" min="1" max="32" class="form-control" value="${g.poolCount || 2}">
              </div>
              <div class="form-group">
                <label class="form-label">Équipes qualifiées par poule</label>
                <input id="g-qual-count" type="number" min="1" max="16" class="form-control" value="${g.qualificationCount || 2}">
                <span class="form-hint">Nombre d'équipes qui se qualifient pour le tableau final</span>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Points par victoire</label>
                <input id="g-pts-win" type="number" min="0" class="form-control" value="${g.pointsWin ?? 3}">
              </div>
              <div class="form-group">
                <label class="form-label">Points par défaite</label>
                <input id="g-pts-loss" type="number" min="0" class="form-control" value="${g.pointsLoss ?? 0}">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Points par match nul</label>
                <input id="g-pts-draw" type="number" min="0" class="form-control" value="${g.pointsDraw ?? 1}">
              </div>
              <div class="form-group">
                <label class="form-label">Taille du tableau final</label>
                <select id="g-bracket-size" class="form-control">
                  ${[4,8,16,32].map(n => `<option value="${n}" ${(g.bracketSize||8)==n?'selected':''}>${n} équipes</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Options tableau final</label>
                <div style="display:flex;flex-direction:column;gap:var(--space-2);margin-top:var(--space-1)">
                  <label style="display:flex;align-items:center;gap:var(--space-2);font-weight:400">
                    <input type="checkbox" id="g-has-final" ${g.hasFinalTable !== false ? 'checked' : ''}> Tableau final actif
                  </label>
                  <label style="display:flex;align-items:center;gap:var(--space-2);font-weight:400">
                    <input type="checkbox" id="g-petite-finale" ${g.hasPetiteFinale !== false ? 'checked' : ''}> Petite finale (3ème place)
                  </label>
                </div>
              </div>
            </div>
          </div>
          <div class="card-footer">
            <button class="btn btn-primary" id="btn-save-game">💾 Enregistrer</button>
          </div>
        </div>
      </div>`;
  };

  // ── CLASSEMENT ────────────────────────────────────────────────
  const renderRanking = (t) => {
    const g = t.settings?.game || {};
    const criteria = g.rankingCriteria || ['wins', 'points', 'setDiff', 'gameDiff', 'headToHead'];
    const CRIT_LABELS = {
      wins:        'Nombre de victoires',
      points:      'Total de points',
      setDiff:     'Différence de sets',
      gameDiff:    'Différence de jeux',
      headToHead:  'Confrontation directe',
      setsWon:     'Sets gagnés',
      gamesWon:    'Jeux gagnés'
    };
    return `
      <div class="settings-section active">
        <div><h3 class="settings-title">Critères de classement</h3>
        <p class="settings-desc">Glissez-déposez pour changer la priorité des critères</p></div>
        <div class="card">
          <div class="card-body">
            <p class="text-muted text-sm mb-4">Les critères sont appliqués dans l'ordre. En cas d'égalité sur le 1er critère, le 2ème est utilisé, etc.</p>
            <div class="criteria-list" id="criteria-sortable">
              ${criteria.map((c, i) => `
                <div class="criteria-item" draggable="true" data-crit="${c}">
                  <span class="criteria-rank">${i + 1}</span>
                  <span class="criteria-label">${CRIT_LABELS[c] || c}</span>
                  <span class="criteria-drag-handle">⠿</span>
                  <button class="btn btn-sm btn-danger btn-del-crit" data-crit="${c}" style="padding:2px 6px">✕</button>
                </div>`).join('')}
            </div>
            <hr class="form-divider">
            <div style="display:flex;gap:var(--space-2);flex-wrap:wrap;margin-top:var(--space-3)">
              ${Object.entries(CRIT_LABELS).filter(([k]) => !criteria.includes(k)).map(([k, v]) => `
                <button class="btn btn-secondary btn-sm btn-add-crit" data-crit="${k}">+ ${v}</button>`).join('')}
            </div>
          </div>
          <div class="card-footer">
            <button class="btn btn-primary" id="btn-save-ranking">💾 Enregistrer</button>
          </div>
        </div>
      </div>`;
  };

  // ── THÈME ─────────────────────────────────────────────────────
  const renderTheme = (t) => {
    const th = t.settings?.theme || {};
    const COLORS = ['#2563eb','#7c3aed','#db2777','#dc2626','#d97706','#16a34a','#0891b2','#1e293b','#374151'];
    const FONTS = ['Inter','Roboto','Open Sans','Lato','Poppins','Montserrat','Nunito','Source Sans Pro'];
    return `
      <div class="settings-section active">
        <div><h3 class="settings-title">Apparence</h3>
        <p class="settings-desc">Couleurs et typographie de l'interface</p></div>
        <div class="card">
          <div class="card-body form-section">
            <div class="form-group">
              <label class="form-label">Couleur principale</label>
              <div style="display:flex;align-items:center;gap:var(--space-3);flex-wrap:wrap">
                ${COLORS.map(c => `
                  <div class="color-swatch ${th.primaryColor === c ? 'selected' : ''}"
                       style="background:${c}" data-color="${c}" title="${c}"></div>`).join('')}
                <div style="display:flex;align-items:center;gap:var(--space-2)">
                  <input type="color" id="s-custom-color" value="${th.primaryColor || '#2563eb'}"
                         style="width:32px;height:32px;border:1px solid var(--color-border);border-radius:50%;cursor:pointer;padding:2px">
                  <span class="text-sm text-muted">Personnalisée</span>
                </div>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Police d'écriture</label>
              <select id="s-font" class="form-control">
                ${FONTS.map(f => `<option value="${f}" ${th.font === f ? 'selected' : ''} style="font-family:${f}">${f}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="card-footer">
            <button class="btn btn-secondary" id="btn-reset-theme">Réinitialiser</button>
            <button class="btn btn-primary" id="btn-save-theme">💾 Appliquer</button>
          </div>
        </div>
      </div>`;
  };

  // ── DONNÉES ───────────────────────────────────────────────────
  const renderData = (t) => `
    <div class="settings-section active">
      <div><h3 class="settings-title">Gestion des données</h3>
      <p class="settings-desc">Export, import et réinitialisation</p></div>
      <div style="display:flex;flex-direction:column;gap:var(--space-4)">
        <div class="card">
          <div class="card-header"><span class="card-title">📤 Export</span></div>
          <div class="card-body form-section">
            <p class="text-sm text-muted">Exportez toutes les données du tournoi au format JSON pour les sauvegarder ou les partager.</p>
            <div style="display:flex;gap:var(--space-2)">
              <button class="btn btn-primary" id="btn-export-tournament">📥 Exporter ce tournoi</button>
              <button class="btn btn-secondary" id="btn-export-all">📦 Exporter tout</button>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">📥 Import</span></div>
          <div class="card-body form-section">
            <p class="text-sm text-muted">Importez un tournoi précédemment exporté.</p>
            <input type="file" id="data-import-file" accept=".json" style="display:none">
            <button class="btn btn-secondary" id="btn-import-data">📁 Importer un fichier</button>
          </div>
        </div>
        <div class="card" style="border-color:var(--color-danger)">
          <div class="card-header"><span class="card-title" style="color:var(--color-danger)">⚠️ Zone dangereuse</span></div>
          <div class="card-body form-section">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-3)">
              <div>
                <div class="font-bold">Réinitialiser le tournoi</div>
                <div class="text-sm text-muted">Efface toutes les équipes, matchs et scores. Les joueurs sont conservés.</div>
              </div>
              <button class="btn btn-warning" id="btn-reset-tournament">🔄 Réinitialiser</button>
            </div>
            <hr class="form-divider">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-3)">
              <div>
                <div class="font-bold" style="color:var(--color-danger)">Nouveau tournoi</div>
                <div class="text-sm text-muted">Crée un nouveau tournoi vide. Le tournoi actuel sera archivé dans l'historique.</div>
              </div>
              <button class="btn btn-danger" id="btn-new-tournament">🆕 Nouveau tournoi</button>
            </div>
            <hr class="form-divider">
            <div style="text-align:center;color:var(--color-text-faint);font-size:var(--font-size-xs)">
              Espace utilisé : ${Storage.storageSize()}
            </div>
          </div>
        </div>
      </div>
    </div>`;

  // ── Bind Events par section ────────────────────────────────────
  const bindSectionEvents = () => {
    const s = _section;
    if (s === 'general') bindGeneral();
    if (s === 'courts')  bindCourts();
    if (s === 'levels')  bindLevels();
    if (s === 'formats') bindFormats();
    if (s === 'game')    bindGame();
    if (s === 'ranking') bindRanking();
    if (s === 'theme')   bindTheme();
    if (s === 'data')    bindData();
  };

  // ── Bindings GÉNÉRAL ──────────────────────────────────────────
  const bindGeneral = () => {
    Utils.el('#s-break-enabled', _container)?.addEventListener('change', (e) => {
      Utils.el('#break-times', _container).style.display = e.target.checked ? '' : 'none';
    });

    Utils.el('#btn-upload-logo', _container)?.addEventListener('click', () => {
      Utils.el('#s-logo-file', _container)?.click();
    });

    Utils.el('#s-logo-file', _container)?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const t = App.getTournament();
        t.settings.tournament.logo = ev.target.result;
        App.saveTournament(t);
        _renderPage();
      };
      reader.readAsDataURL(file);
    });

    Utils.el('#btn-remove-logo', _container)?.addEventListener('click', () => {
      const t = App.getTournament();
      t.settings.tournament.logo = null;
      App.saveTournament(t);
      _renderPage();
    });

    Utils.el('#btn-save-general', _container)?.addEventListener('click', () => {
      const t = App.getTournament();
      t.settings.tournament.name       = Utils.el('#s-name', _container)?.value.trim() || t.settings.tournament.name;
      t.settings.tournament.date       = Utils.el('#s-date', _container)?.value || '';
      t.settings.tournament.venue      = Utils.el('#s-venue', _container)?.value.trim() || '';
      t.settings.tournament.startTime  = Utils.el('#s-start-time', _container)?.value || '09:00';
      t.settings.tournament.endTime    = Utils.el('#s-end-time', _container)?.value || '19:00';
      t.settings.tournament.breakEnabled = Utils.el('#s-break-enabled', _container)?.checked || false;
      t.settings.tournament.breakStart = Utils.el('#s-break-start', _container)?.value || '12:00';
      t.settings.tournament.breakEnd   = Utils.el('#s-break-end', _container)?.value || '13:00';
      App.saveTournament(t);
      Audit.log(Audit.ACTIONS.UPDATE, 'setting', 'Paramètres généraux');
      App.toast('Paramètres enregistrés', 'success');
      App.updateNavBadges();
    });
  };

  // ── Bindings TERRAINS ─────────────────────────────────────────
  const bindCourts = () => {
    Utils.el('#btn-add-court', _container)?.addEventListener('click', () => {
      openCourtForm();
    });

    _container.querySelectorAll('.court-toggle').forEach(toggle => {
      toggle.addEventListener('change', () => {
        const t = App.getTournament();
        const court = t.settings.courts.find(c => c.id === toggle.dataset.id);
        if (court) court.available = toggle.checked;
        App.saveTournament(t);
      });
    });

    _container.querySelectorAll('.btn-rename-court').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = App.getTournament();
        const court = t.settings.courts.find(c => c.id === btn.dataset.id);
        if (court) openCourtForm(court);
      });
    });

    _container.querySelectorAll('.btn-del-court').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await App.confirm('Supprimer ce terrain', 'Cette action est irréversible.', { icon: '🗑️' });
        if (!ok) return;
        const t = App.getTournament();
        t.settings.courts = t.settings.courts.filter(c => c.id !== btn.dataset.id);
        App.saveTournament(t);
        _section = 'courts';
        _renderPage();
      });
    });
  };

  const openCourtForm = (court = null) => {
    const isEdit = !!court;
    App.modal.open(isEdit ? '✏️ Renommer le terrain' : '➕ Ajouter un terrain',
      `<div class="form-group">
        <label class="form-label">Nom du terrain</label>
        <input id="court-name-input" class="form-control" value="${Utils.escHtml(court?.name || '')}" placeholder="Terrain 1">
       </div>`,
      { buttons: [
        { label: 'Annuler', class: 'btn-ghost', onClick: () => App.modal.close() },
        { label: isEdit ? 'Renommer' : 'Ajouter', class: 'btn-primary', id: 'btn-court-ok' }
      ]}
    );
    Utils.el('#btn-court-ok')?.addEventListener('click', () => {
      const name = Utils.el('#court-name-input')?.value.trim();
      if (!name) { App.toast('Nom requis', 'error'); return; }
      const t = App.getTournament();
      if (isEdit) {
        const c = t.settings.courts.find(c => c.id === court.id);
        if (c) c.name = name;
      } else {
        t.settings.courts.push({ id: Utils.uuid(), name, available: true });
      }
      App.saveTournament(t);
      Audit.log(isEdit ? Audit.ACTIONS.UPDATE : Audit.ACTIONS.CREATE, 'court', name);
      App.modal.close();
      _section = 'courts';
      _renderPage();
    });
  };

  // ── Bindings NIVEAUX ──────────────────────────────────────────
  const bindLevels = () => {
    Utils.el('#btn-add-level', _container)?.addEventListener('click', () => openLevelForm());
    _container.querySelectorAll('.btn-edit-level').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = App.getTournament();
        const lv = t.settings.levels.find(l => l.id === btn.dataset.id);
        if (lv) openLevelForm(lv);
      });
    });
    _container.querySelectorAll('.btn-del-level').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await App.confirm('Supprimer ce niveau', 'Les joueurs ayant ce niveau ne seront plus associés.', { icon: '🗑️' });
        if (!ok) return;
        const t = App.getTournament();
        t.settings.levels = t.settings.levels.filter(l => l.id !== btn.dataset.id);
        App.saveTournament(t);
        _section = 'levels';
        _renderPage();
      });
    });
  };

  const openLevelForm = (level = null) => {
    const isEdit = !!level;
    App.modal.open(isEdit ? '✏️ Modifier le niveau' : '➕ Ajouter un niveau',
      `<div class="form-section">
        <div class="form-group">
          <label class="form-label">Nom du niveau <span class="required">*</span></label>
          <input id="lv-name" class="form-control" value="${Utils.escHtml(level?.name || '')}" placeholder="Débutant">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Valeur (pour équilibrage)</label>
            <input id="lv-value" type="number" min="1" class="form-control" value="${level?.value || 1}">
            <span class="form-hint">Plus le nombre est grand, meilleur est le niveau</span>
          </div>
          <div class="form-group">
            <label class="form-label">Couleur</label>
            <input id="lv-color" type="color" class="form-control" value="${level?.color || '#3b82f6'}" style="height:40px;padding:4px">
          </div>
        </div>
      </div>`,
      { buttons: [
        { label: 'Annuler', class: 'btn-ghost', onClick: () => App.modal.close() },
        { label: isEdit ? 'Enregistrer' : 'Ajouter', class: 'btn-primary', id: 'btn-lv-ok' }
      ]}
    );
    Utils.el('#btn-lv-ok')?.addEventListener('click', () => {
      const name = Utils.el('#lv-name')?.value.trim();
      const value = parseInt(Utils.el('#lv-value')?.value) || 1;
      const color = Utils.el('#lv-color')?.value || '#3b82f6';
      if (!name) { App.toast('Nom requis', 'error'); return; }
      const t = App.getTournament();
      if (isEdit) {
        const l = t.settings.levels.find(l => l.id === level.id);
        if (l) Object.assign(l, { name, value, color });
      } else {
        t.settings.levels.push({ id: Utils.uuid(), name, value, color });
      }
      App.saveTournament(t);
      Audit.log(isEdit ? Audit.ACTIONS.UPDATE : Audit.ACTIONS.CREATE, 'level', name);
      App.modal.close();
      _section = 'levels';
      _renderPage();
    });
  };

  // ── Bindings FORMATS ──────────────────────────────────────────
  const bindFormats = () => {
    Utils.el('#btn-add-format', _container)?.addEventListener('click', () => openFormatForm());
    _container.querySelectorAll('.btn-edit-format').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = App.getTournament();
        const f = t.settings.matchFormats.find(f => f.id === btn.dataset.id);
        if (f) openFormatForm(f);
      });
    });
    _container.querySelectorAll('.btn-use-format').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = App.getTournament();
        t.settings.game.activeFormatId = btn.dataset.id;
        App.saveTournament(t);
        _section = 'formats';
        _renderPage();
        App.toast('Format activé', 'success');
      });
    });
    _container.querySelectorAll('.btn-del-format').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await App.confirm('Supprimer ce format', 'Cette action est irréversible.');
        if (!ok) return;
        const t = App.getTournament();
        t.settings.matchFormats = t.settings.matchFormats.filter(f => f.id !== btn.dataset.id);
        App.saveTournament(t);
        _section = 'formats';
        _renderPage();
      });
    });
  };

  const openFormatForm = (fmt = null) => {
    const isEdit = !!fmt;
    App.modal.open(isEdit ? '✏️ Modifier le format' : '➕ Nouveau format de match',
      `<div class="form-section">
        <div class="form-group">
          <label class="form-label">Nom du format <span class="required">*</span></label>
          <input id="f-name" class="form-control" value="${Utils.escHtml(fmt?.name || '')}" placeholder="6 Jeux">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Nombre de sets</label>
            <input id="f-sets" type="number" min="1" max="5" class="form-control" value="${fmt?.sets || 1}">
          </div>
          <div class="form-group">
            <label class="form-label">Jeux par set</label>
            <input id="f-games" type="number" min="1" max="15" class="form-control" value="${fmt?.gamesPerSet || 6}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Durée estimée (minutes)</label>
            <input id="f-duration" type="number" min="5" max="240" class="form-control" value="${fmt?.estimatedDuration || 45}">
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:var(--space-2);margin-top:var(--space-2)">
          <label style="display:flex;align-items:center;gap:var(--space-2);font-weight:400">
            <input type="checkbox" id="f-tiebreak" ${fmt?.tiebreak ? 'checked' : ''}> Tie-break
          </label>
          <label style="display:flex;align-items:center;gap:var(--space-2);font-weight:400">
            <input type="checkbox" id="f-golden" ${fmt?.goldenPoint ? 'checked' : ''}> Golden Point
          </label>
        </div>
      </div>`,
      { buttons: [
        { label: 'Annuler', class: 'btn-ghost', onClick: () => App.modal.close() },
        { label: isEdit ? 'Enregistrer' : 'Ajouter', class: 'btn-primary', id: 'btn-f-ok' }
      ]}
    );
    Utils.el('#btn-f-ok')?.addEventListener('click', () => {
      const name = Utils.el('#f-name')?.value.trim();
      if (!name) { App.toast('Nom requis', 'error'); return; }
      const fmtData = {
        name,
        sets: parseInt(Utils.el('#f-sets')?.value) || 1,
        gamesPerSet: parseInt(Utils.el('#f-games')?.value) || 6,
        estimatedDuration: parseInt(Utils.el('#f-duration')?.value) || 45,
        tiebreak: Utils.el('#f-tiebreak')?.checked || false,
        goldenPoint: Utils.el('#f-golden')?.checked || false
      };
      const t = App.getTournament();
      if (isEdit) {
        const f = t.settings.matchFormats.find(f => f.id === fmt.id);
        if (f) Object.assign(f, fmtData);
      } else {
        t.settings.matchFormats.push({ id: Utils.uuid(), ...fmtData });
      }
      App.saveTournament(t);
      Audit.log(isEdit ? Audit.ACTIONS.UPDATE : Audit.ACTIONS.CREATE, 'format', name);
      App.modal.close();
      _section = 'formats';
      _renderPage();
    });
  };

  // ── Bindings GAME ─────────────────────────────────────────────
  const bindGame = () => {
    Utils.el('#btn-save-game', _container)?.addEventListener('click', () => {
      const t = App.getTournament();
      if (!t.settings.game) t.settings.game = {};
      const g = t.settings.game;
      g.playersPerTeam = parseInt(Utils.el('#g-players-per-team', _container)?.value) || 2;
      g.maxTeams = parseInt(Utils.el('#g-max-teams', _container)?.value) || 16;
      g.poolCount = parseInt(Utils.el('#g-pool-count', _container)?.value) || 2;
      g.qualificationCount = parseInt(Utils.el('#g-qual-count', _container)?.value) || 2;
      g.pointsWin = parseInt(Utils.el('#g-pts-win', _container)?.value) ?? 3;
      g.pointsLoss = parseInt(Utils.el('#g-pts-loss', _container)?.value) ?? 0;
      g.pointsDraw = parseInt(Utils.el('#g-pts-draw', _container)?.value) ?? 1;
      g.bracketSize = parseInt(Utils.el('#g-bracket-size', _container)?.value) || 8;
      g.hasFinalTable = Utils.el('#g-has-final', _container)?.checked ?? true;
      g.hasPetiteFinale = Utils.el('#g-petite-finale', _container)?.checked ?? true;
      App.saveTournament(t);
      Audit.log(Audit.ACTIONS.UPDATE, 'setting', 'Règles du jeu');
      App.toast('Règles enregistrées', 'success');
    });
  };

  // ── Bindings RANKING ──────────────────────────────────────────
  const bindRanking = () => {
    // Drag & drop critères
    let draggedItem = null;
    _container.querySelectorAll('.criteria-item').forEach(item => {
      item.addEventListener('dragstart', () => { draggedItem = item; item.style.opacity = '0.5'; });
      item.addEventListener('dragend',   () => { item.style.opacity = ''; draggedItem = null; updateCriteriaRanks(); });
      item.addEventListener('dragover',  (e) => { e.preventDefault(); });
      item.addEventListener('drop', (e) => {
        e.preventDefault();
        if (draggedItem && draggedItem !== item) {
          const list = Utils.el('#criteria-sortable', _container);
          const items = [...list.querySelectorAll('.criteria-item')];
          const fromIdx = items.indexOf(draggedItem);
          const toIdx = items.indexOf(item);
          if (fromIdx < toIdx) list.insertBefore(draggedItem, item.nextSibling);
          else list.insertBefore(draggedItem, item);
          updateCriteriaRanks();
        }
      });
    });

    _container.querySelectorAll('.btn-del-crit').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.closest('.criteria-item')?.remove();
        updateCriteriaRanks();
      });
    });

    _container.querySelectorAll('.btn-add-crit').forEach(btn => {
      btn.addEventListener('click', () => {
        const list = Utils.el('#criteria-sortable', _container);
        const count = list.querySelectorAll('.criteria-item').length;
        const el = document.createElement('div');
        el.className = 'criteria-item';
        el.draggable = true;
        el.dataset.crit = btn.dataset.crit;
        el.innerHTML = `<span class="criteria-rank">${count + 1}</span>
          <span class="criteria-label">${btn.textContent.replace(/^\+\s*/, '')}</span>
          <span class="criteria-drag-handle">⠿</span>
          <button class="btn btn-sm btn-danger btn-del-crit" data-crit="${btn.dataset.crit}" style="padding:2px 6px">✕</button>`;
        el.querySelector('.btn-del-crit').addEventListener('click', () => { el.remove(); updateCriteriaRanks(); });
        list.appendChild(el);
        btn.remove();
      });
    });

    Utils.el('#btn-save-ranking', _container)?.addEventListener('click', () => {
      const t = App.getTournament();
      const criteria = [..._container.querySelectorAll('.criteria-item')].map(el => el.dataset.crit);
      t.settings.game.rankingCriteria = criteria;
      App.saveTournament(t);
      Audit.log(Audit.ACTIONS.UPDATE, 'setting', 'Critères de classement');
      App.toast('Critères enregistrés', 'success');
    });
  };

  const updateCriteriaRanks = () => {
    _container.querySelectorAll('.criteria-item').forEach((item, i) => {
      const rankEl = item.querySelector('.criteria-rank');
      if (rankEl) rankEl.textContent = i + 1;
    });
  };

  // ── Bindings THEME ────────────────────────────────────────────
  const bindTheme = () => {
    let selectedColor = App.getTournament().settings?.theme?.primaryColor || '#2563eb';

    _container.querySelectorAll('.color-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        _container.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
        sw.classList.add('selected');
        selectedColor = sw.dataset.color;
        Utils.el('#s-custom-color', _container).value = selectedColor;
      });
    });

    Utils.el('#s-custom-color', _container)?.addEventListener('input', (e) => {
      _container.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      selectedColor = e.target.value;
    });

    Utils.el('#btn-save-theme', _container)?.addEventListener('click', () => {
      const t = App.getTournament();
      if (!t.settings.theme) t.settings.theme = {};
      t.settings.theme.primaryColor = selectedColor;
      t.settings.theme.font = Utils.el('#s-font', _container)?.value || 'Inter';
      App.saveTournament(t);
      App.applyTheme(t.settings.theme);
      Audit.log(Audit.ACTIONS.UPDATE, 'setting', 'Thème');
      App.toast('Thème appliqué', 'success');
    });

    Utils.el('#btn-reset-theme', _container)?.addEventListener('click', () => {
      const t = App.getTournament();
      t.settings.theme = { primaryColor: '#2563eb', font: 'Inter' };
      App.saveTournament(t);
      App.applyTheme(t.settings.theme);
      _section = 'theme';
      _renderPage();
    });
  };

  // ── Bindings DATA ─────────────────────────────────────────────
  const bindData = () => {
    Utils.el('#btn-export-tournament', _container)?.addEventListener('click', () => {
      const t = App.getTournament();
      Utils.downloadJSON(t, `tournoi-${(t.settings?.tournament?.name || 'export').replace(/\s+/g,'-')}.json`);
      App.toast('Export téléchargé', 'success');
    });

    Utils.el('#btn-export-all', _container)?.addEventListener('click', () => {
      Utils.downloadJSON(Storage.exportAll(), 'padelpro-backup.json');
      App.toast('Sauvegarde téléchargée', 'success');
    });

    Utils.el('#btn-import-data', _container)?.addEventListener('click', () => {
      Utils.el('#data-import-file', _container)?.click();
    });

    Utils.el('#data-import-file', _container)?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = await Utils.readJSONFile(file);
        const ok = await App.confirm('Importer des données', 'Cette action remplacera les données existantes.', { icon: '📥', okClass: 'btn-primary', okLabel: 'Importer' });
        if (!ok) return;
        if (data.id && data.settings) {
          // Single tournament
          Storage.saveTournament(data);
          Storage.setActiveId(data.id);
        } else if (data.version && data.tournaments) {
          await Storage.importAll(data);
        }
        App.refreshActiveTournament();
        App.toast('Import réussi', 'success');
        App.navigate('dashboard');
      } catch (err) {
        App.toast(err.message, 'error');
      }
    });

    Utils.el('#btn-reset-tournament', _container)?.addEventListener('click', async () => {
      const ok = await App.confirm('Réinitialiser le tournoi', 'Les équipes, matchs et scores seront effacés. Les joueurs seront conservés.', { icon: '🔄', okClass: 'btn-warning', okLabel: 'Réinitialiser' });
      if (!ok) return;
      const t = App.getTournament();
      t.teams = []; t.pools = []; t.matches = []; t.bracket = null; t.status = 'setup';
      App.saveTournament(t);
      Audit.log(Audit.ACTIONS.RESET, 'tournament', 'Réinitialisation');
      App.toast('Tournoi réinitialisé', 'success');
      App.navigate('dashboard');
    });

    Utils.el('#btn-new-tournament', _container)?.addEventListener('click', async () => {
      const ok = await App.confirm('Nouveau tournoi', 'Un nouveau tournoi vide sera créé. Le tournoi actuel est conservé dans l\'historique.', { icon: '🆕', okClass: 'btn-danger', okLabel: 'Créer' });
      if (!ok) return;
      const newT = Storage.createNewTournament();
      App.refreshActiveTournament();
      App.toast('Nouveau tournoi créé', 'success');
      App.navigate('history');
      App.wizard.show(newT);
    });
  };

  return { render };
})();
