'use strict';

/* ═══════════════════════════════════════════════════════════════
   SCORES MODULE — Saisie des scores + Check-in + Automatisation
   ═══════════════════════════════════════════════════════════════ */

const ScoresModule = (() => {

  let _container = null;
  let _filterPool = 'all';
  let _filterStatus = 'all';

  const render = (container) => {
    _container = container;
    _renderPage();
  };

  const getTeamName = (t, id) => {
    const tm = (t.teams || []).find(x => x.id === id);
    return tm?.name || '?';
  };

  const getTeamPlayers = (t, id) => {
    const tm = (t.teams || []).find(x => x.id === id);
    if (!tm) return '';
    return (tm.playerIds || []).map(pid => {
      const p = App.getPlayers(t).find(pl => pl.id === pid);
      return p ? Utils.escHtml(p.firstName + ' ' + p.lastName) : null;
    }).filter(Boolean).join(' / ');
  };

  // Check-in : tous les joueurs d'une équipe ont present === true
  const isTeamCheckedIn = (t, teamId) => {
    if (typeof CourtsModule !== 'undefined') return CourtsModule.isTeamCheckedIn(t, teamId);
    const team = (t.teams || []).find(x => x.id === teamId);
    if (!team || !team.playerIds?.length) return false;
    return team.playerIds.every(pid => {
      const p = App.getPlayers(t).find(pl => pl.id === pid);
      return p && p.present === true;
    });
  };

  // ── Détection automatique de fin de phase ────────────────────────
  const _checkPhaseCompletion = (t) => {
    const matches = t.matches || [];
    const poolMatches = matches.filter(m => m.type === 'pool');
    const bracketMatches = matches.filter(m => m.type === 'bracket');
    const classementMatches = matches.filter(m => m.type === 'classement');

    // Fin de poules → bracket pas encore généré
    if (poolMatches.length > 0 && poolMatches.every(m => m.status === 'finished') && bracketMatches.length === 0 && classementMatches.length === 0) {
      return 'pools_done';
    }
    // Fin de bracket principal
    if (bracketMatches.length > 0 && bracketMatches.every(m => m.status === 'finished')) {
      return 'bracket_done';
    }
    return null;
  };

  const _renderPage = () => {
    const t = App.getTournament();
    const matches = t.matches || [];
    const pools = t.pools || [];

    let filtered = matches;
    if (_filterPool !== 'all') {
      if (_filterPool === 'bracket') {
        filtered = filtered.filter(m => m.type === 'bracket' || m.type === 'classement');
      } else {
        filtered = filtered.filter(m => m.poolId === _filterPool);
      }
    }
    if (_filterStatus !== 'all') filtered = filtered.filter(m => (_filterStatus === 'pending' ? m.status !== 'finished' : m.status === 'finished'));
    filtered = Utils.sortBy(filtered, m => m.scheduledTime || '99:99', 'asc');

    const pending = matches.filter(m => m.status !== 'finished').length;
    const done = matches.filter(m => m.status === 'finished').length;
    const running = matches.filter(m => m.status === 'running').length;

    const phase = _checkPhaseCompletion(t);

    // Scores proposés par les joueurs en attente de validation
    const pendingProposals = matches.filter(m => m.proposedScore && !m.proposedScore.validated);

    _container.innerHTML = `
      <div class="animate-fade-in">
        <div class="page-header">
          <div class="page-header-left">
            <h2 class="page-title">🏆 Scores</h2>
            <p class="page-subtitle">${done}/${matches.length} matchs terminés${running > 0 ? ` · <span style="color:var(--color-warning);font-weight:700">${running} en cours</span>` : ''}</p>
          </div>
          <div class="page-header-actions">
            <button class="btn btn-secondary" onclick="App.navigate('schedule')">📅 Planning</button>
            <button class="btn btn-secondary" onclick="App.navigate('courts')">🏟️ Terrains</button>
          </div>
        </div>

        <!-- Progression -->
        <div class="card mb-4">
          <div class="card-body" style="display:flex;align-items:center;gap:var(--space-4);flex-wrap:wrap">
            <div style="flex:1;min-width:200px">
              <div class="progress-bar" style="height:10px;margin-bottom:6px">
                <div class="progress-fill ${done === matches.length && done > 0 ? 'success' : ''}"
                     style="width:${matches.length ? Math.round(done/matches.length*100) : 0}%"></div>
              </div>
              <div class="text-xs text-muted">${done} terminé${done>1?'s':''} sur ${matches.length}</div>
            </div>
            <div style="display:flex;gap:var(--space-4)">
              <div class="text-center"><div style="font-size:1.5rem;font-weight:800;color:var(--color-success)">${done}</div><div class="text-xs text-muted">Terminés</div></div>
              ${running > 0 ? `<div class="text-center"><div style="font-size:1.5rem;font-weight:800;color:var(--color-warning)">${running}</div><div class="text-xs text-muted">En cours</div></div>` : ''}
              <div class="text-center"><div style="font-size:1.5rem;font-weight:800;color:var(--color-text-muted)">${pending - running}</div><div class="text-xs text-muted">À jouer</div></div>
            </div>
          </div>
        </div>

        <!-- Bannière validation scores joueurs -->
        ${pendingProposals.length > 0 ? `
          <div class="card mb-4" style="border-color:var(--color-primary);background:var(--color-primary-alpha)">
            <div class="card-body" style="padding:var(--space-3) var(--space-4)">
              <div style="font-weight:700;font-size:var(--font-size-sm);color:var(--color-primary);margin-bottom:var(--space-2)">
                📥 ${pendingProposals.length} score${pendingProposals.length > 1 ? 's proposés' : ' proposé'} à valider
              </div>
              ${pendingProposals.map(m => _renderProposalRow(t, m)).join('')}
            </div>
          </div>` : ''}

        <!-- Bannière phase suivante -->
        ${phase === 'pools_done' ? `
          <div class="card mb-4" style="background:linear-gradient(135deg,var(--color-primary),#7c3aed);color:white">
            <div class="card-body" style="display:flex;align-items:center;gap:var(--space-4);padding:var(--space-4) var(--space-5)">
              <div style="font-size:2rem">🏆</div>
              <div style="flex:1">
                <div style="font-weight:700;font-size:var(--font-size-base)">Phase de poules terminée !</div>
                <div style="opacity:0.85;font-size:var(--font-size-sm)">Générez maintenant le tableau final et les classements.</div>
              </div>
              <button class="btn" style="background:white;color:var(--color-primary);font-weight:700" onclick="App.navigate('bracket')">🏆 Générer tableau →</button>
            </div>
          </div>` :
        phase === 'bracket_done' ? `
          <div class="card mb-4" style="border-color:var(--color-success)">
            <div class="card-body" style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3) var(--space-4)">
              <span style="font-size:1.5rem">🏅</span>
              <span style="flex:1;font-size:var(--font-size-sm)">Tournoi terminé ! Consultez le classement final.</span>
              <button class="btn btn-sm btn-primary" onclick="App.navigate('rankings')">Classement final →</button>
            </div>
          </div>` :
        matches.some(m => m.type === 'bracket') && !matches.filter(m => m.type === 'bracket').every(m => m.status === 'finished') ? `
          <div class="card mb-4" style="border-color:var(--color-primary)">
            <div class="card-body" style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3) var(--space-4)">
              <span>🏆</span>
              <span style="font-size:var(--font-size-sm)">Phase éliminatoire en cours</span>
              <button class="btn btn-sm btn-primary" style="margin-left:auto" onclick="App.navigate('bracket')">Voir le tableau →</button>
            </div>
          </div>` : ''}

        <!-- Filtres -->
        <div style="display:flex;gap:var(--space-3);margin-bottom:var(--space-4);flex-wrap:wrap">
          <select id="filter-pool-select" class="form-control" style="width:auto;min-width:150px">
            <option value="all">Toutes les phases</option>
            ${pools.map(p => `<option value="${p.id}" ${_filterPool===p.id?'selected':''}>${Utils.escHtml(p.name)}</option>`).join('')}
            ${matches.some(m => m.type === 'bracket' || m.type === 'classement') ? `<option value="bracket" ${_filterPool==='bracket'?'selected':''}>Phase finale</option>` : ''}
          </select>
          <select id="filter-status-select" class="form-control" style="width:auto;min-width:150px">
            <option value="all" ${_filterStatus==='all'?'selected':''}>Tous</option>
            <option value="pending" ${_filterStatus==='pending'?'selected':''}>En attente</option>
            <option value="finished" ${_filterStatus==='finished'?'selected':''}>Terminés</option>
          </select>
          <span class="text-sm text-muted" style="align-self:center">${filtered.length} match${filtered.length>1?'s':''}</span>
        </div>

        <!-- Liste des matchs -->
        ${filtered.length === 0 ? `
          <div class="card"><div class="card-body"><div class="empty-state">
            <div class="empty-state-icon">🏆</div>
            <h3>Aucun match</h3>
            <p>Générez le planning pour voir les matchs ici.</p>
          </div></div></div>` :
          `<div style="display:flex;flex-direction:column;gap:var(--space-3)">
            ${filtered.map(m => renderMatchCard(t, m)).join('')}
          </div>`
        }
      </div>`;

    Utils.el('#filter-pool-select', _container)?.addEventListener('change', e => { _filterPool = e.target.value; _renderPage(); });
    Utils.el('#filter-status-select', _container)?.addEventListener('change', e => { _filterStatus = e.target.value; _renderPage(); });

    _container.querySelectorAll('.btn-enter-score').forEach(btn => {
      btn.addEventListener('click', () => {
        const t2 = App.getTournament();
        const m = t2.matches.find(x => x.id === btn.dataset.id);
        if (m) openScoreForm(m, t2);
      });
    });

    _container.querySelectorAll('.btn-delete-score').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await App.confirm('Supprimer le score', 'Le score sera effacé et le match repassera en "À jouer".', { icon: '🗑️', okLabel: 'Supprimer', okClass: 'btn-danger' });
        if (!ok) return;
        const t2 = App.getTournament();
        const m = t2.matches.find(x => x.id === btn.dataset.id);
        if (m) { m.score = null; m.winnerId = null; m.status = 'scheduled'; delete m.startedAt; }
        App.saveTournament(t2);
        App.toast('Score supprimé', 'success');
        _renderPage();
      });
    });

    _container.querySelectorAll('.btn-toggle-status').forEach(btn => {
      btn.addEventListener('click', () => {
        const t2 = App.getTournament();
        const m = t2.matches.find(x => x.id === btn.dataset.id);
        if (!m) return;

        if (m.status !== 'running') {
          // Bloquer si check-in incomplet
          if (!isTeamCheckedIn(t2, m.team1Id) || !isTeamCheckedIn(t2, m.team2Id)) {
            App.toast('⚠️ Certains joueurs ne sont pas encore check-in — marquez-les présents dans l\'onglet Joueurs', 'warning', 5000);
            return;
          }
          m.status = 'running';
          m.startedAt = Date.now();
        } else {
          m.status = 'scheduled';
          delete m.startedAt;
        }
        App.saveTournament(t2);
        _renderPage();
      });
    });

    // Valider score proposé par joueur
    _container.querySelectorAll('.btn-approve-proposal').forEach(btn => {
      btn.addEventListener('click', () => _approveProposal(btn.dataset.id));
    });
    _container.querySelectorAll('.btn-reject-proposal').forEach(btn => {
      btn.addEventListener('click', () => _rejectProposal(btn.dataset.id));
    });

    // WO (Walkover)
    _container.querySelectorAll('.btn-wo').forEach(btn => {
      btn.addEventListener('click', () => {
        const t2 = App.getTournament();
        const m = t2.matches.find(x => x.id === btn.dataset.id);
        if (!m) return;
        const t1 = getTeamName(t2, m.team1Id);
        const t2name = getTeamName(t2, m.team2Id);
        App.modal.open('🚫 Walkover', `
          <div>
            <p style="margin-bottom:var(--space-4);color:var(--color-text-muted)">Quelle équipe déclare forfait ?</p>
            <div style="display:flex;flex-direction:column;gap:var(--space-3)">
              <button class="btn btn-danger btn-wo-team" data-loser="${m.team1Id}" data-winner="${m.team2Id}">${Utils.escHtml(t1)} (absent)</button>
              <button class="btn btn-danger btn-wo-team" data-loser="${m.team2Id}" data-winner="${m.team1Id}">${Utils.escHtml(t2name)} (absent)</button>
            </div>
          </div>`, { buttons: [{ label: 'Annuler', class: 'btn-ghost', onClick: () => App.modal.close() }] });

        document.querySelectorAll('.btn-wo-team').forEach(b => {
          b.addEventListener('click', () => {
            const t3 = App.getTournament();
            const mx = t3.matches.find(x => x.id === m.id);
            if (!mx) return;
            mx.walkover = true;
            mx.winnerId = b.dataset.winner;
            mx.status = 'finished';
            mx.score = null;
            delete mx.startedAt;
            delete mx.proposedScore;
            App.saveTournament(t3);
            Audit.log(Audit.ACTIONS.SCORE, 'match', `WO — ${getTeamName(t3, b.dataset.loser)} forfait`);
            App.toast('WO enregistré', 'warning');
            _afterScoreSaved(t3, mx);
            App.modal.close();
            _renderPage();
          });
        });
      });
    });
  };

  // ── Score proposé par un joueur ──────────────────────────────────
  const _renderProposalRow = (t, m) => {
    const p = m.proposedScore;
    const t1 = getTeamName(t, m.team1Id);
    const t2 = getTeamName(t, m.team2Id);
    const scoreStr = p.sets ? p.sets.map(s => `${s.team1}-${s.team2}`).join(' ') : '?';
    const winner = p.winnerId ? getTeamName(t, p.winnerId) : '?';
    return `
      <div style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-2) 0;border-bottom:1px solid rgba(255,255,255,0.15)">
        <div style="flex:1;font-size:var(--font-size-sm)">
          <span style="font-weight:600">${Utils.escHtml(t1)} vs ${Utils.escHtml(t2)}</span>
          <span style="color:rgba(37,99,235,0.7);margin-left:8px">${scoreStr}</span>
          <span style="color:var(--color-success);margin-left:8px;font-size:var(--font-size-xs)">→ ${Utils.escHtml(winner)}</span>
        </div>
        <button class="btn btn-sm btn-success btn-approve-proposal" data-id="${m.id}">✓ Valider</button>
        <button class="btn btn-sm btn-ghost btn-reject-proposal" data-id="${m.id}">✕</button>
      </div>`;
  };

  const _approveProposal = (matchId) => {
    const t = App.getTournament();
    const m = t.matches.find(x => x.id === matchId);
    if (!m || !m.proposedScore) return;
    m.score = { sets: m.proposedScore.sets };
    if (m.proposedScore.superTiebreak) m.score.superTiebreak = m.proposedScore.superTiebreak;
    m.winnerId = m.proposedScore.winnerId;
    m.status = m.winnerId ? 'finished' : 'running';
    delete m.proposedScore;
    App.saveTournament(t);
    _afterScoreSaved(t, m);
    App.toast('✅ Score validé', 'success');
    _renderPage();
  };

  const _rejectProposal = (matchId) => {
    const t = App.getTournament();
    const m = t.matches.find(x => x.id === matchId);
    if (!m) return;
    delete m.proposedScore;
    App.saveTournament(t);
    App.toast('Score proposé refusé', 'info');
    _renderPage();
  };

  // ── Après chaque score enregistré : propagation + phase auto ─────
  const _afterScoreSaved = (t, match) => {
    // Propager le gagnant dans le bracket/classement
    if (match.winnerId) {
      if (match.type === 'bracket' && typeof BracketModule !== 'undefined') {
        BracketModule.propagateWinner(match.winnerId, match);
      } else if (match.type === 'classement' && typeof BracketModule !== 'undefined') {
        BracketModule.propagateClassementWinner(match.winnerId, match);
      }
    }

    // Détection automatique de fin de phase
    const poolMatches = (t.matches || []).filter(m => m.type === 'pool');
    const allPoolDone = poolMatches.length > 0 && poolMatches.every(m => m.status === 'finished');
    const hasBracket = (t.matches || []).some(m => m.type === 'bracket');

    if (allPoolDone && !hasBracket) {
      setTimeout(() => {
        App.toast('🏆 Toutes les poules sont terminées ! Générez le tableau final.', 'success', 8000);
      }, 400);
    }
  };

  const renderMatchCard = (t, m) => {
    const courts = t.settings?.courts || [];
    const pools = t.pools || [];
    const pool = pools.find(p => p.id === m.poolId);
    const court = courts.find(c => c.id === m.courtId);
    const t1 = getTeamName(t, m.team1Id);
    const t2 = getTeamName(t, m.team2Id);

    const isFinished = m.status === 'finished';
    const isRunning = m.status === 'running';
    const winner = m.winnerId;

    // Badge phase
    let phaseBadge = '';
    if (m.type === 'bracket') phaseBadge = '<span class="badge badge-neutral" style="font-size:10px">Tableau</span>';
    else if (m.type === 'classement') {
      const cl = (t.classements || []).find(c => c.id === m.classementId);
      phaseBadge = `<span class="badge badge-neutral" style="font-size:10px">${Utils.escHtml(cl?.label || 'Classement')}</span>`;
    } else if (pool) {
      phaseBadge = `<span class="badge badge-primary" style="font-size:10px">${Utils.escHtml(pool.name)}</span>`;
    }

    // Check-in des équipes (pour matchs non démarrés)
    const t1checkin = isTeamCheckedIn(t, m.team1Id);
    const t2checkin = isTeamCheckedIn(t, m.team2Id);
    const checkInOk = t1checkin && t2checkin;

    return `
      <div class="card ${isRunning ? 'animate-pulse' : ''}" style="border-color:${isRunning ? 'var(--color-warning)' : isFinished ? 'var(--color-success)' : 'var(--color-border)'}">
        <div class="card-body" style="padding:var(--space-4) var(--space-5)">
          <div style="display:flex;align-items:center;gap:var(--space-4);flex-wrap:wrap">
            <!-- Méta -->
            <div style="display:flex;flex-direction:column;gap:4px;min-width:80px">
              ${m.scheduledTime ? `<span style="font-size:var(--font-size-sm);font-weight:700;color:var(--color-primary)">${m.scheduledTime}</span>` : ''}
              ${court ? `<span class="badge badge-neutral" style="font-size:10px">${Utils.escHtml(court.name)}</span>` : ''}
              ${phaseBadge}
            </div>

            <!-- Équipes & Score -->
            <div style="flex:1;display:flex;align-items:center;gap:var(--space-4);flex-wrap:wrap">
              <div style="flex:1;text-align:right">
                <div style="font-size:var(--font-size-base);font-weight:${winner===m.team1Id?'800':'600'};color:${winner===m.team1Id?'var(--color-success)':winner&&winner!==m.team1Id?'var(--color-text-muted)':'var(--color-text)'}">
                  ${Utils.escHtml(t1)}${!isFinished && !isRunning && !t1checkin ? ' <span title="Non check-in" style="font-size:12px">⚠️</span>' : ''}
                </div>
                <div style="font-size:11px;color:var(--color-text-muted);margin-top:2px">${getTeamPlayers(t, m.team1Id)}</div>
              </div>

              ${isFinished && m.walkover ? `
                <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
                  <span style="font-size:var(--font-size-lg);font-weight:800;color:var(--color-danger)">WO</span>
                  <span style="font-size:10px;color:var(--color-text-muted)">Forfait</span>
                </div>` :
              isFinished && m.score ? `
                <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
                  ${m.score.sets.map(s => `
                    <div style="display:flex;align-items:center;gap:var(--space-2);font-size:var(--font-size-lg);font-weight:800">
                      <span style="color:${s.team1>s.team2?'var(--color-success)':'var(--color-text)'};min-width:20px;text-align:right">${s.team1}</span>
                      <span style="color:var(--color-text-faint);font-size:12px">—</span>
                      <span style="color:${s.team2>s.team1?'var(--color-success)':'var(--color-text)'};min-width:20px">${s.team2}</span>
                    </div>`).join('')}
                </div>` :
              `<div style="font-size:var(--font-size-sm);color:var(--color-text-faint);font-weight:700;padding:0 var(--space-3)">VS</div>`}

              <div style="flex:1">
                <div style="font-size:var(--font-size-base);font-weight:${winner===m.team2Id?'800':'600'};color:${winner===m.team2Id?'var(--color-success)':winner&&winner!==m.team2Id?'var(--color-text-muted)':'var(--color-text)'}">
                  ${Utils.escHtml(t2)}${!isFinished && !isRunning && !t2checkin ? ' <span title="Non check-in" style="font-size:12px">⚠️</span>' : ''}
                </div>
                <div style="font-size:11px;color:var(--color-text-muted);margin-top:2px">${getTeamPlayers(t, m.team2Id)}</div>
              </div>
            </div>

            <!-- Actions -->
            <div style="display:flex;flex-direction:column;gap:var(--space-2);align-items:flex-end">
              ${isFinished
                ? m.walkover
                  ? `<span class="badge badge-danger">WO</span>
                     <div style="font-size:10px;color:var(--color-text-muted)">Forfait — ${Utils.escHtml(winner === m.team1Id ? t1 : t2)} gagne</div>
                     <button class="btn btn-sm btn-secondary btn-enter-score" data-id="${m.id}">✏️ Modifier</button>
                     <button class="btn btn-sm btn-danger btn-delete-score" data-id="${m.id}">🗑️</button>`
                  : `<span class="badge ${winner ? 'badge-success' : 'badge-warning'} badge-dot">${winner ? 'Terminé' : 'Égalité'}</span>
                     <button class="btn btn-sm btn-secondary btn-enter-score" data-id="${m.id}">✏️ Modifier</button>
                     <button class="btn btn-sm btn-danger btn-delete-score" data-id="${m.id}" title="Supprimer le score">🗑️</button>`
                : isRunning
                ? `<span class="badge badge-warning badge-dot">En cours</span>
                   <button class="btn btn-sm btn-success btn-enter-score" data-id="${m.id}">✅ Saisir score</button>
                   <button class="btn btn-sm btn-ghost btn-toggle-status" data-id="${m.id}">⏸ Pause</button>`
                : checkInOk
                ? `<button class="btn btn-sm btn-primary btn-enter-score" data-id="${m.id}">🎾 Saisir score</button>
                   <button class="btn btn-sm btn-secondary btn-toggle-status" data-id="${m.id}">▶️ Démarrer</button>
                   <button class="btn btn-sm btn-ghost btn-wo" data-id="${m.id}" title="Walkover — une équipe est absente">WO</button>`
                : `<button class="btn btn-sm btn-primary btn-enter-score" data-id="${m.id}">🎾 Saisir score</button>
                   <button class="btn btn-sm btn-warning btn-toggle-status" data-id="${m.id}" title="Check-in incomplet — démarrer quand même ?">⚠️ Démarrer</button>
                   <button class="btn btn-sm btn-ghost btn-wo" data-id="${m.id}" title="Walkover — une équipe est absente">WO</button>`}
            </div>
          </div>
        </div>
      </div>`;
  };

  // ── Formulaire de score ────────────────────────────────────────
  const openScoreForm = (match, t) => {
    const fmt = (t.settings?.matchFormats || []).find(f => f.id === match.formatId)
             || (t.settings?.matchFormats || [])[0]
             || { sets: 1, gamesPerSet: 6 };
    const sets = match.score?.sets || Array.from({ length: fmt.sets }, () => ({ team1: 0, team2: 0 }));
    const t1 = getTeamName(t, match.team1Id);
    const t2 = getTeamName(t, match.team2Id);

    const superTB = match.score?.superTiebreak || { team1: 0, team2: 0 };
    const setsHtml = sets.map((s, i) => `
      <div style="display:flex;align-items:center;gap:var(--space-4);padding:var(--space-3) 0;border-bottom:1px solid var(--color-border-light)">
        <div style="width:80px;text-align:right;font-size:var(--font-size-xs);color:var(--color-text-muted)">Set ${i+1}</div>
        <div style="flex:1;text-align:right">
          <input type="number" class="score-number-input" id="s${i}-t1" min="0" max="${fmt.gamesPerSet+2}" value="${s.team1}">
        </div>
        <div class="score-vs">—</div>
        <div style="flex:1">
          <input type="number" class="score-number-input" id="s${i}-t2" min="0" max="${fmt.gamesPerSet+2}" value="${s.team2}">
        </div>
      </div>`).join('');

    const superTBHtml = `
      <div id="super-tb-row" style="display:none;align-items:center;gap:var(--space-4);padding:var(--space-3) 0;background:var(--color-warning-bg);border-radius:var(--radius-md);margin-top:var(--space-2);padding:var(--space-3)">
        <div style="width:80px;text-align:right;font-size:var(--font-size-xs);font-weight:700;color:var(--color-warning)">Super TB</div>
        <div style="flex:1;text-align:right">
          <input type="number" class="score-number-input" id="stb-t1" min="0" max="20" value="${superTB.team1}" style="border-color:var(--color-warning)">
        </div>
        <div class="score-vs">—</div>
        <div style="flex:1">
          <input type="number" class="score-number-input" id="stb-t2" min="0" max="20" value="${superTB.team2}" style="border-color:var(--color-warning)">
        </div>
      </div>`;

    App.modal.open('🎾 Saisir le score', `
      <div>
        <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:var(--space-3);align-items:center;margin-bottom:var(--space-4);padding:var(--space-3);background:var(--color-bg);border-radius:var(--radius-md)">
          <div style="font-weight:700;font-size:var(--font-size-sm);text-align:right">${Utils.escHtml(t1)}</div>
          <div style="font-size:var(--font-size-xs);color:var(--color-text-faint)">VS</div>
          <div style="font-weight:700;font-size:var(--font-size-sm)">${Utils.escHtml(t2)}</div>
        </div>
        <div id="sets-container">${setsHtml}</div>
        ${superTBHtml}
        <div style="margin-top:var(--space-4);padding:var(--space-3);background:var(--color-bg);border-radius:var(--radius-md)">
          <div style="font-size:var(--font-size-xs);color:var(--color-text-muted);margin-bottom:var(--space-2)">Gagnant</div>
          <div style="display:flex;gap:var(--space-3)">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;flex:1;padding:8px;border:2px solid var(--color-border);border-radius:var(--radius-md)">
              <input type="radio" name="winner" value="${match.team1Id}" ${match.winnerId===match.team1Id?'checked':''}> ${Utils.escHtml(t1)}
            </label>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;flex:1;padding:8px;border:2px solid var(--color-border);border-radius:var(--radius-md)">
              <input type="radio" name="winner" value="${match.team2Id}" ${match.winnerId===match.team2Id?'checked':''}> ${Utils.escHtml(t2)}
            </label>
          </div>
        </div>
      </div>`,
      {
        buttons: [
          { label: 'Annuler', class: 'btn-ghost', onClick: () => App.modal.close() },
          { label: '✅ Enregistrer', class: 'btn-primary', id: 'btn-save-score' }
        ]
      }
    );

    // Auto-détection du gagnant + super tie-break
    const autoDetect = () => {
      let t1Wins = 0, t2Wins = 0;
      for (let i = 0; i < fmt.sets; i++) {
        const v1 = parseInt(document.getElementById(`s${i}-t1`)?.value) || 0;
        const v2 = parseInt(document.getElementById(`s${i}-t2`)?.value) || 0;
        if (v1 > v2) t1Wins++;
        else if (v2 > v1) t2Wins++;
      }

      // Super tie-break : si égalité de sets dans un format 2-sets
      const stbRow = document.getElementById('super-tb-row');
      if (fmt.sets === 2 && t1Wins === 1 && t2Wins === 1 && stbRow) {
        stbRow.style.display = 'flex';
      } else if (stbRow) {
        stbRow.style.display = 'none';
      }

      // Auto-sélection du gagnant
      if (t1Wins > t2Wins) {
        const r = document.querySelector(`input[name="winner"][value="${match.team1Id}"]`);
        if (r) r.checked = true;
      } else if (t2Wins > t1Wins) {
        const r = document.querySelector(`input[name="winner"][value="${match.team2Id}"]`);
        if (r) r.checked = true;
      }
    };

    // Écouter les changements de score
    for (let i = 0; i < fmt.sets; i++) {
      document.getElementById(`s${i}-t1`)?.addEventListener('input', autoDetect);
      document.getElementById(`s${i}-t2`)?.addEventListener('input', autoDetect);
    }
    document.getElementById('stb-t1')?.addEventListener('input', autoDetect);
    document.getElementById('stb-t2')?.addEventListener('input', autoDetect);

    // Enregistrement
    document.getElementById('btn-save-score')?.addEventListener('click', () => {
        const t = App.getTournament();
        const sets = [];
        for (let i = 0; i < fmt.sets; i++) {
          sets.push({
            team1: parseInt(document.getElementById(`s${i}-t1`)?.value) || 0,
            team2: parseInt(document.getElementById(`s${i}-t2`)?.value) || 0,
          });
        }
        const stbT1 = parseInt(document.getElementById('stb-t1')?.value) || 0;
        const stbT2 = parseInt(document.getElementById('stb-t2')?.value) || 0;
        const winnerId = document.querySelector('input[name="winner"]:checked')?.value || null;

        const idx = t.matches.findIndex(m => m.id === match.id);
        if (idx !== -1) {
          t.matches[idx] = {
            ...t.matches[idx],
            score: { sets, superTiebreak: { team1: stbT1, team2: stbT2 } },
            winnerId,
            status: 'finished',
            walkover: false,
          };
        }
        App.saveTournament(t);

        // Propager le vainqueur vers le tour suivant du tableau/classement —
        // sans cet appel, un score de 1/8 (ou tout autre tour du tableau final)
        // saisi depuis la page Scores ne fait jamais avancer le tableau : le
        // tour suivant reste "À déterminer" indéfiniment.
        if (idx !== -1) _afterScoreSaved(t, t.matches[idx]);

        App.modal.close();
        _renderPage();

        // Check phase completion
        const phase = _checkPhaseCompletion(t);
        if (phase === 'pools_done') {
          App.toast('Tous les matchs de poule sont terminés ! Générez le tableau final.', 'success', 'Phase terminée');
        } else if (phase === 'bracket_done') {
          App.toast('Le tableau final est terminé ! Consultez le classement.', 'success', 'Tournoi terminé');
        }
    });
  };

  // ── WO (Walkover) handler ──────────────────────────────────────
  const openWoForm = (match, t) => {
    const t1 = getTeamName(t, match.team1Id);
    const t2 = getTeamName(t, match.team2Id);

    App.modal.open('⚠️ Walkover (forfait)', `
      <div>
        <p style="color:var(--color-text-muted);margin-bottom:var(--space-4)">Quelle équipe déclare forfait ?</p>
        <div style="display:flex;flex-direction:column;gap:var(--space-3)">
          <button class="btn btn-danger btn-wo-team" data-absent="${match.team1Id}" data-present="${match.team2Id}">
            🚫 ${Utils.escHtml(t1)} est absente
          </button>
          <button class="btn btn-danger btn-wo-team" data-absent="${match.team2Id}" data-present="${match.team1Id}">
            🚫 ${Utils.escHtml(t2)} est absente
          </button>
        </div>
      </div>`,
      { buttons: [{ label: 'Annuler', class: 'btn-ghost', onClick: () => App.modal.close() }] }
    );

    document.querySelectorAll('.btn-wo-team').forEach(btn => {
        btn.addEventListener('click', () => {
          const t2 = App.getTournament();
          const idx = t2.matches.findIndex(m => m.id === match.id);
          if (idx !== -1) {
            t2.matches[idx] = {
              ...t2.matches[idx],
              walkover: true,
              winnerId: btn.dataset.present,
              status: 'finished',
              score: null,
            };
          }
          App.saveTournament(t2);
          App.modal.close();
          _renderPage();
        });
    });
  };

  // ── Event binding ──────────────────────────────────────────────
  const _bindEvents = (t) => {
    // Filtres
    _container.querySelectorAll('.score-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.filterType;
        const val = btn.dataset.filter;
        if (type === 'pool') _filterPool = val;
        else _filterStatus = val;
        _renderPage();
      });
    });

    // Saisir/modifier score
    _container.querySelectorAll('.btn-enter-score').forEach(btn => {
      btn.addEventListener('click', () => {
        const match = (t.matches || []).find(m => m.id === btn.dataset.id);
        if (match) openScoreForm(match, t);
      });
    });

    // Supprimer score
    _container.querySelectorAll('.btn-delete-score').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await App.confirm('Supprimer le score', 'Le match repassera en attente.', { okLabel: 'Supprimer', icon: '🗑️' });
        if (!ok) return;
        const t2 = App.getTournament();
        const idx = t2.matches.findIndex(m => m.id === btn.dataset.id);
        if (idx !== -1) {
          t2.matches[idx] = { ...t2.matches[idx], score: null, winnerId: null, status: 'pending', walkover: false };
        }
        App.saveTournament(t2);
        _renderPage();
      });
    });

    // Toggle status (démarrer / pause)
    _container.querySelectorAll('.btn-toggle-status').forEach(btn => {
      btn.addEventListener('click', () => {
        const t2 = App.getTournament();
        const idx = t2.matches.findIndex(m => m.id === btn.dataset.id);
        if (idx !== -1) {
          const cur = t2.matches[idx].status;
          t2.matches[idx] = { ...t2.matches[idx], status: cur === 'running' ? 'pending' : 'running' };
        }
        App.saveTournament(t2);
        _renderPage();
      });
    });

    // WO
    _container.querySelectorAll('.btn-wo').forEach(btn => {
      btn.addEventListener('click', () => {
        const match = (t.matches || []).find(m => m.id === btn.dataset.id);
        if (match) openWoForm(match, t);
      });
    });
  };

  return { render };

})();
