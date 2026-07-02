'use strict';

/* ═══════════════════════════════════════════════════════════════
   COURTS MODULE — Gestion des terrains en temps réel
   ═══════════════════════════════════════════════════════════════ */

const CourtsModule = (() => {

  let _container = null;
  let _refreshTimer = null;

  const render = (container) => {
    _container = container;
    if (_refreshTimer) clearInterval(_refreshTimer);
    _renderPage();
    // Auto-refresh toutes les 30s pour mettre à jour les durées
    _refreshTimer = setInterval(() => {
      // Ne re-render que si le module courts est encore la vue active
      if (_container && _container.querySelector('[data-module="courts"]')) _renderPage();
      else clearInterval(_refreshTimer);
    }, 30000);
  };

  // Dériver si une équipe est "check-in" (tous ses joueurs ont present === true)
  const isTeamPresent = (t, teamId) => {
    const team = (t.teams || []).find(x => x.id === teamId);
    if (!team) return false;
    const players = App.getPlayers(t);
    if (!team.playerIds || team.playerIds.length === 0) return false;
    return team.playerIds.every(pid => {
      const p = players.find(pl => pl.id === pid);
      return p && p.present === true;
    });
  };

  const getTeamName = (t, id) => {
    const tm = (t.teams || []).find(x => x.id === id);
    return tm?.name || '?';
  };

  const getPoolName = (t, m) => {
    if (m.type === 'bracket') return 'Tableau';
    if (m.type === 'classement') {
      const cl = (t.classements || []).find(c => c.id === m.classementId);
      return cl?.label || 'Classement';
    }
    const pool = (t.pools || []).find(p => p.id === m.poolId);
    return pool?.name || '';
  };

  // Temps écoulé depuis le début d'un match running
  const elapsed = (startedAt) => {
    if (!startedAt) return null;
    const diff = Math.floor((Date.now() - startedAt) / 60000);
    if (diff < 1) return '< 1 min';
    return `${diff} min`;
  };

  const _renderPage = () => {
    const t = App.getTournament();
    const courts = (t.settings?.courts || []).filter(c => c.available !== false);
    const matches = t.matches || [];

    const runningCount = courts.filter(c => matches.some(m => m.courtId === c.id && m.status === 'running')).length;
    const freeCount = courts.length - runningCount;

    _container.innerHTML = `
      <div class="animate-fade-in" data-module="courts">
        <div class="page-header">
          <div class="page-header-left">
            <h2 class="page-title">🏟️ Terrains</h2>
            <p class="page-subtitle">${runningCount} en cours • ${freeCount} libre${freeCount !== 1 ? 's' : ''}</p>
          </div>
          <div class="page-header-actions">
            <button class="btn btn-secondary" id="btn-add-court-quick">➕ Terrain</button>
            <button class="btn btn-secondary" id="btn-go-schedule">📅 Planning</button>
            <button class="btn btn-primary" id="btn-go-scores">🏆 Scores</button>
          </div>
        </div>

        ${courts.length === 0 ? `
          <div class="card">
            <div class="card-body">
              <div class="empty-state">
                <div class="empty-state-icon">🏟️</div>
                <h3>Aucun terrain configuré</h3>
                <p>Ajoutez un terrain ci-dessus, ou configurez-les dans Paramètres.</p>
                <button class="btn btn-primary" id="btn-add-court-quick-empty">➕ Ajouter un terrain</button>
              </div>
            </div>
          </div>` : `

          <!-- Bannière check-in si joueurs absents -->
          ${_buildAbsentBanner(t)}

          <!-- Grille terrains -->
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:var(--space-4);margin-bottom:var(--space-5)">
            ${courts.map(c => _renderCourtCard(t, c, matches)).join('')}
          </div>

          <!-- Tableau de bord rapide -->
          ${_renderQuickDashboard(t, courts, matches)}
        `}
      </div>`;

    Utils.el('#btn-go-schedule', _container)?.addEventListener('click', () => App.navigate('schedule'));
    Utils.el('#btn-go-scores', _container)?.addEventListener('click', () => App.navigate('scores'));
    Utils.el('#btn-add-court-quick', _container)?.addEventListener('click', () => _openAddCourtModal());
    Utils.el('#btn-add-court-quick-empty', _container)?.addEventListener('click', () => _openAddCourtModal());

    // Boutons démarrer match
    _container.querySelectorAll('.btn-start-match').forEach(btn => {
      btn.addEventListener('click', () => {
        const matchId = btn.dataset.match;
        const courtId = btn.dataset.court;
        _startMatch(matchId, courtId);
      });
    });

    // Boutons libérer terrain
    _container.querySelectorAll('.btn-free-court').forEach(btn => {
      btn.addEventListener('click', () => _freeCourt(btn.dataset.court));
    });

    // Boutons saisir score
    _container.querySelectorAll('.btn-enter-score-court').forEach(btn => {
      btn.addEventListener('click', () => {
        App.navigate('scores');
        App.toast('Saisir le score dans la section Scores', 'info');
      });
    });

    // Boutons appeler match
    _container.querySelectorAll('.btn-call-match').forEach(btn => {
      btn.addEventListener('click', () => {
        const t2 = App.getTournament();
        const m = (t2.matches || []).find(x => x.id === btn.dataset.match);
        const court = (t2.settings?.courts || []).find(c => c.id === btn.dataset.court);
        if (m && court) {
          App.toast(`🔔 ${getTeamName(t2, m.team1Id)} vs ${getTeamName(t2, m.team2Id)} — ${court.name}`, 'info', 6000);
        }
      });
    });
  };

  const _buildAbsentBanner = (t) => {
    const matches = (t.matches || []).filter(m => m.status === 'scheduled');
    const absentTeams = new Set();
    matches.forEach(m => {
      if (!isTeamPresent(t, m.team1Id)) absentTeams.add(m.team1Id);
      if (!isTeamPresent(t, m.team2Id)) absentTeams.add(m.team2Id);
    });
    if (absentTeams.size === 0) return '';
    return `
      <div class="card mb-4" style="border-color:var(--color-warning);background:var(--color-warning-bg)">
        <div class="card-body" style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3) var(--space-4)">
          <span style="font-size:1.4rem">⚠️</span>
          <div style="flex:1">
            <div style="font-weight:700;font-size:var(--font-size-sm);color:var(--color-warning)">Check-in incomplet</div>
            <div style="font-size:var(--font-size-xs);color:var(--color-text-muted)">${absentTeams.size} équipe${absentTeams.size > 1 ? 's ont' : ' a'} des joueurs non marqués présents</div>
          </div>
          <button class="btn btn-sm btn-warning" onclick="App.navigate('players')">👥 Check-in joueurs</button>
        </div>
      </div>`;
  };

  const _renderCourtCard = (t, court, matches) => {
    const running = matches.find(m => m.courtId === court.id && m.status === 'running');
    const scheduled = matches
      .filter(m => m.courtId === court.id && m.status === 'scheduled' && m.scheduledTime)
      .sort((a, b) => Utils.compareTime(a.scheduledTime, b.scheduledTime));
    const next = scheduled[0];

    if (running) {
      const t1present = isTeamPresent(t, running.team1Id);
      const t2present = isTeamPresent(t, running.team2Id);
      const elapsedStr = elapsed(running.startedAt);
      const pool = getPoolName(t, running);

      return `
        <div class="card" style="border:2px solid var(--color-warning);background:var(--color-warning-bg)">
          <!-- En-tête terrain -->
          <div style="background:var(--color-warning);color:white;padding:8px 16px;border-radius:var(--radius-md) var(--radius-md) 0 0;display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:11px;font-weight:700;letter-spacing:1px">⚡ EN COURS</span>
            <span style="font-size:13px;font-weight:800">${Utils.escHtml(court.name)}</span>
            ${elapsedStr ? `<span style="font-size:10px;opacity:0.85">⏱ ${elapsedStr}</span>` : '<span></span>'}
          </div>
          <div class="card-body">
            ${pool ? `<div class="badge badge-neutral mb-2" style="font-size:10px">${Utils.escHtml(pool)}</div>` : ''}
            <!-- Équipes -->
            <div style="display:flex;flex-direction:column;gap:var(--space-2);margin-bottom:var(--space-3)">
              <div style="display:flex;align-items:center;justify-content:space-between">
                <span style="font-size:var(--font-size-base);font-weight:800">${Utils.escHtml(getTeamName(t, running.team1Id))}</span>
                ${!t1present ? `<span title="Joueur(s) non check-in" style="font-size:14px">⚠️</span>` : `<span style="color:var(--color-success);font-size:12px">✓</span>`}
              </div>
              <div style="text-align:center;color:var(--color-warning);font-weight:700;font-size:var(--font-size-xs)">VS</div>
              <div style="display:flex;align-items:center;justify-content:space-between">
                <span style="font-size:var(--font-size-base);font-weight:800">${Utils.escHtml(getTeamName(t, running.team2Id))}</span>
                ${!t2present ? `<span title="Joueur(s) non check-in" style="font-size:14px">⚠️</span>` : `<span style="color:var(--color-success);font-size:12px">✓</span>`}
              </div>
            </div>
            <!-- Score en temps réel -->
            ${running.score?.sets ? `
              <div style="text-align:center;font-size:var(--font-size-xl);font-weight:900;color:var(--color-warning);margin-bottom:var(--space-3)">
                ${running.score.sets.map(s => `${s.team1}–${s.team2}`).join('  ')}
              </div>` : `
              <div style="text-align:center;color:var(--color-text-muted);font-size:var(--font-size-xs);margin-bottom:var(--space-3)">Score en attente…</div>`}
            <!-- Actions -->
            <div style="display:flex;gap:var(--space-2)">
              <button class="btn btn-sm btn-success btn-enter-score-court" data-match="${running.id}" style="flex:1">✅ Saisir score</button>
              <button class="btn btn-sm btn-ghost btn-free-court" data-court="${court.id}" title="Libérer le terrain (annuler le match en cours)">🔓 Libérer</button>
            </div>
            ${next ? `<div style="margin-top:var(--space-3);padding-top:var(--space-2);border-top:1px dashed var(--color-border);font-size:10px;color:var(--color-text-muted)">Suivant · ${next.scheduledTime} · ${Utils.escHtml(getTeamName(t, next.team1Id))} vs ${Utils.escHtml(getTeamName(t, next.team2Id))}</div>` : ''}
          </div>
        </div>`;
    }

    // Terrain libre
    const isNextBlocked = next && (!isTeamPresent(t, next.team1Id) || !isTeamPresent(t, next.team2Id));
    return `
      <div class="card" style="border:2px solid ${next ? 'var(--color-primary)' : 'var(--color-success)'}">
        <div style="background:${next ? 'var(--color-primary)' : 'var(--color-success)'};color:white;padding:8px 16px;border-radius:var(--radius-md) var(--radius-md) 0 0;display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:11px;font-weight:700;letter-spacing:1px">${next ? '🎯 PROCHAIN MATCH' : '✅ LIBRE'}</span>
          <span style="font-size:13px;font-weight:800">${Utils.escHtml(court.name)}</span>
          <span></span>
        </div>
        <div class="card-body">
          ${next ? `
            ${getPoolName(t, next) ? `<div class="badge badge-primary mb-2" style="font-size:10px">${Utils.escHtml(getPoolName(t, next))}</div>` : ''}
            <div style="font-size:var(--font-size-xs);font-weight:700;color:var(--color-primary);margin-bottom:var(--space-2)">⏰ ${next.scheduledTime}</div>
            <div style="display:flex;flex-direction:column;gap:var(--space-1);margin-bottom:var(--space-3)">
              <div style="display:flex;align-items:center;justify-content:space-between">
                <span style="font-size:var(--font-size-base);font-weight:700">${Utils.escHtml(getTeamName(t, next.team1Id))}</span>
                ${!isTeamPresent(t, next.team1Id) ? `<span style="font-size:11px;color:var(--color-warning)">⚠️ absent</span>` : `<span style="color:var(--color-success);font-size:12px">✓</span>`}
              </div>
              <div style="text-align:center;color:var(--color-text-faint);font-size:var(--font-size-xs)">VS</div>
              <div style="display:flex;align-items:center;justify-content:space-between">
                <span style="font-size:var(--font-size-base);font-weight:700">${Utils.escHtml(getTeamName(t, next.team2Id))}</span>
                ${!isTeamPresent(t, next.team2Id) ? `<span style="font-size:11px;color:var(--color-warning)">⚠️ absent</span>` : `<span style="color:var(--color-success);font-size:12px">✓</span>`}
              </div>
            </div>
            <div style="display:flex;gap:var(--space-2)">
              ${isNextBlocked ? `
                <button class="btn btn-sm btn-warning" style="flex:1;cursor:default" disabled title="Certains joueurs ne sont pas encore check-in">⚠️ Check-in incomplet</button>
              ` : `
                <button class="btn btn-sm btn-primary btn-start-match" data-match="${next.id}" data-court="${court.id}" style="flex:1">▶️ Démarrer</button>
              `}
              <button class="btn btn-sm btn-ghost btn-call-match" data-match="${next.id}" data-court="${court.id}" title="Appeler les joueurs">🔔</button>
            </div>
            ${scheduled.length > 1 ? `<div style="margin-top:var(--space-2);font-size:10px;color:var(--color-text-faint)">+${scheduled.length - 1} autre${scheduled.length > 2 ? 's' : ''} match${scheduled.length > 2 ? 's' : ''} planifié${scheduled.length > 2 ? 's' : ''}</div>` : ''}
          ` : `
            <div style="text-align:center;padding:var(--space-6) 0">
              <div style="font-size:3rem;margin-bottom:var(--space-2)">✅</div>
              <div style="color:var(--color-text-muted);font-size:var(--font-size-sm)">Terrain disponible</div>
              <div style="font-size:10px;color:var(--color-text-faint);margin-top:4px">Aucun match planifié</div>
            </div>
          `}
        </div>
      </div>`;
  };

  const _renderQuickDashboard = (t, courts, matches) => {
    const poolMatches = matches.filter(m => m.type === 'pool');
    const done = poolMatches.filter(m => m.status === 'finished').length;
    const running = matches.filter(m => m.status === 'running');
    const upcoming = matches.filter(m => m.status === 'scheduled' && m.scheduledTime)
      .sort((a,b) => Utils.compareTime(a.scheduledTime, b.scheduledTime))
      .slice(0, 5);

    if (running.length === 0 && upcoming.length === 0) return '';

    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4)">
        ${running.length > 0 ? `
          <div class="card">
            <div class="card-header"><span class="card-title">⚡ Matchs en cours (${running.length})</span></div>
            <div class="card-body" style="padding:0">
              ${running.map(m => {
                const court = (t.settings?.courts || []).find(c => c.id === m.courtId);
                return `<div style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3) var(--space-4);border-bottom:1px solid var(--color-border-light)">
                  <span style="font-size:10px;font-weight:700;color:var(--color-warning);min-width:80px">${Utils.escHtml(court?.name || '—')}</span>
                  <span style="font-size:var(--font-size-sm);flex:1">${Utils.escHtml(getTeamName(t, m.team1Id))} <span style="color:var(--color-text-faint)">vs</span> ${Utils.escHtml(getTeamName(t, m.team2Id))}</span>
                  ${elapsed(m.startedAt) ? `<span style="font-size:10px;color:var(--color-text-muted)">⏱ ${elapsed(m.startedAt)}</span>` : ''}
                </div>`;
              }).join('')}
            </div>
          </div>` : '<div></div>'}

        ${upcoming.length > 0 ? `
          <div class="card">
            <div class="card-header"><span class="card-title">⏭️ Prochains matchs</span></div>
            <div class="card-body" style="padding:0">
              ${upcoming.map(m => {
                const court = (t.settings?.courts || []).find(c => c.id === m.courtId);
                const blocked = !isTeamPresent(t, m.team1Id) || !isTeamPresent(t, m.team2Id);
                return `<div style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3) var(--space-4);border-bottom:1px solid var(--color-border-light)">
                  <span style="font-size:var(--font-size-xs);font-weight:700;color:var(--color-primary);min-width:45px">${m.scheduledTime}</span>
                  <span style="font-size:10px;color:var(--color-text-faint);min-width:60px">${Utils.escHtml(court?.name || '—')}</span>
                  <span style="font-size:var(--font-size-sm);flex:1">${Utils.escHtml(getTeamName(t, m.team1Id))} <span style="color:var(--color-text-faint)">vs</span> ${Utils.escHtml(getTeamName(t, m.team2Id))}</span>
                  ${blocked ? '<span title="Check-in incomplet" style="font-size:12px">⚠️</span>' : ''}
                </div>`;
              }).join('')}
            </div>
          </div>` : '<div></div>'}
      </div>`;
  };

  // ── Actions ──────────────────────────────────────────────────────

  const _startMatch = (matchId, courtId) => {
    const t = App.getTournament();
    const m = (t.matches || []).find(x => x.id === matchId);
    if (!m) return;

    // Sécurité check-in
    if (!isTeamPresent(t, m.team1Id) || !isTeamPresent(t, m.team2Id)) {
      App.toast('⚠️ Certains joueurs ne sont pas encore check-in', 'warning');
      return;
    }

    // Vérifier qu'un autre match n'est pas déjà running sur ce terrain
    const alreadyRunning = (t.matches || []).find(x => x.courtId === courtId && x.status === 'running' && x.id !== matchId);
    if (alreadyRunning) {
      App.toast('Un match est déjà en cours sur ce terrain', 'warning');
      return;
    }

    m.status = 'running';
    m.startedAt = Date.now();
    App.saveTournament(t);
    App.toast(`▶️ Match démarré sur ${(t.settings?.courts || []).find(c => c.id === courtId)?.name || courtId}`, 'success');
    _renderPage();
  };

  const _freeCourt = async (courtId) => {
    const ok = await App.confirm('Libérer le terrain', 'Le match en cours repassera en "planifié". Voulez-vous continuer ?', { icon: '🔓', okLabel: 'Libérer', okClass: 'btn-warning' });
    if (!ok) return;
    const t = App.getTournament();
    const running = (t.matches || []).find(m => m.courtId === courtId && m.status === 'running');
    if (running) {
      running.status = 'scheduled';
      delete running.startedAt;
    }
    App.saveTournament(t);
    App.toast('Terrain libéré', 'success');
    _renderPage();
  };

  // Ajout rapide d'un terrain depuis cette page (raccourci vers Paramètres > Terrains)
  const _openAddCourtModal = () => {
    App.modal.open('➕ Ajouter un terrain',
      `<div class="form-group">
        <label class="form-label">Nom du terrain</label>
        <input id="court-quick-name-input" class="form-control" placeholder="Terrain 3" autocomplete="off">
       </div>`,
      { buttons: [
        { label: 'Annuler', class: 'btn-ghost', onClick: () => App.modal.close() },
        { label: 'Ajouter', class: 'btn-primary', id: 'btn-court-quick-ok' }
      ]}
    );
    Utils.el('#btn-court-quick-ok')?.addEventListener('click', () => {
      const name = Utils.el('#court-quick-name-input')?.value.trim();
      if (!name) { App.toast('Nom requis', 'error'); return; }
      const t = App.getTournament();
      t.settings = t.settings || {};
      t.settings.courts = t.settings.courts || [];
      t.settings.courts.push({ id: Utils.uuid(), name, available: true });
      App.saveTournament(t);
      Audit.log(Audit.ACTIONS.CREATE, 'court', name);
      App.modal.close();
      App.toast('Terrain ajouté', 'success');
      _renderPage();
    });
  };

  // API publique exposée pour scores.js
  const startMatchById = (matchId) => {
    const t = App.getTournament();
    const m = (t.matches || []).find(x => x.id === matchId);
    if (m) _startMatch(matchId, m.courtId);
  };


  // Alias exposé pour scores.js (qui appelle CourtsModule.isTeamCheckedIn) —
  // sans cet export, la page Scores plantait avec "isTeamCheckedIn is not a function".
  return { render, startMatchById, isTeamCheckedIn: isTeamPresent };
})();
