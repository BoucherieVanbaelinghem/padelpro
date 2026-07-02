'use strict';

/* ═══════════════════════════════════════════════════════════════
   POOLS MODULE — Gestion des poules
   ═══════════════════════════════════════════════════════════════ */

const PoolsModule = (() => {

  let _container = null;

  const render = (container) => {
    _container = container;
    _renderPage();
  };

  const _renderPage = () => {
    const t = App.getTournament();
    const teams = t.teams || [];
    const pools = t.pools || [];

    _container.innerHTML = `
      <div class="animate-fade-in">
        <div class="page-header">
          <div class="page-header-left">
            <h2 class="page-title">🔵 Poules</h2>
            <p class="page-subtitle">${pools.length} poule${pools.length > 1 ? 's' : ''} • ${teams.length} équipe${teams.length > 1 ? 's' : ''}</p>
          </div>
          <div class="page-header-actions">
            ${pools.length > 0 ? '<button class="btn btn-secondary" id="btn-reset-pools">🔄 Refaire les poules</button>' : ''}
            <button class="btn btn-primary" id="btn-gen-pools">⚡ Générer les poules</button>
          </div>
        </div>

        ${teams.length < 2 ? '<div class="alert alert-warning">⚠️ Il faut au moins 2 équipes pour créer des poules. <button class="btn btn-primary btn-sm" style="margin-left:12px" onclick="App.navigate(\'teams\')">Créer les équipes</button></div>' : ''}

        ${pools.length === 0 ? renderEmptyState() : renderPools(t)}
      </div>`;

    bindEvents();
  };

  const renderEmptyState = () => '<div class="card"><div class="card-body"><div class="empty-state"><div class="empty-state-icon">🔵</div><h3>Aucune poule créée</h3><p>Cliquez sur "Générer les poules" pour répartir automatiquement les équipes.</p></div></div></div>';

  const renderPools = (t) => {
    const pools = t.pools || [];
    const teams = t.teams || [];
    const matches = t.matches || [];

    return '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:var(--space-5)">' +
      pools.map((pool, pi) => {
        const poolTeams = (pool.teamIds || []).map(id => teams.find(tm => tm.id === id)).filter(Boolean);
        const poolMatches = matches.filter(m => m.poolId === pool.id);
        const finished = poolMatches.filter(m => m.status === 'finished').length;

        return '<div class="pool-card">' +
          '<div class="pool-card-header" style="background:' + Utils.colorFromIndex(pi) + '">' +
            '<span class="pool-card-title">' + Utils.escHtml(pool.name) + '</span>' +
            '<span style="font-size:var(--font-size-xs);opacity:0.8">' + poolTeams.length + ' équipes • ' + finished + '/' + poolMatches.length + ' matchs</span>' +
          '</div>' +
          '<table style="width:100%"><thead><tr>' +
            '<th style="background:var(--color-bg);padding:6px 12px;font-size:11px;color:var(--color-text-muted);text-align:left;border-bottom:1px solid var(--color-border)">Équipe</th>' +
            '<th style="background:var(--color-bg);padding:6px 8px;font-size:11px;color:var(--color-text-muted);text-align:center;border-bottom:1px solid var(--color-border)">J</th>' +
            '<th style="background:var(--color-bg);padding:6px 8px;font-size:11px;color:var(--color-text-muted);text-align:center;border-bottom:1px solid var(--color-border)">V</th>' +
            '<th style="background:var(--color-bg);padding:6px 8px;font-size:11px;color:var(--color-text-muted);text-align:center;border-bottom:1px solid var(--color-border)">D</th>' +
            '<th style="background:var(--color-bg);padding:6px 8px;font-size:11px;color:var(--color-text-muted);text-align:center;border-bottom:1px solid var(--color-border)">Pts</th>' +
            '<th style="background:var(--color-bg);padding:6px 8px;font-size:11px;color:var(--color-text-muted);text-align:center;border-bottom:1px solid var(--color-border)">+/-</th>' +
          '</tr></thead><tbody>' +
          poolTeams.map((tm, ri) => {
            const stats = computeTeamStats(tm.id, poolMatches, t.settings && t.settings.game);
            const qualified = ri < ((t.settings && t.settings.game && t.settings.game.qualificationCount) || 2);
            return '<tr style="' + (qualified ? 'background:var(--color-success-bg)' : '') + '">' +
              '<td style="padding:8px 12px;border-bottom:1px solid var(--color-border-light)">' +
                '<div style="display:flex;align-items:center;gap:8px">' +
                  (qualified ? '<span style="color:var(--color-success);font-size:12px;font-weight:700">Q</span>' : '') +
                  '<span style="font-size:var(--font-size-sm);font-weight:' + (qualified ? '700' : '400') + '">' + Utils.escHtml(getTeamName(t, tm.id)) + '</span>' +
                '</div>' +
              '</td>' +
              '<td style="padding:8px;text-align:center;font-size:var(--font-size-sm)">' + stats.played + '</td>' +
              '<td style="padding:8px;text-align:center;font-size:var(--font-size-sm);color:var(--color-success);font-weight:700">' + stats.wins + '</td>' +
              '<td style="padding:8px;text-align:center;font-size:var(--font-size-sm);color:var(--color-danger)">' + stats.losses + '</td>' +
              '<td style="padding:8px;text-align:center;font-size:var(--font-size-sm);font-weight:700;color:var(--color-primary)">' + stats.points + '</td>' +
              '<td style="padding:8px;text-align:center;font-size:var(--font-size-sm);color:var(--color-text-muted)">' + (stats.gameDiff >= 0 ? '+' : '') + stats.gameDiff + '</td>' +
            '</tr>';
          }).join('') +
          '</tbody></table>' +
          (poolMatches.length > 0 ?
            '<div style="padding:8px 12px;border-top:1px solid var(--color-border-light)">' +
              '<div class="progress-bar"><div class="progress-fill' + (finished === poolMatches.length && finished > 0 ? ' success' : '') + '" style="width:' + (poolMatches.length ? Math.round(finished / poolMatches.length * 100) : 0) + '%"></div></div>' +
              '<div style="font-size:10px;color:var(--color-text-muted);margin-top:4px;text-align:right">' + finished + '/' + poolMatches.length + ' matchs terminés</div>' +
            '</div>' : '') +
        '</div>';
      }).join('') +
    '</div>';
  };

  const computeTeamStats = (teamId, matches, gameSettings) => {
    const g = gameSettings || {};
    let played = 0, wins = 0, losses = 0, draws = 0, points = 0, gameDiff = 0, gamesWon = 0;

    matches.filter(function(m) {
      return m.status === 'finished' && (m.team1Id === teamId || m.team2Id === teamId);
    }).forEach(function(m) {
      played++;
      const isTeam1 = m.team1Id === teamId;
      const score = m.score;
      if (!score) return;

      if (m.winnerId === teamId) {
        wins++;
        points += (g.pointsWin !== undefined ? g.pointsWin : 3);
      } else if (!m.winnerId) {
        draws++;
        points += (g.pointsDraw !== undefined ? g.pointsDraw : 1);
      } else {
        losses++;
        points += (g.pointsLoss !== undefined ? g.pointsLoss : 0);
      }

      if (score.sets) {
        score.sets.forEach(function(s) {
          gameDiff += isTeam1 ? (s.team1 - s.team2) : (s.team2 - s.team1);
          gamesWon += isTeam1 ? s.team1 : s.team2;
        });
      }
    });

    return { played: played, wins: wins, losses: losses, draws: draws, points: points, gameDiff: gameDiff, gamesWon: gamesWon };
  };

  const getTeamName = (t, teamId) => {
    const team = (t.teams || []).find(function(tm) { return tm.id === teamId; });
    if (!team) return '?';
    if (team.name) return team.name;
    return (team.playerIds || []).map(function(id) {
      const p = App.getPlayers(t).find(function(pl) { return pl.id === id; });
      return p ? Utils.fullName(p) : '?';
    }).join(' / ');
  };

  const bindEvents = () => {
    Utils.el('#btn-gen-pools', _container) && Utils.el('#btn-gen-pools', _container).addEventListener('click', openGenModal);
    Utils.el('#btn-reset-pools', _container) && Utils.el('#btn-reset-pools', _container).addEventListener('click', openGenModal);
  };

  const openGenModal = () => {
    const t = App.getTournament();
    const teams = t.teams || [];
    const g = (t.settings && t.settings.game) || {};

    const maxPools = Math.max(1, Math.floor(teams.length / 2));
    const defaultPools = Math.min(g.poolCount || 2, maxPools);

    App.modal.open('🔵 Générer les poules',
      '<div class="form-section">' +
        (teams.length < 2
          ? '<div class="alert alert-warning">⚠️ Il faut au moins 2 équipes.</div>'
          : '<div class="alert alert-info">ℹ️ <strong>' + teams.length + ' équipes</strong> disponibles.</div>') +
        '<div class="form-row">' +
          '<div class="form-group">' +
            '<label class="form-label">Nombre de poules</label>' +
            '<input id="gp-count" type="number" min="1" max="' + maxPools + '" class="form-control" value="' + defaultPools + '">' +
            '<span class="form-hint">Max ' + maxPools + ' poule' + (maxPools > 1 ? 's' : '') + ' (min. 2 équipes par poule)</span>' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label">Équipes qualifiées par poule</label>' +
            '<input id="gp-qual" type="number" min="1" max="' + Math.max(1, Math.floor(teams.length / Math.max(defaultPools, 1))) + '" class="form-control" value="' + (g.qualificationCount || 2) + '">' +
          '</div>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Méthode de répartition</label>' +
          '<select id="gp-method" class="form-control">' +
            '<option value="balanced">Équilibrée (niveaux)</option>' +
            '<option value="seeding">Têtes de série FFT (classement)</option>' +
            '<option value="random">Aléatoire</option>' +
            '<option value="sequential">Séquentielle (1,2,3…)</option>' +
          '</select>' +
        '</div>' +
        '<div id="gp-preview" class="mt-4" style="background:var(--color-bg);border-radius:var(--radius-md);padding:var(--space-3)">' +
          '<div class="text-xs text-muted mb-2" style="margin-bottom:8px">Aperçu de la répartition</div>' +
          '<div id="gp-preview-content">Saisissez le nombre de poules</div>' +
        '</div>' +
      '</div>',
      {
        buttons: [
          { label: 'Annuler', class: 'btn-ghost', onClick: function() { App.modal.close(); } },
          { label: '✅ Créer les poules', class: 'btn-primary', id: 'btn-do-pools' }
        ]
      }
    );

    const updatePreview = function() {
      const countEl = Utils.el('#gp-count');
      const methodEl = Utils.el('#gp-method');
      const count = Math.min(parseInt(countEl && countEl.value) || 1, maxPools);
      const method = (methodEl && methodEl.value) || 'balanced';
      const preview = distributeTeams(teams, count, method, t.settings && t.settings.levels, App.getPlayers(t));
      const el = Utils.el('#gp-preview-content');
      if (el) {
        el.innerHTML = preview.map(function(pool, i) {
          return '<div style="margin-bottom:6px;font-size:var(--font-size-sm)">' +
            '<span style="font-weight:700;color:' + Utils.colorFromIndex(i) + '">Poule ' + String.fromCharCode(65 + i) + '</span>' +
            ' (' + pool.length + ' équipes) : ' +
            pool.map(function(tm) { return '<span class="chip">' + Utils.escHtml(tm.name || '?') + '</span>'; }).join(' ') +
          '</div>';
        }).join('');
      }
    };

    Utils.el('#gp-count') && Utils.el('#gp-count').addEventListener('input', updatePreview);
    Utils.el('#gp-method') && Utils.el('#gp-method').addEventListener('change', updatePreview);
    updatePreview();

    Utils.el('#btn-do-pools') && Utils.el('#btn-do-pools').addEventListener('click', function() {
      const count = parseInt((Utils.el('#gp-count') && Utils.el('#gp-count').value) || 1);
      const qual = parseInt((Utils.el('#gp-qual') && Utils.el('#gp-qual').value) || 2);
      const method = (Utils.el('#gp-method') && Utils.el('#gp-method').value) || 'balanced';
      createPools(count, qual, method);
    });
  };

  // Valeur numérique d'un classement FFT (plus haut = meilleur)
  const _fftRankValue = (code) => {
    const MAP = { 'P1000': 7, 'P500': 6, 'P250': 5, 'P100': 4, 'P50': 3, 'P25': 2, 'NC': 1, '': 0 };
    return MAP[code] || 0;
  };

  const _teamSeedScore = (team, players) => {
    if (!team.playerIds || !players) return 0;
    const scores = team.playerIds.map(pid => {
      const p = players.find(pl => pl.id === pid);
      return _fftRankValue(p?.classementFFT || '');
    });
    return scores.reduce((a, b) => a + b, 0);
  };

  const distributeTeams = (teams, count, method, levels, players) => {
    if (teams.length === 0 || count <= 0) return [];
    const safeCount = Math.min(count, Math.floor(teams.length / 2));
    if (safeCount < 1) return [teams.slice()];

    let sorted = teams.slice();
    if (method === 'random') {
      sorted = Utils.shuffle(teams);
    } else if (method === 'seeding') {
      // Trier par classement FFT décroissant (meilleurs en premier)
      sorted = teams.slice().sort((a, b) => _teamSeedScore(b, players || []) - _teamSeedScore(a, players || []));
    }

    const pools = [];
    for (let i = 0; i < safeCount; i++) pools.push([]);

    sorted.forEach(function(team, i) {
      const poolCount = pools.length;
      let idx;
      if (method === 'balanced' || method === 'seeding') {
        // Snake: 0,1,2,3,3,2,1,0,0,1,2,3...
        idx = (i % (poolCount * 2) < poolCount) ? (i % poolCount) : (poolCount - 1 - (i % poolCount));
      } else {
        idx = i % poolCount;
      }
      pools[idx].push(team);
    });

    return pools.filter(function(p) { return p.length >= 2; });
  };

  const createPools = (count, qualCount, method) => {
    const t = App.getTournament();
    const teams = t.teams || [];

    const maxPools = Math.max(1, Math.floor(teams.length / 2));
    if (count > maxPools) {
      App.toast('Trop de poules ! Maximum ' + maxPools + ' poule' + (maxPools > 1 ? 's' : '') + ' pour ' + teams.length + ' équipes.', 'error');
      return;
    }

    const groups = distributeTeams(teams, count, method, t.settings && t.settings.levels, App.getPlayers(t));

    if (groups.length === 0) {
      App.toast("Impossible de créer les poules : pas assez d'équipes.", 'error');
      return;
    }

    // Règle FFT : minimum 3 matchs par paire → il faut au moins 4 équipes par poule
    const smallPools = groups.filter(g => g.length < 4);
    if (smallPools.length > 0) {
      const minMatches = Math.min(...groups.map(g => (g.length * (g.length - 1)) / 2));
      App.toast(`⚠️ Certaines poules ont moins de 4 équipes (seulement ${minMatches} match${minMatches > 1 ? 's' : ''} par équipe). La règle FFT exige 3 matchs minimum par paire.`, 'warning', 7000);
    }

    if (!t.settings) t.settings = {};
    if (!t.settings.game) t.settings.game = {};
    t.settings.game.poolCount = count;
    t.settings.game.qualificationCount = qualCount;

    t.pools = groups.map(function(group, i) {
      return {
        id: Utils.uuid(),
        name: 'Poule ' + String.fromCharCode(65 + i),
        teamIds: group.map(tm => tm.id)
      };
    });

    // Générer les matchs de poule
    const newMatches = [];
    const existingMatches = (t.matches || []).filter(m => m.type !== 'pool');

    t.pools.forEach(pool => {
      const ids = pool.teamIds || [];
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          newMatches.push({
            id: Utils.uuid(),
            type: 'pool',
            poolId: pool.id,
            team1Id: ids[i],
            team2Id: ids[j],
            status: 'pending',
            score: null,
            winnerId: null,
            scheduledTime: null,
            court: null,
            formatId: t.settings?.game?.activeFormatId || null,
          });
        }
      }
    });

    t.matches = [...existingMatches, ...newMatches];
    App.saveTournament(t);
    App.modal.close();
    _renderPage();
    App.toast(`${t.pools.length} poule${t.pools.length > 1 ? 's' : ''} créée${t.pools.length > 1 ? 's' : ''} avec ${newMatches.length} matchs.`, 'success');
  };

  return { render, computeTeamStats, distributeTeams };

})();
