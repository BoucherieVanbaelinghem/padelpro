'use strict';

/* ═══════════════════════════════════════════════════════════════
   RANKINGS MODULE — Classements
   ═══════════════════════════════════════════════════════════════ */

const RankingsModule = (() => {

  let _container = null;

  const render = (container) => {
    _container = container;
    _renderPage();
  };

  const getTeamName = (t, id) => {
    const tm = (t.teams || []).find(x => x.id === id);
    return tm?.name || '?';
  };

  const _renderPage = () => {
    const t = App.getTournament();
    const pools = t.pools || [];
    const matches = t.matches || [];

    if (pools.length === 0) {
      _container.innerHTML = `
        <div class="animate-fade-in">
          <div class="page-header"><div class="page-header-left">
            <h2 class="page-title">📊 Classements</h2>
          </div></div>
          <div class="card"><div class="card-body"><div class="empty-state">
            <div class="empty-state-icon">📊</div>
            <h3>Aucune poule créée</h3>
            <p>Créez des poules pour voir les classements.</p>
            <button class="btn btn-primary" onclick="App.navigate('pools')">Créer les poules</button>
          </div></div></div>
        </div>`;
      return;
    }

    _container.innerHTML = `
      <div class="animate-fade-in">
        <div class="page-header">
          <div class="page-header-left">
            <h2 class="page-title">📊 Classements</h2>
            <p class="page-subtitle">${pools.length} poule${pools.length>1?'s':''}</p>
          </div>
          <div class="page-header-actions">
            <button class="btn btn-secondary" onclick="window.print()">🖨️ Imprimer</button>
          </div>
        </div>

        ${pools.map((pool, pi) => renderPoolRanking(t, pool, pi)).join('')}

        ${renderQualifiedSection(t)}
        ${renderFinalRanking(t)}
      </div>`;

    // Bouton imprimer classement final
    _container.querySelector('#btn-print-final-ranking')?.addEventListener('click', () => {
      printFinalRanking(App.getTournament());
    });
  };

  const computeStats = (teamId, matches, criteria, gameSettings) => {
    const g = gameSettings || {};
    let played = 0, wins = 0, losses = 0, draws = 0;
    let points = 0, setsWon = 0, setsLost = 0, gamesWon = 0, gamesLost = 0;

    matches.filter(m => m.status === 'finished' && (m.team1Id === teamId || m.team2Id === teamId))
      .forEach(m => {
        played++;
        const isT1 = m.team1Id === teamId;
        const score = m.score;

        if (m.winnerId === teamId) { wins++; points += g.pointsWin ?? 3; }
        else if (!m.winnerId) { draws++; points += g.pointsDraw ?? 1; }
        else { losses++; points += g.pointsLoss ?? 0; }

        if (score?.sets) {
          score.sets.forEach(s => {
            if (isT1) { setsWon += s.team1 > s.team2 ? 1 : 0; setsLost += s.team2 > s.team1 ? 1 : 0; gamesWon += s.team1; gamesLost += s.team2; }
            else      { setsWon += s.team2 > s.team1 ? 1 : 0; setsLost += s.team1 > s.team2 ? 1 : 0; gamesWon += s.team2; gamesLost += s.team1; }
          });
        }
      });

    return {
      played, wins, losses, draws, points,
      setsWon, setsLost, setDiff: setsWon - setsLost,
      gamesWon, gamesLost, gameDiff: gamesWon - gamesLost
    };
  };

  const rankTeams = (teams, poolMatches, criteria, gameSettings) => {
    const statsMap = {};
    teams.forEach(tm => { statsMap[tm.id] = computeStats(tm.id, poolMatches, criteria, gameSettings); });

    const CRIT = criteria || ['wins', 'points', 'setDiff', 'gameDiff', 'headToHead'];

    return [...teams].sort((a, b) => {
      const sa = statsMap[a.id];
      const sb = statsMap[b.id];

      for (const crit of CRIT) {
        let va, vb;
        switch (crit) {
          case 'wins':       va = sa.wins;     vb = sb.wins;     break;
          case 'points':     va = sa.points;   vb = sb.points;   break;
          case 'setDiff':    va = sa.setDiff;  vb = sb.setDiff;  break;
          case 'gameDiff':   va = sa.gameDiff; vb = sb.gameDiff; break;
          case 'setsWon':    va = sa.setsWon;  vb = sb.setsWon;  break;
          case 'gamesWon':   va = sa.gamesWon; vb = sb.gamesWon; break;
          case 'headToHead': {
            const h2h = poolMatches.find(m =>
              m.status === 'finished' &&
              ((m.team1Id === a.id && m.team2Id === b.id) || (m.team1Id === b.id && m.team2Id === a.id))
            );
            if (h2h) {
              va = h2h.winnerId === a.id ? 1 : 0;
              vb = h2h.winnerId === b.id ? 1 : 0;
            } else { continue; }
            break;
          }
          default: continue;
        }
        if (vb !== va) return vb - va;
      }
      return 0;
    }).map(tm => ({ team: tm, stats: statsMap[tm.id] }));
  };

  const renderPoolRanking = (t, pool, pi) => {
    const teams = (pool.teamIds || []).map(id => (t.teams || []).find(tm => tm.id === id)).filter(Boolean);
    const poolMatches = (t.matches || []).filter(m => m.poolId === pool.id);
    const criteria = t.settings?.game?.rankingCriteria || ['wins', 'points', 'setDiff', 'gameDiff', 'headToHead'];
    const gameSettings = t.settings?.game;
    const qualCount = gameSettings?.qualificationCount || 2;

    const ranked = rankTeams(teams, poolMatches, criteria, gameSettings);
    const color = Utils.colorFromIndex(pi);

    return `
      <div class="pool-card mb-4">
        <div class="pool-card-header" style="background:${color}">
          <span class="pool-card-title">${Utils.escHtml(pool.name)}</span>
          <span style="font-size:11px;opacity:0.8">${poolMatches.filter(m=>m.status==='finished').length}/${poolMatches.length} matchs</span>
        </div>
        <div class="table-wrapper" style="border-radius:0;border:none">
          <table>
            <thead>
              <tr>
                <th style="width:40px">Pos</th>
                <th>Équipe</th>
                <th style="text-align:center">J</th>
                <th style="text-align:center">V</th>
                <th style="text-align:center">D</th>
                <th style="text-align:center">Pts</th>
                <th style="text-align:center">S+/-</th>
                <th style="text-align:center">J+/-</th>
              </tr>
            </thead>
            <tbody>
              ${ranked.map(({ team, stats }, i) => {
                const isQ = i < qualCount;
                return `
                  <tr style="${isQ ? 'background:rgba(22,163,74,0.05)' : ''}">
                    <td style="text-align:center">
                      <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:${isQ?color:'var(--color-border)'};color:${isQ?'white':'var(--color-text-muted)'};font-size:12px;font-weight:700">${i+1}</span>
                    </td>
                    <td>
                      <div style="display:flex;align-items:center;gap:8px">
                        ${isQ ? '<span style="color:var(--color-success);font-size:11px;font-weight:700">Q</span>' : ''}
                        <span style="font-weight:${isQ?'700':'500'}">${Utils.escHtml(getTeamName(t, team.id))}</span>
                      </div>
                    </td>
                    <td style="text-align:center">${stats.played}</td>
                    <td style="text-align:center;color:var(--color-success);font-weight:700">${stats.wins}</td>
                    <td style="text-align:center;color:var(--color-danger)">${stats.losses}</td>
                    <td style="text-align:center;font-weight:800;color:var(--color-primary)">${stats.points}</td>
                    <td style="text-align:center;color:var(--color-text-muted)">${stats.setDiff >= 0 ? '+' : ''}${stats.setDiff}</td>
                    <td style="text-align:center;color:var(--color-text-muted)">${stats.gameDiff >= 0 ? '+' : ''}${stats.gameDiff}</td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  };

  const renderQualifiedSection = (t) => {
    const pools = t.pools || [];
    const qualCount = t.settings?.game?.qualificationCount || 2;
    const criteria = t.settings?.game?.rankingCriteria || ['wins', 'points', 'setDiff', 'gameDiff', 'headToHead'];
    const gameSettings = t.settings?.game;

    const qualified = [];
    pools.forEach(pool => {
      const teams = (pool.teamIds || []).map(id => (t.teams || []).find(tm => tm.id === id)).filter(Boolean);
      const poolMatches = (t.matches || []).filter(m => m.poolId === pool.id);
      const ranked = rankTeams(teams, poolMatches, criteria, gameSettings);
      ranked.slice(0, qualCount).forEach(({ team }, i) => {
        qualified.push({ team, pool, rank: i + 1 });
      });
    });

    if (qualified.length === 0) return '';

    return `
      <div class="card">
        <div class="card-header">
          <span class="card-title">🏆 Équipes qualifiées pour le tableau final</span>
          <span class="badge badge-success">${qualified.length} équipes</span>
        </div>
        <div class="card-body">
          <div class="grid-auto">
            ${qualified.map(({ team, pool, rank }, i) => `
              <div style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3);
                background:var(--color-success-bg);border-radius:var(--radius-md);border:1px solid rgba(22,163,74,0.2)">
                <div style="width:32px;height:32px;border-radius:50%;background:var(--color-success);color:white;
                  display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px">${i+1}</div>
                <div>
                  <div style="font-weight:700;font-size:var(--font-size-sm)">${Utils.escHtml(getTeamName(t, team.id))}</div>
                  <div style="font-size:10px;color:var(--color-text-muted)">${Utils.escHtml(pool.name)} — ${Utils.ordinal(rank)}</div>
                </div>
              </div>`).join('')}
          </div>
        </div>
        ${t.settings?.game?.hasFinalTable !== false ? `
          <div class="card-footer">
            <button class="btn btn-primary" onclick="App.navigate('bracket')">🏆 Voir le tableau final →</button>
          </div>` : ''}
      </div>`;
  };


  // ── Classement final complet ───────────────────────────────────
  const buildFinalRanking = (t) => {
    const bracket = t.bracket;
    const classements = t.classements || [];
    const matches = t.matches || [];
    const results = []; // { place, team1Id, team2Id (for ties), label, source }

    if (!bracket) return results;

    const rounds = bracket.rounds || [];
    if (rounds.length === 0) return results;

    // Finale principale (dernier round)
    const finalRound = rounds[rounds.length - 1];
    const finalMatch = matches.find(m => m.id === finalRound?.matchIds?.[0]);
    if (finalMatch) {
      const loserId = finalMatch.winnerId === finalMatch.team1Id ? finalMatch.team2Id : finalMatch.team1Id;
      results.push({ place: 1, teamId: finalMatch.winnerId, label: '🥇 1ère place', source: 'Vainqueur du tournoi' });
      results.push({ place: 2, teamId: loserId || null, label: '🥈 2ème place', source: 'Finaliste' });
    }

    // Petite finale (3ème/4ème place)
    const petite = matches.find(m => m.isPetiteFinale);
    if (petite) {
      const loserId3 = petite.winnerId === petite.team1Id ? petite.team2Id : petite.team1Id;
      results.push({ place: 3, teamId: petite.winnerId || null, label: '🥉 3ème place', source: 'Petite finale' });
      results.push({ place: 4, teamId: loserId3 || null, label: '4ème place', source: 'Petite finale' });
    } else if (rounds.length >= 2) {
      // Pas de petite finale : les perdants des demi-finales partagent la 3ème place
      const sfRound = rounds[rounds.length - 2];
      const sfLosers = (sfRound?.matchIds || []).map(id => {
        const m = matches.find(x => x.id === id);
        if (!m) return null;
        return m.winnerId ? (m.winnerId === m.team1Id ? m.team2Id : m.team1Id) : null;
      }).filter(Boolean);
      sfLosers.forEach((id, i) => {
        results.push({ place: 3, teamId: id, label: `${3 + i}ème place`, source: 'Demi-finale' });
      });
    }

    // Tableaux de classement
    classements.forEach(cls => {
      const clsRounds = cls.rounds || [];
      if (clsRounds.length === 0) return;

      const clsFinalRound = clsRounds[clsRounds.length - 1];
      const clsFinalMatch = matches.find(m => m.id === clsFinalRound?.matchIds?.[0] && m.classementId === cls.id);
      if (clsFinalMatch) {
        const loserId = clsFinalMatch.winnerId === clsFinalMatch.team1Id ? clsFinalMatch.team2Id : clsFinalMatch.team1Id;
        results.push({ place: cls.placeFrom, teamId: clsFinalMatch.winnerId || null, label: `${cls.placeFrom}ème place`, source: cls.label });
        results.push({ place: cls.placeFrom + 1, teamId: loserId || null, label: `${cls.placeFrom + 1}ème place`, source: cls.label });
      }
      // Demi-finales du classement (3ème/4ème dans ce classement)
      if (clsRounds.length >= 2) {
        const clsSfRound = clsRounds[clsRounds.length - 2];
        const clsSfLosers = (clsSfRound?.matchIds || []).map(id => {
          const m = matches.find(x => x.id === id && x.classementId === cls.id);
          if (!m) return null;
          return m.winnerId ? (m.winnerId === m.team1Id ? m.team2Id : m.team1Id) : null;
        }).filter(Boolean);
        clsSfLosers.forEach((id, i) => {
          results.push({ place: cls.placeFrom + 2 + i, teamId: id, label: `${cls.placeFrom + 2 + i}ème place`, source: cls.label });
        });
      }
    });

    return results.sort((a, b) => a.place - b.place);
  };

  const getTeamDisplayName = (t, teamId) => {
    if (!teamId) return null;
    const team = (t.teams || []).find(x => x.id === teamId);
    if (!team) return null;
    const teamName = team.name || null;
    const players = (team.playerIds || []).map(pid => {
      const p = App.getPlayers(t).find(pl => pl.id === pid);
      return p ? Utils.fullName(p) : null;
    }).filter(Boolean);
    return { teamName, players };
  };

  const renderFinalRanking = (t) => {
    const bracket = t.bracket;
    if (!bracket) return '';

    const ranking = buildFinalRanking(t);
    if (ranking.length === 0) return '';

    const hasBracketResults = ranking.some(r => r.teamId);
    if (!hasBracketResults) return '';

    const medalColors = { 1: '#fbbf24', 2: '#94a3b8', 3: '#cd7f32' };
    const medalBg    = { 1: '#fffbeb', 2: '#f8fafc',  3: '#fff7ed' };
    const categorie = t.settings?.tournament?.categorie || t.settings?.game?.categorie || null;
    const showFftPts = !!categorie && !!FFT_BAREME[categorie];
    const drawSize = (t.teams || []).length;

    return `
      <div class="card" id="final-ranking-card" style="margin-top:var(--space-5)">
        <div class="card-header">
          <span class="card-title">🏆 Classement final du tournoi${categorie ? ` — <span class="badge badge-primary">${categorie}</span>` : ''}</span>
          <button class="btn btn-secondary btn-sm no-print" id="btn-print-final-ranking">🖨️ Imprimer</button>
        </div>
        <div class="card-body" style="padding:0">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:var(--color-bg-alt);border-bottom:2px solid var(--color-border)">
                <th style="padding:12px 16px;text-align:center;font-size:11px;font-weight:700;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.5px;width:72px">Place</th>
                <th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.5px">Équipe / Joueurs</th>
                ${showFftPts ? `<th style="padding:12px 16px;text-align:center;font-size:11px;font-weight:700;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap">Pts FFT</th>` : ''}
              </tr>
            </thead>
            <tbody>
              ${ranking.map(row => {
                const info = row.teamId ? getTeamDisplayName(t, row.teamId) : null;
                const medal = medalColors[row.place];
                const bg = medalBg[row.place] || '';
                const placeEmoji = row.place === 1 ? '🥇' : row.place === 2 ? '🥈' : row.place === 3 ? '🥉' : '';
                const fftPts = showFftPts ? getFFTPoints(categorie, row.place, drawSize) : null;
                return `
                  <tr style="border-bottom:1px solid var(--color-border-light);${bg ? `background:${bg}` : ''}">
                    <td style="padding:14px 16px;text-align:center">
                      <div style="width:40px;height:40px;border-radius:50%;margin:0 auto;
                        background:${medal || 'var(--color-bg-alt)'};
                        display:flex;align-items:center;justify-content:center;
                        font-weight:900;font-size:${row.place <= 3 ? '18' : '15'}px;
                        color:${medal ? 'white' : 'var(--color-text-muted)'}">
                        ${placeEmoji || row.place}
                      </div>
                    </td>
                    <td style="padding:14px 16px">
                      ${info ? `
                        <div style="font-weight:700;font-size:var(--font-size-base);color:var(--color-text)">
                          ${Utils.escHtml(info.teamName || info.players.join(' / ') || '?')}
                        </div>
                        ${info.teamName && info.players.length > 0 ? `
                          <div style="font-size:var(--font-size-sm);color:var(--color-text-muted);margin-top:3px">
                            👤 ${info.players.map(p => Utils.escHtml(p)).join(' &nbsp;·&nbsp; ')}
                          </div>` : ''}
                      ` : `<em style="color:var(--color-text-faint)">À déterminer</em>`}
                    </td>
                    ${showFftPts ? `<td style="padding:14px 16px;text-align:center">
                      ${fftPts !== null ? `<span style="font-size:var(--font-size-lg);font-weight:800;color:var(--color-primary)">${fftPts}</span><span style="font-size:11px;color:var(--color-text-muted);margin-left:4px">pts</span>` : '<span style="color:var(--color-text-faint)">—</span>'}
                    </td>` : ''}
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
          ${showFftPts ? `<div style="padding:var(--space-3) var(--space-4);font-size:11px;color:var(--color-text-muted);border-top:1px solid var(--color-border)">
            Barème FFT 2026 — Catégorie ${categorie} (tableau ${getDrawSizeTier(drawSize)} paires)
          </div>` : ''}
        </div>
      </div>`;
  };

  const printFinalRanking = (t) => {
    const ranking = buildFinalRanking(t);
    const tournamentName = t.settings?.tournament?.name || 'Tournoi de Padel';
    const tournamentDate = t.settings?.tournament?.date ? Utils.formatDate(t.settings.tournament.date) : '';
    const categorie = t.settings?.tournament?.categorie || t.settings?.game?.categorie || null;
    const showFftPts = !!categorie && !!FFT_BAREME[categorie];
    const drawSize = (t.teams || []).length;
    const medalEmoji = { 1: '🥇', 2: '🥈', 3: '🥉' };
    const medalColors = { 1: '#fbbf24', 2: '#94a3b8', 3: '#cd7f32' };

    const rows = ranking.map(row => {
      const info = row.teamId ? getTeamDisplayName(t, row.teamId) : null;
      const medal = medalColors[row.place];
      const emoji = medalEmoji[row.place] || '';
      const fftPts = showFftPts ? getFFTPoints(categorie, row.place, drawSize) : null;
      const teamNameHtml = info
        ? `<strong>${info.teamName || info.players.join(' / ') || '?'}</strong>${info.teamName && info.players.length ? `<br><span style="font-size:12px;color:#555">${info.players.join(' · ')}</span>` : ''}`
        : `<em style="color:#999">À déterminer</em>`;
      return `
        <tr style="border-bottom:1px solid #e5e7eb;${row.place <= 3 ? `background:${row.place===1?'#fffbeb':row.place===2?'#f8fafc':'#fff7ed'}` : ''}">
          <td style="padding:12px 16px;text-align:center;width:64px">
            <div style="width:38px;height:38px;border-radius:50%;margin:0 auto;
              background:${medal || '#f3f4f6'};
              display:flex;align-items:center;justify-content:center;
              font-weight:900;font-size:${row.place<=3?'18':'14'}px;color:${medal?'white':'#6b7280'}">
              ${emoji || row.place}
            </div>
          </td>
          <td style="padding:12px 16px">${teamNameHtml}</td>
          <td style="padding:12px 16px;font-size:12px;color:#6b7280">${row.label}</td>
          ${showFftPts ? `<td style="padding:12px 16px;text-align:center;font-weight:800;color:#2563eb">${fftPts !== null ? `${fftPts} pts` : '—'}</td>` : ''}
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Classement final — ${Utils.escHtml(tournamentName)}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; color: #111827; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    .subtitle { color: #6b7280; font-size: 14px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { background: #f3f4f6; padding: 10px 16px; text-align: left; border-bottom: 2px solid #e5e7eb; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; }
    th.center { text-align: center; }
    td { padding: 12px 16px; border-bottom: 1px solid #e5e7eb; }
    @media print { body { padding: 10px; } }
  </style>
</head>
<body>
  <h1>🏆 Classement final${categorie ? ` — ${categorie}` : ''}</h1>
  <div class="subtitle">${Utils.escHtml(tournamentName)}${tournamentDate ? ` · ${tournamentDate}` : ''}</div>
  <table>
    <thead>
      <tr>
        <th class="center" style="width:64px">Place</th>
        <th>Équipe / Joueurs</th>
        <th>Source</th>
        ${showFftPts ? '<th class="center">Pts FFT</th>' : ''}
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  ${showFftPts ? `<p style="font-size:11px;color:#9ca3af;margin-top:16px">Barème FFT 2026 — Catégorie ${categorie} (tableau ${getDrawSizeTier(drawSize)} paires)</p>` : ''}
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
  };

  // ── Barème FFT 2026 (officiel, applicable depuis le 1er mars 2026) ──
  // Chaque catégorie a un barème qui dépend de la taille du tableau (nombre
  // de paires engagées dans le tournoi). Les clés des sous-tables sont les
  // seuils de "place ≥ seuil" : 1=vainqueur, 2=finaliste, 3=demi (3e-4e),
  // 5=quart (5e-8e), 9=1/8 (9e-16e), 17=1/16 (17e-24e), 25=1/32 (25e-32e).
  const FFT_BAREME = {
    P25: {
      label: 'Débutant', pointsVainqueur: 25,
      cutHommes: 'Top 30 000', cutFemmes: 'Top 3 000', format: '½ journée',
      tiers: {
        '4-8':   { 1: 25, 2: 20, 3: 15, 5: 5 },
        '9-16':  { 1: 25, 2: 20, 3: 15, 5: 9,  9: 3 },
        '17-24': { 1: 25, 2: 21, 3: 17, 5: 12, 9: 6,  17: 2 },
        '25-32': { 1: 25, 2: 22, 3: 19, 5: 14, 9: 9,  17: 4, 25: 2 },
      }
    },
    P50: {
      label: 'Intermédiaire', pointsVainqueur: 50,
      cutHommes: 'Top 10 000', cutFemmes: 'Top 1 000', format: '½ journée à journée',
      tiers: {
        '4-8':   { 1: 50, 2: 35, 3: 22, 5: 10 },
        '9-16':  { 1: 50, 2: 38, 3: 28, 5: 18, 9: 8 },
        '17-24': { 1: 50, 2: 40, 3: 32, 5: 22, 9: 13, 17: 5 },
        '25-32': { 1: 50, 2: 42, 3: 34, 5: 25, 9: 16, 17: 8 },
      }
    },
    P100: {
      label: 'Inter. / Confirmé', pointsVainqueur: 100,
      cutHommes: 'Top 3 000', cutFemmes: 'Top 300', format: 'Journée',
      tiers: {
        '4-8':   { 1: 100, 2: 70,  3: 45,  5: 20 },
        '9-16':  { 1: 100, 2: 75,  3: 55,  5: 35, 9: 15 },
        '17-24': { 1: 100, 2: 78,  3: 60,  5: 42, 9: 25, 17: 8 },
        '25-32': { 1: 100, 2: 80,  3: 62,  5: 45, 9: 30, 17: 15, 25: 5 },
      }
    },
    P250: {
      label: 'Confirmé / Avancé', pointsVainqueur: 250,
      cutHommes: 'Top 500', cutFemmes: 'Top 100', format: 'Week-end',
      tiers: {
        '4-8':   { 1: 250, 2: 150, 3: 100, 5: 50 },
        '9-16':  { 1: 250, 2: 170, 3: 115, 5: 70,  9: 35 },
        '17-24': { 1: 250, 2: 185, 3: 130, 5: 85,  9: 50, 17: 20 },
        '25-32': { 1: 250, 2: 195, 3: 140, 5: 95,  9: 60, 17: 30, 25: 15 },
      }
    },
    P500: {
      label: 'Avancé', pointsVainqueur: 500,
      cutHommes: 'Top 200', cutFemmes: 'Top 50', format: 'Week-end',
      tiers: {
        '4-8':   { 1: 500, 2: 300, 3: 200, 5: 100 },
        '9-16':  { 1: 500, 2: 340, 3: 230, 5: 140, 9: 70 },
        '17-24': { 1: 500, 2: 370, 3: 260, 5: 170, 9: 100, 17: 40 },
        '25-32': { 1: 500, 2: 390, 3: 280, 5: 190, 9: 120, 17: 60, 25: 30 },
      }
    },
    P1000: {
      label: 'Expert / Élite nationale', pointsVainqueur: 1000,
      cutHommes: 'Aucune restriction', cutFemmes: 'Aucune restriction', format: 'Week-end',
      tiers: {
        '4-8':   { 1: 1000, 2: 600, 3: 400, 5: 200 },
        '9-16':  { 1: 1000, 2: 680, 3: 460, 5: 280, 9: 140 },
        '17-24': { 1: 1000, 2: 740, 3: 520, 5: 340, 9: 200, 17: 80 },
        '25-32': { 1: 1000, 2: 780, 3: 560, 5: 380, 9: 240, 17: 120, 25: 60 },
      }
    },
    // P1500 / P2000 / P3000 (championnat de France) : niveau élite absolue,
    // tournois sur invitation / qualifications strictes. Barème détaillé par
    // taille de tableau non publié publiquement par la FFT — non inclus ici
    // pour éviter d'afficher des points non officiels.
  };

  // Détermine le palier de tableau ('4-8', '9-16', '17-24', '25-32') à
  // partir du nombre de paires engagées. Par défaut (taille inconnue) on
  // utilise le palier de référence 17-24, le plus communément cité par la FFT.
  const getDrawSizeTier = (drawSize) => {
    const n = Number(drawSize) || 0;
    if (n <= 0) return '17-24';
    if (n <= 8) return '4-8';
    if (n <= 16) return '9-16';
    if (n <= 24) return '17-24';
    return '25-32';
  };

  const getFFTPoints = (categorie, place, drawSize) => {
    const cat = FFT_BAREME[categorie];
    if (!cat || !cat.tiers) return null;
    const tierKey = getDrawSizeTier(drawSize);
    const table = cat.tiers[tierKey] || cat.tiers['17-24'];
    if (!table) return null;
    const thresholds = Object.keys(table).map(Number).sort((a, b) => b - a);
    for (const threshold of thresholds) {
      if (place >= threshold) return table[threshold];
    }
    return null;
  };

  return { render, rankTeams, computeStats, getFFTPoints, getDrawSizeTier, FFT_BAREME };

})();
