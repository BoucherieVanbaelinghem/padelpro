'use strict';

/* ═══════════════════════════════════════════════════════════════
   FORMATS MODULE — Formats de match officiels FFT 2026
   ═══════════════════════════════════════════════════════════════ */

const FormatsModule = (() => {

  let _container = null;

  // ── Formats officiels FFT 2026 ──────────────────────────────────
  const FFT_FORMATS = [
    {
      code: 'A1',
      name: 'A1 — Classique complet',
      sets: 3, gamesPerSet: 6, tiebreak: true, superTiebreak: false, goldenPoint: false,
      description: '3 sets à 6 jeux, tie-break à 6-6',
      usage: 'P250 et plus',
      restAfterMin: 120,
      durationMin: 60, durationMax: 100
    },
    {
      code: 'B1',
      name: 'B1 — Standard P100',
      sets: 2, gamesPerSet: 6, tiebreak: true, superTiebreak: true, goldenPoint: false,
      description: '2 sets à 6 jeux + super tie-break à 10 pts',
      usage: 'P100, P250',
      restAfterMin: 90,
      durationMin: 45, durationMax: 75
    },
    {
      code: 'C1',
      name: 'C1 — Format court',
      sets: 2, gamesPerSet: 4, tiebreak: true, superTiebreak: true, goldenPoint: false,
      description: '2 sets à 4 jeux + super tie-break à 10 pts',
      usage: 'P25, P50, P100',
      restAfterMin: 60,
      durationMin: 30, durationMax: 55
    },
    {
      code: 'D1',
      name: 'D1 — Un set long',
      sets: 1, gamesPerSet: 9, tiebreak: true, superTiebreak: false, goldenPoint: false,
      description: '1 set à 9 jeux, tie-break à 8-8',
      usage: 'Tournois express',
      restAfterMin: 45,
      durationMin: 30, durationMax: 50
    },
    {
      code: 'F',
      name: 'F — Express soirée',
      sets: 1, gamesPerSet: 4, tiebreak: true, superTiebreak: false, goldenPoint: true,
      description: '1 set à 4 jeux, tie-break à 3-3, point décisif',
      usage: 'P25, soirée, tournois jeunes',
      restAfterMin: 30,
      durationMin: 15, durationMax: 30
    },
  ];

  // Max matchs/jour par format FFT
  const MAX_MATCHES_DAY = {
    'A1': 2, 'A2': 2,
    'B1': 4, 'B2': 4,
    'C1': 6, 'C2': 6,
    'D1': 6, 'D2': 6,
    'F': 99, 'E': 99
  };

  const render = (container) => {
    _container = container;
    _renderPage();
  };

  const _renderPage = () => {
    const t = App.getTournament();
    let formats = t.settings?.matchFormats || [];
    const game = t.settings?.game || {};
    const defaultFormatId = game.defaultFormatId || (formats[0]?.id);
    const catFft = t.settings?.tournament?.categorie || t.settings?.game?.categorie || '';

    _container.innerHTML = `
      <div class="animate-fade-in">
        <div class="page-header">
          <div class="page-header-left">
            <h2 class="page-title">🎾 Formats de match</h2>
            <p class="page-subtitle">Formats officiels FFT 2026 · ${formats.length} format${formats.length > 1 ? 's' : ''} configuré${formats.length > 1 ? 's' : ''}</p>
          </div>
          <div class="page-header-actions">
            <button class="btn btn-secondary" id="btn-load-fft">📋 Charger formats FFT</button>
            <button class="btn btn-primary" id="btn-add-format">+ Personnalisé</button>
          </div>
        </div>

        <!-- Référence FFT -->
        <div class="card mb-4" style="background:var(--color-bg-alt)">
          <div class="card-header">
            <span class="card-title">📖 Référence officielle FFT 2026</span>
            <span style="font-size:11px;color:var(--color-text-muted)">Guide de la Compétition mis à jour juillet 2025</span>
          </div>
          <div class="card-body" style="padding:0">
            <div style="overflow-x:auto">
              <table style="width:100%;border-collapse:collapse;min-width:600px">
                <thead>
                  <tr style="background:var(--color-bg)">
                    <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--color-text-muted);border-bottom:1px solid var(--color-border)">Code</th>
                    <th style="padding:8px 12px;font-size:11px;color:var(--color-text-muted);border-bottom:1px solid var(--color-border)">Structure</th>
                    <th style="padding:8px 12px;font-size:11px;color:var(--color-text-muted);border-bottom:1px solid var(--color-border)">Point décisif</th>
                    <th style="padding:8px 12px;font-size:11px;color:var(--color-text-muted);border-bottom:1px solid var(--color-border)">Repos min.</th>
                    <th style="padding:8px 12px;font-size:11px;color:var(--color-text-muted);border-bottom:1px solid var(--color-border)">Max/jour</th>
                    <th style="padding:8px 12px;font-size:11px;color:var(--color-text-muted);border-bottom:1px solid var(--color-border)">Durée est.</th>
                    <th style="padding:8px 12px;font-size:11px;color:var(--color-text-muted);border-bottom:1px solid var(--color-border)">Usage</th>
                    <th style="padding:8px 4px;border-bottom:1px solid var(--color-border)"></th>
                  </tr>
                </thead>
                <tbody>
                  ${FFT_FORMATS.map(f => {
                    const isRecommended = !!catFft && f.usage.toUpperCase().includes(catFft.toUpperCase());
                    return `
                    <tr style="border-bottom:1px solid var(--color-border-light);${isRecommended ? 'background:var(--color-primary-100)' : ''}">
                      <td style="padding:8px 12px;font-weight:800;color:var(--color-primary)">${f.code}${isRecommended ? ' <span title="Recommandé pour votre catégorie" style="font-size:10px">⭐</span>' : ''}</td>
                      <td style="padding:8px 12px;font-size:var(--font-size-xs)">${f.description}</td>
                      <td style="padding:8px 12px;text-align:center">${f.goldenPoint ? '⚡ Oui' : '—'}</td>
                      <td style="padding:8px 12px;font-size:var(--font-size-xs)">${f.restAfterMin} min</td>
                      <td style="padding:8px 12px;text-align:center;font-weight:700">${MAX_MATCHES_DAY[f.code] === 99 ? '7+' : MAX_MATCHES_DAY[f.code]}</td>
                      <td style="padding:8px 12px;font-size:var(--font-size-xs);color:var(--color-text-muted)">${f.durationMin}–${f.durationMax} min</td>
                      <td style="padding:8px 12px;font-size:var(--font-size-xs);color:var(--color-text-muted)">${f.usage}</td>
                      <td style="padding:4px 8px">
                        <button class="btn btn-sm btn-ghost btn-use-fft-format" data-code="${f.code}" title="Utiliser ce format">+</button>
                      </td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
            <div style="padding:var(--space-3) var(--space-4);font-size:11px;color:var(--color-text-muted);border-top:1px solid var(--color-border-light)">
              ⚠️ Règle FFT : chaque paire doit disputer <strong>au moins 3 matchs</strong> (formats A–D) ou 5 matchs (formats E–F).<br>
              ⚠️ Aucun match après <strong>minuit</strong>. Repos de <strong>12h minimum</strong> entre deux journées.
            </div>
          </div>
        </div>

        <!-- Formats configurés -->
        ${formats.length === 0 ? `
          <div class="card">
            <div class="card-body">
              <div class="empty-state">
                <div class="empty-state-icon">🎾</div>
                <h3>Aucun format configuré</h3>
                <p>Chargez les formats officiels FFT ou créez un format personnalisé.</p>
                <button class="btn btn-primary" id="btn-load-fft-empty">📋 Charger formats FFT</button>
              </div>
            </div>
          </div>` : `
          <div style="display:flex;flex-direction:column;gap:var(--space-3)" id="formats-list">
            ${formats.map((f, i) => _renderFormatCard(f, i, formats.length, defaultFormatId)).join('')}
          </div>`}
      </div>`;

    // Events
    Utils.el('#btn-add-format', _container)?.addEventListener('click', () => _openFormatEditor(null));
    Utils.el('#btn-load-fft', _container)?.addEventListener('click', _loadFftFormats);
    Utils.el('#btn-load-fft-empty', _container)?.addEventListener('click', _loadFftFormats);

    _container.querySelectorAll('.btn-use-fft-format').forEach(btn => {
      btn.addEventListener('click', () => _addFftFormat(btn.dataset.code));
    });
    _container.querySelectorAll('.btn-edit-format').forEach(btn => {
      btn.addEventListener('click', () => {
        const t2 = App.getTournament();
        const f = (t2.settings?.matchFormats || []).find(x => x.id === btn.dataset.id);
        if (f) _openFormatEditor(f);
      });
    });
    _container.querySelectorAll('.btn-delete-format').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await App.confirm('Supprimer ce format', 'Les matchs utilisant ce format perdront la référence.', { icon: '🗑️', okLabel: 'Supprimer', okClass: 'btn-danger' });
        if (!ok) return;
        const t2 = App.getTournament();
        t2.settings.matchFormats = (t2.settings.matchFormats || []).filter(x => x.id !== btn.dataset.id);
        App.saveTournament(t2);
        App.toast('Format supprimé', 'success');
        _renderPage();
      });
    });
    _container.querySelectorAll('.btn-set-default').forEach(btn => {
      btn.addEventListener('click', () => {
        const t2 = App.getTournament();
        if (!t2.settings) t2.settings = {};
        if (!t2.settings.game) t2.settings.game = {};
        t2.settings.game.defaultFormatId = btn.dataset.id;
        // Appliquer à tous les matchs sans format
        (t2.matches || []).forEach(m => { if (!m.formatId) m.formatId = btn.dataset.id; });
        App.saveTournament(t2);
        App.toast('Format par défaut mis à jour', 'success');
        _renderPage();
      });
    });
  };

  const _renderFormatCard = (f, index, total, defaultFormatId) => {
    const t = App.getTournament();
    const isDefault = f.id === defaultFormatId || (index === 0 && !defaultFormatId);
    const matchCount = (t.matches || []).filter(m => m.formatId === f.id).length;
    const fftRef = FFT_FORMATS.find(ff => ff.code === f.fftCode);
    const restMin = fftRef?.restAfterMin || (f.sets >= 3 ? 120 : f.sets === 2 && f.gamesPerSet >= 6 ? 90 : 60);
    const maxDay = fftRef ? (MAX_MATCHES_DAY[fftRef.code] === 99 ? '7+' : MAX_MATCHES_DAY[fftRef.code]) : (f.sets >= 3 ? 2 : 6);

    return `
      <div class="card" style="border-color:${isDefault ? 'var(--color-primary)' : 'var(--color-border)'}">
        <div class="card-body">
          <div style="display:flex;align-items:flex-start;gap:var(--space-4)">
            <div style="flex:1">
              <div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-3)">
                ${f.fftCode ? `<span style="font-size:11px;font-weight:900;color:white;background:var(--color-primary);padding:2px 8px;border-radius:var(--radius-sm)">${f.fftCode}</span>` : ''}
                <span style="font-size:var(--font-size-base);font-weight:800">${Utils.escHtml(f.name)}</span>
                ${isDefault ? `<span class="badge badge-primary" style="font-size:10px">Par défaut</span>` : ''}
                ${matchCount > 0 ? `<span class="badge badge-neutral" style="font-size:10px">${matchCount} match${matchCount > 1 ? 's' : ''}</span>` : ''}
              </div>
              <div style="display:flex;gap:var(--space-5);flex-wrap:wrap">
                <div>
                  <div style="font-size:10px;color:var(--color-text-muted)">Structure</div>
                  <div style="font-weight:700;font-size:var(--font-size-sm)">
                    ${f.sets} set${f.sets > 1 ? 's' : ''} × ${f.gamesPerSet} jeux
                    ${f.superTiebreak ? '+ Super TB' : ''}
                    ${f.goldenPoint ? '+ ⚡ Point décisif' : ''}
                  </div>
                </div>
                <div>
                  <div style="font-size:10px;color:var(--color-text-muted)">Repos min.</div>
                  <div style="font-weight:700;font-size:var(--font-size-sm)">${restMin} min</div>
                </div>
                <div>
                  <div style="font-size:10px;color:var(--color-text-muted)">Max/jour</div>
                  <div style="font-weight:700;font-size:var(--font-size-sm)">${maxDay} matchs</div>
                </div>
                <div>
                  <div style="font-size:10px;color:var(--color-text-muted)">Durée est.</div>
                  <div style="font-weight:700;font-size:var(--font-size-sm);color:var(--color-text-muted)">${fftRef ? `${fftRef.durationMin}–${fftRef.durationMax} min` : '—'}</div>
                </div>
              </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:var(--space-2);align-items:flex-end">
              <button class="btn btn-sm btn-secondary btn-edit-format" data-id="${f.id}">✏️</button>
              ${!isDefault ? `<button class="btn btn-sm btn-ghost btn-set-default" data-id="${f.id}" title="Définir par défaut">⭐ Défaut</button>` : ''}
              ${matchCount === 0 ? `<button class="btn btn-sm btn-danger btn-delete-format" data-id="${f.id}">🗑️</button>` : ''}
            </div>
          </div>
        </div>
      </div>`;
  };

  // Charger tous les formats FFT officiels d'un coup
  const _loadFftFormats = async () => {
    const t = App.getTournament();
    const ok = await App.confirm(
      '📋 Charger formats FFT 2026',
      'Les 5 formats officiels FFT (A1, B1, C1, D1, F) seront ajoutés. Les formats existants sont conservés.',
      { icon: '📋', okLabel: 'Charger', okClass: 'btn-primary' }
    );
    if (!ok) return;
    if (!t.settings) t.settings = {};
    if (!t.settings.matchFormats) t.settings.matchFormats = [];
    let added = 0;
    FFT_FORMATS.forEach(ff => {
      if (!t.settings.matchFormats.find(x => x.fftCode === ff.code)) {
        t.settings.matchFormats.push({
          id: Utils.uuid(),
          fftCode: ff.code,
          name: ff.name,
          sets: ff.sets,
          gamesPerSet: ff.gamesPerSet,
          tiebreak: ff.tiebreak,
          superTiebreak: ff.superTiebreak,
          goldenPoint: ff.goldenPoint,
          restAfterMin: ff.restAfterMin
        });
        added++;
      }
    });
    // Définir B1 comme format par défaut si pas de défaut
    if (!t.settings.game) t.settings.game = {};
    if (!t.settings.game.defaultFormatId) {
      const b1 = t.settings.matchFormats.find(x => x.fftCode === 'B1');
      if (b1) t.settings.game.defaultFormatId = b1.id;
    }
    App.saveTournament(t);
    App.toast(`${added} format${added > 1 ? 's' : ''} FFT ajouté${added > 1 ? 's' : ''} !`, 'success');
    _renderPage();
  };

  const _addFftFormat = (code) => {
    const ff = FFT_FORMATS.find(f => f.code === code);
    if (!ff) return;
    const t = App.getTournament();
    if (!t.settings) t.settings = {};
    if (!t.settings.matchFormats) t.settings.matchFormats = [];
    if (t.settings.matchFormats.find(x => x.fftCode === code)) {
      App.toast(`Le format ${code} est déjà configuré`, 'info');
      return;
    }
    t.settings.matchFormats.push({
      id: Utils.uuid(),
      fftCode: ff.code,
      name: ff.name,
      sets: ff.sets,
      gamesPerSet: ff.gamesPerSet,
      tiebreak: ff.tiebreak,
      superTiebreak: ff.superTiebreak,
      goldenPoint: ff.goldenPoint,
      restAfterMin: ff.restAfterMin
    });
    App.saveTournament(t);
    App.toast(`Format ${code} ajouté !`, 'success');
    _renderPage();
  };

  const _openFormatEditor = (existing) => {
    const f = existing || { id: Utils.uuid(), name: '', sets: 2, gamesPerSet: 6, tiebreak: true, superTiebreak: true, goldenPoint: false };
    const isNew = !existing;

    App.modal.open(isNew ? '+ Format personnalisé' : '✏️ Modifier le format', `
      <div style="display:flex;flex-direction:column;gap:var(--space-4)">
        <div>
          <label class="form-label">Nom du format</label>
          <input type="text" class="form-control" id="fmt-name" value="${Utils.escAttr(f.name)}" placeholder="Ex: Match classique">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4)">
          <div>
            <label class="form-label">Nombre de sets</label>
            <select class="form-control" id="fmt-sets">
              <option value="1" ${f.sets===1?'selected':''}>1 set</option>
              <option value="2" ${f.sets===2?'selected':''}>2 sets</option>
              <option value="3" ${f.sets===3?'selected':''}>3 sets</option>
            </select>
          </div>
          <div>
            <label class="form-label">Jeux par set</label>
            <select class="form-control" id="fmt-games">
              <option value="4" ${f.gamesPerSet===4?'selected':''}>4 jeux</option>
              <option value="6" ${f.gamesPerSet===6?'selected':''}>6 jeux</option>
              <option value="7" ${f.gamesPerSet===7?'selected':''}>7 jeux</option>
              <option value="8" ${f.gamesPerSet===8?'selected':''}>8 jeux</option>
              <option value="9" ${f.gamesPerSet===9?'selected':''}>9 jeux</option>
            </select>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:var(--space-3)">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" id="fmt-tiebreak" ${f.tiebreak!==false?'checked':''}> 
            <span>Tie-break au set</span>
          </label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" id="fmt-supertb" ${f.superTiebreak?'checked':''}>
            <span>Super tie-break (10 pts) — remplace le dernier set</span>
          </label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" id="fmt-golden" ${f.goldenPoint?'checked':''}>
            <span>⚡ Point décisif (golden point) au tie-break et jeux égaux</span>
          </label>
        </div>
        <div>
          <label class="form-label">Temps de repos minimum (min)</label>
          <input type="number" class="form-control" id="fmt-rest" value="${f.restAfterMin || 60}" min="0" max="240">
          <span class="form-hint">Temps de repos FFT imposé après ce format avant le prochain match</span>
        </div>
        <div style="padding:var(--space-3);background:var(--color-bg);border-radius:var(--radius-md);font-size:var(--font-size-xs);color:var(--color-text-muted)">
          💡 Formats officiels : A1 = 3×6+TB • B1 = 2×6+SuperTB • C1 = 2×4+SuperTB • D1 = 1×9+TB • F = 1×4+TB+GoldenPoint
        </div>
      </div>`,
      {
        buttons: [
          { label: 'Annuler', class: 'btn-ghost', onClick: () => App.modal.close() },
          { label: isNew ? '+ Créer' : '✅ Enregistrer', class: 'btn-primary', id: 'btn-save-format' }
        ]
      }
    );

    Utils.el('#btn-save-format')?.addEventListener('click', () => {
      const name = Utils.el('#fmt-name')?.value.trim();
      if (!name) { App.toast('Donnez un nom au format', 'warning'); return; }
      const t2 = App.getTournament();
      if (!t2.settings) t2.settings = {};
      if (!t2.settings.matchFormats) t2.settings.matchFormats = [];
      const saved = {
        id: f.id,
        fftCode: f.fftCode || null,
        name,
        sets: parseInt(Utils.el('#fmt-sets')?.value) || 2,
        gamesPerSet: parseInt(Utils.el('#fmt-games')?.value) || 6,
        tiebreak: Utils.el('#fmt-tiebreak')?.checked !== false,
        superTiebreak: Utils.el('#fmt-supertb')?.checked || false,
        goldenPoint: Utils.el('#fmt-golden')?.checked || false,
        restAfterMin: parseInt(Utils.el('#fmt-rest')?.value) || 60
      };
      const idx = t2.settings.matchFormats.findIndex(x => x.id === f.id);
      if (idx >= 0) t2.settings.matchFormats[idx] = saved;
      else t2.settings.matchFormats.push(saved);
      App.saveTournament(t2);
      App.toast(isNew ? 'Format créé !' : 'Format mis à jour !', 'success');
      App.modal.close();
      _renderPage();
    });
  };

  // API publique pour schedule.js : vérifier les contraintes FFT
  const getFormatConstraints = (formatId) => {
    const t = App.getTournament();
    const f = (t.settings?.matchFormats || []).find(x => x.id === formatId);
    if (!f) return { restAfterMin: 60, maxPerDay: 6 };
    const fftRef = FFT_FORMATS.find(ff => ff.code === f.fftCode);
    return {
      restAfterMin: f.restAfterMin || fftRef?.restAfterMin || 60,
      maxPerDay: fftRef ? (MAX_MATCHES_DAY[fftRef.code] || 6) : 6,
      goldenPoint: f.goldenPoint || false
    };
  };

  return { render, getFormatConstraints, FFT_FORMATS, MAX_MATCHES_DAY };
})();
