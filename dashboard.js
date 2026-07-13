'use strict';

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD MODULE
   ═══════════════════════════════════════════════════════════════ */

const DashboardModule = (() => {

  let _refreshInterval = null;

  // ── Calculs ────────────────────────────────────────────────────
  const computeStats = (t) => {
    const players = App.getPlayers(t);
    const teams = t.teams || [];
    const matches = t.matches || [];
    const courts = t.settings?.courts || [];
    const s = t.settings || {};
    const fmt = (s.game?.matchFormats || s.matchFormats || []).find(f => f.id === s.game?.activeFormatId)
              || { estimatedDuration: 45 };

    const totalMatches = matches.length;
    const finishedMatches = matches.filter(m => m.status === 'finished').length;
    const runningMatches = matches.filter(m => m.status === 'running').length;
    const scheduledMatches = matches.filter(m => m.status === 'scheduled' || !m.status).length;

    // Prochain match
    const nextMatches = matches
      .filter(m => m.status !== 'finished' && m.scheduledTime)
      .sort((a, b) => Utils.compareTime(a.scheduledTime, b.scheduledTime));
    const nextMatch = nextMatches[0] || null;

    // Temps restant
    const remainingMatches = totalMatches - finishedMatches;
    const activeCourts = courts.filter(c => c.available).length || 1;
    const remainingMinutes = Math.ceil(remainingMatches / activeCourts) * (fmt.estimatedDuration || 45);

    // Heure estimée de fin
    //
    // ATTENTION : Utils.minToTime() (utilisée par Utils.addMinutes()) calcule
    // l'heure avec "% 24" et ne renvoie donc qu'un horaire dans la journée,
    // sans jamais indiquer qu'on est passé au(x) jour(s) suivant(s). Dès que
    // le temps total estimé (matchs déjà joués + matchs restants) dépasse
    // 24h — ce qui arrive vite avec beaucoup de matchs et peu de terrains —
    // l'heure "bouclait" et affichait une fin antérieure au début (ex:
    // "Fin estimée : 08:15" pour un début à 09:00), ce qui n'a aucun sens.
    // On calcule donc ici le dépassement en jours et on l'affiche
    // explicitement, plutôt que de laisser l'heure boucler silencieusement.
    const startTime = s.tournament?.startTime || '09:00';
    const matchDuration = fmt.estimatedDuration || 45;
    const currentMinutes = finishedMatches * matchDuration;
    const totalMinutesNeeded = currentMinutes + remainingMinutes;
    const endMinAbsolute = Utils.timeToMin(startTime) + totalMinutesNeeded;
    const daysOver = Math.floor(endMinAbsolute / 1440);
    const estimatedEndTime = Utils.minToTime(endMinAbsolute) + (daysOver > 0 ? ` (+${daysOver}j)` : '');

    // Progression
    const progress = totalMatches > 0 ? Math.round((finishedMatches / totalMatches) * 100) : 0;

    return {
      players: players.length,
      teams: teams.length,
      courts: courts.filter(c => c.available).length,
      totalMatches, finishedMatches, runningMatches, scheduledMatches,
      nextMatch, remainingMinutes, estimatedEndTime, progress,
      pools: (t.pools || []).length
    };
  };

  const getTeamName = (t, teamId) => {
    const team = (t.teams || []).find(tm => tm.id === teamId);
    if (!team) return '?';
    if (team.name) return team.name;
    return team.playerIds?.map(pid => {
      const p = App.getPlayers(t).find(pl => pl.id === pid);
      return p ? Utils.fullName(p) : '?';
    }).join(' / ') || '—';
  };

  const getCourtName = (t, courtId) => {
    const court = (t.settings?.courts || []).find(c => c.id === courtId);
    return court?.name || courtId || '—';
  };

  // ── Rendu principal ────────────────────────────────────────────
  const render = (container) => {
    const t = App.getTournament();

    // Bannière de configuration si le tournoi n'a jamais été nommé
    const nameIsDefault = !t.settings?.tournament?.name || t.settings.tournament.name === 'Tournoi de Padel';
    const setupBanner = nameIsDefault ? `
      <div style="background:linear-gradient(135deg,var(--color-primary),var(--color-secondary));border-radius:var(--radius-xl);padding:var(--space-5) var(--space-6);display:flex;align-items:center;gap:var(--space-4);margin-bottom:var(--space-5);color:white">
        <div style="font-size:2.5rem;flex-shrink:0">🏆</div>
        <div style="flex:1">
          <div style="font-size:var(--font-size-lg);font-weight:800;margin-bottom:4px">Configurez votre tournoi</div>
          <div style="font-size:var(--font-size-sm);opacity:0.85">Donnez un nom à votre tournoi, choisissez la date, les terrains et le format de jeu.</div>
        </div>
        <button class="btn" id="btn-setup-tournament"
          style="background:white;color:var(--color-primary);font-weight:700;white-space:nowrap;flex-shrink:0">
          ⚙️ Configurer
        </button>
      </div>` : '';

    const stats = computeStats(t);
    const s = t.settings?.tournament || {};

    container.innerHTML = `
      <div class="animate-fade-in">
        ${setupBanner}
        <!-- Hero Banner -->
        <div class="card mb-4 dashboard-hero" style="background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%); color: white; border-color: transparent;">
          <div class="card-body hero-body" style="display:flex;align-items:center;gap:var(--space-5)">
            ${s.logo ? `<img src="${s.logo}" class="hero-icon" style="height:80px;width:80px;object-fit:contain;border-radius:var(--radius-md);background:rgba(255,255,255,.15);padding:8px;" alt="Logo">` :
              `<div class="hero-icon" style="font-size:3.5rem">🎾</div>`}
            <div style="flex:1">
              <h2 style="font-size:var(--font-size-2xl);font-weight:800;color:white;margin-bottom:4px">
                ${Utils.escHtml(s.name || 'Tournoi de Padel')}
              </h2>
              <div style="color:rgba(255,255,255,0.8);font-size:var(--font-size-sm)">
                ${s.date ? Utils.formatDate(s.date) : ''}
                ${s.venue ? ` • ${Utils.escHtml(s.venue)}` : ''}
              </div>
              <div style="margin-top:var(--space-3)">
                <div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:6px">
                  <span style="color:rgba(255,255,255,0.7);font-size:var(--font-size-xs)">Progression</span>
                  <span style="color:white;font-weight:700;font-size:var(--font-size-xs)">${stats.progress}%</span>
                </div>
                <div style="height:6px;background:rgba(255,255,255,0.2);border-radius:99px;overflow:hidden;width:280px;max-width:100%">
                  <div style="height:100%;width:${stats.progress}%;background:rgba(255,255,255,0.9);border-radius:99px;transition:width 0.5s ease"></div>
                </div>
              </div>
            </div>
            <div class="hero-right" style="text-align:right;color:rgba(255,255,255,0.8);font-size:var(--font-size-sm)">
              <div>Début : <b style="color:white">${s.startTime || '—'}</b></div>
              <div>Fin estimée : <b style="color:white">${stats.estimatedEndTime || '—'}</b></div>
              ${stats.remainingMinutes > 0 ? `<div>Temps restant : <b style="color:#fbbf24">${Utils.durationText(stats.remainingMinutes)}</b></div>` : ''}
            </div>
          </div>
        </div>

        <!-- Stats -->
        <div class="stats-grid">
          ${statCard('Joueurs', stats.players, '👥', 'blue', 'Participants inscrits')}
          ${statCard('Équipes', stats.teams, '🤝', 'purple', 'Équipes formées')}
          ${statCard('Terrains', stats.courts, '🏟️', 'teal', 'Disponibles')}
          ${statCard('Matchs total', stats.totalMatches, '📋', 'orange', 'Planifiés')}
          ${statCard('Terminés', stats.finishedMatches, '✅', 'green', `${stats.progress}% du tournoi`)}
          ${statCard('En cours', stats.runningMatches, '⚡', 'red', 'Sur les terrains')}
          ${statCard('Poules', stats.pools, '🔵', 'blue', 'Groupes')}
          ${statCard('À jouer', stats.scheduledMatches, '⏳', 'orange', 'Matchs restants')}
        </div>

        <!-- Dashboard grid -->
        <div class="dashboard-grid">
          <!-- Colonne principale -->
          <div style="display:flex;flex-direction:column;gap:var(--space-5)">
            ${renderMatchesSection(t, stats)}
            ${renderCourtStatus(t)}
          </div>
          <!-- Colonne latérale -->
          <div style="display:flex;flex-direction:column;gap:var(--space-5)">
            ${renderNextMatch(t, stats)}
            ${renderQuickActions(t)}
            ${renderRecentAudit()}
          </div>
        </div>
      </div>`;

    // Auto-refresh toutes les 60s (recalcule "Fin estimée", temps restant, etc.
    // même si rien n'a changé côté Firestore — ces valeurs dépendent aussi de
    // l'heure actuelle). Le callback était vide auparavant ("auto-refresh
    // disabled"), ce qui figeait la Fin estimée à sa valeur du premier
    // rendu. On protège le re-rendu par une double vérification : le tableau
    // de bord doit toujours être la page affichée (sinon on écraserait une
    // autre page avec le contenu du dashboard — cause probable d'un
    // clignotement déjà observé) et le conteneur doit toujours être attaché
    // au DOM ; sinon on arrête proprement l'intervalle.
    if (_refreshInterval) clearInterval(_refreshInterval);
    _refreshInterval = setInterval(() => {
      if (App.getCurrentPage() !== 'dashboard' || !document.body.contains(container)) {
        clearInterval(_refreshInterval);
        _refreshInterval = null;
        return;
      }
      render(container);
    }, 60000);

    // Bouton de configuration du tournoi (bannière)
    container.querySelector('#btn-setup-tournament')?.addEventListener('click', () => {
      App.wizard.show(App.getTournament());
    });

    // Actions rapides
    container.querySelectorAll('[data-navigate]').forEach(el => {
      el.addEventListener('click', () => App.navigate(el.dataset.navigate));
    });
  };

  const statCard = (label, value, icon, color, sub) => `
    <div class="stat-card stat-${color}">
      <div class="stat-card-icon"><span style="font-size:1.3rem">${icon}</span></div>
      <div class="stat-card-value">${value}</div>
      <div class="stat-card-label">${label}</div>
      ${sub ? `<div class="stat-card-sub">${Utils.escHtml(sub)}</div>` : ''}
    </div>`;

  const renderMatchesSection = (t, stats) => {
    const matches = (t.matches || [])
      .filter(m => m.status === 'running' || m.status === 'scheduled' || m.status === 'finished')
      .sort((a, b) => {
        const order = { running: 0, scheduled: 1, finished: 2 };
        return (order[a.status] ?? 1) - (order[b.status] ?? 1)
            || Utils.compareTime(a.scheduledTime || '99:99', b.scheduledTime || '99:99');
      })
      .slice(0, 8);

    if (matches.length === 0) return `
      <div class="card">
        <div class="card-header"><span class="card-title">📋 Matchs</span></div>
        <div class="card-body"><div class="empty-state" style="padding:var(--space-8) 0">
          <div class="empty-state-icon">📋</div>
          <h3>Aucun match planifié</h3>
          <p>Créez les équipes et générez le planning pour commencer.</p>
          <div style="display:flex;gap:var(--space-2);margin-top:var(--space-4)">
            <button class="btn btn-primary" data-navigate="teams">Créer les équipes</button>
            <button class="btn btn-secondary" data-navigate="schedule">Planning</button>
          </div>
        </div></div>
      </div>`;

    return `
      <div class="card">
        <div class="card-header">
          <span class="card-title">📋 Matchs récents / en cours</span>
          <button class="btn btn-sm btn-ghost" data-navigate="scores">Voir tous →</button>
        </div>
        <div class="card-body" style="padding:0">
          ${matches.map(m => renderMatchRow(t, m)).join('')}
        </div>
      </div>`;
  };

  const renderMatchRow = (t, m) => {
    const t1 = getTeamName(t, m.team1Id);
    const t2 = getTeamName(t, m.team2Id);
    const court = getCourtName(t, m.courtId);
    const statusClass = m.status === 'running' ? 'badge-warning' : m.status === 'finished' ? 'badge-success' : 'badge-neutral';
    const statusLabel = m.status === 'running' ? '⚡ En cours' : m.status === 'finished' ? '✅ Terminé' : '⏳ Planifié';

    let scoreHtml = '';
    if (m.status === 'finished' && m.score) {
      const sc = m.score;
      scoreHtml = sc.sets?.map(s => `${s.team1}-${s.team2}`).join(' / ') || '';
    }

    return `
      <div class="timeline-item">
        <span class="timeline-court">${Utils.escHtml(court)}</span>
        <div class="timeline-teams">
          <div>${Utils.escHtml(t1)}</div>
          <div style="color:var(--color-text-faint);font-size:11px">vs ${Utils.escHtml(t2)}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          ${m.scheduledTime ? `<span class="timeline-time">${m.scheduledTime}</span>` : ''}
          ${scoreHtml ? `<span class="timeline-score">${Utils.escHtml(scoreHtml)}</span>` : ''}
          <span class="badge ${statusClass}">${statusLabel}</span>
        </div>
      </div>`;
  };

  const renderCourtStatus = (t) => {
    const courts = t.settings?.courts || [];
    if (courts.length === 0) return '';
    const matches = t.matches || [];

    return `
      <div class="card">
        <div class="card-header"><span class="card-title">🏟️ État des terrains</span></div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:var(--space-3)">
            ${courts.map(court => {
              const currentMatch = matches.find(m => m.courtId === court.id && m.status === 'running');
              const nextMatch = matches.find(m => m.courtId === court.id && m.status === 'scheduled');
              const available = !currentMatch;

              return `
                <div style="border:2px solid ${available ? 'var(--color-success)' : 'var(--color-warning)'};
                            border-radius:var(--radius-md);padding:var(--space-3);background:${available ? 'var(--color-success-bg)' : 'var(--color-warning-bg)'}">
                  <div style="font-weight:700;font-size:var(--font-size-sm);margin-bottom:4px">${Utils.escHtml(court.name)}</div>
                  ${!court.available ? `<span class="badge badge-danger">Indisponible</span>` :
                    currentMatch ? `
                      <span class="badge badge-warning badge-dot">En jeu</span>
                      <div style="font-size:11px;color:var(--color-text-muted);margin-top:4px">
                        ${Utils.escHtml(getTeamName(t, currentMatch.team1Id))} vs ${Utils.escHtml(getTeamName(t, currentMatch.team2Id))}
                      </div>` :
                    nextMatch ? `
                      <span class="badge badge-neutral">Prochain : ${nextMatch.scheduledTime}</span>` :
                    `<span class="badge badge-success badge-dot">Disponible</span>`
                  }
                </div>`;
            }).join('')}
          </div>
        </div>
      </div>`;
  };

  const renderNextMatch = (t, stats) => {
    const m = stats.nextMatch;
    if (!m) return `
      <div class="card">
        <div class="card-header"><span class="card-title">⏭️ Prochain match</span></div>
        <div class="card-body text-center text-muted" style="padding:var(--space-6)">
          ${stats.finishedMatches === stats.totalMatches && stats.totalMatches > 0
            ? '🎉 Tournoi terminé !'
            : 'Aucun match planifié'}
        </div>
      </div>`;

    return `
      <div class="card" style="border-color:var(--color-primary)">
        <div class="card-header" style="background:var(--color-primary-50)">
          <span class="card-title" style="color:var(--color-primary)">⏭️ Prochain match</span>
          <span class="badge badge-primary">${m.scheduledTime || '—'}</span>
        </div>
        <div class="card-body" style="text-align:center;padding:var(--space-5)">
          <div style="font-size:var(--font-size-lg);font-weight:700;margin-bottom:var(--space-2)">
            ${Utils.escHtml(getTeamName(t, m.team1Id))}
          </div>
          <div style="font-size:var(--font-size-xs);color:var(--color-text-faint);font-weight:700;margin-bottom:var(--space-2)">VS</div>
          <div style="font-size:var(--font-size-lg);font-weight:700;margin-bottom:var(--space-3)">
            ${Utils.escHtml(getTeamName(t, m.team2Id))}
          </div>
          <span class="badge badge-neutral">${Utils.escHtml(getCourtName(t, m.courtId))}</span>
        </div>
      </div>`;
  };

  const renderQuickActions = (t) => `
    <div class="card">
      <div class="card-header"><span class="card-title">⚡ Actions rapides</span></div>
      <div class="card-body" style="display:flex;flex-direction:column;gap:var(--space-2)">
        <button class="btn btn-primary w-full" data-navigate="scores">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          Saisir des scores
        </button>
        <button class="btn btn-secondary w-full" data-navigate="schedule">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Voir le planning
        </button>
        <button class="btn btn-secondary w-full" data-navigate="rankings">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          Classements
        </button>
        <button class="btn btn-secondary w-full" id="btn-fullscreen-dash">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
          Affichage public
        </button>
      </div>
    </div>`;

  const renderRecentAudit = () => {
    const logs = Audit.getLogs(5);
    if (logs.length === 0) return '';
    return `
      <div class="card">
        <div class="card-header">
          <span class="card-title">📜 Activité récente</span>
        </div>
        <div class="card-body" style="padding:var(--space-2) 0">
          ${logs.map(l => `
            <div style="display:flex;align-items:flex-start;gap:var(--space-2);padding:var(--space-2) var(--space-4);border-bottom:1px solid var(--color-border-light)">
              <span>${l.icon}</span>
              <div style="flex:1">
                <div style="font-size:var(--font-size-xs);font-weight:600">${Utils.escHtml(l.actionLabel)} — ${Utils.escHtml(l.label)}</div>
                ${l.details ? `<div style="font-size:11px;color:var(--color-text-muted)">${Utils.escHtml(l.details)}</div>` : ''}
              </div>
              <div style="font-size:10px;color:var(--color-text-faint);white-space:nowrap">${Utils.formatTimestamp(l.timestamp)}</div>
            </div>`).join('')}
        </div>
      </div>`;
  };

  return { render };
})();
