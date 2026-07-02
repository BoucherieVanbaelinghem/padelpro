'use strict';

/* ═══════════════════════════════════════════════════════════════
   AUDIT — Journal d'audit
   ═══════════════════════════════════════════════════════════════ */

const Audit = (() => {

  const ACTIONS = {
    CREATE:  'create',
    UPDATE:  'update',
    DELETE:  'delete',
    SCORE:   'score',
    IMPORT:  'import',
    EXPORT:  'export',
    GENERATE:'generate',
    START:   'start',
    FINISH:  'finish',
    RESET:   'reset'
  };

  const ICONS = {
    create:   '✅',
    update:   '✏️',
    delete:   '🗑️',
    score:    '🏆',
    import:   '📥',
    export:   '📤',
    generate: '⚙️',
    start:    '▶️',
    finish:   '🎉',
    reset:    '🔄'
  };

  const LABELS = {
    player:   'Joueur',
    team:     'Équipe',
    pool:     'Poule',
    match:    'Match',
    schedule: 'Planning',
    bracket:  'Tableau final',
    setting:  'Paramètre',
    tournament:'Tournoi',
    level:    'Niveau',
    format:   'Format',
    court:    'Terrain'
  };

  const log = (action, entity, details = '') => {
    const entry = {
      action,
      entity,
      details,
      icon: ICONS[action] || '📌',
      label: LABELS[entity] || entity,
      actionLabel: getActionLabel(action)
    };
    Storage.addAuditEntry(entry);
  };

  const getActionLabel = (action) => {
    const labels = {
      create:   'Création',
      update:   'Modification',
      delete:   'Suppression',
      score:    'Score saisi',
      import:   'Import',
      export:   'Export',
      generate: 'Génération',
      start:    'Démarrage',
      finish:   'Terminé',
      reset:    'Réinitialisation'
    };
    return labels[action] || action;
  };

  const getLogs = (limit = 100) => Storage.getAudit().slice(0, limit);
  const clearLogs = () => Storage.clearAudit();

  return { ACTIONS, ICONS, LABELS, log, getLogs, clearLogs, getActionLabel };
})();
