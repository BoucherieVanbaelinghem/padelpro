'use strict';

/* ═══════════════════════════════════════════════════════════════
   SCHEDULE MODULE — Planning optimisé
   ═══════════════════════════════════════════════════════════════ */

const ScheduleModule = (() => {

  let _container = null;
  let _viewMode = 'timeline'; // timeline | list

  const render = (container) => {
    _container = container;
    _renderPage();
  };

  const getTeamName = (t, id) => {
    const tm = (t.teams || []).find(x => x.id === id);
    return tm?.name || '?';
  };
  const getCourtName = (t, id) => {
    const c = (t.settings?.courts || []).find(x => x.id === id);
    return c?.name || '?';
  };

  const _renderPage = () => {
    const t = App.getTournament();
    const matches = t.matches || [];
    const courts = (t.settings?.courts || []).filter(c => c.available);

    _container.innerHTML = `
      <div class="animate-fade-in">
        <div class="page-header">
          <div class="page-header-left">
            <h2 class="page-title">📅 Planning</h2>
            <p class="page-subtitle">${matches.length} match${matches.length > 1 ? 's' : ''} • ${courts.length} terrain${courts.length > 1 ? 's' : ''}</p>
          </div>
          <div class="page-header-actions">
            <div class="tabs" style="margin-bottom:0;padding:3px">
              <button class="tab-btn ${_viewMode==='timeline'?'active':''}" data-view="timeline">📊 Planning</button>
              <button class="tab-btn ${_viewMode==='list'?'active':''}" data-view="list">📋 Liste</button>
              <button class="tab-btn ${_viewMode==='org'?'active':''}" data-view="org">🌳 Organigramme</button>
            </div>
            ${matches.filter(m=>m.status==='scheduled').length > 0 ? `<button class="btn btn-secondary" id="btn-reschedule-now">⏰ Recaler depuis maintenant</button>` : ''}
            ${matches.length > 0 ? `<button class="btn btn-secondary" id="btn-clear-schedule">🗑️ Effacer</button>` : ''}
            <button class="btn btn-primary" id="btn-gen-schedule">⚡ Générer le planning</button>
          </div>
        </div>

        ${matches.length === 0 ? renderEmpty() :
          _viewMode === 'timeline' ? renderTimeline(t) :
          _viewMode === 'list' ? renderList(t) :
          renderOrgChart(t)}
      </div>`;

    _container.querySelectorAll('.tab-btn[data-view]').forEach(btn => {
      btn.addEventListener('click', () => { _viewMode = btn.dataset.view; _renderPage(); });
    });

    Utils.el('#btn-gen-schedule', _container)?.addEventListener('click', () => openScheduleModal());
    Utils.el('#btn-reschedule-now', _container)?.addEventListener('click', () => rescheduleFromNow());
    Utils.el('#btn-clear-schedule', _container)?.addEventListener('click', async () => {
      const ok = await App.confirm('Effacer le planning', 'Les horaires et terrains seront réinitialisés (les scores sont conservés).', { icon: '🗑️' });
      if (!ok) return;
      const t = App.getTournament();
      t.matches.forEach(m => { m.courtId = null; m.scheduledTime = null; });
      App.saveTournament(t);
      _renderPage();
    });

    // Clic sur une carte match → édition manuelle
    _container.querySelectorAll('.planning-match-card[data-match]').forEach(card => {
      card.addEventListener('click', () => openEditMatchModal(card.dataset.match));
    });
    _container.querySelectorAll('.btn-move-match').forEach(btn => {
      btn.addEventListener('click', () => openEditMatchModal(btn.dataset.id));
    });
  };

  const renderEmpty = () => {
    const t = App.getTournament();
    const teams = t.teams || [];
    const pools = t.pools || [];

    if (teams.length === 0) return `
      <div class="card"><div class="card-body"><div class="empty-state">
        <div class="empty-state-icon">📅</div>
        <h3>Étape 1 — Créez des joueurs et des équipes</h3>
        <p>Ajoutez des joueurs, formez des équipes, puis revenez ici.</p>
        <div style="display:flex;gap:var(--space-2);margin-top:var(--space-4)">
          <button class="btn btn-primary" onclick="App.navigate('players')">👥 Ajouter des joueurs</button>
          <button class="btn btn-secondary" onclick="App.navigate('teams')">🤝 Créer des équipes</button>
        </div>
      </div></div></div>`;

    if (pools.length === 0) return `
      <div class="card"><div class="card-body"><div class="empty-state">
        <div class="empty-state-icon">📅</div>
        <h3>Étape 2 — Créez les poules</h3>
        <p>Vous avez <strong>${teams.length} équipe${teams.length>1?'s':''}</strong>. Générez les poules pour créer les matchs, puis revenez générer le planning.</p>
        <button class="btn btn-primary" onclick="App.navigate('pools')">🔵 Créer les poules</button>
      </div></div></div>`;

    return `
      <div class="card"><div class="card-body"><div class="empty-state">
        <div class="empty-state-icon">📅</div>
        <h3>Prêt à planifier !</h3>
        <p>Cliquez sur <strong>"Générer le planning"</strong> pour affecter automatiquement les horaires et les terrains.</p>
      </div></div></div>`;
  };

  // ── Vue Timeline ──────────────────────────────────────────────
  const renderTimeline = (t) => {
    const matches = t.matches || [];
    const courts = (t.settings?.courts || []).filter(c => c.available);
    const scheduled = matches.filter(m => m.scheduledTime && m.courtId);

    if (scheduled.length === 0) return `
      <div class="card"><div class="card-body">
        <div class="empty-state">
          <div class="empty-state-icon">📊</div>
          <h3>Planning non encore calculé</h3>
          <p>Cliquez sur "Générer le planning" pour affecter automatiquement les horaires et les terrains.</p>
        </div>
      </div></div>`;

    const byTime = {};
    scheduled.forEach(m => {
      const key = m.scheduledTime;
      if (!byTime[key]) byTime[key] = {};
      byTime[key][m.courtId] = m;
    });

    const times = Object.keys(byTime).sort(Utils.compareTime.bind(Utils));

    return `
      <div class="planning-grid" id="planning-grid">
        <div class="planning-header" style="grid-template-columns:80px ${courts.map(() => '1fr').join(' ')}">
          <div class="planning-cell planning-time-col">Heure</div>
          ${courts.map(c => `<div class="planning-cell" style="font-size:var(--font-size-xs);font-weight:700;text-align:center">${Utils.escHtml(c.name)}</div>`).join('')}
        </div>
        ${times.map(time => `
          <div class="slot-row" style="display:grid;grid-template-columns:80px ${courts.map(() => '1fr').join(' ')}">
            <div class="planning-cell planning-time-col" style="display:flex;align-items:center;justify-content:center;font-size:var(--font-size-sm);font-weight:700">${time}</div>
            ${courts.map(court => {
              const m = byTime[time]?.[court.id];
              if (!m) return `<div class="planning-cell" style="background:var(--color-bg)"></div>`;
              const statusClass = m.status === 'finished' ? 'finished' : m.status === 'running' ? 'running' : '';
              return `
                <div class="planning-cell" style="padding:6px">
                  <div class="planning-match-card ${statusClass}" data-match="${m.id}" style="cursor:pointer" title="Cliquer pour modifier">
                    <div style="font-weight:700;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${Utils.escHtml(getTeamName(t, m.team1Id))}</div>
                    <div style="font-size:10px;color:var(--color-text-faint)">vs</div>
                    <div style="font-weight:700;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${Utils.escHtml(getTeamName(t, m.team2Id))}</div>
                    ${m.status === 'finished' && m.score ? `<div style="font-size:10px;font-weight:700;color:var(--color-success);margin-top:2px">${formatScore(m.score)}</div>` : ''}
                    ${getPoolLabel(t, m)}
                    <div style="font-size:9px;color:var(--color-text-faint);margin-top:2px;opacity:0.6">✏️ modifier</div>
                  </div>
                </div>`;
            }).join('')}
          </div>`).join('')}
      </div>`;
  };

  const getPoolLabel = (t, m) => {
    if (m.type === 'bracket') return `<div style="font-size:10px;color:var(--color-primary)">🏆 Final</div>`;
    const pool = (t.pools || []).find(p => p.id === m.poolId);
    return pool ? `<div style="font-size:10px;color:var(--color-text-faint)">${Utils.escHtml(pool.name)}</div>` : '';
  };

  const formatScore = (score) => {
    if (!score?.sets) return '';
    return score.sets.map(s => `${s.team1}-${s.team2}`).join(' ');
  };

  // ── Vue Liste ─────────────────────────────────────────────────
  const renderList = (t) => {
    const matches = Utils.sortBy(t.matches || [], m => m.scheduledTime || '99:99', 'asc');

    return `
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Heure</th>
              <th>Terrain</th>
              <th>Équipe 1</th>
              <th>Équipe 2</th>
              <th>Type</th>
              <th>Statut</th>
              <th>Score</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${matches.map(m => {
              const pool = (t.pools || []).find(p => p.id === m.poolId);
              const statusBadge = m.status === 'finished'
                ? '<span class="badge badge-success">✅ Terminé</span>'
                : m.status === 'running'
                ? '<span class="badge badge-warning badge-dot">En cours</span>'
                : '<span class="badge badge-neutral">⏳ Planifié</span>';
              return `
                <tr>
                  <td style="font-weight:700">${m.scheduledTime || '—'}</td>
                  <td>${m.courtId ? Utils.escHtml(getCourtName(t, m.courtId)) : '<span class="text-muted">—</span>'}</td>
                  <td style="font-weight:500">${Utils.escHtml(getTeamName(t, m.team1Id))}</td>
                  <td style="font-weight:500">${Utils.escHtml(getTeamName(t, m.team2Id))}</td>
                  <td>${pool ? `<span class="badge badge-primary">${Utils.escHtml(pool.name)}</span>` : '<span class="badge badge-neutral">Final</span>'}</td>
                  <td>${statusBadge}</td>
                  <td style="font-weight:700">${m.score ? formatScore(m.score) : '—'}</td>
                  <td>
                    <button class="btn btn-sm btn-secondary btn-move-match" data-id="${m.id}" title="Modifier horaire/terrain">✏️ Modifier</button>
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  };

  // ── Modal édition manuelle d'un match ─────────────────────────
  const openEditMatchModal = (matchId) => {
    const t = App.getTournament();
    const m = (t.matches || []).find(x => x.id === matchId);
    if (!m) return;
    const courts = (t.settings?.courts || []).filter(c => c.available);
    const team1 = getTeamName(t, m.team1Id);
    const team2 = getTeamName(t, m.team2Id);
    const pool = (t.pools || []).find(p => p.id === m.poolId);
    const label = pool ? pool.name : (m.type === 'bracket' ? '🏆 Finale' : '?');

    App.modal.open(`✏️ Modifier le match`, `
      <div class="form-section">
        <div style="text-align:center;padding:var(--space-3);background:var(--color-bg-alt);border-radius:var(--radius-md);margin-bottom:var(--space-4)">
          <div style="font-size:var(--font-size-sm);font-weight:700">${Utils.escHtml(team1)}</div>
          <div style="font-size:var(--font-size-xs);color:var(--color-text-muted)">vs</div>
          <div style="font-size:var(--font-size-sm);font-weight:700">${Utils.escHtml(team2)}</div>
          <div style="font-size:var(--font-size-xs);color:var(--color-text-faint);margin-top:4px">${Utils.escHtml(label)}</div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Heure</label>
            <input id="edit-match-time" type="time" class="form-control" value="${m.scheduledTime || '09:00'}">
          </div>
          <div class="form-group">
            <label class="form-label">Terrain</label>
            <select id="edit-match-court" class="form-control">
              <option value="">— Non assigné —</option>
              ${courts.map(c => `<option value="${c.id}" ${m.courtId === c.id ? 'selected' : ''}>${Utils.escHtml(c.name)}</option>`).join('')}
            </select>
          </div>
        </div>
        ${m.status === 'finished' ? '<div class="alert alert-warning" style="margin-top:var(--space-3)">⚠️ Ce match est terminé — modifier l\'horaire n\'affecte pas le score.</div>' : ''}
      </div>`,
      {
        buttons: [
          { label: 'Annuler', class: 'btn-ghost', onClick: () => App.modal.close() },
          { label: '💾 Enregistrer', class: 'btn-primary', id: 'btn-save-match-edit' }
        ]
      }
    );

    Utils.el('#btn-save-match-edit')?.addEventListener('click', () => {
      const newTime = Utils.el('#edit-match-time')?.value?.trim();
      const newCourt = Utils.el('#edit-match-court')?.value;
      if (!newTime) { App.toast('Heure invalide', 'error'); return; }

      // Vérifier conflits (équipes déjà occupées à ce créneau)
      const otherMatches = (t.matches || []).filter(x => x.id !== m.id && x.scheduledTime === newTime);
      const busyTeams = new Set();
      otherMatches.forEach(x => { if (x.team1Id) busyTeams.add(x.team1Id); if (x.team2Id) busyTeams.add(x.team2Id); });
      const conflict = [m.team1Id, m.team2Id].filter(Boolean).some(id => busyTeams.has(id));
      if (conflict) {
        const conflictMatch = otherMatches.find(x => busyTeams.has(m.team1Id) || busyTeams.has(m.team2Id));
        const conflictTeam = getTeamName(t, [m.team1Id, m.team2Id].find(id => busyTeams.has(id)));
        App.toast(`Conflit : ${conflictTeam} joue déjà à ${newTime}`, 'error');
        return;
      }

      // Vérifier terrain déjà occupé
      if (newCourt) {
        const courtConflict = otherMatches.find(x => x.courtId === newCourt);
        if (courtConflict) {
          App.toast(`${getCourtName(t, newCourt)} est déjà occupé à ${newTime}`, 'error');
          return;
        }
      }

      m.scheduledTime = newTime;
      m.courtId = newCourt || null;
      App.saveTournament(t);
      Audit.log(Audit.ACTIONS.UPDATE, 'schedule', `Match ${team1} vs ${team2} déplacé à ${newTime}`);
      App.toast('Horaire mis à jour', 'success');
      App.modal.close();
      _renderPage();
    });
  };

  // ── Modal génération planning ──────────────────────────────────
  // Calcule l'estimation (créneaux disponibles vs matchs à planifier) à
  // partir des valeurs ACTUELLES des champs du formulaire.
  const _computeScheduleEstimate = (matches, courts, breakDefaults) => {
    const start      = Utils.el('#sch-start')?.value || '09:00';
    const end         = Utils.el('#sch-end')?.value || '19:00';
    const duration    = parseInt(Utils.el('#sch-duration')?.value) || 45;
    const gap         = parseInt(Utils.el('#sch-gap')?.value) || 0;
    const useBreak    = Utils.el('#sch-break')?.checked;

    const slotDuration = duration + gap;
    let totalMin = Utils.timeToMin(end) - Utils.timeToMin(start);
    if (useBreak) {
      const bDur = Utils.timeToMin(breakDefaults.breakEnd) - Utils.timeToMin(breakDefaults.breakStart);
      totalMin -= Math.max(0, bDur);
    }

    const courtCount = Math.max(courts.length, 0);
    const parallelTime = courtCount > 0 ? Math.ceil(matches.length / courtCount) * slotDuration : 0;

    if (totalMin <= 0 || courtCount === 0) {
      return { status: 'unknown', parallelTime, matches: matches.length, courts: courtCount };
    }

    const slotsPerCourt = Math.floor(totalMin / slotDuration);
    const totalSlots = slotsPerCourt * courtCount;
    const status = totalSlots >= matches.length * 1.15 ? 'ok' : totalSlots >= matches.length ? 'tight' : 'over';

    return { status, parallelTime, totalSlots, slotsPerCourt, matches: matches.length, courts: courtCount };
  };

  const _renderScheduleEstimate = (est) => {
    const C = { ok: '#16a34a', tight: '#d97706', over: '#dc2626', unknown: '#2563eb' };
    const I = { ok: '✅', tight: '⚠️', over: '🔴', unknown: 'ℹ️' };
    const M = {
      ok:      'Planning réalisable avec ces réglages',
      tight:   'Planning serré — risque de dépassement en fin de journée',
      over:    `Impossible de tout caser avec ${est.courts} terrain(s)`,
      unknown: 'Renseignez les horaires pour une estimation complète'
    };
    const c = C[est.status];

    const stats = [
      ['🎾 Matchs à planifier', est.matches],
      ['🏟️ Terrains', est.courts]
    ];
    if (est.status !== 'unknown') {
      stats.push(['📋 Créneaux / terrain', est.slotsPerCourt]);
      stats.push(['🏓 Capacité totale', `${est.totalSlots} créneaux`]);
    }

    return `
      <div style="border-radius:var(--radius-lg);border:1px solid ${c};overflow:hidden;font-size:12px">
        <div style="background:${c}20;padding:8px 12px;display:flex;align-items:center;gap:8px;border-bottom:1px solid ${c}40">
          <span style="font-size:1rem;flex-shrink:0">${I[est.status]}</span>
          <span style="font-weight:700;color:${c}">${M[est.status]}</span>
        </div>
        <div style="padding:var(--space-3);background:var(--color-bg-alt);display:grid;grid-template-columns:1fr 1fr;gap:8px;color:var(--color-text-muted)">
          ${stats.map(([label, value]) => `<div>${label} &nbsp;<b style="color:var(--color-text)">${value}</b></div>`).join('')}
          <div style="grid-column:span 2;padding-top:6px;border-top:1px solid var(--color-border-light)">
            ⏱️ Durée estimée en continu &nbsp;<b style="color:var(--color-text)">${Utils.durationText(est.parallelTime)}</b>
          </div>
        </div>
      </div>`;
  };

  const openScheduleModal = () => {
    const t = App.getTournament();
    const s = t.settings;
    const courts = (s?.courts || []).filter(c => c.available);
    const matches = t.matches || [];
    const fmt = (s?.matchFormats || []).find(f => f.id === s?.game?.activeFormatId) || { estimatedDuration: 45 };
    const breakDefaults = {
      breakStart: s?.tournament?.breakStart || '12:00',
      breakEnd:   s?.tournament?.breakEnd || '13:00'
    };

    App.modal.open('⚡ Générer le planning', `
      <div class="form-section">
        <div id="sch-estimate-box" style="margin-bottom:var(--space-4)"></div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Heure de début</label>
            <input id="sch-start" type="time" class="form-control" value="${s?.tournament?.startTime || '09:00'}">
          </div>
          <div class="form-group">
            <label class="form-label">Heure limite de fin</label>
            <input id="sch-end" type="time" class="form-control" value="${s?.tournament?.endTime || '19:00'}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Durée par match (min)</label>
            <input id="sch-duration" type="number" min="10" max="180" class="form-control" value="${fmt.estimatedDuration}">
          </div>
          <div class="form-group">
            <label class="form-label">Pause entre matchs (min)</label>
            <input id="sch-gap" type="number" min="0" max="60" class="form-control" value="5">
          </div>
        </div>
        <div class="form-group">
          <label style="display:flex;align-items:center;gap:var(--space-2);font-weight:400;cursor:pointer">
            <input type="checkbox" id="sch-break" ${s?.tournament?.breakEnabled ? 'checked' : ''}>
            Inclure la pause déjeuner (${breakDefaults.breakStart} – ${breakDefaults.breakEnd})
          </label>
        </div>
        ${(() => {
          const af = (s?.matchFormats || []).find(f => f.id === s?.game?.activeFormatId);
          if (!af?.restAfterMin) return '';
          const maxDay = af.fftCode && typeof FormatsModule !== 'undefined' ? FormatsModule.MAX_MATCHES_DAY?.[af.fftCode] : null;
          return `<div class="alert alert-info" style="margin-top:var(--space-3)">
            🕐 Format ${af.fftCode || af.name} : repos minimum <strong>${af.restAfterMin} min</strong> entre 2 matchs${maxDay ? ` · max <strong>${maxDay} matchs/jour</strong>` : ''}
          </div>`;
        })()}
        ${courts.length === 0 ? `<div class="alert alert-warning">⚠️ Aucun terrain disponible. Configurez les terrains dans Paramètres.</div>` : ''}
      </div>`,
      {
        buttons: [
          { label: 'Annuler', class: 'btn-ghost', onClick: () => App.modal.close() },
          { label: '📅 Générer', class: 'btn-primary', id: 'btn-do-schedule' }
        ]
      }
    );

    const refreshEstimate = () => {
      const box = Utils.el('#sch-estimate-box');
      if (box) box.innerHTML = _renderScheduleEstimate(_computeScheduleEstimate(matches, courts, breakDefaults));
    };
    refreshEstimate();

    ['#sch-start', '#sch-end', '#sch-duration', '#sch-gap'].forEach(sel => {
      Utils.el(sel)?.addEventListener('input', refreshEstimate);
    });
    Utils.el('#sch-break')?.addEventListener('change', refreshEstimate);

    Utils.el('#btn-do-schedule')?.addEventListener('click', () => {
      const config = {
        startTime:    Utils.el('#sch-start')?.value || '09:00',
        endTime:      Utils.el('#sch-end')?.value || '19:00',
        duration:     parseInt(Utils.el('#sch-duration')?.value) || fmt.estimatedDuration,
        gap:          parseInt(Utils.el('#sch-gap')?.value) || 5,
        useBreak:     Utils.el('#sch-break')?.checked,
        breakStart:   breakDefaults.breakStart,
        breakEnd:     breakDefaults.breakEnd
      };
      generateSchedule(config);
    });
  };

  // ── Algorithme de planification par rounds ─────────────────────
  // À chaque créneau horaire, on remplit TOUS les terrains disponibles
  // en évitant les conflits d'équipes. On avance seulement quand tous
  // les terrains sont occupés ou qu'aucun match restant n'est possible.
  const generateSchedule = (config) => {
    const t = App.getTournament();
    const courts = (t.settings?.courts || []).filter(c => c.available);
    const allMatches = t.matches || [];

    if (courts.length === 0) { App.toast('Aucun terrain disponible', 'error'); return; }

    const slotDuration = config.duration + config.gap;
    const breakStartMin = config.useBreak ? Utils.timeToMin(config.breakStart) : -1;
    const breakEndMin   = config.useBreak ? Utils.timeToMin(config.breakEnd)   : -1;

    // Séparer matchs déjà planifiés (terminés/en cours) et matchs à placer
    const alreadyScheduled = allMatches.filter(m =>
      m.scheduledTime && (m.status === 'finished' || m.status === 'running')
    );
    const toSchedule = allMatches.filter(m =>
      !m.scheduledTime || (m.status !== 'finished' && m.status !== 'running')
    );

    // Busy map équipes : créneau → Set(teamIds)
    const busyTeams = {};
    // Busy map terrains : créneau → Set(courtIds)
    const busyCourts = {};
    // Last match end time per team (minutes from midnight)
    const teamLastEndMin = {};
    // Match count per team
    const teamMatchCount = {};

    // Récupérer les contraintes de repos selon le format actif
    const activeFormat = (t.settings?.matchFormats || []).find(f => f.id === t.settings?.game?.activeFormatId);
    const restAfterMin = activeFormat?.restAfterMin || 0;
    const maxMatchesDay = (() => {
      if (typeof FormatsModule !== 'undefined' && activeFormat?.fftCode) {
        const constraints = FormatsModule.getFormatConstraints?.(activeFormat.id);
        return constraints?.maxMatchesDay || 99;
      }
      return 99;
    })();

    const markBusy = (teamIds, courtId, time, duration) => {
      if (!busyTeams[time]) busyTeams[time] = new Set();
      if (!busyCourts[time]) busyCourts[time] = new Set();
      teamIds.forEach(id => {
        busyTeams[time].add(id);
        const endMin = Utils.timeToMin(time) + (duration || config.duration);
        if (!teamLastEndMin[id] || endMin > teamLastEndMin[id]) teamLastEndMin[id] = endMin;
        teamMatchCount[id] = (teamMatchCount[id] || 0) + 1;
      });
      if (courtId) busyCourts[time].add(courtId);
    };

    // Pré-remplir avec les matchs déjà planifiés
    alreadyScheduled.forEach(m => {
      markBusy([m.team1Id, m.team2Id].filter(Boolean), m.courtId, m.scheduledTime);
    });

    const isConflict = (teamIds, courtId, time, roundTeams, roundCourts) => {
      // Conflit avec matchs déjà planifiés précédemment
      if (busyTeams[time] && teamIds.some(id => busyTeams[time].has(id))) return true;
      if (courtId && busyCourts[time] && busyCourts[time].has(courtId)) return true;
      // Conflit dans le round actuel (matchs déjà assignés ce créneau)
      if (teamIds.some(id => roundTeams.has(id))) return true;
      if (courtId && roundCourts.has(courtId)) return true;
      // Temps de repos FFT
      if (restAfterMin > 0) {
        const slotMin = Utils.timeToMin(time);
        for (const id of teamIds) {
          if (teamLastEndMin[id] && slotMin < teamLastEndMin[id] + restAfterMin) return true;
        }
      }
      // Max matchs par jour
      if (maxMatchesDay < 99) {
        for (const id of teamIds) {
          if ((teamMatchCount[id] || 0) >= maxMatchesDay) return true;
        }
      }
      return false;
    };

    const adjustForBreak = (time) => {
      if (!config.useBreak) return time;
      const slotMin = Utils.timeToMin(time);
      const matchEndMin = slotMin + config.duration;
      if (slotMin < breakEndMin && matchEndMin > breakStartMin) {
        return config.breakEnd;
      }
      return time;
    };

    // Réordonner pour éviter matchs consécutifs entre poules
    const remaining = optimizeMatchOrder([...toSchedule]);

    let currentTime = adjustForBreak(config.startTime);
    let safetyCounter = 0;

    while (remaining.length > 0 && safetyCounter < 500) {
      safetyCounter++;

      // Check heure limite
      if (config.endTime && Utils.compareTime(currentTime, config.endTime) >= 0) {
        // Planifier quand même mais sans heure limite stricte
        // (on ne bloque pas les matchs restants)
      }

      const roundTeams = new Set();
      const roundCourts = new Set();
      let scheduledThisRound = 0;

      // Essayer de remplir chaque terrain
      for (const court of courts) {
        if (remaining.length === 0) break;

        const teamIds = [];
        // Trouver un match compatible avec ce terrain à ce créneau
        const idx = remaining.findIndex(m => {
          const teams = [m.team1Id, m.team2Id].filter(Boolean);
          return !isConflict(teams, court.id, currentTime, roundTeams, roundCourts);
        });

        if (idx === -1) continue; // Aucun match possible sur ce terrain ce créneau

        const [m] = remaining.splice(idx, 1);
        m.courtId = court.id;
        m.scheduledTime = currentTime;
        const teams = [m.team1Id, m.team2Id].filter(Boolean);
        teams.forEach(id => roundTeams.add(id));
        roundCourts.add(court.id);
        scheduledThisRound++;
      }

      if (scheduledThisRound === 0) {
        // Aucun match placé ce créneau → avancer d'un slot pour éviter boucle infinie
        currentTime = adjustForBreak(Utils.addMinutes(currentTime, slotDuration));
        continue;
      }

      // Marquer tous les matchs du round comme occupés
      roundTeams.forEach(id => {
        if (!busyTeams[currentTime]) busyTeams[currentTime] = new Set();
        busyTeams[currentTime].add(id);
        const endMin = Utils.timeToMin(currentTime) + config.duration;
        if (!teamLastEndMin[id] || endMin > teamLastEndMin[id]) teamLastEndMin[id] = endMin;
        teamMatchCount[id] = (teamMatchCount[id] || 0) + 1;
      });
      roundCourts.forEach(cid => {
        if (!busyCourts[currentTime]) busyCourts[currentTime] = new Set();
        busyCourts[currentTime].add(cid);
      });

      // Avancer au prochain créneau
      currentTime = adjustForBreak(Utils.addMinutes(currentTime, slotDuration));
    }

    // Sauvegarder
    App.saveTournament(t);
    App.modal.close();

    // Avertissements post-génération
    const lateTimes = toSchedule.filter(m => m.scheduledTime && Utils.timeToMin(m.scheduledTime) >= 0 && Utils.compareTime(m.scheduledTime, config.endTime) > 0);
    if (lateTimes.length > 0) {
      setTimeout(() => App.toast(`⚠️ ${lateTimes.length} match(s) planifiés après l'heure limite (${config.endTime}). Ajoutez des terrains ou réduisez la durée des matchs.`, 'warning', 8000), 400);
    }

    App.toast(`Planning généré — ${toSchedule.length} matchs planifiés sur ${courts.length} terrain(s)${restAfterMin > 0 ? ` (repos ${restAfterMin}min appliqué)` : ''}`, 'success');
    _renderPage();
  };

  // ── Optimisation de l'ordre des matchs (interleave des poules) ─
  const optimizeMatchOrder = (matches) => {
    // Grouper par poule
    const byPool = {};
    const nonPool = [];
    matches.forEach(m => {
      if (m.poolId) {
        if (!byPool[m.poolId]) byPool[m.poolId] = [];
        byPool[m.poolId].push(m);
      } else {
        nonPool.push(m);
      }
    });

    // Interleaver les poules pour que les matchs se succèdent de poules différentes
    const poolGroups = Object.values(byPool);
    const result = [];
    const maxLen = Math.max(...poolGroups.map(g => g.length), 0);
    for (let i = 0; i < maxLen; i++) {
      poolGroups.forEach(g => { if (i < g.length) result.push(g[i]); });
    }
    return [...result, ...nonPool];
  };

  // ── Organigramme : poules → tableau final ─────────────────────
  const renderOrgChart = (t) => {
    const pools = t.pools || [];
    const teams = t.teams || [];
    const matches = t.matches || [];
    const bracket = t.bracket || null;
    const classements = t.classements || [];

    const getTeamName = (id) => {
      const tm = teams.find(x => x.id === id);
      return tm?.name || '?';
    };

    const computePoolStandings = (pool) => {
      const poolMatches = matches.filter(m => m.poolId === pool.id && m.status === 'finished');
      const teamStats = (pool.teamIds || []).map(id => {
        let wins = 0, losses = 0, points = 0, played = 0;
        poolMatches.filter(m => m.team1Id === id || m.team2Id === id).forEach(m => {
          played++;
          if (m.winnerId === id) { wins++; points += 3; }
          else if (m.winnerId) losses++;
          else points++;
        });
        return { id, name: getTeamName(id), wins, losses, points, played };
      }).sort((a, b) => b.points - a.points || b.wins - a.wins);
      return teamStats;
    };

    const poolFinished = pools.length > 0 && pools.every(p => {
      const pm = matches.filter(m => m.poolId === p.id);
      return pm.length > 0 && pm.every(m => m.status === 'finished');
    });

    const qualCount = t.settings?.game?.qualificationCount || 1;

    return `
      <div style="overflow-x:auto">
        <!-- Phase de poules -->
        <div style="margin-bottom:var(--space-6)">
          <h3 style="font-size:var(--font-size-base);font-weight:700;margin-bottom:var(--space-4);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:1px">🔵 Phase de poules</h3>
          ${pools.length === 0 ? '<div class="alert alert-neutral">Aucune poule configurée.</div>' : `
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:var(--space-4)">
            ${pools.map((pool, pi) => {
              const standings = computePoolStandings(pool);
              const poolMatches = matches.filter(m => m.poolId === pool.id);
              const finished = poolMatches.filter(m => m.status === 'finished').length;
              const colors = ['#3b82f6','#8b5cf6','#ec4899','#f59e0b','#10b981'];
              const color = colors[pi % colors.length];
              return `
                <div style="border:2px solid ${color}20;border-radius:var(--radius-lg);overflow:hidden">
                  <div style="background:${color};color:white;padding:8px 16px;font-weight:700;font-size:var(--font-size-sm);display:flex;justify-content:space-between">
                    <span>${Utils.escHtml(pool.name)}</span>
                    <span style="opacity:0.8;font-size:11px">${finished}/${poolMatches.length} matchs</span>
                  </div>
                  <div>
                    ${standings.map((s, i) => `
                      <div style="padding:8px 16px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--color-border-light);${i < qualCount ? 'background:var(--color-success-bg)' : ''}">
                        <span style="font-size:12px;min-width:16px;text-align:center">${i < qualCount ? '✅' : ''}</span>
                        <span style="font-size:var(--font-size-sm);font-weight:${i < qualCount ? '700' : '400'};flex:1">${Utils.escHtml(s.name)}</span>
                        <span style="font-size:11px;color:var(--color-text-muted)">${s.played}J</span>
                        <span style="font-size:12px;font-weight:700;color:var(--color-primary)">${s.points}pts</span>
                      </div>`).join('')}
                  </div>
                </div>`;
            }).join('')}
          </div>`}
        </div>

        ${poolFinished && bracket ? `
          <div style="text-align:center;margin:var(--space-4) 0;color:var(--color-text-muted)">
            <div style="font-size:2rem">⬇️</div>
            <div style="font-size:var(--font-size-sm);font-weight:600;margin-top:4px">Qualification → Phase finale</div>
          </div>

          <div style="margin-bottom:var(--space-6)">
            <h3 style="font-size:var(--font-size-base);font-weight:700;margin-bottom:var(--space-4);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:1px">🏆 Tableau principal</h3>
            <div style="display:flex;gap:var(--space-4);overflow-x:auto;padding-bottom:var(--space-2)">
              ${(() => {
                const roundNames = ['1/4 de finale','1/2 finale','Finale'];
                return (bracket.rounds || []).map((round, r) => `
                  <div style="min-width:180px;flex:1">
                    <div style="font-size:11px;color:var(--color-text-muted);font-weight:700;text-align:center;margin-bottom:var(--space-3);text-transform:uppercase">${roundNames[r] || 'Tour '+(r+1)}</div>
                    <div style="display:flex;flex-direction:column;gap:var(--space-3)">
                      ${(round.matchIds || []).map(id => {
                        const m = matches.find(x => x.id === id);
                        if (!m) return '';
                        return `<div style="background:var(--color-bg-alt);border-radius:var(--radius-md);overflow:hidden;border:1px solid ${m.status==='finished'?'var(--color-success)':'var(--color-border)'}">
                          <div style="padding:8px 12px;border-bottom:1px solid var(--color-border-light);${m.winnerId===m.team1Id?'background:var(--color-success-bg)':''}">
                            <span style="font-size:var(--font-size-sm);font-weight:${m.winnerId===m.team1Id?'700':'400'}">${m.team1Id ? Utils.escHtml(getTeamName(m.team1Id)) : '<em style="opacity:0.4">À déterm.</em>'}</span>
                          </div>
                          <div style="padding:8px 12px;${m.winnerId===m.team2Id?'background:var(--color-success-bg)':''}">
                            <span style="font-size:var(--font-size-sm);font-weight:${m.winnerId===m.team2Id?'700':'400'}">${m.team2Id ? Utils.escHtml(getTeamName(m.team2Id)) : '<em style="opacity:0.4">À déterm.</em>'}</span>
                          </div>
                        </div>`;
                      }).join('')}
                    </div>
                  </div>`).join('');
              })()}
            </div>
          </div>

          ${classements.length > 0 ? `
          <div>
            <h3 style="font-size:var(--font-size-base);font-weight:700;margin-bottom:var(--space-4);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:1px">📊 Classements</h3>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:var(--space-4)">
              ${classements.map(cls => {
                const clsMatches = matches.filter(m => m.type === 'classement' && m.classementId === cls.id);
                const done = clsMatches.filter(m => m.status === 'finished').length;
                return `<div style="border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-3)">
                  <div style="font-weight:700;font-size:var(--font-size-sm);margin-bottom:4px">📊 ${Utils.escHtml(cls.label)}</div>
                  <div style="font-size:11px;color:var(--color-text-muted)">${done}/${clsMatches.length} matchs terminés</div>
                </div>`;
              }).join('')}
            </div>
          </div>` : ''}
        ` : poolFinished ? `
          <div class="alert alert-info">
            ℹ️ Phase de poules terminée. <button class="btn btn-primary btn-sm" onclick="App.navigate('bracket')">🏆 Générer les tableaux</button>
          </div>` : `
          <div class="alert alert-neutral" style="text-align:center">
            L'organigramme complet s'affichera une fois la phase de poules terminée.
          </div>`}
      </div>`;
  };

  // ── Recalage intelligent depuis maintenant ─────────────────────
  const rescheduleFromNow = async () => {
    const t = App.getTournament();
    const toReschedule = (t.matches || []).filter(m => m.status === 'scheduled');
    if (toReschedule.length === 0) {
      App.toast('Aucun match à recaler', 'info');
      return;
    }

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    await App.confirm(
      'Recaler le planning',
      `${toReschedule.length} match(s) seront repositionnés à partir de ${currentTime} en respectant les contraintes (terrains, repos).`,
      { icon: '⏰', okLabel: 'Recaler', okClass: 'btn-primary' }
    ).then(ok => {
      if (!ok) return;

      const courts = (t.settings?.courts || []).filter(c => c.available);
      if (courts.length === 0) { App.toast('Aucun terrain disponible', 'error'); return; }

      const [nowH, nowM] = currentTime.split(':').map(Number);
      let slotMin = nowH * 60 + nowM;

      const courtLastEnd = {};
      courts.forEach(c => { courtLastEnd[c.id] = slotMin; });

      const sorted = [...toReschedule].sort((a, b) => {
        const [ah, am] = (a.scheduledTime || '00:00').split(':').map(Number);
        const [bh, bm] = (b.scheduledTime || '00:00').split(':').map(Number);
        return (ah * 60 + am) - (bh * 60 + bm);
      });

      const fmt = t.settings?.matchFormats?.find(f => f.id === t.settings?.game?.activeFormatId) || { estimatedDuration: 45 };
      const dur = fmt.estimatedDuration || 45;

      sorted.forEach(match => {
        const courtId = match.courtId || courts[0].id;
        const start = Math.max(courtLastEnd[courtId] || slotMin, slotMin);
        const endMin = start + dur;
        const h = Math.floor(start / 60), m = start % 60;
        const idx = t.matches.findIndex(x => x.id === match.id);
        if (idx !== -1) {
          t.matches[idx] = { ...t.matches[idx], scheduledTime: `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}` };
        }
        courtLastEnd[courtId] = endMin;
      });

      App.saveTournament(t);
      _renderPage();
      App.toast(`${toReschedule.length} match(s) recalés depuis ${currentTime}.`, 'success');
    });
  };

  return { render };

})();
