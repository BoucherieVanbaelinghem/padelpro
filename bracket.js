'use strict';

/* ═══════════════════════════════════════════════════════════════
   BRACKET MODULE — Tableau principal + Tableaux de classement
   Format P25/P100 padel français : poules → classements par rang
   ═══════════════════════════════════════════════════════════════ */

const BracketModule = (() => {

  let _container = null;
  let _tab = 'main';

  const render = (container) => {
    _container = container;
    _renderPage();
  };

  const getTeamName = (t, id) => {
    if (!id) return 'À déterminer';
    const tm = (t.teams || []).find(x => x.id === id);
    return tm?.name || '?';
  };

  const nextPow2 = (n) => Math.pow(2, Math.ceil(Math.log2(Math.max(n, 2))));

  // ── Render principal ───────────────────────────────────────────
  const _renderPage = () => {
    const t = App.getTournament();
    const bracket = t.bracket;
    const classements = t.classements || [];
    const hasAny = bracket || classements.length > 0;

    const tabs = [
      { id: 'main', label: '🏆 Tableau principal' },
      ...classements.map(c => ({ id: c.id, label: `📊 ${Utils.escHtml(c.label)}` }))
    ];

    _container.innerHTML = `
      <div class="animate-fade-in">
        <div class="page-header">
          <div class="page-header-left">
            <h2 class="page-title">🏆 Tableaux</h2>
            <p class="page-subtitle">Phase éliminatoire + classements</p>
          </div>
          <div class="page-header-actions">
            ${hasAny ? '<button class="btn btn-secondary" id="btn-refresh-bracket" title="Recharger l\'affichage si les scores saisis n\'apparaissent pas">↻ Actualiser</button>' : ''}
            ${hasAny ? '<button class="btn btn-secondary" id="btn-reset-bracket">🔄 Réinitialiser</button>' : ''}
            <button class="btn btn-primary" id="btn-gen-bracket">⚡ Générer les tableaux</button>
          </div>
        </div>

        ${hasAny ? `
          <div class="tabs" style="margin-bottom:var(--space-4)">
            ${tabs.map(tab => `<button class="tab-btn ${_tab===tab.id?'active':''}" data-tab="${tab.id}">${tab.label}</button>`).join('')}
          </div>
          <div id="bracket-content">${renderCurrentTab(t)}</div>` :
          renderEmpty()}
      </div>`;

    _container.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => { _tab = btn.dataset.tab; _renderPage(); });
    });
    Utils.el('#btn-gen-bracket', _container)?.addEventListener('click', openGenModal);
    Utils.el('#btn-refresh-bracket', _container)?.addEventListener('click', () => {
      App.refreshActiveTournament();
      App.toast('Tableau actualisé', 'info');
      _renderPage();
    });
    Utils.el('#btn-reset-bracket', _container)?.addEventListener('click', async () => {
      const ok = await App.confirm('Réinitialiser les tableaux', 'Tous les tableaux et scores de la phase éliminatoire seront supprimés.', { icon: '🔄' });
      if (!ok) return;
      const t = App.getTournament();
      t.bracket = null;
      t.classements = [];
      t.matches = (t.matches || []).filter(m => m.type !== 'bracket' && m.type !== 'classement');
      App.saveTournament(t);
      _tab = 'main';
      _renderPage();
    });
    _container.querySelectorAll('.bracket-team[data-match]').forEach(el => {
      el.addEventListener('click', () => {
        const t = App.getTournament();
        const m = (t.matches || []).find(x => x.id === el.dataset.match);
        if (m && m.team1Id && m.team2Id && m.status !== 'finished') openScoreForm(m, t);
      });
    });
  };

  const renderCurrentTab = (t) => {
    if (_tab === 'main') return renderMainBracket(t);
    const cls = (t.classements || []).find(c => c.id === _tab);
    return cls ? renderClassementBracket(t, cls) : '';
  };

  const renderEmpty = () => `
    <div class="card"><div class="card-body"><div class="empty-state">
      <div class="empty-state-icon">🏆</div>
      <h3>Tableaux non générés</h3>
      <p>Terminez les matchs de poule et cliquez sur "Générer les tableaux".<br>
      L'application créera automatiquement le tableau principal et les tableaux de classement.</p>
    </div></div></div>`;

  // ── Affichage tableau principal ────────────────────────────────
  const renderMainBracket = (t) => {
    const bracket = t.bracket;
    if (!bracket) return '<div class="alert alert-info">Générez les tableaux pour démarrer la phase éliminatoire.</div>';

    const rounds = bracket.rounds || [];
    const roundNames = ['Finale', 'Demi-finales', 'Quarts de finale', '8es de finale', '16es de finale', '32es de finale', '64es de finale'];
    const qualCount = t.settings?.game?.qualificationCount || 1;
    const qualLabel = qualCount === 1 ? '1ère place de chaque poule' : `1ère à ${qualCount}ème place de chaque poule`;

    const mainHtml = `
      <div class="card">
        <div class="card-header">
          <span class="card-title">🏆 Tableau principal — ${bracket.size} équipes</span>
          <span style="font-size:11px;color:var(--color-text-muted)">Qualifiés : ${qualLabel}</span>
        </div>
        <div class="card-body" style="overflow-x:auto">
          <div class="bracket-container">
            <div class="bracket">
              ${rounds.map((round, ri) => {
                // Ordre naturel (gauche → droite) : 1er tour (quarts/huitièmes...) → ... → Finale.
                // roundIdx = distance au tour final (0 = Finale, 1 = Demi-finales, 2 = Quarts, ...)
                const roundIdx = rounds.length - 1 - ri;
                const roundName = roundNames[roundIdx] || `Tour ${roundIdx + 1}`;
                const spacing = Math.pow(2, ri);
                return `
                  <div class="bracket-round">
                    <div class="bracket-round-title">${roundName}</div>
                    <div style="display:flex;flex-direction:column;gap:${spacing * 16}px">
                      ${(round.matchIds || []).map(matchId => {
                        const m = (t.matches || []).find(x => x.id === matchId);
                        if (!m) return '';
                        return renderBracketMatchCard(t, m, spacing);
                      }).join('')}
                    </div>
                  </div>`;
              }).join('')}
            </div>
          </div>
        </div>
      </div>`;

    // Petite finale
    const petite = (t.matches || []).find(m => m.isPetiteFinale);
    const petiteHtml = petite ? `
      <div class="card" style="margin-top:var(--space-4)">
        <div class="card-header"><span class="card-title">🥉 Petite finale — 3ème place</span></div>
        <div class="card-body" style="overflow-x:auto">
          <div style="max-width:300px">${renderBracketMatchCard(t, petite, 1)}</div>
        </div>
      </div>` : '';

    const winner = renderBracketWinner(t, bracket);
    return mainHtml + petiteHtml + winner;
  };

  // ── Affichage tableau de classement ───────────────────────────
  const renderClassementBracket = (t, cls) => {
    const rounds = cls.rounds || [];
    const roundNames = ['Finale', 'Demi-finales', 'Quarts de finale', '8es de finale', '16es de finale', '32es de finale'];
    const clsMatches = (t.matches || []).filter(m => m.type === 'classement' && m.classementId === cls.id);
    const finished = clsMatches.filter(m => m.status === 'finished').length;

    let winnerHtml = '';
    if (finished === clsMatches.length && clsMatches.length > 0) {
      const finalRound = rounds[rounds.length - 1];
      const finalMatch = (t.matches || []).find(m => m.id === finalRound?.matchIds?.[0]);
      if (finalMatch?.winnerId) {
        winnerHtml = `
          <div class="card mt-4" style="background:linear-gradient(135deg,var(--color-primary),var(--color-secondary));border-color:transparent;text-align:center">
            <div class="card-body" style="padding:var(--space-6)">
              <div style="font-size:2.5rem;margin-bottom:var(--space-2)">🥇</div>
              <div style="font-size:var(--font-size-sm);color:rgba(255,255,255,0.8);margin-bottom:var(--space-1)">${Utils.escHtml(cls.label)} — ${cls.placeFrom}ème place</div>
              <div style="font-size:var(--font-size-2xl);font-weight:900;color:white">${Utils.escHtml(getTeamName(t, finalMatch.winnerId))}</div>
            </div>
          </div>`;
      }
    }

    return `
      <div class="card">
        <div class="card-header">
          <span class="card-title">${Utils.escHtml(cls.label)}</span>
          <span style="font-size:11px;color:var(--color-text-muted)">${finished}/${clsMatches.length} matchs terminés</span>
        </div>
        <div class="card-body" style="overflow-x:auto">
          <div class="bracket-container">
            <div class="bracket">
              ${rounds.map((round, ri) => {
                // Ordre naturel (gauche → droite) : 1er tour (quarts/huitièmes...) → ... → Finale.
                // roundIdx = distance au tour final (0 = Finale, 1 = Demi-finales, 2 = Quarts, ...)
                const roundIdx = rounds.length - 1 - ri;
                const roundName = roundNames[roundIdx] || `Tour ${roundIdx + 1}`;
                const spacing = Math.pow(2, ri);
                return `
                  <div class="bracket-round">
                    <div class="bracket-round-title">${roundName}</div>
                    <div style="display:flex;flex-direction:column;gap:${spacing * 16}px">
                      ${(round.matchIds || []).map(matchId => {
                        const m = (t.matches || []).find(x => x.id === matchId);
                        if (!m) return '';
                        return renderBracketMatchCard(t, m, spacing);
                      }).join('')}
                    </div>
                  </div>`;
              }).join('')}
            </div>
          </div>
        </div>
      </div>${winnerHtml}`;
  };

  const renderBracketMatchCard = (t, m, spacing) => {
    const t1 = getTeamName(t, m.team1Id);
    const t2 = getTeamName(t, m.team2Id);
    const isClickable = m.team1Id && m.team2Id && m.status !== 'finished';
    const scoreStr = m.score?.sets ? m.score.sets.map(s => `${s.team1}-${s.team2}`).join(' ') : '';
    return `
      <div class="bracket-match-wrapper" style="margin:${spacing * 8}px 0">
        <div class="bracket-match ${!m.team1Id&&!m.team2Id?'opacity-50':''}">
          <div class="bracket-team ${m.winnerId===m.team1Id?'winner':m.winnerId&&m.winnerId!==m.team1Id?'loser':''}"
               data-match="${m.id}" style="cursor:${isClickable?'pointer':'default'}" title="${isClickable?'Cliquer pour saisir le score':''}">
            <span class="bracket-team-name">${Utils.escHtml(t1)}</span>
            <span class="bracket-team-score">${m.score?.sets?.[0]?.team1??''}</span>
          </div>
          <div class="bracket-team ${m.winnerId===m.team2Id?'winner':m.winnerId&&m.winnerId!==m.team2Id?'loser':''}"
               data-match="${m.id}" style="cursor:${isClickable?'pointer':'default'}" title="${isClickable?'Cliquer pour saisir le score':''}">
            <span class="bracket-team-name">${Utils.escHtml(t2)}</span>
            <span class="bracket-team-score">${m.score?.sets?.[0]?.team2??''}</span>
          </div>
          ${scoreStr?`<div style="font-size:10px;color:var(--color-text-muted);text-align:center;padding:2px 4px;background:var(--color-bg)">${scoreStr}</div>`:''}
          ${m.scheduledTime?`<div style="font-size:9px;color:var(--color-text-faint);text-align:center;padding:2px">⏰ ${m.scheduledTime}</div>`:''}
        </div>
      </div>`;
  };

  const renderBracketWinner = (t, bracket) => {
    const rounds = bracket.rounds || [];
    const finalRound = rounds[rounds.length - 1];
    const finalMatch = (t.matches || []).find(m => m.id === finalRound?.matchIds?.[0]);
    if (!finalMatch?.winnerId) return '';
    return `
      <div class="card mt-4" style="background:linear-gradient(135deg,#fbbf24,#f59e0b);border-color:transparent;text-align:center">
        <div class="card-body" style="padding:var(--space-8)">
          <div style="font-size:4rem;margin-bottom:var(--space-3)">🏆</div>
          <div style="font-size:var(--font-size-lg);color:white;font-weight:700;margin-bottom:var(--space-2)">Vainqueur du tournoi</div>
          <div style="font-size:var(--font-size-3xl);font-weight:900;color:white">${Utils.escHtml(getTeamName(t, finalMatch.winnerId))}</div>
        </div>
      </div>`;
  };

  // ── Modal de génération ────────────────────────────────────────
  const openGenModal = () => {
    const t = App.getTournament();
    const pools = t.pools || [];
    const g = t.settings?.game || {};
    const maxPerPool = pools.length > 0 ? Math.max(...pools.map(p => (p.teamIds||[]).length)) : 4;
    const poolCount = pools.length;

    App.modal.open('⚡ Générer les tableaux', `
      <div class="form-section">
        <div class="alert alert-info" style="margin-bottom:var(--space-4)">
          ℹ️ <strong>${poolCount} poule${poolCount>1?'s':''}</strong> de <strong>${maxPerPool} équipes</strong> chacune — Format padel compétitif
        </div>

        <div class="form-group">
          <label class="form-label">Format du tournoi</label>
          <div style="display:flex;flex-direction:column;gap:var(--space-2)">
            <label style="display:flex;align-items:flex-start;gap:10px;padding:10px;border:2px solid var(--color-border);border-radius:var(--radius-md);cursor:pointer" id="fmt-p25">
              <input type="radio" name="br-format" value="1" style="margin-top:2px" ${(g.qualificationCount||1)===1?'checked':''}>
              <div>
                <div style="font-weight:700">🎯 Format P25 — 1 qualifié par poule</div>
                <div style="font-size:11px;color:var(--color-text-muted)">Tableau principal : ${poolCount} équipes (1er de chaque poule)<br>
                Classements : ${maxPerPool-1} tableaux (2ème, 3ème… de chaque poule) • Chaque équipe joue 5 matchs min.</div>
              </div>
            </label>
            <label style="display:flex;align-items:flex-start;gap:10px;padding:10px;border:2px solid var(--color-border);border-radius:var(--radius-md);cursor:pointer" id="fmt-p100">
              <input type="radio" name="br-format" value="2" style="margin-top:2px" ${(g.qualificationCount||1)===2?'checked':''}>
              <div>
                <div style="font-weight:700">🏅 Format P100 — 2 qualifiés par poule</div>
                <div style="font-size:11px;color:var(--color-text-muted)">Tableau principal : ${poolCount*2} équipes (1er et 2ème de chaque poule)<br>
                Classements : ${Math.max(0,maxPerPool-2)} tableaux (3ème, 4ème…) • Format compétitif avancé</div>
              </div>
            </label>
            <label style="display:flex;align-items:flex-start;gap:10px;padding:10px;border:2px solid var(--color-border);border-radius:var(--radius-md);cursor:pointer" id="fmt-custom">
              <input type="radio" name="br-format" value="custom" style="margin-top:2px" ${(g.qualificationCount||1)>2?'checked':''}>
              <div style="flex:1">
                <div style="font-weight:700">🔢 Personnalisé — <span id="br-custom-label">${Math.min(3,maxPerPool)}</span> qualifiés par poule</div>
                <div style="font-size:11px;color:var(--color-text-muted);margin-bottom:6px">Utile pour obtenir un grand tableau (1/8, 1/16…) à partir de moins de poules.</div>
                <input type="range" id="br-custom-count" min="1" max="${Math.max(1,maxPerPool)}" step="1" value="${Math.min(3,maxPerPool)}" style="width:100%">
              </div>
            </label>
          </div>
        </div>

        <div class="form-row" style="margin-top:var(--space-4)">
          <div class="form-group">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:400">
              <input type="checkbox" id="br-petite" ${g.hasPetiteFinale!==false?'checked':''}>
              Petite finale (3ème place dans le tableau principal)
            </label>
          </div>
        </div>

        <div id="br-preview" style="margin-top:var(--space-4);padding:var(--space-3);background:var(--color-bg-alt);border-radius:var(--radius-md)">
          <div style="font-size:11px;font-weight:700;color:var(--color-text-muted);margin-bottom:var(--space-2)">APERÇU DES TABLEAUX</div>
          <div id="br-preview-content"></div>
        </div>
      </div>`,
      {
        buttons: [
          { label: 'Annuler', class: 'btn-ghost', onClick: () => App.modal.close() },
          { label: '🏆 Générer', class: 'btn-primary', id: 'btn-do-bracket' }
        ]
      }
    );

    const getQualCount = () => {
      const checked = document.querySelector('input[name="br-format"]:checked')?.value || '1';
      if (checked === 'custom') {
        return parseInt(document.getElementById('br-custom-count')?.value) || 1;
      }
      return parseInt(checked) || 1;
    };

    const updatePreview = () => {
      const qualCount = getQualCount();
      const hasPetite = document.getElementById('br-petite')?.checked;
      const preview = Utils.el('#br-preview-content');
      if (!preview) return;

      const lines = [];
      // Main bracket
      const mainSize = nextPow2(poolCount * qualCount);
      lines.push(`<div style="font-size:12px;padding:4px 0;font-weight:600">🏆 Tableau principal — ${mainSize} équipes (${qualCount === 1 ? '1er' : `1er à ${qualCount}ème`} de chaque poule)</div>`);
      if (hasPetite) lines.push(`<div style="font-size:11px;color:var(--color-text-muted);padding:2px 8px">• Petite finale (3ème place)</div>`);

      // Classements
      for (let rank = qualCount + 1; rank <= maxPerPool; rank++) {
        const rankLabel = rank === 2 ? '2ème' : rank === 3 ? '3ème' : rank === 4 ? '4ème' : `${rank}ème`;
        const placeFrom = (rank - 1) * poolCount + 1;
        const placeTo = rank * poolCount;
        lines.push(`<div style="font-size:12px;padding:4px 0;font-weight:600;margin-top:4px">📊 Classement ${rankLabel} — Places ${placeFrom} à ${placeTo} (${poolCount} équipes)</div>`);
      }

      preview.innerHTML = lines.join('');
    };

    document.querySelectorAll('input[name="br-format"]').forEach(r => r.addEventListener('change', updatePreview));
    document.getElementById('br-petite')?.addEventListener('change', updatePreview);
    document.getElementById('br-custom-count')?.addEventListener('input', (e) => {
      const label = document.getElementById('br-custom-label');
      if (label) label.textContent = e.target.value;
      const customRadio = document.querySelector('input[name="br-format"][value="custom"]');
      if (customRadio) customRadio.checked = true;
      updatePreview();
    });
    updatePreview();

    Utils.el('#btn-do-bracket')?.addEventListener('click', () => {
      const qualCount = getQualCount();
      const hasPetite = Utils.el('#br-petite')?.checked;
      generateAll(qualCount, hasPetite);
    });
  };

  // ── Génération de tous les tableaux ───────────────────────────
  const generateAll = (qualCount, hasPetiteFinale) => {
    const t = App.getTournament();
    const pools = t.pools || [];
    const criteria = t.settings?.game?.rankingCriteria || ['wins','points','setDiff','gameDiff','headToHead'];
    const gameSettings = t.settings?.game || {};
    const fmtId = gameSettings.activeFormatId;

    // Reset les matchs existants de bracket/classement
    t.matches = (t.matches || []).filter(m => m.type !== 'bracket' && m.type !== 'classement');
    t.bracket = null;
    t.classements = [];

    // Récupérer les équipes par rang depuis chaque poule
    const teamsByRank = {}; // rank → [teamId, ...]
    const maxRank = Math.max(...pools.map(p => (p.teamIds||[]).length));

    pools.forEach(pool => {
      const poolTeams = (pool.teamIds || []).map(id => (t.teams || []).find(tm => tm.id === id)).filter(Boolean);
      const poolMatches = (t.matches || []).filter(m => m.poolId === pool.id);
      const ranked = RankingsModule.rankTeams(poolTeams, poolMatches, criteria, gameSettings);
      ranked.forEach(({ team }, i) => {
        const rank = i + 1;
        if (!teamsByRank[rank]) teamsByRank[rank] = [];
        teamsByRank[rank].push(team.id);
      });
    });

    // 1. Tableau principal (rangs 1..qualCount)
    const qualifiedIds = [];
    for (let r = 1; r <= qualCount; r++) {
      (teamsByRank[r] || []).forEach(id => qualifiedIds.push(id));
    }
    generateMainBracket(t, qualifiedIds, fmtId, hasPetiteFinale, qualCount);

    // 2. Tableaux de classement (rangs > qualCount)
    for (let rank = qualCount + 1; rank <= maxRank; rank++) {
      const teams = teamsByRank[rank] || [];
      if (teams.length < 2) continue;
      const placeFrom = (rank - 1) * pools.length + 1;
      const placeTo = rank * pools.length;
      generateClassement(t, teams, rank, fmtId, placeFrom, placeTo);
    }

    // Sauvegarder et planifier
    t.settings.game = { ...(t.settings.game || {}), qualificationCount: qualCount, hasPetiteFinale, bracketSize: nextPow2(qualifiedIds.length) };
    App.saveTournament(t);
    _autoScheduleAll(t);

    const totalMatches = (t.matches || []).filter(m => m.type === 'bracket' || m.type === 'classement').length;
    Audit.log(Audit.ACTIONS.GENERATE, 'bracket', `Tableaux générés : principal + ${(t.classements||[]).length} classements`);
    App.toast(`Tableaux générés : ${1 + (t.classements||[]).length} tableaux, ${totalMatches} matchs`, 'success');
    App.modal.close();
    _tab = 'main';
    _renderPage();
  };

  const generateMainBracket = (t, qualifiedIds, fmtId, hasPetiteFinale, qualCount) => {
    const size = nextPow2(qualifiedIds.length);
    let seeds = [...qualifiedIds];
    while (seeds.length < size) seeds.push(null);

    // Tête de série : alterner poules pour éviter que 2 équipes de même poule se rencontrent tôt
    seeds = interleavePools(seeds, qualCount);

    const rounds = [];
    let currentCount = size;
    while (currentCount >= 2) {
      rounds.push({ matchIds: [] });
      currentCount = Math.floor(currentCount / 2);
    }

    // Round 1
    for (let i = 0; i < size / 2; i++) {
      const m = {
        id: Utils.uuid(), type: 'bracket', poolId: null,
        bracketRound: 0, bracketPosition: i,
        team1Id: seeds[i * 2] || null, team2Id: seeds[i * 2 + 1] || null,
        courtId: null, scheduledTime: null, status: 'scheduled',
        score: null, winnerId: null, formatId: fmtId
      };
      if (!m.team1Id || !m.team2Id) { m.winnerId = m.team1Id || m.team2Id; m.status = 'finished'; }
      t.matches.push(m);
      rounds[0].matchIds.push(m.id);
    }

    // Rounds suivants (matchs TBD)
    for (let r = 1; r < rounds.length; r++) {
      const count = size / Math.pow(2, r + 1);
      for (let i = 0; i < count; i++) {
        const m = {
          id: Utils.uuid(), type: 'bracket', poolId: null,
          bracketRound: r, bracketPosition: i,
          team1Id: null, team2Id: null,
          courtId: null, scheduledTime: null, status: 'scheduled',
          score: null, winnerId: null, formatId: fmtId
        };
        t.matches.push(m);
        rounds[r].matchIds.push(m.id);
      }
    }

    // Petite finale
    if (hasPetiteFinale && rounds.length >= 2) {
      const m = {
        id: Utils.uuid(), type: 'bracket', isPetiteFinale: true,
        bracketRound: rounds.length - 1, bracketPosition: 99,
        team1Id: null, team2Id: null,
        courtId: null, scheduledTime: null, status: 'scheduled',
        score: null, winnerId: null, formatId: fmtId
      };
      t.matches.push(m);
    }

    propagateByes(t, rounds);
    t.bracket = { rounds, hasPetiteFinale, size };
  };

  const generateClassement = (t, teamIds, poolRank, fmtId, placeFrom, placeTo) => {
    const size = nextPow2(teamIds.length);
    let seeds = [...teamIds];
    while (seeds.length < size) seeds.push(null);

    const classementId = Utils.uuid();
    const rounds = [];
    let currentCount = size;
    while (currentCount >= 2) {
      rounds.push({ matchIds: [] });
      currentCount = Math.floor(currentCount / 2);
    }

    // Round 1
    for (let i = 0; i < size / 2; i++) {
      const m = {
        id: Utils.uuid(), type: 'classement', classementId,
        classementRound: 0, classementPosition: i,
        poolId: null,
        team1Id: seeds[i * 2] || null, team2Id: seeds[i * 2 + 1] || null,
        courtId: null, scheduledTime: null, status: 'scheduled',
        score: null, winnerId: null, formatId: fmtId
      };
      if (!m.team1Id || !m.team2Id) { m.winnerId = m.team1Id || m.team2Id; m.status = 'finished'; }
      t.matches.push(m);
      rounds[0].matchIds.push(m.id);
    }

    // Rounds suivants
    for (let r = 1; r < rounds.length; r++) {
      const count = size / Math.pow(2, r + 1);
      for (let i = 0; i < count; i++) {
        const m = {
          id: Utils.uuid(), type: 'classement', classementId,
          classementRound: r, classementPosition: i,
          poolId: null,
          team1Id: null, team2Id: null,
          courtId: null, scheduledTime: null, status: 'scheduled',
          score: null, winnerId: null, formatId: fmtId
        };
        t.matches.push(m);
        rounds[r].matchIds.push(m.id);
      }
    }

    propagateClassementByes(t, rounds, classementId);

    const rankLabel = poolRank === 2 ? '2ème' : poolRank === 3 ? '3ème' : poolRank === 4 ? '4ème' : `${poolRank}ème`;
    t.classements = t.classements || [];
    t.classements.push({ id: classementId, label: `Classement — Places ${placeFrom} à ${placeTo}`, poolRank, placeFrom, placeTo, size, rounds });
  };

  // Interleave seeds for bracket seeding (1er poule A, 1er poule B, ...)
  const interleavePools = (seeds, qualPerPool) => {
    if (qualPerPool <= 1) return seeds;
    // Separate by pool position (1st from all pools, then 2nd from all pools)
    return seeds; // Already grouped by rank, order is fine
  };

  const propagateByes = (t, rounds) => {
    rounds.forEach((round, r) => {
      if (r >= rounds.length - 1) return;
      (round.matchIds || []).forEach((matchId, pos) => {
        const m = (t.matches || []).find(x => x.id === matchId);
        if (m?.winnerId) {
          const nextPos = Math.floor(pos / 2);
          const nextId = rounds[r + 1]?.matchIds?.[nextPos];
          const next = (t.matches || []).find(x => x.id === nextId);
          if (next) { if (pos % 2 === 0) next.team1Id = m.winnerId; else next.team2Id = m.winnerId; }
        }
      });
    });
  };

  const propagateClassementByes = (t, rounds, classementId) => {
    rounds.forEach((round, r) => {
      if (r >= rounds.length - 1) return;
      (round.matchIds || []).forEach((matchId, pos) => {
        const m = (t.matches || []).find(x => x.id === matchId && x.classementId === classementId);
        if (m?.winnerId) {
          const nextPos = Math.floor(pos / 2);
          const nextId = rounds[r + 1]?.matchIds?.[nextPos];
          const next = (t.matches || []).find(x => x.id === nextId);
          if (next) { if (pos % 2 === 0) next.team1Id = m.winnerId; else next.team2Id = m.winnerId; }
        }
      });
    });
  };

  // ── Propagation vainqueur tableau principal ────────────────────
  const propagateWinner = (winnerId, match) => {
    const t = App.getTournament();
    const bracket = t.bracket;
    if (!bracket) return;

    const loserId = match.team1Id === winnerId ? match.team2Id : match.team1Id;
    const rounds = bracket.rounds;
    const r = match.bracketRound;
    const pos = match.bracketPosition;

    // Route winner to next round
    if (r < rounds.length - 1) {
      const nextPos = Math.floor(pos / 2);
      const nextId = rounds[r + 1]?.matchIds?.[nextPos];
      const next = (t.matches || []).find(x => x.id === nextId);
      if (next) { if (pos % 2 === 0) next.team1Id = winnerId; else next.team2Id = winnerId; }
    }

    // Petite finale : le perdant des demi-finales
    if (bracket.hasPetiteFinale && r === rounds.length - 2) {
      const petite = (t.matches || []).find(m => m.isPetiteFinale);
      if (petite && loserId) {
        if (pos % 2 === 0) petite.team1Id = loserId;
        else petite.team2Id = loserId;
      }
    }

    App.saveTournament(t);
  };

  // ── Propagation vainqueur tableau de classement ───────────────
  const propagateClassementWinner = (winnerId, match) => {
    const t = App.getTournament();
    const cls = (t.classements || []).find(c => c.id === match.classementId);
    if (!cls) return;

    const rounds = cls.rounds;
    const r = match.classementRound;
    const pos = match.classementPosition;

    if (r < rounds.length - 1) {
      const nextPos = Math.floor(pos / 2);
      const nextId = rounds[r + 1]?.matchIds?.[nextPos];
      const next = (t.matches || []).find(x => x.id === nextId);
      if (next) { if (pos % 2 === 0) next.team1Id = winnerId; else next.team2Id = winnerId; }
    }

    App.saveTournament(t);
  };

  // ── Saisie de score ───────────────────────────────────────────
  const openScoreForm = (match, t) => {
    const t1 = getTeamName(t, match.team1Id);
    const t2 = getTeamName(t, match.team2Id);
    const fmt = (t.settings?.matchFormats || []).find(f => f.id === match.formatId) || { sets: 1 };
    const setsCount = fmt.sets || 1;
    const existingSets = match.score?.sets || Array.from({ length: setsCount }, () => ({ team1: 0, team2: 0 }));

    const isClassement = match.type === 'classement';
    const cls = isClassement ? (t.classements || []).find(c => c.id === match.classementId) : null;
    const title = isClassement ? `📊 Score — ${Utils.escHtml(cls?.label || 'Classement')}` : '🏆 Score du tableau';

    App.modal.open(title, `
      <div>
        <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:var(--space-3);align-items:center;margin-bottom:var(--space-4);padding:var(--space-3);background:var(--color-bg-alt);border-radius:var(--radius-md)">
          <div style="font-weight:700;text-align:right">${Utils.escHtml(t1)}</div>
          <div style="font-size:var(--font-size-xs);color:var(--color-text-faint);font-weight:700">VS</div>
          <div style="font-weight:700">${Utils.escHtml(t2)}</div>
        </div>
        ${existingSets.map((s, i) => `
          <div style="display:flex;align-items:center;gap:var(--space-4);padding:var(--space-3) 0;border-bottom:1px solid var(--color-border-light)">
            <div style="width:80px;text-align:right;font-size:var(--font-size-xs);color:var(--color-text-muted)">Set ${i + 1}</div>
            <div style="flex:1;text-align:right"><input type="number" class="score-number-input" id="bs${i}-t1" min="0" value="${s.team1}"></div>
            <div class="score-vs">—</div>
            <div style="flex:1"><input type="number" class="score-number-input" id="bs${i}-t2" min="0" value="${s.team2}"></div>
          </div>`).join('')}
        <div style="margin-top:var(--space-4)">
          <div style="font-size:var(--font-size-xs);color:var(--color-text-muted);margin-bottom:8px">Vainqueur</div>
          <div style="display:flex;gap:var(--space-3)">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;flex:1;padding:8px;border:2px solid var(--color-border);border-radius:var(--radius-md)">
              <input type="radio" name="br-winner" value="${match.team1Id}" ${match.winnerId===match.team1Id?'checked':''}> ${Utils.escHtml(t1)}
            </label>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;flex:1;padding:8px;border:2px solid var(--color-border);border-radius:var(--radius-md)">
              <input type="radio" name="br-winner" value="${match.team2Id}" ${match.winnerId===match.team2Id?'checked':''}> ${Utils.escHtml(t2)}
            </label>
          </div>
        </div>
      </div>`,
      {
        buttons: [
          { label: 'Annuler', class: 'btn-ghost', onClick: () => App.modal.close() },
          { label: '✅ Enregistrer', class: 'btn-primary', id: 'btn-save-br-score' }
        ]
      }
    );

    Utils.el('#btn-save-br-score')?.addEventListener('click', () => {
      const newSets = existingSets.map((s, i) => ({
        team1: parseInt(document.getElementById(`bs${i}-t1`)?.value) || 0,
        team2: parseInt(document.getElementById(`bs${i}-t2`)?.value) || 0
      }));
      const winnerId = document.querySelector('input[name="br-winner"]:checked')?.value || null;

      const t = App.getTournament();
      const m = (t.matches || []).find(x => x.id === match.id);
      if (m) {
        m.score = { sets: newSets };
        m.winnerId = winnerId;
        m.status = 'finished';
      }
      App.saveTournament(t);

      if (winnerId) {
        if (isClassement) propagateClassementWinner(winnerId, match);
        else propagateWinner(winnerId, match);
      }

      App.toast('Score enregistré', 'success');
      App.modal.close();
      _renderPage();
    });
  };

  // ── Planification automatique ──────────────────────────────────
  const _autoScheduleAll = (t) => {
    const courts = (t.settings?.courts || []).filter(c => c.available);
    if (courts.length === 0) return;

    const g = t.settings?.game || {};
    const fmt = (t.settings?.matchFormats || []).find(f => f.id === g.activeFormatId) || { estimatedDuration: 45 };
    const slotDuration = (fmt.estimatedDuration || 45) + 5;

    // Trouver la fin du dernier match de poule planifié
    const poolMatches = (t.matches || []).filter(m => m.poolId && m.scheduledTime);
    let startAfter = t.settings?.tournament?.startTime || '09:00';
    if (poolMatches.length > 0) {
      startAfter = poolMatches.reduce((latest, m) =>
        Utils.compareTime(m.scheduledTime, latest) > 0 ? m.scheduledTime : latest, '00:00');
      startAfter = Utils.addMinutes(startAfter, slotDuration);
    }

    const breakStart = t.settings?.tournament?.breakStart;
    const breakEnd = t.settings?.tournament?.breakEnd;
    const adjustForBreak = (time) => {
      if (!breakStart || !breakEnd) return time;
      const slotMin = Utils.timeToMin(time);
      const endMin = slotMin + (fmt.estimatedDuration || 45);
      if (slotMin < Utils.timeToMin(breakEnd) && endMin > Utils.timeToMin(breakStart)) return breakEnd;
      return time;
    };

    const busyAtTime = {};
    const markBusy = (teamIds, time) => {
      if (!busyAtTime[time]) busyAtTime[time] = new Set();
      teamIds.forEach(id => busyAtTime[time].add(id));
    };
    const isBusy = (teamIds, time) => busyAtTime[time] && teamIds.some(id => busyAtTime[time].has(id));

    // Récupérer tous les matchs bracket/classement groupés par "phase" et "round"
    // On schedule: main round 0, classement round 0, main round 1, classement round 1, ...
    const mainRounds = t.bracket?.rounds || [];
    const classements = t.classements || [];
    const maxRound = Math.max(
      mainRounds.length - 1,
      ...classements.map(c => (c.rounds?.length || 1) - 1)
    );

    const courtSlots = courts.map(() => startAfter);

    const scheduleMatches = (matchList) => {
      const roundTeams = new Set();
      const roundCourts = new Set();

      for (const court of courts) {
        if (matchList.length === 0) break;
        const idx = matchList.findIndex(m => {
          const teams = [m.team1Id, m.team2Id].filter(Boolean);
          if (isBusy(teams, courtSlots[courts.indexOf(court)])) return false;
          if (teams.some(id => roundTeams.has(id))) return false;
          if (roundCourts.has(court.id)) return false;
          return true;
        });
        if (idx === -1) continue;
        const [m] = matchList.splice(idx, 1);
        const time = adjustForBreak(courtSlots[courts.indexOf(court)]);
        m.courtId = court.id;
        m.scheduledTime = time;
        [m.team1Id, m.team2Id].filter(Boolean).forEach(id => roundTeams.add(id));
        roundCourts.add(court.id);
        markBusy([m.team1Id, m.team2Id].filter(Boolean), time);
        courtSlots[courts.indexOf(court)] = Utils.addMinutes(time, slotDuration);
      }
    };

    for (let r = 0; r <= maxRound; r++) {
      // Collecter les matchs bracket de ce round (non terminés et non planifiés)
      const roundMatches = [];

      // Main bracket round r
      const mainRound = mainRounds[r];
      if (mainRound) {
        mainRound.matchIds.forEach(id => {
          const m = (t.matches || []).find(x => x.id === id && x.status !== 'finished' && !x.scheduledTime && !x.isPetiteFinale);
          if (m) roundMatches.push(m);
        });
      }

      // Classement brackets round r
      classements.forEach(cls => {
        const clsRound = cls.rounds?.[r];
        if (clsRound) {
          clsRound.matchIds.forEach(id => {
            const m = (t.matches || []).find(x => x.id === id && x.status !== 'finished' && !x.scheduledTime);
            if (m) roundMatches.push(m);
          });
        }
      });

      if (roundMatches.length === 0) continue;

      // Schedule this round's matches across all courts
      const remaining = [...roundMatches];
      while (remaining.length > 0) {
        const prevLen = remaining.length;
        scheduleMatches(remaining);
        if (remaining.length === prevLen) break; // Safety: no progress

        // Advance court slots to max after this batch
        const maxSlot = courtSlots.reduce((m, s) => Utils.compareTime(s, m) > 0 ? s : m, '00:00');
        courtSlots.forEach((s, i) => {
          if (Utils.compareTime(s, maxSlot) < 0) courtSlots[i] = maxSlot;
        });
      }

      // After each round, advance all courts to same time (wait for round to finish)
      const maxSlot = courtSlots.reduce((m, s) => Utils.compareTime(s, m) > 0 ? s : m, '00:00');
      courtSlots.forEach((_, i) => courtSlots[i] = adjustForBreak(maxSlot));
    }

    // Petite finale en dernier
    const petite = (t.matches || []).find(m => m.isPetiteFinale && !m.scheduledTime);
    if (petite) {
      const time = adjustForBreak(courtSlots[0]);
      petite.scheduledTime = time;
      petite.courtId = courts[0]?.id;
    }

    App.saveTournament(t);
  };

  return { render, propagateWinner, propagateClassementWinner };
})();
