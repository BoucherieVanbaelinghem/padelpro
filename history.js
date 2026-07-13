'use strict';

/* ═══════════════════════════════════════════════════════════════
   HOME MODULE — Accueil : liste & sélection de tournois
   ═══════════════════════════════════════════════════════════════ */

const HistoryModule = (() => {

  let _container = null;
  let _tab = 'tournaments';

  const render = (container) => {
    _container = container;
    _renderPage();
  };

  const _tournamentStatus = (t) => {
    const now = new Date();
    const date = t.settings?.tournament?.date;
    if (t.status === 'finished') return { label: 'Terminé', cls: 'badge-neutral', icon: '✅' };
    if (!date) return { label: 'Configuration', cls: 'badge-warning', icon: '⚙️' };
    const d = new Date(date);
    const today = now.toISOString().split('T')[0];
    if (date === today) return { label: 'Aujourd\'hui', cls: 'badge-success badge-dot', icon: '🔴' };
    if (d > now) return { label: 'À venir', cls: 'badge-primary', icon: '📅' };
    if (t.status === 'running') return { label: 'En cours', cls: 'badge-success badge-dot', icon: '▶️' };
    return { label: 'Configuration', cls: 'badge-warning', icon: '⚙️' };
  };

  const _nextMatches = (t) => {
    const matches = (t.matches || []).filter(m => m.status === 'scheduled' && m.scheduledTime);
    matches.sort((a, b) => (a.scheduledTime || '').localeCompare(b.scheduledTime || ''));
    return matches.slice(0, 3);
  };

  const _renderPage = () => {
    const all = Storage.getAllTournaments();
    const activeId = Storage.getActiveId();
    const tournaments = Object.values(all).sort((a, b) => {
      // Actif en premier, puis par date décroissante
      if (a.id === activeId) return -1;
      if (b.id === activeId) return 1;
      return (b.settings?.tournament?.date || '').localeCompare(a.settings?.tournament?.date || '');
    });

    const globalPlayerCount = Storage.getAllPlayersList().length;

    _container.innerHTML = `
      <div class="animate-fade-in">
        <div class="page-header">
          <div class="page-header-left">
            <h2 class="page-title">🏠 Accueil</h2>
            <p class="page-subtitle">${tournaments.length} tournoi${tournaments.length > 1 ? 's' : ''} · <strong>${globalPlayerCount} joueur${globalPlayerCount > 1 ? 's' : ''}</strong> dans la base</p>
          </div>
          <div class="page-header-actions">
            <button class="btn btn-secondary" id="btn-import-history">📥 Importer</button>
            <button class="btn btn-secondary" id="btn-export-history">📤 Sauvegarder</button>
            <button class="btn btn-primary" id="btn-new-tournament-h">🆕 Nouveau tournoi</button>
          </div>
        </div>

        <div class="tabs">
          <button class="tab-btn ${_tab==='tournaments'?'active':''}" data-tab="tournaments">🏆 Tournois</button>
          <button class="tab-btn ${_tab==='players_global'?'active':''}" data-tab="players_global">👥 Base joueurs</button>
          <button class="tab-btn ${_tab==='audit'?'active':''}" data-tab="audit">📜 Journal d'audit</button>
        </div>

        <div id="history-content" style="margin-top:var(--space-4)">
          ${_tab === 'tournaments' ? _renderTournaments(tournaments, activeId)
          : _tab === 'players_global' ? _renderGlobalPlayers()
          : _renderAudit()}
        </div>

        <input type="file" id="import-history-file" accept=".json" style="display:none">
      </div>`;

    _bindEvents();
  };

  const _renderTournaments = (tournaments, activeId) => {
    if (tournaments.length === 0) return `
      <div class="card"><div class="card-body">
        <div class="empty-state">
          <div class="empty-state-icon">🏆</div>
          <h3>Aucun tournoi</h3>
          <p>Créez votre premier tournoi pour démarrer.</p>
          <button class="btn btn-primary" id="btn-create-first">🆕 Créer un tournoi</button>
        </div>
      </div></div>`;

    return `<div style="display:flex;flex-direction:column;gap:var(--space-4)">
      ${tournaments.map(t => {
        const s = t.settings?.tournament || {};
        const isActive = t.id === activeId;
        const status = _tournamentStatus(t);
        const next = _nextMatches(t);
        const playerCount = (t.playerIds || []).length;
        const teamCount = (t.teams || []).length;
        const matchCount = (t.matches || []).length;
        const finishedCount = (t.matches || []).filter(m => m.status === 'finished').length;
        const progress = matchCount > 0 ? Math.round((finishedCount / matchCount) * 100) : 0;

        return `
          <div class="t-card ${isActive ? 't-card-active' : ''}">
            <div class="t-card-body">
              <!-- Ligne principale : icône + infos -->
              <div class="t-card-main">
                <div class="t-card-icon" style="background:${isActive?'var(--color-primary)':'var(--color-bg-alt)'}">
                  ${s.logo ? `<img src="${s.logo}" style="width:100%;height:100%;object-fit:contain;border-radius:inherit">` : '🎾'}
                </div>
                <div class="t-card-info">
                  <div class="t-card-title">${Utils.escHtml(s.name || 'Tournoi sans nom')}</div>
                  <div class="t-card-badges">
                    ${isActive ? '<span class="badge badge-primary">Actif</span>' : ''}
                    <span class="badge ${status.cls}">${status.icon} ${status.label}</span>
                    ${s.categorie ? `<span class="badge badge-neutral">${Utils.escHtml(s.categorie)}</span>` : ''}
                    ${s.genre ? `<span class="badge badge-neutral">${Utils.escHtml(s.genre)}</span>` : ''}
                  </div>
                  <div class="t-card-meta">
                    ${s.date ? `<span>📅 ${Utils.formatShortDate(s.date)}</span>` : ''}
                    ${s.venue ? `<span class="t-card-hide-xs">📍 ${Utils.escHtml(s.venue)}</span>` : ''}
                    <span>👥 ${playerCount}</span>
                    <span>🤝 ${teamCount}</span>
                    ${matchCount > 0 ? `<span>📋 ${finishedCount}/${matchCount}</span>` : ''}
                    <span class="t-card-hide-xs" style="color:var(--color-text-faint)">Modifié ${Utils.formatTimestamp(t.updatedAt)}</span>
                  </div>
                </div>
              </div>

              <!-- Barre de progression -->
              ${matchCount > 0 ? `
              <div class="t-card-progress">
                <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--color-text-muted);margin-bottom:4px">
                  <span>Progression</span><span>${progress}%</span>
                </div>
                <div style="height:4px;background:var(--color-border);border-radius:2px;overflow:hidden">
                  <div style="height:100%;width:${progress}%;background:${progress===100?'var(--color-success)':'var(--color-primary)'};transition:width 0.3s"></div>
                </div>
              </div>` : ''}

              <!-- Actions -->
              <div class="t-card-actions">
                ${!isActive
                  ? `<button class="btn btn-primary btn-sm btn-activate" data-id="${t.id}">▶ Ouvrir</button>`
                  : `<button class="btn btn-success btn-sm" onclick="App.navigate('dashboard')" style="cursor:pointer">📊 Tableau de bord</button>`}
                <button class="btn btn-secondary btn-sm btn-duplicate" data-id="${t.id}" title="Dupliquer">📋 Dupliquer</button>
                <button class="btn btn-secondary btn-sm btn-export-t" data-id="${t.id}" title="Exporter">📤 Exporter</button>
                <button class="btn btn-danger btn-sm btn-del-t" data-id="${t.id}" title="Supprimer">🗑️ Supprimer</button>
              </div>

              ${next.length > 0 ? `
              <!-- Prochains matchs -->
              <div class="t-card-next t-card-hide-xs">
                <div style="font-size:11px;font-weight:700;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:var(--space-2)">Prochains matchs</div>
                <div style="display:flex;flex-wrap:wrap;gap:var(--space-2)">
                  ${next.map(m => {
                    const teams = t.teams || [];
                    const t1 = teams.find(x => x.id === m.team1Id)?.name || '?';
                    const t2 = teams.find(x => x.id === m.team2Id)?.name || '?';
                    return `<span style="font-size:11px;padding:2px 8px;background:var(--color-bg-alt);border-radius:var(--radius-sm);border:1px solid var(--color-border)">${m.scheduledTime} — ${Utils.escHtml(t1)} vs ${Utils.escHtml(t2)}</span>`;
                  }).join('')}
                </div>
              </div>` : ''}
            </div>
          </div>`;
      }).join('')}
    </div>`;
  };

  // ── Onglet Base joueurs globale ──────────────────────────────
  const _renderGlobalPlayers = () => {
    const players = Storage.getAllPlayersList().sort((a, b) =>
      (a.lastName || '').localeCompare(b.lastName || ''));

    if (players.length === 0) return `
      <div class="card"><div class="card-body">
        <div class="empty-state">
          <div class="empty-state-icon">👥</div>
          <h3>Base joueurs vide</h3>
          <p>Ajoutez des joueurs dans un tournoi — ils seront automatiquement sauvegardés ici.</p>
        </div>
      </div></div>`;

    const tournaments = Storage.getAllTournaments();

    return `
      <div class="card">
        <div class="card-header">
          <span class="card-title">👥 ${players.length} joueur${players.length > 1 ? 's' : ''} dans la base globale</span>
          <button class="btn btn-danger btn-sm" id="btn-clear-global-players">🗑️ Vider la base</button>
        </div>
        <div style="overflow-x:auto">
          <table class="table">
            <thead><tr>
              <th>Nom</th>
              <th>Classement FFT</th>
              <th>Sexe</th>
              <th>Club</th>
              <th>Tournois</th>
            </tr></thead>
            <tbody>
              ${players.map(p => {
                const tournoisCount = Object.values(tournaments).filter(t => (t.playerIds || []).includes(p.id)).length;
                return `<tr>
                  <td style="font-weight:600">${Utils.escHtml(Utils.fullName(p))}</td>
                  <td><span style="font-weight:700;color:var(--color-primary)">${Utils.escHtml(p.classementFFT || 'NC')}</span></td>
                  <td>${p.gender === 'M' ? '♂️' : p.gender === 'F' ? '♀️' : '—'}</td>
                  <td>${Utils.escHtml(p.club || '—')}</td>
                  <td><span class="badge badge-neutral">${tournoisCount} tournoi${tournoisCount !== 1 ? 's' : ''}</span></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  };

  const _renderAudit = () => {
    const logs = Audit.getLogs(200);
    return `
      <div>
        <div style="display:flex;justify-content:flex-end;margin-bottom:var(--space-3)">
          <button class="btn btn-danger btn-sm" id="btn-clear-audit">🗑️ Vider le journal</button>
        </div>
        ${logs.length === 0 ? `
          <div class="card"><div class="card-body">
            <div class="empty-state"><div class="empty-state-icon">📜</div><h3>Journal vide</h3></div>
          </div></div>` :
          `<div class="card"><div class="card-body" style="padding:var(--space-2)">
            ${logs.map(l => `
              <div class="audit-item audit-${l.action}">
                <span class="audit-icon">${l.icon || '📌'}</span>
                <div class="audit-body">
                  <div class="audit-action">${Utils.escHtml(l.actionLabel)} — ${Utils.escHtml(l.label)}</div>
                  ${l.details ? `<div class="audit-detail">${Utils.escHtml(l.details)}</div>` : ''}
                </div>
                <div class="audit-time">${Utils.formatTimestamp(l.timestamp)}</div>
              </div>`).join('')}
          </div></div>`}
      </div>`;
  };

  const _bindEvents = () => {
    _container.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => { _tab = btn.dataset.tab; _renderPage(); });
    });

    Utils.el('#btn-create-first', _container)?.addEventListener('click', () => {
      const newT = Storage.createNewTournament();
      App.refreshActiveTournament();
      App.navigate('dashboard');
      App.wizard.show(newT);
    });

    Utils.el('#btn-new-tournament-h', _container)?.addEventListener('click', async () => {
      const ok = await App.confirm('Nouveau tournoi', 'Le tournoi actuel sera conservé. Vos joueurs restent dans la base.', { icon: '🆕', okClass: 'btn-primary', okLabel: 'Créer' });
      if (!ok) return;
      const newT = Storage.createNewTournament();
      App.refreshActiveTournament();
      App.navigate('dashboard');
      App.wizard.show(newT);
    });

    Utils.el('#btn-export-history', _container)?.addEventListener('click', () => {
      Utils.downloadJSON(Storage.exportAll(), 'padelpro-backup.json');
      App.toast('Sauvegarde exportée', 'success');
    });

    Utils.el('#btn-import-history', _container)?.addEventListener('click', () => {
      Utils.el('#import-history-file', _container)?.click();
    });

    Utils.el('#import-history-file', _container)?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = await Utils.readJSONFile(file);
        const ok = await App.confirm('Importer des données', 'Les tournois et joueurs seront fusionnés avec les données existantes.', { icon: '📥', okClass: 'btn-primary', okLabel: 'Importer' });
        if (!ok) return;
        await Storage.importAll(data);
        App.toast('Import réussi', 'success');
        _renderPage();
      } catch (err) {
        App.toast(err.message, 'error');
      }
    });

    _container.querySelectorAll('.btn-activate').forEach(btn => {
      btn.addEventListener('click', () => {
        Storage.setActiveId(btn.dataset.id);
        App.refreshActiveTournament();
        App.toast('Tournoi ouvert', 'success');
        App.navigate('dashboard');
      });
    });

    _container.querySelectorAll('.btn-duplicate').forEach(btn => {
      btn.addEventListener('click', async () => {
        const dup = Storage.duplicateTournament(btn.dataset.id);
        if (dup) {
          App.toast('Tournoi dupliqué (joueurs inclus)', 'success');
          _renderPage();
        }
      });
    });

    _container.querySelectorAll('.btn-export-t').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = Storage.getTournament(btn.dataset.id);
        if (t) {
          const players = Storage.getTournamentPlayers(t);
          Utils.downloadJSON({ ...t, players }, `tournoi-${(t.settings?.tournament?.name||'export').replace(/\s+/g,'-')}.json`);
          App.toast('Export téléchargé', 'success');
        }
      });
    });

    _container.querySelectorAll('.btn-del-t').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const wasActive = id === Storage.getActiveId();
        const msg = wasActive
          ? "C'est le tournoi actuellement actif. Les matchs et équipes seront supprimés. Les joueurs restent dans la base globale."
          : 'Les matchs et équipes seront supprimés. Les joueurs restent dans la base globale.';
        const ok = await App.confirm('Supprimer ce tournoi', msg, { icon: '🗑️' });
        if (!ok) return;

        Storage.deleteTournament(id);

        if (wasActive) {
          const remaining = Object.values(Storage.getAllTournaments())
            .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
          if (remaining.length > 0) {
            // Bascule vers le tournoi restant le plus récent.
            Storage.setActiveId(remaining[0].id);
            App.refreshActiveTournament();
          } else {
            // AUCUN tournoi restant : surtout ne PAS appeler
            // App.refreshActiveTournament() ici — Storage.getActive() crée
            // automatiquement un tournoi vide dès qu'aucun n'existe (pour
            // que le reste de l'app ait toujours un tournoi "actif" à
            // manipuler). Résultat : chaque suppression du dernier tournoi
            // en faisait immédiatement réapparaître un nouveau vide, ce qui
            // ressemblait à "la suppression ne marche pas". On se contente
            // ici d'effacer l'ID actif ; un nouveau tournoi ne sera créé
            // que si l'utilisateur clique explicitement "Nouveau tournoi".
            Storage.clearActiveId();
          }
        }

        App.toast('Tournoi supprimé', 'success');
        _renderPage();
      });
    });

    Utils.el('#btn-clear-global-players', _container)?.addEventListener('click', async () => {
      const ok = await App.confirm('Vider la base joueurs', 'Tous les joueurs seront supprimés de la base globale. Les tournois existants garderont leurs IDs mais les noms seront perdus.', { icon: '🗑️', okClass: 'btn-danger', okLabel: 'Vider' });
      if (!ok) return;
      Storage.saveGlobalPlayers({});
      App.toast('Base joueurs vidée', 'warning');
      _renderPage();
    });

    Utils.el('#btn-clear-audit', _container)?.addEventListener('click', async () => {
      const ok = await App.confirm('Vider le journal', 'Toutes les entrées du journal seront supprimées.', { icon: '🗑️' });
      if (!ok) return;
      Audit.clear();
      App.toast('Journal vidé', 'warning');
      _renderPage();
    });

  };

  return { render };
})();
