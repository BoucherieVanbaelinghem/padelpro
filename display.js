'use strict';

/* ═══════════════════════════════════════════════════════════════
   DISPLAY MODULE — Affichage TV / Projecteur + QR Code
   ═══════════════════════════════════════════════════════════════ */

const DisplayModule = (() => {

  let _interval = null;
  let _clockInterval = null;
  let _container = null;
  let _lastCallNotif = null; // ID du dernier match annoncé

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
    return c?.name || id || '?';
  };

  // ── Page principale ─────────────────────────────────────────────
  const _renderPage = () => {
    const t = App.getTournament();
    const courts = (t.settings?.courts || []).filter(c => c.available);
    const matches = t.matches || [];

    _container.innerHTML = `
      <div class="animate-fade-in">
        <div class="page-header">
          <div class="page-header-left">
            <h2 class="page-title">📺 Affichage public</h2>
            <p class="page-subtitle">Mode TV / Projecteur • QR Code joueurs</p>
          </div>
          <div class="page-header-actions">
            <button class="btn btn-secondary" id="btn-call-next">🔔 Appeler prochain match</button>
            <button class="btn btn-primary" id="btn-open-display">⛶ Plein écran</button>
          </div>
        </div>

        <!-- Appel de match actif -->
        <div id="match-call-banner" style="display:none;margin-bottom:var(--space-4)"></div>

        <!-- Cartes terrains -->
        <div class="display-courts-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:var(--space-4);margin-bottom:var(--space-5)">
          ${courts.map(c => renderCourtCard(t, c)).join('')}
          ${courts.length === 0 ? '<div class="card"><div class="card-body"><div class="empty-state"><div class="empty-state-icon">🏟️</div><h3>Aucun terrain configuré</h3><p>Ajoutez des terrains dans Paramètres → Terrains.</p></div></div></div>' : ''}
        </div>

        <!-- QR Code + Prochains matchs + Soumission scores -->
        <div class="display-widgets-grid" style="display:grid;grid-template-columns:1fr 1fr 280px;gap:var(--space-4)">
          <div class="card">
            <div class="card-header"><span class="card-title">⏭️ Prochains matchs</span></div>
            <div class="card-body" style="padding:0">
              ${renderUpcomingList(t)}
            </div>
          </div>
          <div class="card">
            <div class="card-header">
              <span class="card-title">📥 Scores joueurs</span>
              ${(t.matches || []).some(m => m.proposedScore && !m.proposedScore.validated) ? `<span class="badge badge-warning" style="font-size:10px">⚡ À valider</span>` : ''}
            </div>
            <div class="card-body" style="padding:0" id="player-score-panel">
              ${_renderPlayerScorePanel(t)}
            </div>
          </div>
          <div class="card">
            <div class="card-header"><span class="card-title">📱 QR Code joueurs</span></div>
            <div class="card-body" style="text-align:center" id="qr-panel">
              ${renderQRPanel(t)}
            </div>
          </div>
        </div>
      </div>`;

    Utils.el('#btn-open-display', _container)?.addEventListener('click', openFullscreen);
    Utils.el('#btn-call-next', _container)?.addEventListener('click', callNextMatch);
    Utils.el('#btn-refresh-qr', _container)?.addEventListener('click', () => {
      Utils.el('#qr-panel', _container).innerHTML = renderQRPanel(App.getTournament());
    });
    Utils.el('#btn-export-viewer', _container)?.addEventListener('click', exportViewer);

    // Délégation (et non un binding direct) : le panneau QR est
    // regénéré dynamiquement par #btn-refresh-qr (innerHTML remplacé),
    // donc un bouton "Copier le lien" ajouté après coup ne serait jamais
    // rebindé si on l'attachait seulement ici au chargement initial.
    _container.addEventListener('click', (e) => {
      const btn = e.target.closest('#btn-copy-viewer-link');
      if (!btn) return;
      const url = btn.dataset.url;
      navigator.clipboard?.writeText(url).then(() => {
        App.toast('Lien copié !', 'success');
      }).catch(() => {
        App.toast('Impossible de copier automatiquement — sélectionnez le lien manuellement', 'warning');
      });
    });

    _container.querySelectorAll('.btn-propose-score').forEach(btn => {
      btn.addEventListener('click', () => openPlayerScoreForm(btn.dataset.id));
    });
  };

  // ── Carte terrain ───────────────────────────────────────────────
  const renderCourtCard = (t, court) => {
    const matches = t.matches || [];
    const running = matches.find(m => m.courtId === court.id && m.status === 'running');
    const scheduled = matches
      .filter(m => m.courtId === court.id && m.status === 'scheduled' && m.scheduledTime)
      .sort((a, b) => Utils.compareTime(a.scheduledTime, b.scheduledTime));
    const next = scheduled[0];
    const isFree = !running;

    if (running) {
      return `
        <div class="card" style="border:2px solid var(--color-warning);background:var(--color-warning-bg)">
          <div style="background:var(--color-warning);color:white;padding:6px 16px;font-size:11px;font-weight:700;letter-spacing:1px;border-radius:var(--radius-md) var(--radius-md) 0 0">
            ⚡ EN COURS — ${Utils.escHtml(court.name)}
          </div>
          <div class="card-body">
            <div style="font-size:var(--font-size-lg);font-weight:800;margin-bottom:4px">${Utils.escHtml(getTeamName(t, running.team1Id))}</div>
            <div style="color:var(--color-text-muted);font-size:var(--font-size-xs)">vs</div>
            <div style="font-size:var(--font-size-lg);font-weight:800;margin-bottom:var(--space-2)">${Utils.escHtml(getTeamName(t, running.team2Id))}</div>
            ${running.score?.sets ? `<div style="font-size:var(--font-size-xl);font-weight:900;color:var(--color-warning)">${running.score.sets.map(s=>`${s.team1}-${s.team2}`).join('  ')}</div>` : '<div style="color:var(--color-text-muted);font-size:var(--font-size-sm)">Score en attente…</div>'}
            ${next ? `<div style="margin-top:var(--space-3);padding-top:var(--space-2);border-top:1px dashed var(--color-border);font-size:11px;color:var(--color-text-muted)">Suivant • ${next.scheduledTime} — ${Utils.escHtml(getTeamName(t, next.team1Id))} vs ${Utils.escHtml(getTeamName(t, next.team2Id))}</div>` : ''}
          </div>
        </div>`;
    } else {
      return `
        <div class="card" style="border:2px solid ${next ? 'var(--color-primary)' : 'var(--color-border)'}">
          <div style="background:${next ? 'var(--color-primary)' : 'var(--color-border)'};color:${next ? 'white' : 'var(--color-text-muted)'};padding:6px 16px;font-size:11px;font-weight:700;letter-spacing:1px;border-radius:var(--radius-md) var(--radius-md) 0 0">
            ${next ? '🎯 PROCHAIN MATCH' : '✅ LIBRE'} — ${Utils.escHtml(court.name)}
          </div>
          <div class="card-body">
            ${next ? `
              <div style="font-size:var(--font-size-xs);color:var(--color-text-muted);margin-bottom:var(--space-1)">⏰ ${next.scheduledTime}</div>
              <div style="font-size:var(--font-size-lg);font-weight:800;margin-bottom:4px">${Utils.escHtml(getTeamName(t, next.team1Id))}</div>
              <div style="color:var(--color-text-muted);font-size:var(--font-size-xs)">vs</div>
              <div style="font-size:var(--font-size-lg);font-weight:800;margin-bottom:var(--space-2)">${Utils.escHtml(getTeamName(t, next.team2Id))}</div>
              <button class="btn btn-sm btn-primary" onclick="DisplayModule._callMatch('${next.id}','${Utils.escHtml(court.name)}')">🔔 Appeler ce match</button>
            ` : `
              <div class="display-empty-state" style="text-align:center;padding:var(--space-4)">
                <div class="display-empty-icon" style="font-size:2.5rem">✅</div>
                <div style="color:var(--color-text-muted);font-size:var(--font-size-sm);margin-top:var(--space-2)">Terrain disponible</div>
                <div style="font-size:11px;color:var(--color-text-faint);margin-top:4px">Aucun match planifié</div>
              </div>
            `}
          </div>
        </div>`;
    }
  };

  // ── Appel de match ─────────────────────────────────────────────
  const callNextMatch = () => {
    const t = App.getTournament();
    const courts = (t.settings?.courts || []).filter(c => c.available);
    let matchToCall = null;
    let courtName = '';

    // Chercher le prochain match sur un terrain libre
    for (const court of courts) {
      const running = (t.matches || []).find(m => m.courtId === court.id && m.status === 'running');
      if (running) continue;
      const next = (t.matches || [])
        .filter(m => m.courtId === court.id && m.status === 'scheduled' && m.scheduledTime)
        .sort((a, b) => Utils.compareTime(a.scheduledTime, b.scheduledTime))[0];
      if (next) { matchToCall = next; courtName = court.name; break; }
    }

    if (!matchToCall) {
      App.toast('Aucun match à appeler — tous les terrains sont occupés ou aucun match planifié', 'info');
      return;
    }
    _callMatch(matchToCall.id, courtName);
  };

  const _callMatch = (matchId, courtName) => {
    const t = App.getTournament();
    const m = (t.matches || []).find(x => x.id === matchId);
    if (!m) return;

    const banner = Utils.el('#match-call-banner', _container);
    if (!banner) return;

    banner.style.display = '';
    banner.innerHTML = `
      <div style="background:linear-gradient(135deg,var(--color-primary),var(--color-secondary));color:white;border-radius:var(--radius-lg);padding:var(--space-4) var(--space-5);display:flex;align-items:center;gap:var(--space-4);animation:pulse 1s ease-in-out 3">
        <div style="font-size:2.5rem">🔔</div>
        <div style="flex:1">
          <div style="font-size:var(--font-size-xs);opacity:0.8;letter-spacing:1px;text-transform:uppercase">Appel de match — ${Utils.escHtml(courtName)}</div>
          <div style="font-size:var(--font-size-xl);font-weight:800">${Utils.escHtml(getTeamName(t, m.team1Id))} vs ${Utils.escHtml(getTeamName(t, m.team2Id))}</div>
          <div style="font-size:var(--font-size-sm);opacity:0.8">Veuillez vous présenter sur ${Utils.escHtml(courtName)} — ${m.scheduledTime || 'maintenant'}</div>
        </div>
        <button onclick="this.parentElement.parentElement.style.display='none'" style="background:rgba(255,255,255,0.2);border:none;color:white;border-radius:50%;width:32px;height:32px;cursor:pointer;font-size:16px">✕</button>
      </div>`;

    // Auto-ferme après 30s
    setTimeout(() => { if (banner) banner.style.display = 'none'; }, 30000);
    App.toast(`🔔 ${getTeamName(t, m.team1Id)} vs ${getTeamName(t, m.team2Id)} appelés sur ${courtName}`, 'info');
  };

  // ── Liste prochains matchs ─────────────────────────────────────
  const renderUpcomingList = (t) => {
    const upcoming = (t.matches || [])
      .filter(m => m.status === 'scheduled' && m.scheduledTime)
      .sort((a, b) => Utils.compareTime(a.scheduledTime, b.scheduledTime))
      .slice(0, 10);

    if (upcoming.length === 0) return '<div style="padding:var(--space-4);text-align:center;color:var(--color-text-muted)">Aucun match à venir</div>';

    return upcoming.map(m => `
      <div style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3) var(--space-4);border-bottom:1px solid var(--color-border-light)">
        <div style="text-align:center;min-width:52px">
          <div style="font-size:var(--font-size-sm);font-weight:800;color:var(--color-primary)">${m.scheduledTime}</div>
          <div style="font-size:10px;color:var(--color-text-faint)">${m.courtId ? Utils.escHtml(getCourtName(t, m.courtId)) : '—'}</div>
        </div>
        <div style="flex:1">
          <span style="font-weight:600;font-size:var(--font-size-sm)">${Utils.escHtml(getTeamName(t, m.team1Id))}</span>
          <span style="color:var(--color-text-muted);margin:0 6px;font-size:11px">vs</span>
          <span style="font-weight:600;font-size:var(--font-size-sm)">${Utils.escHtml(getTeamName(t, m.team2Id))}</span>
        </div>
        <button class="btn btn-sm btn-ghost" onclick="DisplayModule._callMatch('${m.id}','${Utils.escHtml(m.courtId ? getCourtName(t, m.courtId) : '')}')" title="Appeler ce match">🔔</button>
      </div>`).join('');
  };

  // ── QR Code panel ───────────────────────────────────────────────
  const renderQRPanel = (t) => {
    const compact = buildCompactData(t);
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(compact))));
    const base = window.location.href.replace(/[^/]*$/, '');
    const viewerUrl = `${base}viewer.html#${b64}`;
    const isFile = window.location.protocol === 'file:';
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&ecc=M&data=${encodeURIComponent(viewerUrl)}`;

    return `
      <div>
        ${isFile ? `
          <div class="alert alert-warning" style="font-size:11px;margin-bottom:var(--space-3)">
            ⚠️ En mode fichier local, le QR Code ne fonctionne que sur cet ordinateur.<br>
            Utilisez <strong>Exporter la feuille</strong> ou ouvrez l'app via un serveur web.
          </div>` : `
          <img src="${qrApiUrl}" alt="QR Code" style="width:200px;height:200px;max-width:100%;border-radius:var(--radius-md)" onerror="this.style.display='none';document.getElementById('qr-fallback').style.display=''">
          <div id="qr-fallback" style="display:none;padding:var(--space-4);background:var(--color-bg-alt);border-radius:var(--radius-md)">
            <div style="font-size:11px;color:var(--color-text-muted);margin-bottom:var(--space-3)">⚠️ Le QR Code ne s'est pas généré (probablement trop de données pour ce tournoi). Le lien reste utilisable :</div>
            <a href="${viewerUrl}" target="_blank" rel="noopener" class="btn btn-primary btn-sm" style="width:100%;justify-content:center">🔗 Ouvrir le planning</a>
            <button class="btn btn-secondary btn-sm" id="btn-copy-viewer-link" data-url="${Utils.escHtml(viewerUrl)}" style="width:100%;justify-content:center;margin-top:var(--space-2)">📋 Copier le lien</button>
          </div>
        `}
        <div style="margin-top:var(--space-3);display:flex;flex-direction:column;gap:var(--space-2)">
          <button class="btn btn-primary btn-sm" id="btn-export-viewer">💾 Exporter la feuille de match</button>
          <button class="btn btn-secondary btn-sm" id="btn-refresh-qr">🔄 Actualiser</button>
          <div style="font-size:10px;color:var(--color-text-faint);text-align:center">Les joueurs scannent pour voir le planning en direct</div>
        </div>
      </div>`;
  };

  // ── Données compactes pour viewer ─────────────────────────────
  // IMPORTANT : les identifiants internes (team.id, court.id) sont des
  // UUID de 36 caractères. Avec 30+ équipes, les réutiliser tels quels
  // dans ce payload (encodé en base64 puis mis dans l'URL du QR Code)
  // produit une URL de plusieurs milliers de caractères — trop longue
  // pour être encodée de façon fiable en QR Code (le service externe
  // échouait silencieusement, affichant juste "QR Code indisponible").
  // On remappe donc chaque équipe/terrain vers un index court (0, 1, 2…)
  // uniquement pour ce payload compact ; viewer.html n'a besoin que de
  // clés cohérentes entre teams/courts/matches/pools, peu importe leur
  // forme exacte.
  const buildCompactData = (t) => {
    const teamIndex = {};
    const teams = {};
    (t.teams || []).forEach((tm, i) => {
      teamIndex[tm.id] = String(i);
      teams[i] = tm.name || tm.id;
    });
    const courtIndex = {};
    const courts = {};
    (t.settings?.courts || []).forEach((c, i) => {
      courtIndex[c.id] = String(i);
      courts[i] = c.name || c.id;
    });

    return {
      v: 1,
      n: t.settings?.tournament?.name || 'Tournoi de Padel',
      d: t.settings?.tournament?.date || new Date().toISOString().slice(0,10),
      teams,
      courts,
      matches: (t.matches || []).filter(m => m.scheduledTime).map(m => ({
        t: m.scheduledTime,
        c: m.courtId != null ? (courtIndex[m.courtId] ?? '') : '',
        a: m.team1Id != null ? (teamIndex[m.team1Id] ?? '') : '',
        b: m.team2Id != null ? (teamIndex[m.team2Id] ?? '') : '',
        s: m.status === 'finished' ? 'f' : m.status === 'running' ? 'r' : 'p',
        w: m.winnerId != null ? (teamIndex[m.winnerId] ?? '') : '',
        sc: m.score?.sets ? m.score.sets.map(s => `${s.team1}-${s.team2}`).join(' ') : ''
      })),
      pools: (t.pools || []).map(p => ({
        n: p.name,
        ids: (p.teamIds || []).map(id => teamIndex[id]).filter(id => id !== undefined)
      }))
    };
  };

  // ── Export viewer.html autonome ────────────────────────────────
  const exportViewer = () => {
    const t = App.getTournament();
    const compact = buildCompactData(t);
    const dataStr = JSON.stringify(compact);

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${Utils.escHtml(compact.n)} — Planning</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0f172a;color:white;font-family:system-ui,sans-serif;min-height:100vh}
.hdr{background:rgba(255,255,255,0.05);padding:16px 24px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,0.1)}
.hdr h1{font-size:1.3rem;font-weight:800}
.hdr .sub{font-size:0.8rem;color:rgba(255,255,255,0.5)}
.tabs{display:flex;gap:8px;padding:16px 24px;background:rgba(255,255,255,0.03)}
.tab{padding:8px 20px;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.6)}
.tab.active{background:#2563eb;color:white}
.content{padding:16px 24px}
.match{display:flex;align-items:center;gap:12px;padding:12px 16px;background:rgba(255,255,255,0.05);border-radius:10px;margin-bottom:8px;border-left:3px solid transparent}
.match.running{border-left-color:#f59e0b;background:rgba(245,158,11,0.1)}
.match.finished{border-left-color:#22c55e;opacity:0.75}
.match.pending{border-left-color:#3b82f6}
.time{font-size:1rem;font-weight:800;color:#60a5fa;min-width:55px}
.court{font-size:11px;color:rgba(255,255,255,0.4);min-width:55px}
.teams{flex:1;font-weight:600}
.score{font-size:1.1rem;font-weight:800;color:#4ade80}
.win{color:#4ade80}
.lose{color:rgba(255,255,255,0.4)}
.badge{padding:3px 8px;border-radius:999px;font-size:10px;font-weight:700}
.bd-f{background:rgba(34,197,94,0.2);color:#4ade80}
.bd-r{background:rgba(245,158,11,0.2);color:#fbbf24}
.bd-p{background:rgba(59,130,246,0.2);color:#93c5fd}
.pool-hdr{font-size:12px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;margin:16px 0 8px}
table{width:100%;border-collapse:collapse}
th,td{padding:8px 12px;text-align:left;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.06)}
th{color:rgba(255,255,255,0.4);font-weight:600;font-size:11px}
.sec{display:none}.sec.active{display:block}
.empty{text-align:center;padding:40px;color:rgba(255,255,255,0.3)}
</style>
</head>
<body>
<div class="hdr">
  <div><h1 id="tn"></h1><div class="sub" id="td"></div></div>
  <div style="text-align:right">
    <div style="font-size:1.3rem;font-weight:800" id="clock"></div>
    <div style="font-size:11px;color:rgba(255,255,255,0.3)">Généré le ${new Date().toLocaleDateString('fr-FR')}</div>
  </div>
</div>
<div class="tabs">
  <button class="tab active" onclick="showTab('planning')">📅 Planning</button>
  <button class="tab" onclick="showTab('scores')">🏆 Scores</button>
</div>
<div class="content">
  <div class="sec active" id="sec-planning"></div>
  <div class="sec" id="sec-scores"></div>
</div>
<script>
const D = ${dataStr};
document.getElementById('tn').textContent = D.n;
document.getElementById('td').textContent = D.d;
function showTab(t){
  document.querySelectorAll('.sec').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
  document.getElementById('sec-'+t).classList.add('active');
  event.target.classList.add('active');
}
function clock(){
  const n=new Date();
  document.getElementById('clock').textContent=n.getHours().toString().padStart(2,'0')+':'+n.getMinutes().toString().padStart(2,'0')+':'+n.getSeconds().toString().padStart(2,'0');
}
setInterval(clock,1000);clock();
// Planning
const pm = D.matches.sort((a,b)=>a.t>b.t?1:a.t<b.t?-1:0);
const byTime = {};
pm.forEach(m=>{if(!byTime[m.t])byTime[m.t]=[];byTime[m.t].push(m);});
let ph = '';
Object.keys(byTime).sort().forEach(time=>{
  ph += '<div style="font-size:11px;color:rgba(255,255,255,0.3);margin:12px 0 4px">⏰ ' + time + '</div>';
  byTime[time].forEach(m=>{
    const cls = m.s==='f'?'finished':m.s==='r'?'running':'pending';
    const bdCls = m.s==='f'?'bd-f':m.s==='r'?'bd-r':'bd-p';
    const bdLbl = m.s==='f'?'Terminé':m.s==='r'?'En cours':'Planifié';
    const t1cls = m.w===m.a?'win':m.w?'lose':'';
    const t2cls = m.w===m.b?'win':m.w?'lose':'';
    ph += '<div class="match '+cls+'"><div class="time">'+time+'</div><div class="court">'+(D.courts[m.c]||m.c||'—')+'</div><div class="teams"><span class="'+t1cls+'">'+(D.teams[m.a]||m.a)+'</span> <span style="color:rgba(255,255,255,0.3)">vs</span> <span class="'+t2cls+'">'+(D.teams[m.b]||m.b)+'</span></div>'+(m.sc?'<div class="score">'+m.sc+'</div>':'')+'<span class="badge '+bdCls+'">'+bdLbl+'</span></div>';
  });
});
document.getElementById('sec-planning').innerHTML = ph || '<div class="empty">Aucun match planifié</div>';
// Scores
const fm = D.matches.filter(m=>m.s==='f');
let sh = fm.length===0 ? '<div class="empty">Aucun match terminé</div>' : fm.map(m=>{
  const t1cls=m.w===m.a?'win':m.w?'lose':'';
  const t2cls=m.w===m.b?'win':m.w?'lose':'';
  return '<div class="match finished"><div class="time">'+m.t+'</div><div class="court">'+(D.courts[m.c]||m.c||'—')+'</div><div class="teams"><span class="'+t1cls+'">'+(D.teams[m.a]||m.a)+'</span> vs <span class="'+t2cls+'">'+(D.teams[m.b]||m.b)+'</span></div>'+(m.sc?'<div class="score">'+m.sc+'</div>':'')+'</div>';
}).join('');
document.getElementById('sec-scores').innerHTML = sh;
<\/script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(compact.n || 'tournoi').replace(/[^a-z0-9]/gi, '_')}_feuille.html`;
    a.click();
    URL.revokeObjectURL(url);
    App.toast('Feuille de match exportée !', 'success');
  };

  // ── Mode Plein Écran ────────────────────────────────────────────
  const openFullscreen = () => {
    const overlay = Utils.el('#display-overlay');
    const content = Utils.el('#display-content');
    if (!overlay || !content) return;

    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    content.innerHTML = buildFullscreenContent();

    _stopClock();
    _startClock();

    if (_interval) clearInterval(_interval);
    _interval = setInterval(() => {
      content.innerHTML = buildFullscreenContent();
      _startClock();
    }, 30000);

    Utils.el('#display-close-btn')?.addEventListener('click', close, { once: true });
  };

  const buildFullscreenContent = () => {
    const t = App.getTournament();
    const s = t.settings?.tournament || {};
    const courts = (t.settings?.courts || []).filter(c => c.available);
    const matches = t.matches || [];
    const recent = matches.filter(m => m.status === 'finished').slice(-3);
    const upcoming = matches
      .filter(m => m.status === 'scheduled' && m.scheduledTime)
      .sort((a,b) => Utils.compareTime(a.scheduledTime, b.scheduledTime))
      .slice(0, 4);

    return `
      <div style="font-family:system-ui,sans-serif;height:100%;display:flex;flex-direction:column;padding:0">
        <!-- Header -->
        <div style="background:rgba(255,255,255,0.06);padding:16px 32px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,0.1)">
          <div>
            <div style="font-size:1.8rem;font-weight:900;color:white">${Utils.escHtml(s.name || 'Tournoi de Padel')}</div>
            ${s.date ? `<div style="color:rgba(255,255,255,0.5);font-size:0.9rem">${Utils.formatDate(s.date)}</div>` : ''}
          </div>
          <div id="live-clock" style="font-size:2.5rem;font-weight:900;color:white;letter-spacing:2px;font-variant-numeric:tabular-nums"></div>
        </div>

        <!-- Terrains -->
        <div style="flex:1;display:grid;grid-template-columns:repeat(${Math.min(courts.length,4)},1fr);gap:16px;padding:20px 32px;overflow:auto">
          ${courts.map(c => {
            const running = matches.find(m => m.courtId === c.id && m.status === 'running');
            const next = matches
              .filter(m => m.courtId === c.id && m.status === 'scheduled' && m.scheduledTime)
              .sort((a,b) => Utils.compareTime(a.scheduledTime, b.scheduledTime))[0];

            if (running) return `
              <div style="background:rgba(245,158,11,0.15);border:2px solid #f59e0b;border-radius:16px;padding:24px;display:flex;flex-direction:column;gap:8px">
                <div style="font-size:11px;font-weight:700;letter-spacing:2px;color:#fbbf24;text-transform:uppercase">⚡ ${Utils.escHtml(c.name)}</div>
                <div style="font-size:1.6rem;font-weight:900;color:white">${Utils.escHtml(getTeamName(t, running.team1Id))}</div>
                <div style="font-size:0.9rem;color:rgba(255,255,255,0.4)">vs</div>
                <div style="font-size:1.6rem;font-weight:900;color:white">${Utils.escHtml(getTeamName(t, running.team2Id))}</div>
                ${running.score?.sets ? `<div style="font-size:2rem;font-weight:900;color:#fbbf24;margin-top:8px">${running.score.sets.map(s=>`${s.team1}-${s.team2}`).join('  ')}</div>` : '<div style="color:rgba(255,255,255,0.3)">En cours…</div>'}
              </div>`;

            return `
              <div style="background:rgba(255,255,255,0.04);border:2px solid ${next?'#3b82f6':'rgba(255,255,255,0.1)'};border-radius:16px;padding:24px">
                <div style="font-size:11px;font-weight:700;letter-spacing:2px;color:${next?'#60a5fa':'rgba(255,255,255,0.3)'};text-transform:uppercase">${next?'🎯 PROCHAIN':'✅ LIBRE'} — ${Utils.escHtml(c.name)}</div>
                ${next ? `
                  <div style="margin-top:12px">
                    <div style="font-size:1.5rem;font-weight:900;color:white">${Utils.escHtml(getTeamName(t, next.team1Id))}</div>
                    <div style="font-size:0.9rem;color:rgba(255,255,255,0.4)">vs</div>
                    <div style="font-size:1.5rem;font-weight:900;color:white">${Utils.escHtml(getTeamName(t, next.team2Id))}</div>
                    <div style="font-size:0.9rem;color:#60a5fa;margin-top:8px;font-weight:700">⏰ ${next.scheduledTime}</div>
                  </div>` :
                  '<div style="text-align:center;padding:32px 0;font-size:3rem;opacity:0.3">🏟️</div>'}
              </div>`;
          }).join('')}
        </div>

        <!-- Footer : récents + prochains -->
        <div style="background:rgba(255,255,255,0.04);border-top:1px solid rgba(255,255,255,0.08);padding:12px 32px;display:flex;gap:32px;overflow:hidden">
          ${recent.length > 0 ? `
            <div style="flex:1">
              <div style="font-size:10px;color:rgba(255,255,255,0.3);letter-spacing:1px;margin-bottom:8px">✅ RÉSULTATS RÉCENTS</div>
              <div style="display:flex;gap:16px;flex-wrap:wrap">
                ${recent.map(m => `
                  <div style="font-size:0.85rem;color:rgba(255,255,255,0.7)">
                    <span style="color:${m.winnerId===m.team1Id?'#4ade80':'rgba(255,255,255,0.4)'}">${Utils.escHtml(getTeamName(t, m.team1Id))}</span>
                    <span style="color:rgba(255,255,255,0.3)"> vs </span>
                    <span style="color:${m.winnerId===m.team2Id?'#4ade80':'rgba(255,255,255,0.4)'}">${Utils.escHtml(getTeamName(t, m.team2Id))}</span>
                    ${m.score?.sets ? `<span style="color:#60a5fa;margin-left:8px">${m.score.sets.map(s=>`${s.team1}-${s.team2}`).join(' ')}</span>` : ''}
                  </div>`).join('')}
              </div>
            </div>` : ''}
          ${upcoming.length > 0 ? `
            <div style="flex:1">
              <div style="font-size:10px;color:rgba(255,255,255,0.3);letter-spacing:1px;margin-bottom:8px">⏭️ À VENIR</div>
              <div style="display:flex;gap:16px;flex-wrap:wrap">
                ${upcoming.map(m => `
                  <div style="font-size:0.85rem;color:rgba(255,255,255,0.7)">
                    <span style="color:#60a5fa;font-weight:700">${m.scheduledTime}</span>
                    <span style="margin-left:8px">${Utils.escHtml(getTeamName(t, m.team1Id))} vs ${Utils.escHtml(getTeamName(t, m.team2Id))}</span>
                  </div>`).join('')}
              </div>
            </div>` : ''}
        </div>
      </div>`;
  };

  const _startClock = () => {
    _stopClock();
    const tick = () => {
      const el = Utils.el('#live-clock');
      if (!el) { clearInterval(_clockInterval); return; }
      const now = new Date();
      el.textContent = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    };
    tick();
    _clockInterval = setInterval(tick, 1000);
  };

  const _stopClock = () => {
    if (_clockInterval) { clearInterval(_clockInterval); _clockInterval = null; }
  };

  const close = () => {
    const overlay = Utils.el('#display-overlay');
    overlay?.classList.remove('active');
    overlay?.setAttribute('aria-hidden', 'true');
    if (_interval) { clearInterval(_interval); _interval = null; }
    _stopClock();
  };

  // ── Soumission de score par les joueurs ─────────────────────────
  const openPlayerScoreForm = (matchId) => {
    const t = App.getTournament();
    const m = (t.matches || []).find(x => x.id === matchId);
    if (!m) return;

    const fmt = (t.settings?.matchFormats || []).find(f => f.id === m.formatId)
             || (t.settings?.matchFormats || [])[0]
             || { sets: 1, gamesPerSet: 6 };
    const t1 = getTeamName(t, m.team1Id);
    const t2 = getTeamName(t, m.team2Id);

    const setsHtml = Array.from({ length: fmt.sets }, (_, i) => `
      <div style="display:flex;align-items:center;gap:16px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08)">
        <div style="width:60px;text-align:right;font-size:12px;color:rgba(255,255,255,0.4)">Set ${i+1}</div>
        <div style="flex:1;text-align:right"><input type="number" class="score-number-input" id="ps${i}-t1" min="0" max="${fmt.gamesPerSet+2}" value="0" style="text-align:center"></div>
        <div style="color:rgba(255,255,255,0.3);font-weight:700">—</div>
        <div style="flex:1"><input type="number" class="score-number-input" id="ps${i}-t2" min="0" max="${fmt.gamesPerSet+2}" value="0" style="text-align:center"></div>
      </div>`).join('');

    App.modal.open('📥 Proposer un score', `
      <div>
        <div style="background:rgba(37,99,235,0.1);border:1px solid rgba(37,99,235,0.3);border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:12px;color:var(--color-text-muted)">
          ℹ️ Le score proposé sera soumis à validation de l'organisateur avant d'être enregistré.
        </div>
        <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:center;margin-bottom:16px;padding:10px;background:var(--color-bg);border-radius:8px">
          <div style="font-weight:700;font-size:var(--font-size-sm);text-align:right">${Utils.escHtml(t1)}</div>
          <div style="font-size:11px;color:var(--color-text-faint)">VS</div>
          <div style="font-weight:700;font-size:var(--font-size-sm)">${Utils.escHtml(t2)}</div>
        </div>
        ${setsHtml}
        <div style="margin-top:14px;padding:10px;background:var(--color-bg);border-radius:8px">
          <div style="font-size:11px;color:var(--color-text-muted);margin-bottom:8px">Gagnant</div>
          <div style="display:flex;gap:10px">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;flex:1;padding:8px;border:2px solid var(--color-border);border-radius:8px;font-size:var(--font-size-sm)">
              <input type="radio" name="pwinner" value="${m.team1Id}"> ${Utils.escHtml(t1)}
            </label>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;flex:1;padding:8px;border:2px solid var(--color-border);border-radius:8px;font-size:var(--font-size-sm)">
              <input type="radio" name="pwinner" value="${m.team2Id}"> ${Utils.escHtml(t2)}
            </label>
          </div>
        </div>
      </div>`,
      { buttons: [
        { label: 'Annuler', class: 'btn-ghost', onClick: () => App.modal.close() },
        { label: '📤 Soumettre', class: 'btn-primary', id: 'btn-submit-proposal' }
      ]}
    );

    const autoDetect = () => {
      let w1 = 0, w2 = 0;
      for (let i = 0; i < fmt.sets; i++) {
        const v1 = parseInt(document.getElementById(`ps${i}-t1`)?.value) || 0;
        const v2 = parseInt(document.getElementById(`ps${i}-t2`)?.value) || 0;
        if (v1 > v2) w1++; else if (v2 > v1) w2++;
      }
      if (w1 > w2) {
        const r = document.querySelector(`input[name="pwinner"][value="${m.team1Id}"]`);
        if (r) r.checked = true;
      } else if (w2 > w1) {
        const r = document.querySelector(`input[name="pwinner"][value="${m.team2Id}"]`);
        if (r) r.checked = true;
      }
    };
    for (let i = 0; i < fmt.sets; i++) {
      document.getElementById(`ps${i}-t1`)?.addEventListener('input', autoDetect);
      document.getElementById(`ps${i}-t2`)?.addEventListener('input', autoDetect);
    }

    Utils.el('#btn-submit-proposal')?.addEventListener('click', () => {
      const sets = [];
      for (let i = 0; i < fmt.sets; i++) {
        sets.push({
          team1: parseInt(document.getElementById(`ps${i}-t1`)?.value) || 0,
          team2: parseInt(document.getElementById(`ps${i}-t2`)?.value) || 0
        });
      }
      const winnerId = document.querySelector('input[name="pwinner"]:checked')?.value || null;
      if (!winnerId) { App.toast('Sélectionnez le gagnant', 'warning'); return; }

      const t2 = App.getTournament();
      const match = t2.matches.find(x => x.id === matchId);
      if (match) {
        match.proposedScore = { sets, winnerId, submittedAt: Date.now(), validated: false };
      }
      App.saveTournament(t2);
      App.toast("Score soumis à l'organisateur pour validation !", 'success');
      App.modal.close();
      _renderPage();
    });
  };

  const _renderPlayerScorePanel = (t) => {
    const runningOrNext = (t.matches || [])
      .filter(m => m.status === 'running' || (m.status === 'scheduled' && m.scheduledTime))
      .sort((a, b) => {
        if (a.status === 'running' && b.status !== 'running') return -1;
        if (b.status === 'running' && a.status !== 'running') return 1;
        return Utils.compareTime(a.scheduledTime || '', b.scheduledTime || '');
      })
      .slice(0, 8);

    if (runningOrNext.length === 0) return '<div style="padding:var(--space-4);text-align:center;color:var(--color-text-muted)">Aucun match en cours ou à venir</div>';

    return runningOrNext.map(m => {
      const hasPending = m.proposedScore && !m.proposedScore.validated;
      return `
        <div style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3) var(--space-4);border-bottom:1px solid var(--color-border-light)">
          <div style="flex:1">
            <div style="font-size:var(--font-size-sm);font-weight:600">${Utils.escHtml(getTeamName(t, m.team1Id))} <span style="color:var(--color-text-faint)">vs</span> ${Utils.escHtml(getTeamName(t, m.team2Id))}</div>
            ${m.scheduledTime ? `<div style="font-size:10px;color:var(--color-text-faint)">⏰ ${m.scheduledTime}</div>` : ''}
          </div>
          ${hasPending
            ? `<span class="badge badge-warning" style="font-size:10px">⏳ En attente de validation</span>`
            : m.status === 'running'
            ? `<button class="btn btn-sm btn-primary btn-propose-score" data-id="${m.id}">📤 Soumettre score</button>`
            : `<button class="btn btn-sm btn-secondary btn-propose-score" data-id="${m.id}">📤 Proposer score</button>`}
        </div>`;
    }).join('');
  };

  return { render, openFullscreen, close, _callMatch, openPlayerScoreForm };
})();
