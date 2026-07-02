'use strict';

/* ═══════════════════════════════════════════════════════════════
   TEAMS MODULE — Gestion et création des équipes
   ═══════════════════════════════════════════════════════════════ */

const TeamsModule = (() => {

  let _container = null;

  const render = (container) => {
    _container = container;
    _renderPage();
  };

  const _renderPage = () => {
    const t = App.getTournament();
    const teams = t.teams || [];
    const players = App.getPlayers(t);
    const presentPlayers = players.filter(p => p.present !== false);

    _container.innerHTML = `
      <div class="animate-fade-in">
        <div class="page-header">
          <div class="page-header-left">
            <h2 class="page-title">🤝 Équipes</h2>
            <p class="page-subtitle">${teams.length} équipe${teams.length > 1 ? 's' : ''} • <strong>${presentPlayers.length} joueur${presentPlayers.length > 1 ? 's' : ''} présent${presentPlayers.length > 1 ? 's' : ''}</strong> sur ${players.length} inscrits</p>
          </div>
          <div class="page-header-actions">
            ${teams.length > 0 ? `
              <button class="btn btn-secondary" id="btn-clear-teams">🗑️ Effacer tout</button>
              <button class="btn btn-secondary" id="btn-export-teams">📤 Exporter</button>` : ''}
            <button class="btn btn-primary" id="btn-generate-teams">⚡ Créer les équipes</button>
            <button class="btn btn-secondary" id="btn-add-team-manual">➕ Équipe manuelle</button>
          </div>
        </div>

        ${presentPlayers.length < 2 ? `
          <div class="alert alert-warning">
            ⚠️ Il faut au moins 2 joueurs <strong>présents</strong> pour créer des équipes.
            <button class="btn btn-primary btn-sm" style="margin-left:var(--space-3)" onclick="App.navigate('players')">Gérer les présences</button>
          </div>` : ''}

        ${teams.length === 0 ? renderEmptyState() : renderTeamsGrid(t)}
      </div>`;

    bindEvents();
  };

  const renderEmptyState = () => `
    <div class="card">
      <div class="card-body">
        <div class="empty-state">
          <div class="empty-state-icon">🤝</div>
          <h3>Aucune équipe créée</h3>
          <p>Utilisez le bouton "Créer les équipes" pour générer automatiquement les équipes à partir des joueurs inscrits.</p>
        </div>
      </div>
    </div>`;

  const renderTeamsGrid = (t) => {
    const teams = t.teams || [];
    const players = App.getPlayers(t);
    const levels = t.settings?.levels || [];

    return `
      <div class="grid-auto">
        ${teams.map((team, i) => {
          const teamPlayers = (team.playerIds || []).map(id => players.find(p => p.id === id)).filter(Boolean);
          const avgLevel = getTeamAvgLevel(teamPlayers, levels);
          const color = Utils.colorFromIndex(i);

          return `
            <div class="team-card" data-id="${team.id}">
              <div class="team-card-header">
                <div style="display:flex;align-items:center;gap:var(--space-2)">
                  <div style="width:10px;height:10px;border-radius:50%;background:${color}"></div>
                  <span class="team-name">${Utils.escHtml(team.name || `Équipe ${i+1}`)}</span>
                  ${team.locked ? '<span title="Équipe verrouillée">🔒</span>' : ''}
                </div>
                <div style="display:flex;gap:var(--space-1)">
                  <button class="btn btn-sm btn-secondary btn-edit-team" data-id="${team.id}" title="Modifier">✏️</button>
                  <button class="btn btn-sm btn-danger btn-del-team" data-id="${team.id}" title="Supprimer">🗑️</button>
                </div>
              </div>
              ${avgLevel ? `<div style="margin-bottom:var(--space-2)">
                <span class="badge" style="background:${avgLevel.color}22;color:${avgLevel.color}">Niveau moyen : ${avgLevel.label}</span>
              </div>` : ''}
              <div class="team-players">
                ${teamPlayers.length === 0 ? `<div class="text-muted text-xs">Aucun joueur assigné</div>` :
                  teamPlayers.map(p => {
                    const lv = levels.find(l => l.id === p.levelId);
                    return `
                      <div class="team-player">
                        <div class="avatar" style="background:${Utils.colorFromStr(p.id)}">${Utils.initials(p.firstName, p.lastName)}</div>
                        <div style="flex:1">
                          <div style="font-size:var(--font-size-sm);font-weight:500">${Utils.escHtml(Utils.fullName(p))}</div>
                          ${lv ? `<div style="font-size:10px;color:${lv.color}">${Utils.escHtml(lv.name)}</div>` :
                                   p.club ? `<div style="font-size:10px;color:var(--color-text-faint)">${Utils.escHtml(p.club)}</div>` : ''}
                        </div>
                      </div>`
                  }).join('')}
              </div>
            </div>`;
        }).join('')}
      </div>`;
  };

  const getTeamAvgLevel = (players, levels) => {
    if (!players.length || !levels.length) return null;
    const vals = players.map(p => levels.find(l => l.id === p.levelId)?.value || 0).filter(v => v > 0);
    if (!vals.length) return null;
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    const closest = levels.reduce((prev, curr) =>
      Math.abs(curr.value - avg) < Math.abs(prev.value - avg) ? curr : prev
    );
    return { label: closest.name, color: closest.color };
  };

  // ── Événements ────────────────────────────────────────────────
  const bindEvents = () => {
    Utils.el('#btn-generate-teams', _container)?.addEventListener('click', () => openGenerateModal());
    Utils.el('#btn-add-team-manual', _container)?.addEventListener('click', () => openTeamForm());

    Utils.el('#btn-clear-teams', _container)?.addEventListener('click', async () => {
      const ok = await App.confirm('Effacer toutes les équipes', 'Les poules et le planning associés seront aussi supprimés.', { icon: '🗑️' });
      if (!ok) return;
      const t = App.getTournament();
      t.teams = []; t.pools = []; t.matches = [];
      App.saveTournament(t);
      Audit.log(Audit.ACTIONS.DELETE, 'team', 'Toutes les équipes supprimées');
      App.toast('Équipes supprimées', 'success');
      _renderPage();
    });

    Utils.el('#btn-export-teams', _container)?.addEventListener('click', () => {
      const t = App.getTournament();
      Utils.downloadJSON(t.teams, 'equipes.json');
    });

    _container.querySelectorAll('.btn-edit-team').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = App.getTournament();
        const team = t.teams.find(tm => tm.id === btn.dataset.id);
        if (team) openTeamForm(team);
      });
    });

    _container.querySelectorAll('.btn-del-team').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await App.confirm('Supprimer cette équipe', 'La suppression est irréversible.', { icon: '🗑️' });
        if (!ok) return;
        const t = App.getTournament();
        t.teams = t.teams.filter(tm => tm.id !== btn.dataset.id);
        App.saveTournament(t);
        Audit.log(Audit.ACTIONS.DELETE, 'team', 'Équipe supprimée');
        _renderPage();
      });
    });
  };

  // ── Modal génération ──────────────────────────────────────────
  const openGenerateModal = () => {
    const t = App.getTournament();
    const players = App.getPlayers(t).filter(p => p.present !== false); // présents seulement
    const g = t.settings?.game || {};
    const ppt = g.playersPerTeam || 2;
    const maxTeams = Math.floor(players.length / ppt);

    App.modal.open('⚡ Créer les équipes',
      `<div class="form-section">
        <div class="form-group">
          <label class="form-label">Mode de création</label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3)">
            ${[
              { id: 'random',   icon: '🎲', label: 'Aléatoire',     desc: 'Mélange complet des joueurs' },
              { id: 'balanced', icon: '⚖️', label: 'Équilibré',     desc: 'Équilibre automatique des niveaux' },
              { id: 'manual',   icon: '✋', label: 'Manuel',         desc: 'Composition équipe par équipe' },
              { id: 'locked',   icon: '🔒', label: 'Verrouillé',    desc: 'Préservez certaines équipes' }
            ].map(m => `
              <label style="display:flex;align-items:flex-start;gap:var(--space-2);padding:var(--space-3);
                border:2px solid var(--color-border);border-radius:var(--radius-md);cursor:pointer;
                transition:border-color 0.15s" class="mode-card" data-mode="${m.id}">
                <input type="radio" name="gen-mode" value="${m.id}" ${m.id === 'balanced' ? 'checked' : ''} style="margin-top:3px">
                <div>
                  <div style="font-weight:700">${m.icon} ${m.label}</div>
                  <div class="text-xs text-muted">${m.desc}</div>
                </div>
              </label>`).join('')}
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Nombre d'équipes</label>
            <input id="gen-team-count" type="number" min="2" max="${maxTeams || 32}" class="form-control" value="${Math.min(maxTeams, g.maxTeams || 16)}">
            <span class="form-hint">Max avec ${players.length} joueurs présents (${ppt}/équipe) : ${maxTeams}</span>
          </div>
          <div class="form-group">
            <label class="form-label">Nom des équipes</label>
            <select id="gen-naming" class="form-control">
              <option value="auto">Équipe 1, 2, 3…</option>
              <option value="alpha">A, B, C…</option>
              <option value="player">Nom du 1er joueur</option>
            </select>
          </div>
        </div>
        ${players.length === 0 ? `<div class="alert alert-warning">⚠️ Aucun joueur présent. <a onclick="App.navigate('players')" style="cursor:pointer;color:var(--color-primary)">Gérer les présences</a></div>` : ''}
        <div id="gen-manual-section" style="display:none">
          <div class="alert alert-info">ℹ️ En mode manuel, vous pourrez composer chaque équipe après la génération.</div>
        </div>
      </div>`,
      { size: 'lg',
        buttons: [
          { label: 'Annuler', class: 'btn-ghost', onClick: () => App.modal.close() },
          { label: '⚡ Générer', class: 'btn-primary', id: 'btn-do-generate' }
        ]
      }
    );

    // Highlight sélectionné
    document.querySelectorAll('.mode-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.mode-card').forEach(c => c.style.borderColor = 'var(--color-border)');
        card.style.borderColor = 'var(--color-primary)';
        const mode = card.dataset.mode;
        const manualSec = Utils.el('#gen-manual-section');
        if (manualSec) manualSec.style.display = mode === 'manual' ? '' : 'none';
      });
    });
    document.querySelector('.mode-card[data-mode="balanced"]').style.borderColor = 'var(--color-primary)';

    Utils.el('#btn-do-generate')?.addEventListener('click', () => {
      const mode = document.querySelector('input[name="gen-mode"]:checked')?.value || 'balanced';
      const count = parseInt(Utils.el('#gen-team-count')?.value) || maxTeams;
      const naming = Utils.el('#gen-naming')?.value || 'auto';
      generateTeams(mode, count, naming);
    });
  };

  // ── Algorithmes de génération ─────────────────────────────────
  const generateTeams = (mode, count, naming) => {
    const t = App.getTournament();
    // Ne prendre que les joueurs présents (present !== false)
    const players = App.getPlayers(t).filter(p => p.present !== false);
    const levels = t.settings?.levels || [];
    const ppt = t.settings?.game?.playersPerTeam || 2;

    if (players.length < ppt) {
      App.toast(`Il faut au moins ${ppt} joueurs présents`, 'error');
      return;
    }

    let groups = [];

    switch (mode) {
      case 'random':
        groups = assignRandom(players, count, ppt);
        break;
      case 'balanced':
        groups = assignBalanced(players, levels, count, ppt);
        break;
      case 'manual':
        groups = Array.from({ length: count }, () => []);
        break;
      case 'locked': {
        const locked = (t.teams || []).filter(tm => tm.locked);
        const assignedIds = new Set(locked.flatMap(tm => tm.playerIds || []));
        const free = players.filter(p => !assignedIds.has(p.id));
        const extraCount = Math.max(0, count - locked.length);
        const newGroups = assignBalanced(free, levels, extraCount, ppt);
        groups = [
          ...locked.map(tm => (tm.playerIds || []).map(id => players.find(p => p.id === id)).filter(Boolean)),
          ...newGroups
        ];
        break;
      }
    }

    // Construire les équipes
    const newTeams = groups.map((group, i) => {
      const name = genTeamName(naming, i, group);
      const locked = mode === 'locked' && i < (t.teams || []).filter(tm => tm.locked).length;
      return {
        id: Utils.uuid(),
        name,
        playerIds: group.map(p => p.id),
        locked,
        poolId: null
      };
    });

    t.teams = newTeams;
    t.pools = []; // Reset les poules
    t.matches = [];
    App.saveTournament(t);
    Audit.log(Audit.ACTIONS.GENERATE, 'team', `${newTeams.length} équipe(s) créée(s) - mode: ${mode}`);
    App.toast(`${newTeams.length} équipes créées`, 'success');
    App.modal.close();
    _renderPage();
  };

  const genTeamName = (naming, i, players) => {
    if (naming === 'alpha') return String.fromCharCode(65 + i);
    if (naming === 'player' && players[0]) return Utils.fullName(players[0]);
    return `Équipe ${i + 1}`;
  };

  const assignRandom = (players, count, ppt) => {
    const shuffled = Utils.shuffle(players);
    const groups = [];
    for (let i = 0; i < count; i++) {
      groups.push(shuffled.splice(0, ppt));
    }
    return groups;
  };

  const assignBalanced = (players, levels, count, ppt) => {
    if (count <= 0 || players.length === 0) return [];

    // Trier les joueurs par niveau décroissant
    const sorted = Utils.sortBy(players, (p) => {
      const lv = levels.find(l => l.id === p.levelId);
      return -(lv?.value || 0);
    }, 'asc');

    // Snake draft : distribuer dans les équipes en serpentin
    const groups = Array.from({ length: count }, () => []);
    let dir = 1;
    let col = 0;

    for (let i = 0; i < sorted.length && groups.flat().length < count * ppt; i++) {
      if (groups[col].length < ppt) {
        groups[col].push(sorted[i]);
      }

      if (dir === 1) {
        if (col === count - 1) { dir = -1; }
        else col++;
      } else {
        if (col === 0) { dir = 1; }
        else col--;
      }
    }

    return groups.filter(g => g.length > 0);
  };

  // ── Formulaire équipe manuelle ────────────────────────────────
  const openTeamForm = (team = null) => {
    const t = App.getTournament();
    const players = App.getPlayers(t);
    const allTeams = t.teams || [];
    const isEdit = !!team;

    // Joueurs déjà dans une équipe (sauf l'équipe en cours d'édition)
    const usedIds = new Set(
      allTeams
        .filter(tm => !team || tm.id !== team.id)
        .flatMap(tm => tm.playerIds || [])
    );

    const assignedInCurrent = team?.playerIds || [];

    App.modal.open(isEdit ? '✏️ Modifier l\'équipe' : '➕ Nouvelle équipe',
      `<div class="form-section">
        <div class="form-group">
          <label class="form-label">Nom de l'équipe <span class="required">*</span></label>
          <input id="team-name" class="form-control" value="${Utils.escHtml(team?.name || '')}" placeholder="Nom de l'équipe">
        </div>
        <div class="form-group">
          <label class="form-label">Joueurs</label>
          <div id="player-picker" style="max-height:300px;overflow-y:auto;border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-2)">
            ${players.length === 0 ? '<div class="text-muted text-sm" style="padding:8px">Aucun joueur disponible</div>' :
              players.map(p => {
                const inCurrent = assignedInCurrent.includes(p.id);
                const busy = usedIds.has(p.id);
                const levels = t.settings?.levels || [];
                const lv = levels.find(l => l.id === p.levelId);
                return `
                  <label style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-2);
                    border-radius:var(--radius-sm);cursor:${busy ? 'not-allowed' : 'pointer'};
                    opacity:${busy ? '0.5' : '1'}" class="player-pick-row">
                    <input type="checkbox" name="player-pick" value="${p.id}"
                           ${inCurrent ? 'checked' : ''} ${busy ? 'disabled' : ''}>
                    <div class="avatar" style="background:${Utils.colorFromStr(p.id)};width:28px;height:28px;font-size:10px">${Utils.initials(p.firstName, p.lastName)}</div>
                    <div style="flex:1">
                      <div style="font-size:var(--font-size-sm);font-weight:500">${Utils.escHtml(Utils.fullName(p))}</div>
                      ${lv ? `<div style="font-size:10px;color:${lv.color}">${Utils.escHtml(lv.name)}</div>` : ''}
                    </div>
                    ${busy ? '<span class="text-xs text-muted">En équipe</span>' : ''}
                  </label>`;
              }).join('')
            }
          </div>
        </div>
        <label style="display:flex;align-items:center;gap:var(--space-2);font-weight:400;cursor:pointer">
          <input type="checkbox" id="team-locked" ${team?.locked ? 'checked' : ''}> Verrouiller cette équipe
          <span class="text-xs text-muted">(ne sera pas modifiée lors d'une re-génération)</span>
        </label>
      </div>`,
      {
        buttons: [
          { label: 'Annuler', class: 'btn-ghost', onClick: () => App.modal.close() },
          { label: isEdit ? 'Enregistrer' : 'Créer', class: 'btn-primary', id: 'btn-save-team' }
        ]
      }
    );

    Utils.el('#btn-save-team')?.addEventListener('click', () => {
      const name = Utils.el('#team-name')?.value.trim();
      if (!name) { App.toast('Nom requis', 'error'); return; }
      const playerIds = [...document.querySelectorAll('input[name="player-pick"]:checked')].map(cb => cb.value);
      const locked = Utils.el('#team-locked')?.checked || false;

      const t = App.getTournament();
      if (isEdit) {
        const tm = t.teams.find(x => x.id === team.id);
        if (tm) Object.assign(tm, { name, playerIds, locked });
        Audit.log(Audit.ACTIONS.UPDATE, 'team', name);
        App.toast('Équipe modifiée', 'success');
      } else {
        t.teams.push({ id: Utils.uuid(), name, playerIds, locked });
        Audit.log(Audit.ACTIONS.CREATE, 'team', name);
        App.toast('Équipe créée', 'success');
      }
      App.saveTournament(t);
      App.modal.close();
      _renderPage();
    });
  };

  return { render };
})();
