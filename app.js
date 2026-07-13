'use strict';

/* ═══════════════════════════════════════════════════════════════
   APP — Application principale, routeur, état global
   ═══════════════════════════════════════════════════════════════ */

const App = (() => {

  // ── État global ────────────────────────────────────────────────
  let _tournament = null;
  let _currentPage = null;
  let _events = {};

  // ── Pages & Modules ────────────────────────────────────────────
  const PAGES = {
    dashboard: { title: 'Tableau de bord',  module: () => DashboardModule,  search: false },
    players:   { title: 'Joueurs',           module: () => PlayersModule,    search: true  },
    teams:     { title: 'Équipes',           module: () => TeamsModule,      search: false },
    pools:     { title: 'Poules',            module: () => PoolsModule,      search: false },
    courts:    { title: 'Terrains',          module: () => CourtsModule,     search: false },
    schedule:  { title: 'Planning',          module: () => ScheduleModule,   search: false },
    scores:    { title: 'Scores',            module: () => ScoresModule,     search: false },
    formats:   { title: 'Formats de match',  module: () => FormatsModule,    search: false },
    rankings:  { title: 'Classements',       module: () => RankingsModule,   search: false },
    bracket:   { title: 'Tableau final',     module: () => BracketModule,    search: false },
    stats:     { title: 'Statistiques',      module: () => StatsModule,      search: false },
    display:   { title: 'Affichage public',  module: () => DisplayModule,    search: false },
    history:   { title: 'Accueil',            module: () => HistoryModule,    search: false },
    settings:  { title: 'Paramètres',        module: () => SettingsModule,   search: false }
  };

  // ── Event bus ─────────────────────────────────────────────────
  const on = (event, handler) => {
    if (!_events[event]) _events[event] = [];
    _events[event].push(handler);
  };

  const off = (event, handler) => {
    if (_events[event]) _events[event] = _events[event].filter(h => h !== handler);
  };

  const emit = (event, data) => {
    (_events[event] || []).forEach(h => h(data));
  };

  // ── Accès au tournoi ───────────────────────────────────────────
  const getTournament = () => _tournament;

  const saveTournament = (t) => {
    _tournament = t;
    const ok = Storage.saveActive(t);
    emit('tournament:updated', t);
    updateNavBadges();
    if (!ok) _handleSaveFailure();
  };

  // Alerte visible et persistante (pas juste un toast qui disparaît en 3s) en
  // cas d'échec d'écriture Firestore (hors ligne, règles de sécurité,
  // problème réseau…). Sans ça, l'app aurait l'air de fonctionner (l'écran
  // se met à jour en mémoire) mais rien ne serait réellement sauvegardé :
  // dès qu'un autre appareil recharge, il ne verrait pas les changements.
  let _saveFailureWarningShown = false;
  const _handleSaveFailure = (err) => {
    if (_saveFailureWarningShown) return; // évite de spammer le joueur de messages
    _saveFailureWarningShown = true;
    err = err || Storage.getLastWriteError?.();
    modal.open('⚠️ Échec de la sauvegarde', `
      <div>
        <p style="color:var(--color-danger);font-weight:700;margin-bottom:var(--space-3)">
          Vos dernières modifications n'ont peut-être pas pu être enregistrées en ligne !
        </p>
        <p style="color:var(--color-text-muted);margin-bottom:var(--space-3)">
          ${err?.message ? `Détail technique : ${Utils.escHtml(err.message)}. ` : ''}Vérifiez votre connexion internet. Vos modifications restent visibles à l'écran, mais tant que la connexion n'est pas rétablie, elles ne seront pas visibles depuis un autre appareil.
        </p>
        <p style="color:var(--color-text-muted)">
          Une fois la connexion revenue, ressaisissez ou revalidez votre dernière action pour être sûr qu'elle soit bien enregistrée.
        </p>
      </div>`,
      { buttons: [{ label: 'Compris', class: 'btn-primary', onClick: () => { modal.close(); _saveFailureWarningShown = false; } }] }
    );
  };

  // Recharge le tournoi actif depuis le stockage. À appeler après tout
  // changement de l'ID actif fait directement via Storage (changement de
  // tournoi, création, suppression, import) pour resynchroniser l'état
  // interne de l'App — sans ça, App.getTournament() continue de renvoyer
  // l'ancien tournoi en mémoire et les modifications suivantes (ex: ajout
  // d'un terrain) sont silencieusement appliquées au mauvais tournoi.
  const refreshActiveTournament = () => {
    _tournament = Storage.getActive();
    applyTheme(_tournament?.settings?.theme);
    emit('tournament:updated', _tournament);
    updateNavBadges();
    return _tournament;
  };

  // ── Accès aux joueurs (base globale filtrée par tournoi) ───────
  // Retourne les joueurs inscrits au tournoi actif (avec présence injectée)
  const getPlayers = (t) => {
    const tournament = t || _tournament;
    if (!tournament) return [];
    return Storage.getTournamentPlayers(tournament);
  };

  // Tous les joueurs de la base globale
  const getAllPlayers = () => Storage.getAllPlayersList();

  // ── Routeur ────────────────────────────────────────────────────
  const navigate = (page, pushState = true) => {
    if (!PAGES[page]) page = 'dashboard';

    _currentPage = page;
    const config = PAGES[page];

    // Active nav item
    Utils.els('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });
    // Active bottom-nav item (mobile) — reste inactif si la page courante
    // n'est pas l'une des 4 raccourcis (ex: "players"), c'est normal :
    // ces pages restent accessibles via "Plus" (menu hamburger).
    Utils.els('.bottom-nav-item[data-bottom-page]').forEach(el => {
      el.classList.toggle('active', el.dataset.bottomPage === page);
    });

    // Titre
    const titleEl = Utils.el('#topbar-title');
    if (titleEl) titleEl.textContent = config.title;

    // Search — on bascule une classe (et non un style inline) pour que la
    // règle mobile @media(max-width:480px) puisse forcer le masquage sans
    // être écrasée par un style inline, qui gagnerait toujours sur la
    // feuille de style externe quelle que soit la media query.
    const sw = Utils.el('#search-wrapper');
    if (sw) sw.classList.toggle('is-visible', !!config.search);

    // Fermer sidebar mobile
    document.body.classList.remove('sidebar-open');

    // Rendre le module
    const container = Utils.el('#page-content');
    if (!container) return;

    const mod = config.module();
    if (mod && typeof mod.render === 'function') {
      try {
        mod.render(container);
      } catch (err) {
        console.error('Module render error:', err);
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">⚠️</div>
            <h3>Erreur de chargement</h3>
            <p>${Utils.escHtml(err.message)}</p>
          </div>`;
      }
    } else {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🚧</div><h3>Module en cours de développement</h3></div>`;
    }

    if (pushState) {
      try {
        history.pushState({ page }, config.title, `#${page}`);
      } catch (e) {
        // file:// protocol can block history.pushState on some browsers
      }
    }
  };

  // ── Modal ─────────────────────────────────────────────────────
  const modal = {
    _stack: [],
    open(title, bodyHtml, options = {}) {
      const overlay = Utils.el('#modal-overlay');
      const dialog = Utils.el('#modal-dialog');
      const titleEl = Utils.el('#modal-title');
      const bodyEl = Utils.el('#modal-body');
      const footerEl = Utils.el('#modal-footer');

      titleEl.textContent = title;

      if (typeof bodyHtml === 'string') bodyEl.innerHTML = bodyHtml;
      else { bodyEl.innerHTML = ''; bodyEl.appendChild(bodyHtml); }

      // Footer buttons
      footerEl.innerHTML = '';
      if (options.footer) {
        if (typeof options.footer === 'string') footerEl.innerHTML = options.footer;
        else footerEl.appendChild(options.footer);
      } else if (options.buttons) {
        options.buttons.forEach(btn => {
          const b = document.createElement('button');
          b.className = `btn ${btn.class || 'btn-secondary'}`;
          b.textContent = btn.label;
          if (btn.id) b.id = btn.id;
          if (btn.onClick) b.addEventListener('click', btn.onClick);
          footerEl.appendChild(b);
        });
      }

      // Size
      dialog.className = 'modal-dialog' + (options.size ? ` modal-${options.size}` : '');

      overlay.classList.add('active');
      overlay.setAttribute('aria-hidden', 'false');

      // Focus first input
      setTimeout(() => {
        const first = dialog.querySelector('input, select, textarea');
        if (first) first.focus();
      }, 0);
    },

    close() {
      const overlay = Utils.el('#modal-overlay');
      overlay.classList.remove('active');
      overlay.setAttribute('aria-hidden', 'true');
    },

    setTitle(title) {
      const el = Utils.el('#modal-title');
      if (el) el.textContent = title;
    }
  };

  // ── Confirm ────────────────────────────────────────────────────
  const confirm = (title, message, options = {}) => {
    return new Promise((resolve) => {
      const overlay = Utils.el('#confirm-overlay');
      Utils.el('#confirm-title').textContent = title;
      Utils.el('#confirm-message').textContent = message;
      Utils.el('#confirm-icon').textContent = options.icon || '⚠️';

      const okBtn = Utils.el('#confirm-ok-btn');
      okBtn.textContent = options.okLabel || 'Confirmer';
      okBtn.className = `btn ${options.okClass || 'btn-danger'}`;

      overlay.classList.add('active');

      const cleanup = (result) => {
        overlay.classList.remove('active');
        okBtn.removeEventListener('click', onOk);
        Utils.el('#confirm-cancel-btn').removeEventListener('click', onCancel);
        resolve(result);
      };

      const onOk = () => cleanup(true);
      const onCancel = () => cleanup(false);

      okBtn.addEventListener('click', onOk);
      Utils.el('#confirm-cancel-btn').addEventListener('click', onCancel);
    });
  };

  // ── Toast Notifications ────────────────────────────────────────
  const toast = (message, type = 'info', title = null) => {
    const container = Utils.el('#toast-container');
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const titles = { success: 'Succès', error: 'Erreur', warning: 'Attention', info: 'Info' };

    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
      <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
      <div class="toast-body">
        <div class="toast-title">${Utils.escHtml(title || titles[type])}</div>
        ${message ? `<div class="toast-msg">${Utils.escHtml(message)}</div>` : ''}
      </div>`;

    container.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 3200);
  };

  // ── Nav badges ────────────────────────────────────────────────
  const updateNavBadges = () => {
    const t = _tournament;
    if (!t) return;

    const badgePlayers = Utils.el('#badge-players');
    const badgeTeams = Utils.el('#badge-teams');

    if (badgePlayers) {
      const count = (t.playerIds || t.players || []).length;
      badgePlayers.textContent = count > 0 ? count : '';
      badgePlayers.style.display = count > 0 ? '' : 'none';
    }
    if (badgeTeams) {
      const count = (t.teams || []).length;
      badgeTeams.textContent = count > 0 ? count : '';
      badgeTeams.style.display = count > 0 ? '' : 'none';
    }

    const badgeCourts = Utils.el('#badge-courts');
    if (badgeCourts) {
      const running = (t.matches || []).filter(m => m.status === 'running').length;
      badgeCourts.textContent = running > 0 ? running : '';
      badgeCourts.style.display = running > 0 ? '' : 'none';
      badgeCourts.style.background = running > 0 ? 'var(--color-warning)' : '';
    }

    // Update sidebar tournament info
    const nameEl = Utils.el('#nav-tournament-name');
    const dateEl = Utils.el('#nav-tournament-date');
    const statusEl = Utils.el('#nav-tournament-status');

    const tName = t.settings?.tournament?.name || 'Tournoi de Padel';
    document.body.setAttribute('data-tournament-name', tName);
    if (nameEl) nameEl.textContent = tName;
    if (dateEl) dateEl.textContent = t.settings?.tournament?.date ? Utils.formatShortDate(t.settings.tournament.date) : '—';
    if (statusEl) {
      const statusMap = { setup: 'Configuration', running: 'En cours', finished: 'Terminé' };
      statusEl.textContent = statusMap[t.status] || 'Configuration';
      statusEl.className = `stc-badge ${t.status || 'setup'}`;
    }

    // Topbar : nom du tournoi actif
    const topbarName = Utils.el('#topbar-tournament-name');
    if (topbarName) topbarName.textContent = tName;

    // Bannière tournoi actif
    const banner = Utils.el('#tournament-banner');
    const bannerName = Utils.el('#banner-tournament-name');
    const bannerDate = Utils.el('#banner-tournament-date');
    const bannerStatus = Utils.el('#banner-tournament-status');
    if (banner) {
      banner.style.display = 'flex';
      if (bannerName) bannerName.textContent = tName;
      if (bannerDate) bannerDate.textContent = t.settings?.tournament?.date ? Utils.formatShortDate(t.settings.tournament.date) : '';
      if (bannerStatus) {
        const statusMap = { setup: '⚙️ Configuration', running: '▶ En cours', finished: '✅ Terminé' };
        bannerStatus.textContent = statusMap[t.status] || '⚙️ Configuration';
      }
    }
  };

  // ── Sidebar ────────────────────────────────────────────────────
  const initSidebar = () => {
    const prefs = Storage.getPreferences();

    if (prefs.sidebarCollapsed) document.body.classList.add('sidebar-collapsed');

    Utils.el('#sidebar-collapse')?.addEventListener('click', () => {
      document.body.classList.toggle('sidebar-collapsed');
      const collapsed = document.body.classList.contains('sidebar-collapsed');
      const p = Storage.getPreferences();
      Storage.savePreferences({ ...p, sidebarCollapsed: collapsed });
    });

    Utils.el('#mobile-menu-btn')?.addEventListener('click', () => {
      document.body.classList.toggle('sidebar-open');
    });

    Utils.el('#sidebar-overlay')?.addEventListener('click', () => {
      document.body.classList.remove('sidebar-open');
    });

    // Bottom navigation (mobile) : 4 raccourcis directs + "Plus" qui ouvre
    // le même tiroir hamburger que le sidebar (pas de logique dupliquée).
    Utils.els('.bottom-nav-item[data-bottom-page]').forEach(item => {
      item.addEventListener('click', () => navigate(item.dataset.bottomPage));
    });
    Utils.el('#bottom-nav-more')?.addEventListener('click', () => {
      document.body.classList.toggle('sidebar-open');
    });

    // Bouton topbar "Nouveau tournoi"
    Utils.el('#btn-new-tournament-topbar')?.addEventListener('click', async () => {
      const ok = await App.confirm(
        'Nouveau tournoi',
        "Le tournoi actuel sera conservé dans l'Historique. Vous pourrez y revenir à tout moment.",
        { icon: '🏆', okLabel: 'Créer', okClass: 'btn-primary' }
      );
      if (!ok) return;
      _tournament = Storage.createNewTournament();
      updateNavBadges();
      navigate('dashboard');
      wizard.show(_tournament);
    });

    // Nav items click
    Utils.els('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(item.dataset.page);
      });
    });
  };

  // ── Topbar actions ─────────────────────────────────────────────
  const initTopbar = () => {
    Utils.el('#btn-fullscreen-display')?.addEventListener('click', () => {
      navigate('display');
    });

    Utils.el('#btn-print-page')?.addEventListener('click', () => {
      window.print();
    });

    // Modal close
    Utils.el('#modal-close-btn')?.addEventListener('click', () => modal.close());
    // Fermeture au clic sur le fond : on exige que le mousedown ET le click
    // aient tous les deux commencé sur le fond lui-même. Sans ça, glisser la
    // souris depuis un champ du formulaire (ex: les flèches d'un input time /
    // number, ou une sélection de texte) jusqu'en dehors de la boîte de
    // dialogue relâche le clic sur l'overlay et ferme la modale par erreur.
    let _overlayMouseDownOnSelf = false;
    Utils.el('#modal-overlay')?.addEventListener('mousedown', (e) => {
      _overlayMouseDownOnSelf = e.target === Utils.el('#modal-overlay');
    });
    Utils.el('#modal-overlay')?.addEventListener('click', (e) => {
      if (_overlayMouseDownOnSelf && e.target === Utils.el('#modal-overlay')) modal.close();
      _overlayMouseDownOnSelf = false;
    });

    // Keyboard
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        modal.close();
        DisplayModule?.close?.();
      }
    });
  };

  // ── Theme application ──────────────────────────────────────────
  const applyTheme = (theme) => {
    if (!theme) return;
    const root = document.documentElement;
    if (theme.primaryColor) {
      root.style.setProperty('--color-primary', theme.primaryColor);
      const meta = Utils.el('#meta-theme-color') || document.querySelector('meta[name="theme-color"]');
      if (meta) meta.content = theme.primaryColor;
    }
    if (theme.secondaryColor) root.style.setProperty('--color-secondary', theme.secondaryColor);
    if (theme.font) root.style.setProperty('--font-family', `'${theme.font}', system-ui, sans-serif`);
  };

  // ── Wizard de création de tournoi ─────────────────────────────
  const wizard = (() => {
    let _step = 1;
    const TOTAL = 4;
    let _data = {};

    // Catégories officielles FFT 2026 — affichées intégralement dans un
    // <select> plutôt qu'un datalist, car un datalist filtre ses suggestions
    // par préfixe du texte déjà saisi : avec "P25" pré-rempli, le navigateur
    // ne proposait que "P25" et "P250" (les seules valeurs commençant par
    // "P25"), donnant l'impression trompeuse qu'il n'existait que 2 catégories.
    const FFT_CATEGORIE_OPTIONS = [
      ['P25', 'P25 — Débutant · 25 pts'],
      ['P50', 'P50 — Intermédiaire · 50 pts'],
      ['P100', 'P100 — Inter./Confirmé · 100 pts'],
      ['P250', 'P250 — Confirmé · 250 pts'],
      ['P500', 'P500 — Avancé · 500 pts'],
      ['P1000', 'P1000 — Expert · 1000 pts'],
      ['P1500', 'P1500 — Élite · 1500 pts'],
      ['P2000', 'P2000 — Élite · 2000 pts'],
      ['P3000', 'P3000 — Championnat de France'],
    ];
    const FFT_CATEGORIE_VALUES = FFT_CATEGORIE_OPTIONS.map(([v]) => v);

    const _isFresh = (t) =>
      (!t.playerIds || t.playerIds.length === 0) &&
      (!t.teams || t.teams.length === 0) &&
      (!t.matches || t.matches.length === 0);

    const show = (t) => {
      t = t || Storage.getActive();
      if (!t) return;
      _step = 1;
      const defFmts = Storage.DEFAULT_SETTINGS.matchFormats;
      _data = {
        name: (t.settings?.tournament?.name && t.settings.tournament.name !== 'Tournoi de Padel')
              ? t.settings.tournament.name : '',
        date: t.settings?.tournament?.date || new Date().toISOString().split('T')[0],
        venue: t.settings?.tournament?.venue || '',
        startTime: t.settings?.tournament?.startTime || '09:00',
        endTime: t.settings?.tournament?.endTime || '19:00',
        breakEnabled: t.settings?.tournament?.breakEnabled || false,
        breakStart: t.settings?.tournament?.breakStart || '12:00',
        breakEnd: t.settings?.tournament?.breakEnd || '13:00',
        courts: (t.settings?.courts?.length
          ? t.settings.courts
          : [{ id: 'court-1', name: 'Terrain 1', available: true },
             { id: 'court-2', name: 'Terrain 2', available: true }]
        ).map(c => ({ ...c })),
        activeFormatId: t.settings?.game?.activeFormatId || 'fmt-1',
        matchFormats: t.settings?.matchFormats?.length ? t.settings.matchFormats : defFmts,
        poolCount: t.settings?.game?.poolCount || 4,
        maxTeams: t.settings?.game?.maxTeams || 16,
        qualificationCount: t.settings?.game?.qualificationCount || 1,
        hasPetiteFinale: t.settings?.game?.hasPetiteFinale !== false,
        categorie: t.settings?.game?.categorie || 'P25',
        genre: t.settings?.game?.genre || 'Mixte',
      };
      const overlay = Utils.el('#wizard-overlay');
      if (overlay) overlay.style.display = 'flex';
      _render();
    };

    const hide = () => {
      const overlay = Utils.el('#wizard-overlay');
      if (overlay) overlay.style.display = 'none';
    };

    const _stepLabels = ['Tournoi', 'Terrains', 'Format', 'Structure'];

    const _renderProgress = () => {
      const items = [];
      _stepLabels.forEach((label, i) => {
        const n = i + 1;
        const cls = n < _step ? 'done' : n === _step ? 'active' : '';
        const icon = n < _step ? '✓' : String(n);
        items.push(`<div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0">
          <div class="wizard-step-dot ${cls}">${icon}</div>
          <div class="wizard-step-label" style="${n === _step ? 'color:var(--color-primary);font-weight:700' : ''}">${label}</div>
        </div>`);
        if (i < _stepLabels.length - 1) {
          items.push(`<div class="wizard-step-line ${i + 1 < _step ? 'done' : ''}" style="margin-bottom:20px"></div>`);
        }
      });
      return `<div style="display:flex;align-items:flex-start;gap:var(--space-2);padding:var(--space-4) var(--space-6) 0;background:var(--color-bg-alt)">${items.join('')}</div>`;
    };

    const _esc = (s) => Utils.escAttr(s);

    const _renderStep1 = () => `
      <div class="wizard-body">
        <div class="wizard-step-title">🏆 Votre tournoi</div>
        <div class="wizard-step-desc">Commençons par les informations de base.</div>
        <div class="form-group">
          <label class="form-label">Nom du tournoi <span style="color:var(--color-danger)">*</span></label>
          <input id="wz-name" type="text" class="form-control" placeholder="Ex: Open Padel Club Municipal" value="${_esc(_data.name)}" autocomplete="off">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Date</label>
            <input id="wz-date" type="date" class="form-control" value="${_data.date}">
          </div>
          <div class="form-group">
            <label class="form-label">Lieu</label>
            <input id="wz-venue" type="text" class="form-control" placeholder="Nom du club..." value="${_esc(_data.venue)}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">⏰ Début</label>
            <input id="wz-start" type="time" class="form-control" value="${_data.startTime}">
          </div>
          <div class="form-group">
            <label class="form-label">🏁 Fin prévue</label>
            <input id="wz-end" type="time" class="form-control" value="${_data.endTime}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Catégorie FFT</label>
            <select id="wz-categorie" class="form-control">
              <optgroup label="Catégories officielles FFT 2026">
                ${FFT_CATEGORIE_OPTIONS.map(([v, l]) =>
                  `<option value="${v}" ${_data.categorie === v ? 'selected' : ''}>${l}</option>`).join('')}
              </optgroup>
              <optgroup label="Non homologué">
                ${['Open','Regional','Club'].map(v =>
                  `<option value="${v}" ${_data.categorie === v ? 'selected' : ''}>${v}</option>`).join('')}
              </optgroup>
              <option value="__custom__" ${!FFT_CATEGORIE_VALUES.includes(_data.categorie) && !['Open','Regional','Club'].includes(_data.categorie) ? 'selected' : ''}>Autre (personnalisé)…</option>
            </select>
            <input id="wz-categorie-custom" type="text" class="form-control" placeholder="Ex: Amical, Interne club..."
              value="${!FFT_CATEGORIE_VALUES.includes(_data.categorie) && !['Open','Regional','Club'].includes(_data.categorie) ? _esc(_data.categorie) : ''}"
              autocomplete="off"
              style="margin-top:6px;display:${!FFT_CATEGORIE_VALUES.includes(_data.categorie) && !['Open','Regional','Club'].includes(_data.categorie) ? 'block' : 'none'}">
            <p class="form-hint" style="margin-top:4px;font-size:11px;color:var(--color-text-muted)">Catégories officielles FFT 2026 (P25 à P2000) ou format libre pour un tournoi non homologué.</p>
          </div>
          <div class="form-group">
            <label class="form-label">Genre</label>
            <select id="wz-genre" class="form-control">
              ${['Masculin','Féminin','Mixte'].map(g =>
                `<option value="${g}" ${_data.genre === g ? 'selected' : ''}>${g}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">👥 Nombre d'équipes attendues</label>
          <select id="wz-maxteams-s1" class="form-control">
            ${[4,6,8,10,12,16,20,24,32].map(n =>
              `<option value="${n}" ${_data.maxTeams === n ? 'selected' : ''}>${n} équipes</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-weight:400">
            <input type="checkbox" id="wz-break" ${_data.breakEnabled ? 'checked' : ''}>
            Inclure une pause déjeuner
          </label>
          <div id="wz-break-times" style="display:${_data.breakEnabled ? 'flex' : 'none'};gap:var(--space-3);margin-top:var(--space-3)">
            <div class="form-group" style="flex:1;margin:0">
              <label class="form-label" style="font-size:11px">Début pause</label>
              <input id="wz-break-start" type="time" class="form-control" value="${_data.breakStart}">
            </div>
            <div class="form-group" style="flex:1;margin:0">
              <label class="form-label" style="font-size:11px">Fin pause</label>
              <input id="wz-break-end" type="time" class="form-control" value="${_data.breakEnd}">
            </div>
          </div>
        </div>
      </div>`;

    const _renderStep2 = () => `
      <div class="wizard-body">
        <div class="wizard-step-title">🎾 Terrains</div>
        <div class="wizard-step-desc">Combien de terrains seront disponibles ?</div>
        <div class="wizard-court-list" id="wz-courts">
          ${_data.courts.map((c, i) => `
            <div class="wizard-court-row" data-idx="${i}">
              <span style="font-size:16px">🎾</span>
              <input type="text" class="form-control wz-court-name" placeholder="Nom du terrain..." value="${_esc(c.name)}">
              ${_data.courts.length > 1
                ? `<button class="btn-icon-sm wz-remove-court" data-idx="${i}" title="Supprimer">✕</button>`
                : ''}
            </div>`).join('')}
        </div>
        <button class="btn btn-secondary btn-sm" id="wz-add-court" style="margin-top:var(--space-2)">+ Ajouter un terrain</button>
        <div id="wz-advice-container">${_renderAdvice()}</div>
      </div>`;

    const _renderStep3 = () => {
      const formats = _data.matchFormats;
      const selFmt = formats.find(f => f.id === _data.activeFormatId) || formats[0];
      return `
      <div class="wizard-body">
        <div class="wizard-step-title">📋 Format de match</div>
        <div class="wizard-step-desc">Choisissez le format utilisé pour tous les matchs.</div>
        <div class="wizard-format-grid">
          ${formats.map(f => `
            <label class="wizard-format-card ${f.id === _data.activeFormatId ? 'selected' : ''}">
              <input type="radio" name="wz-fmt" value="${f.id}" ${f.id === _data.activeFormatId ? 'checked' : ''} style="display:none">
              <div class="wizard-format-card-icon">${f.sets > 1 ? '🎯' : f.gamesPerSet >= 9 ? '⚡' : '🏓'}</div>
              <div class="wizard-format-card-name">${Utils.escHtml(f.name)}</div>
              <div class="wizard-format-card-desc">${f.sets === 1 ? f.gamesPerSet + ' jeux' : f.sets + ' sets de ' + f.gamesPerSet} · ~${f.estimatedDuration} min</div>
            </label>`).join('')}
        </div>
        <div id="wz-advice-container">${_renderAdvice()}</div>
      </div>`;
    };

    const _renderStep4 = () => `
      <div class="wizard-body">
        <div class="wizard-step-title">🗂️ Structure du tournoi</div>
        <div class="wizard-step-desc">Définissez la taille et le format de compétition.</div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Équipes attendues</label>
            <select id="wz-maxteams" class="form-control">
              ${[4,6,8,10,12,16,20,24,32].map(n =>
                `<option value="${n}" ${_data.maxTeams === n ? 'selected' : ''}>${n} équipes</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Nombre de poules</label>
            <select id="wz-pools" class="form-control">
              ${[1,2,3,4,5,6,8].map(n =>
                `<option value="${n}" ${_data.poolCount === n ? 'selected' : ''}>${n} poule${n > 1 ? 's' : ''}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Format de qualification</label>
          <div style="display:flex;flex-direction:column;gap:var(--space-2)">
            <label style="display:flex;align-items:flex-start;gap:10px;padding:12px;border:2px solid var(--color-border);border-radius:var(--radius-md);cursor:pointer">
              <input type="radio" name="wz-qual" value="1" style="margin-top:2px" ${_data.qualificationCount === 1 ? 'checked' : ''}>
              <div>
                <div style="font-weight:700;font-size:var(--font-size-sm)">🎯 Format P25 — 1 qualifié par poule</div>
                <div style="font-size:11px;color:var(--color-text-muted)">Seule la 1ère équipe accède au tableau principal. Les autres jouent les tableaux de classement.</div>
              </div>
            </label>
            <label style="display:flex;align-items:flex-start;gap:10px;padding:12px;border:2px solid var(--color-border);border-radius:var(--radius-md);cursor:pointer">
              <input type="radio" name="wz-qual" value="2" style="margin-top:2px" ${_data.qualificationCount === 2 ? 'checked' : ''}>
              <div>
                <div style="font-weight:700;font-size:var(--font-size-sm)">🏅 Format P50/P100 — 2 qualifiés par poule</div>
                <div style="font-size:11px;color:var(--color-text-muted)">Les 2 premières équipes de chaque poule accèdent au tableau principal.</div>
              </div>
            </label>
            <label style="display:flex;align-items:flex-start;gap:10px;padding:12px;border:2px solid var(--color-border);border-radius:var(--radius-md);cursor:pointer">
              <input type="radio" name="wz-qual" value="3" style="margin-top:2px" ${_data.qualificationCount === 3 ? 'checked' : ''}>
              <div>
                <div style="font-weight:700;font-size:var(--font-size-sm)">🥇 Format P250/P500 — 3+ qualifiés par poule</div>
                <div style="font-size:11px;color:var(--color-text-muted)">Les 3 premières équipes de chaque poule accèdent au tableau principal.</div>
              </div>
            </label>
          </div>
        </div>
        <div class="form-group">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-weight:400">
            <input type="checkbox" id="wz-petite" ${_data.hasPetiteFinale ? 'checked' : ''}>
            Petite finale (match pour la 3ème place dans le tableau principal)
          </label>
        </div>
        <div id="wz-summary" style="margin-top:var(--space-3);padding:var(--space-3);background:var(--color-primary-alpha);border-radius:var(--radius-md);font-size:var(--font-size-sm);border:1px solid rgba(37,99,235,0.2)"></div>
        <div id="wz-advice-container"></div>
      </div>`;

    // ── Calcul des conseils de planning ────────────────────────
    const _computeAdvice = () => {
      const toMin = (t) => { const [h, m] = (t || '00:00').split(':').map(Number); return h * 60 + m; };
      const startMin = toMin(_data.startTime || '09:00');
      const endMin   = toMin(_data.endTime   || '18:00');
      let totalMin = endMin - startMin;
      if (_data.breakEnabled) {
        const bDur = toMin(_data.breakEnd || '13:00') - toMin(_data.breakStart || '12:00');
        totalMin -= Math.max(0, bDur);
      }
      if (totalMin <= 0) return null;

      const courts   = _data.courts.length;
      const fmt      = (_data.matchFormats || []).find(f => f.id === _data.activeFormatId);
      const matchDur = (fmt?.estimatedDuration || 45) + 5; // +5 min rotation
      const slotsPerCourt = Math.floor(totalMin / matchDur);
      const totalSlots    = courts * slotsPerCourt;

      const maxTeams  = _data.maxTeams  || 16;
      const poolCount = _data.poolCount || 4;
      const qualCount = _data.qualificationCount || 1;
      const teamsPerPool  = Math.ceil(maxTeams / poolCount);
      const poolMatches   = poolCount * Math.round(teamsPerPool * (teamsPerPool - 1) / 2);
      const mainSize      = Math.pow(2, Math.ceil(Math.log2(Math.max(poolCount * qualCount, 2))));
      const consolTeams   = Math.max(0, maxTeams - poolCount * qualCount);
      const bracketMatches = (mainSize - 1) + (_data.hasPetiteFinale ? 1 : 0) + Math.max(0, consolTeams - 1);
      const totalMatches  = poolMatches + bracketMatches;
      const courtsNeeded  = slotsPerCourt > 0 ? Math.ceil(totalMatches / slotsPerCourt) : courts;

      const status = totalSlots >= totalMatches * 1.15 ? 'ok' : totalSlots >= totalMatches ? 'tight' : 'over';
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      const timeStr = h > 0 ? `${h}h${m > 0 ? String(m).padStart(2, '0') : ''}` : `${m} min`;

      return { courts, slotsPerCourt, totalSlots, totalMatches, courtsNeeded, timeStr, matchDur, status, poolMatches, bracketMatches };
    };

    const _renderAdvice = () => {
      const a = _computeAdvice();
      if (!a) return `<div style="margin-top:var(--space-3);padding:var(--space-3);background:var(--color-bg-alt);border-radius:var(--radius-md);font-size:12px;color:var(--color-text-muted)">ℹ️ Renseignez les horaires (étape 1) pour obtenir des conseils personnalisés.</div>`;

      const C = { ok: '#16a34a', tight: '#d97706', over: '#dc2626' };
      const I = { ok: '✅', tight: '⚠️', over: '🔴' };
      const M = {
        ok:    `Planning réalisable — ${a.courts} terrain(s) suffisent pour finir dans les temps.`,
        tight: `Planning serré — risque de dépassement en fin de journée.`,
        over:  `Impossible de terminer à l'heure avec ${a.courts} terrain(s). Il en faudrait au moins ${a.courtsNeeded}.`,
      };
      const c = C[a.status];
      return `
        <div id="wz-advice-box" style="margin-top:var(--space-4);border-radius:var(--radius-lg);border:1px solid ${c};overflow:hidden;font-size:12px">
          <div style="background:${c}20;padding:8px 12px;display:flex;align-items:center;gap:8px;border-bottom:1px solid ${c}40">
            <span style="font-size:1rem">${I[a.status]}</span>
            <span style="font-weight:700;color:${c}">${M[a.status]}</span>
          </div>
          <div style="padding:var(--space-3);background:var(--color-bg-alt);display:grid;grid-template-columns:1fr 1fr;gap:8px;color:var(--color-text-muted)">
            <div>⏱️ Temps utile &nbsp;<b style="color:var(--color-text)">${a.timeStr}</b></div>
            <div>⌛ Durée/match &nbsp;<b style="color:var(--color-text)">${a.matchDur} min</b></div>
            <div>🎾 Créneaux/terrain &nbsp;<b style="color:var(--color-text)">${a.slotsPerCourt}</b></div>
            <div>🏓 Capacité totale &nbsp;<b style="color:var(--color-text)">${a.totalSlots}</b></div>
            <div>📋 Matchs poules &nbsp;<b style="color:var(--color-text)">~${a.poolMatches}</b></div>
            <div>🏆 Matchs tableau &nbsp;<b style="color:var(--color-text)">~${a.bracketMatches}</b></div>
            <div style="grid-column:span 2;padding-top:6px;border-top:1px solid var(--color-border-light)">
              Total estimé : <b style="color:var(--color-text)">${a.totalMatches} matchs</b>
              — capacité <b style="color:${a.totalSlots >= a.totalMatches ? '#16a34a' : '#dc2626'}">${a.totalSlots} créneaux</b>
              ${a.status === 'over' ? `→ <b style="color:#dc2626">recommandé : ${a.courtsNeeded} terrain(s)</b>` : ''}
            </div>
          </div>
        </div>`;
    };

    const _refreshAdvice = () => {
      const container = Utils.el('#wz-advice-container');
      if (container) container.innerHTML = _renderAdvice();
    };

    const _updateSummary = () => {
      const maxTeams = parseInt(Utils.el('#wz-maxteams')?.value || _data.maxTeams);
      const poolCount = parseInt(Utils.el('#wz-pools')?.value || _data.poolCount);
      const qualCount = parseInt(document.querySelector('input[name="wz-qual"]:checked')?.value || _data.qualificationCount);
      // Sync to _data so advice uses current values
      _data.maxTeams = maxTeams; _data.poolCount = poolCount; _data.qualificationCount = qualCount;
      const teamsPerPool  = Math.ceil(maxTeams / poolCount);
      const matchesPerPool = (teamsPerPool * (teamsPerPool - 1)) / 2;
      const totalPoolMatches = matchesPerPool * poolCount;
      const mainSize = Math.pow(2, Math.ceil(Math.log2(Math.max(poolCount * qualCount, 2))));
      const classCount = Math.max(0, teamsPerPool - qualCount);
      const el = Utils.el('#wz-summary');
      if (el) el.innerHTML =
        `<strong>Aperçu :</strong> ${poolCount} poule${poolCount > 1 ? 's' : ''} de ~${teamsPerPool} équipes
        · ${totalPoolMatches} matchs de poule
        · Tableau principal de ${mainSize} équipes
        · ${classCount} tableau${classCount > 1 ? 'x' : ''} de classement
        · Minimum <strong>${matchesPerPool + Math.ceil(Math.log2(Math.max(mainSize, 2)))} matchs</strong> garantis par équipe`;
      _refreshAdvice();
    };

    const _collectCourts = () => {
      document.querySelectorAll('.wz-court-name').forEach((inp, i) => {
        if (_data.courts[i]) _data.courts[i].name = inp.value.trim() || `Terrain ${i + 1}`;
      });
    };

    const _collect = () => {
      if (_step === 1) {
        _data.name = Utils.el('#wz-name')?.value.trim() || 'Tournoi de Padel';
        _data.date = Utils.el('#wz-date')?.value || new Date().toISOString().split('T')[0];
        _data.venue = Utils.el('#wz-venue')?.value.trim() || '';
        _data.startTime = Utils.el('#wz-start')?.value || '09:00';
        _data.endTime = Utils.el('#wz-end')?.value || '19:00';
        _data.breakEnabled = Utils.el('#wz-break')?.checked || false;
        _data.breakStart = Utils.el('#wz-break-start')?.value || '12:00';
        _data.breakEnd = Utils.el('#wz-break-end')?.value || '13:00';
        const catSel = Utils.el('#wz-categorie')?.value || 'P25';
        _data.categorie = catSel === '__custom__'
          ? (Utils.el('#wz-categorie-custom')?.value.trim() || 'P25')
          : catSel;
        _data.genre = Utils.el('#wz-genre')?.value || 'Mixte';
        _data.maxTeams = parseInt(Utils.el('#wz-maxteams-s1')?.value) || 16;
      } else if (_step === 2) {
        _collectCourts();
      } else if (_step === 3) {
        _data.activeFormatId = document.querySelector('input[name="wz-fmt"]:checked')?.value || _data.activeFormatId;
      } else if (_step === 4) {
        _data.maxTeams = parseInt(Utils.el('#wz-maxteams')?.value) || 16;
        _data.poolCount = parseInt(Utils.el('#wz-pools')?.value) || 4;
        _data.qualificationCount = parseInt(document.querySelector('input[name="wz-qual"]:checked')?.value) || 1;
        _data.hasPetiteFinale = Utils.el('#wz-petite')?.checked !== false;
      }
    };

    const _validate = () => {
      if (_step === 1) {
        const name = Utils.el('#wz-name')?.value.trim();
        if (!name) {
          Utils.el('#wz-name')?.focus();
          Utils.el('#wz-name')?.classList.add('input-error');
          toast('Le nom du tournoi est obligatoire', 'warning');
          return false;
        }
        Utils.el('#wz-name')?.classList.remove('input-error');
      }
      return true;
    };

    const _render = () => {
      const box = Utils.el('#wizard-box');
      if (!box) return;

      let stepHtml = '';
      if (_step === 1) stepHtml = _renderStep1();
      else if (_step === 2) stepHtml = _renderStep2();
      else if (_step === 3) stepHtml = _renderStep3();
      else if (_step === 4) stepHtml = _renderStep4();

      box.innerHTML = `
        <div class="wizard-header" style="position:relative">
          <button id="wz-close" title="Annuler" style="position:absolute;top:var(--space-3);right:var(--space-3);background:none;border:none;font-size:18px;cursor:pointer;color:var(--color-text-muted);line-height:1;padding:4px 8px;border-radius:var(--radius-sm)">&#x2715;</button>
          <div class="wizard-logo">🏆</div>
          <div class="wizard-title">Nouveau tournoi</div>
          <div class="wizard-subtitle">Configuration en ${TOTAL} étapes</div>
        </div>
        ${_renderProgress()}
        ${stepHtml}
        <div class="wizard-footer">
          <div>
            ${_step > 1 ? `<button class="btn btn-ghost" id="wz-prev">← Retour</button>` : '<div></div>'}
          </div>
          <div class="wizard-step-counter">Étape ${_step} / ${TOTAL}</div>
          <button class="btn btn-primary" id="wz-next">${_step === TOTAL ? '🎉 Créer le tournoi' : 'Suivant →'}</button>
        </div>`;

      Utils.el('#wz-prev')?.addEventListener('click', () => { _collect(); _step--; _render(); });
      Utils.el('#wz-next')?.addEventListener('click', () => {
        if (!_validate()) return;
        _collect();
        if (_step < TOTAL) { _step++; _render(); }
        else _finish();
      });

      Utils.el('#wz-close')?.addEventListener('click', () => hide());

      if (_step === 1) {
        Utils.el('#wz-break')?.addEventListener('change', (e) => {
          const div = Utils.el('#wz-break-times');
          if (div) div.style.display = e.target.checked ? 'flex' : 'none';
        });
        Utils.el('#wz-maxteams-s1')?.addEventListener('change', () => {
          _data.maxTeams = parseInt(Utils.el('#wz-maxteams-s1')?.value) || 16;
        });
        Utils.el('#wz-categorie')?.addEventListener('change', (e) => {
          const customInput = Utils.el('#wz-categorie-custom');
          if (customInput) {
            customInput.style.display = e.target.value === '__custom__' ? 'block' : 'none';
            if (e.target.value === '__custom__') customInput.focus();
          }
        });
        setTimeout(() => Utils.el('#wz-name')?.focus(), 0);
      }

      if (_step === 2) {
        Utils.el('#wz-add-court')?.addEventListener('click', () => {
          _collectCourts();
          const n = _data.courts.length + 1;
          _data.courts.push({ id: `court-${Date.now()}`, name: `Terrain ${n}`, available: true });
          _render();
        });
        box.querySelectorAll('.wz-remove-court').forEach(btn => {
          btn.addEventListener('click', () => {
            _collectCourts();
            _data.courts.splice(parseInt(btn.dataset.idx), 1);
            _render();
          });
        });
      }

      if (_step === 3) {
        box.querySelectorAll('.wizard-format-card').forEach(card => {
          card.addEventListener('click', () => {
            const radio = card.querySelector('input[type="radio"]');
            if (radio) {
              radio.checked = true;
              _data.activeFormatId = radio.value;
              box.querySelectorAll('.wizard-format-card').forEach(c => c.classList.remove('selected'));
              card.classList.add('selected');
              _refreshAdvice();
            }
          });
        });
      }

      if (_step === 4) {
        _updateSummary();
        Utils.el('#wz-maxteams')?.addEventListener('change', _updateSummary);
        Utils.el('#wz-pools')?.addEventListener('change', _updateSummary);
        document.querySelectorAll('input[name="wz-qual"]').forEach(r => r.addEventListener('change', _updateSummary));
      }
    };

    const _finish = () => {
      const t = _tournament;
      if (!t) return;

      t.settings = t.settings || {};
      t.settings.tournament = {
        ...(t.settings.tournament || {}),
        name: _data.name || 'Tournoi de Padel',
        date: _data.date,
        venue: _data.venue,
        startTime: _data.startTime,
        endTime: _data.endTime,
        breakEnabled: _data.breakEnabled,
        breakStart: _data.breakStart,
        breakEnd: _data.breakEnd,
        categorie: _data.categorie,
        genre: _data.genre,
      };
      t.settings.courts = _data.courts;
      t.settings.matchFormats = _data.matchFormats;
      t.settings.game = {
        ...(t.settings.game || {}),
        activeFormatId: _data.activeFormatId,
        poolCount: _data.poolCount,
        maxTeams: _data.maxTeams,
        qualificationCount: _data.qualificationCount,
        hasPetinale: _data.hasPetiteFinale,
        categorie: _data.categorie,
        genre: _data.genre,
      };

      App.saveTournament(t);
      hide();
      App.updateNavBadges();
      App.navigate('dashboard');
      App.toast('Tournoi créé ! Ajoutez vos joueurs pour commencer.', 'success');
    };

    return { show, hide };
  })();

  // ── init ────────────────────────────────────────────────────────
  const init = async () => {
    initSidebar();
    initTopbar();

    // Attend la connexion Firebase (authentification anonyme + premières
    // données) avant de rendre quoi que ce soit — l'écran de chargement
    // défini dans index.html reste affiché pendant ce temps.
    try {
      await Storage.ready();
    } catch (err) {
      console.error('Firebase — échec de l\'initialisation :', err);
      const container = Utils.el('#page-content');
      if (container) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">⚠️</div>
            <h3>Impossible de se connecter à Firebase</h3>
            <p>${Utils.escHtml(err?.message || String(err))}</p>
            <p style="color:var(--color-text-muted);font-size:13px;margin-top:8px">Vérifiez votre connexion internet, puis rechargez la page.</p>
          </div>`;
      }
      return;
    }

    Storage.migrateToGlobalPlayers();
    _tournament = Storage.getActive();
    updateNavBadges();
    applyTheme(_tournament?.settings?.theme);

    // Rafraîchit l'affichage quand les données changent (autre appareil
    // connecté en même temps, ou simple écho de nos propres écritures).
    // On évite de re-render si l'utilisateur est en train de taper dans un
    // champ, pour ne pas lui couper la saisie en cours.
    Storage.onRemoteChange(() => {
      _tournament = Storage.getActive();
      updateNavBadges();
      const activeTag = document.activeElement?.tagName;
      const isTyping = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT';
      if (_currentPage && !isTyping) navigate(_currentPage, false);
    });

    // Signale les échecs d'écriture Firestore même différés (asynchrones).
    Storage.onWriteError((err) => _handleSaveFailure(err));

    const hash = window.location.hash.replace('#', '');
    navigate(hash || 'history');

    registerServiceWorker();
  };

  // ── Service Worker (PWA) ───────────────────────────────────────
  //
  // sw.js existait dans le dossier depuis le début mais n'était jamais
  // enregistré nulle part dans le code : aucune mise en cache ni mise à
  // jour n'était donc réellement sous le contrôle de l'app. Ce que les
  // utilisateurs subissaient (obligés d'effacer manuellement les données
  // du site pour voir un correctif) était simplement le cache HTTP brut de
  // Safari/Chrome, particulièrement collant pour les apps ajoutées à
  // l'écran d'accueil — sans aucun levier pour le forcer à se mettre à
  // jour proprement.
  //
  // On enregistre maintenant vraiment le Service Worker (déjà conçu pour
  // aller chercher index.html sur le réseau en priorité, voir sw.js), et on
  // prévient l'utilisateur dès qu'une nouvelle version est prête au lieu de
  // le laisser deviner pourquoi "rien ne change".
  const registerServiceWorker = () => {
    if (!('serviceWorker' in navigator)) return;
    // file:// ne supporte pas les Service Workers (ignoré silencieusement
    // par le navigateur de toute façon) — on évite juste l'erreur console.
    if (location.protocol === 'file:') return;

    navigator.serviceWorker.register('./sw.js').then((reg) => {
      // Une mise à jour est déjà en attente au chargement (onglet resté
      // ouvert pendant un déploiement, ou détectée juste avant ce point).
      if (reg.waiting) _promptUpdate(reg.waiting);

      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          // "installed" + un controller déjà actif = vraie mise à jour
          // (pas la toute première installation du Service Worker).
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            _promptUpdate(installing);
          }
        });
      });
    }).catch((err) => console.error('Service Worker — échec d\'enregistrement :', err));

    // Recharge une seule fois automatiquement quand le nouveau Service
    // Worker prend le contrôle (après que l'utilisateur ait confirmé).
    let _reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (_reloaded) return;
      _reloaded = true;
      window.location.reload();
    });
  };

  const _promptUpdate = (worker) => {
    modal.open('🔄 Nouvelle version disponible', `
      <p>Une mise à jour de PadelPro est prête. Rechargez pour l'appliquer — vos données ne sont pas affectées (tout est sauvegardé en ligne).</p>`,
      { buttons: [
        { label: 'Plus tard', class: 'btn-ghost', onClick: () => modal.close() },
        { label: '🔄 Recharger maintenant', class: 'btn-primary', onClick: () => { worker.postMessage({ type: 'SKIP_WAITING' }); modal.close(); } }
      ] }
    );
  };

  return {
    init,
    navigate,
    getCurrentPage: () => _currentPage,
    getTournament,
    saveTournament,
    refreshActiveTournament,
    getPlayers,
    getAllPlayers,
    modal,
    confirm,
    toast,
    wizard,
    on,
    off,
    emit,
    applyTheme,
    updateNavBadges,
  };

})();

document.addEventListener('DOMContentLoaded', () => App.init());
