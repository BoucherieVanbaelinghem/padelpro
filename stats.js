'use strict';

/* ═══════════════════════════════════════════════════════════════
   STATS MODULE — Statistiques joueurs & classement multi-tournois
   ═══════════════════════════════════════════════════════════════ */

const StatsModule = (() => {

  let _container = null;
  let _tab = 'current'; // current | global

  const render = (container) => {
    _container = container;
    _renderPage();
  };

  const _renderPage = () => {
    const t = App.getTournament();
    const hasMatches = (t.matches || []).some(m => m.status === 'finished');

    _container.innerHTML = `
      <div class="animate-fade-in">
        <div class="page-header">
          <div class="page-header-left">
            <h2 class="page-title">📊 Statistiques</h2>
            <p class="page-subtitle">Performances des joueurs</p>
          </div>
        </div>
        <div class="tabs" style="margin-bottom:var(--space-4)">
          <button class="tab-btn ${_tab==='current'?'active':''}" data-tab="current">🏟️ Tournoi actuel</button>
          <button class="tab-btn ${_tab==='global'?'active':''}" data-tab="global">🌍 Classement global</button>
          <button class="tab-btn ${_tab==='fun'?'active':''}" data-tab="fun">🎯 Métriques fun</button>
        </div>
        <div id="stats-content"></div>
      </div>`;

    _container.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => { _tab = btn.dataset.tab; _renderPage(); });
    });

    const sc = Utils.el('#stats-content', _container);
    if (_tab === 'current') renderCurrentStats(sc, t);
    else if (_tab === 'global') renderGlobalStats(sc);
    else renderFunStats(sc, t);
  };

  // ── Stats tournoi actuel ───────────────────────────────────────
  const renderCurrentStats = (container, t) => {
    const finishedMatches = (t.matches || []).filter(m => m.status === 'finished');
    if (finishedMatches.length === 0) {
      container.innerHTML = '<div class="card"><div class="card-body"><div class="empty-state"><div class="empty-state-icon">📊</div><h3>Aucun match terminé</h3><p>Les statistiques apparaîtront au fur et à mesure des matchs.</p></div></div></div>';
      return;
    }

    // Calculer stats par équipe
    const teamStats = (t.teams || []).map(tm => {
      const stats = computeTeamStats(tm.id, finishedMatches, t.settings?.game);
      const players = (tm.playerIds || []).map(id => {
        const allP = Storage.getGlobalPlayers(); const p = allP[id];
        return p ? `${p.firstName || ''} ${(p.lastName || '').toUpperCase()}`.trim() : '?';
      });
      return { ...stats, teamId: tm.id, teamName: tm.name || players.join(' / '), players };
    }).sort((a, b) => b.points - a.points || b.wins - a.wins || b.gameDiff - a.gameDiff);

    const medals = ['🥇', '🥈', '🥉'];

    container.innerHTML = `
      <div class="card">
        <div class="card-header"><span class="card-title">🏆 Classement — ${Utils.escHtml(t.settings?.tournament?.name || 'Tournoi')}</span></div>
        <div class="table-wrapper">
          <table>
            <thead><tr>
              <th style="width:40px">#</th>
              <th>Équipe / Joueurs</th>
              <th style="text-align:center">J</th>
              <th style="text-align:center">V</th>
              <th style="text-align:center">D</th>
              <th style="text-align:center">Éq.</th>
              <th style="text-align:center">Pts</th>
              <th style="text-align:center">+/-</th>
              <th style="text-align:center">Win%</th>
            </tr></thead>
            <tbody>
              ${teamStats.map((s, i) => `
                <tr style="${i < 2 ? 'background:var(--color-success-bg)' : ''}">
                  <td style="font-weight:700;text-align:center">${medals[i] || (i + 1)}</td>
                  <td>
                    <div style="font-weight:700;font-size:var(--font-size-sm)">${Utils.escHtml(s.teamName)}</div>
                    <div style="font-size:11px;color:var(--color-text-muted)">${s.players.map(p => Utils.escHtml(p)).join(' & ')}</div>
                  </td>
                  <td style="text-align:center">${s.played}</td>
                  <td style="text-align:center;color:var(--color-success);font-weight:700">${s.wins}</td>
                  <td style="text-align:center;color:var(--color-danger)">${s.losses}</td>
                  <td style="text-align:center;color:var(--color-text-muted)">${s.draws}</td>
                  <td style="text-align:center;font-weight:700;color:var(--color-primary)">${s.points}</td>
                  <td style="text-align:center;color:${s.gameDiff>=0?'var(--color-success)':'var(--color-danger)'}">${s.gameDiff >= 0 ? '+' : ''}${s.gameDiff}</td>
                  <td style="text-align:center">
                    <span style="font-weight:700;color:${s.played?'var(--color-text)':'var(--color-text-muted)'}">${s.played ? Math.round(s.wins/s.played*100) : 0}%</span>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:var(--space-4);margin-top:var(--space-4)">
        ${renderStatCard('🎾 Matchs joués', finishedMatches.length, 'au total')}
        ${renderStatCard('🏆 Meilleure équipe', teamStats[0]?.teamName || '—', `${teamStats[0]?.wins || 0} victoires`)}
        ${renderStatCard('⚡ Meilleur pourcentage', teamStats[0]?.played ? Math.round(teamStats[0].wins/teamStats[0].played*100)+'%' : '—', teamStats[0]?.teamName || '')}
        ${renderStatCard('🎯 Total points', teamStats.reduce((s,t) => s+t.points, 0), 'distribués')}
      </div>`;
  };

  const renderStatCard = (label, value, sub) => `
    <div class="card">
      <div class="card-body" style="text-align:center;padding:var(--space-4)">
        <div style="font-size:var(--font-size-xs);color:var(--color-text-muted);margin-bottom:var(--space-1)">${label}</div>
        <div style="font-size:var(--font-size-xl);font-weight:800;color:var(--color-primary)">${Utils.escHtml(String(value))}</div>
        <div style="font-size:11px;color:var(--color-text-faint)">${Utils.escHtml(String(sub))}</div>
      </div>
    </div>`;

  // ── Stats globales multi-tournois ──────────────────────────────
  const renderGlobalStats = (container) => {
    const allTournaments = Storage.getAllTournaments ? Storage.getAllTournaments() : [];
    if (allTournaments.length === 0) {
      container.innerHTML = '<div class="card"><div class="card-body"><div class="empty-state"><div class="empty-state-icon">🌍</div><h3>Un seul tournoi</h3><p>Le classement global apparaît quand vous avez joué plusieurs tournois.</p></div></div></div>';
      return;
    }

    // Agréger par joueur (on identifie par "prénom nom" normalisé)
    const playerMap = {}; // key: "prenom_nom" → { name, wins, losses, draws, played, tournaments: Set }

    allTournaments.forEach(t => {
      const finishedMatches = (t.matches || []).filter(m => m.status === 'finished');
      (t.teams || []).forEach(tm => {
        const stats = computeTeamStats(tm.id, finishedMatches, t.settings?.game);
        (tm.playerIds || []).forEach(pid => {
          const allPl = Storage.getGlobalPlayers(); const p = allPl[pid];
          if (!p) return;
          const key = `${(p.firstName||'').toLowerCase()}_${(p.lastName||'').toLowerCase()}`;
          const name = `${p.firstName || ''} ${(p.lastName || '').toUpperCase()}`.trim();
          if (!playerMap[key]) playerMap[key] = { name, wins: 0, losses: 0, draws: 0, played: 0, tournaments: new Set(), points: 0 };
          playerMap[key].wins += stats.wins;
          playerMap[key].losses += stats.losses;
          playerMap[key].draws += stats.draws;
          playerMap[key].played += stats.played;
          playerMap[key].points += stats.points;
          playerMap[key].tournaments.add(t.id || t.settings?.tournament?.name || '?');
        });
      });
    });

    const players = Object.values(playerMap)
      .map(p => ({ ...p, winPct: p.played ? Math.round(p.wins / p.played * 100) : 0, tourCount: p.tournaments.size }))
      .sort((a, b) => b.wins - a.wins || b.winPct - a.winPct || b.played - a.played)
      .filter(p => p.played > 0);

    if (players.length === 0) {
      container.innerHTML = '<div class="card"><div class="card-body"><div class="empty-state"><div class="empty-state-icon">🌍</div><h3>Aucun match joué</h3><p>Les statistiques globales apparaîtront après vos premiers matchs.</p></div></div></div>';
      return;
    }

    const medals = ['🥇', '🥈', '🥉'];
    container.innerHTML = `
      <div class="alert alert-info" style="margin-bottom:var(--space-4)">
        ℹ️ Classement basé sur <strong>${allTournaments.length} tournoi${allTournaments.length>1?'s':''}</strong> — ${players.length} joueurs
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">🌍 Classement global tous tournois</span></div>
        <div class="table-wrapper">
          <table>
            <thead><tr>
              <th style="width:40px">#</th>
              <th>Joueur</th>
              <th style="text-align:center">Tournois</th>
              <th style="text-align:center">J</th>
              <th style="text-align:center">V</th>
              <th style="text-align:center">D</th>
              <th style="text-align:center">Win%</th>
              <th style="text-align:center">Points</th>
            </tr></thead>
            <tbody>
              ${players.map((p, i) => `
                <tr>
                  <td style="font-weight:700;text-align:center">${medals[i] || (i+1)}</td>
                  <td style="font-weight:600">${Utils.escHtml(p.name)}</td>
                  <td style="text-align:center"><span class="badge badge-primary">${p.tourCount}</span></td>
                  <td style="text-align:center">${p.played}</td>
                  <td style="text-align:center;color:var(--color-success);font-weight:700">${p.wins}</td>
                  <td style="text-align:center;color:var(--color-danger)">${p.losses}</td>
                  <td style="text-align:center">
                    <div style="display:flex;align-items:center;gap:6px">
                      <div style="flex:1;height:6px;background:var(--color-border);border-radius:3px;overflow:hidden">
                        <div style="width:${p.winPct}%;height:100%;background:var(--color-primary);border-radius:3px"></div>
                      </div>
                      <span style="font-weight:700;font-size:var(--font-size-xs)">${p.winPct}%</span>
                    </div>
                  </td>
                  <td style="text-align:center;font-weight:700;color:var(--color-primary)">${p.points}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  };

  // ── Métriques fun ──────────────────────────────────────────────
  const renderFunStats = (container, t) => {
    const matches = (t.matches || []).filter(m => m.status === 'finished');
    if (matches.length === 0) {
      container.innerHTML = '<div class="card"><div class="card-body"><div class="empty-state"><div class="empty-state-icon">🎯</div><h3>Aucun match terminé</h3></div></div></div>';
      return;
    }

    const getTeamName = (id) => {
      const tm = (t.teams || []).find(x => x.id === id);
      return tm?.name || '?';
    };

    // Trouver le match le plus serré (différence de jeux la plus petite)
    let closestMatch = null, closestDiff = Infinity;
    let biggestWin = null, biggestDiff = 0;
    let totalSets = 0, decidingMatches = 0;

    matches.forEach(m => {
      if (!m.score?.sets) return;
      let diff = 0;
      m.score.sets.forEach(s => { diff += Math.abs(s.team1 - s.team2); totalSets++; });
      if (diff < closestDiff) { closestDiff = diff; closestMatch = m; }
      if (diff > biggestDiff) { biggestDiff = diff; biggestWin = m; }
      if (m.score.sets.length >= 2) {
        const w1 = m.score.sets.filter(s => s.team1 > s.team2).length;
        const w2 = m.score.sets.filter(s => s.team2 > s.team1).length;
        if (w1 === w2) decidingMatches++;
      }
    });

    // Équipe la plus en forme (derniers matchs)
    const recentMatches = matches.slice(-6);
    const recentWins = {};
    recentMatches.forEach(m => {
      if (!m.winnerId) return;
      recentWins[m.winnerId] = (recentWins[m.winnerId] || 0) + 1;
    });
    const hotTeamId = Object.entries(recentWins).sort((a,b) => b[1]-a[1])[0]?.[0];

    container.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--space-4)">
        ${closestMatch ? `
          <div class="card">
            <div class="card-body">
              <div style="font-size:1.5rem;margin-bottom:var(--space-2)">😅 Match le plus serré</div>
              <div style="font-weight:700">${Utils.escHtml(getTeamName(closestMatch.team1Id))} vs ${Utils.escHtml(getTeamName(closestMatch.team2Id))}</div>
              <div style="color:var(--color-text-muted);font-size:var(--font-size-sm)">${closestMatch.score?.sets?.map(s=>`${s.team1}-${s.team2}`).join(' ') || ''}</div>
            </div>
          </div>` : ''}
        ${biggestWin ? `
          <div class="card">
            <div class="card-body">
              <div style="font-size:1.5rem;margin-bottom:var(--space-2)">💥 Victoire la plus large</div>
              <div style="font-weight:700">${Utils.escHtml(getTeamName(biggestWin.winnerId || biggestWin.team1Id))}</div>
              <div style="color:var(--color-text-muted);font-size:var(--font-size-sm)">${biggestWin.score?.sets?.map(s=>`${s.team1}-${s.team2}`).join(' ') || ''}</div>
            </div>
          </div>` : ''}
        ${hotTeamId ? `
          <div class="card">
            <div class="card-body">
              <div style="font-size:1.5rem;margin-bottom:var(--space-2)">🔥 Équipe en forme</div>
              <div style="font-weight:700">${Utils.escHtml(getTeamName(hotTeamId))}</div>
              <div style="color:var(--color-text-muted);font-size:var(--font-size-sm)">${recentWins[hotTeamId]} victoire${recentWins[hotTeamId]>1?'s':''} récente${recentWins[hotTeamId]>1?'s':''}</div>
            </div>
          </div>` : ''}
        ${renderStatCard('🎾 Sets joués', totalSets, 'au total')}
        ${renderStatCard('⚔️ Matchs en 3 sets', decidingMatches, `sur ${matches.length} matchs`)}
        ${renderStatCard('📈 Taux de complétion', Math.round(matches.length / Math.max((t.matches||[]).length, 1) * 100) + '%', `${matches.length}/${(t.matches||[]).length} matchs`)}
      </div>`;
  };

  // ── Calcul stats équipe ────────────────────────────────────────
  const computeTeamStats = (teamId, matches, gameSettings) => {
    const g = gameSettings || {};
    let played = 0, wins = 0, losses = 0, draws = 0, points = 0, gameDiff = 0;

    matches.filter(m => m.team1Id === teamId || m.team2Id === teamId).forEach(m => {
      played++;
      const isTeam1 = m.team1Id === teamId;
      if (m.winnerId === teamId) {
        wins++;
        points += (g.pointsWin !== undefined ? g.pointsWin : 3);
      } else if (!m.winnerId || m.winnerId === '') {
        draws++;
        points += (g.pointsDraw !== undefined ? g.pointsDraw : 1);
      } else {
        losses++;
        points += (g.pointsLoss !== undefined ? g.pointsLoss : 0);
      }
      if (m.score?.sets) {
        m.score.sets.forEach(s => {
          gameDiff += isTeam1 ? (s.team1 - s.team2) : (s.team2 - s.team1);
        });
      }
    });

    return { played, wins, losses, draws, points, gameDiff };
  };

  return { render };
})();
