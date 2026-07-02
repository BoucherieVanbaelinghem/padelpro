'use strict';

/* ═══════════════════════════════════════════════════════════════
   UTILS — Fonctions utilitaires globales
   ═══════════════════════════════════════════════════════════════ */

const Utils = (() => {

  // ── Identifiants ──────────────────────────────────────────────
  const uuid = () =>
    'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);

  // ── Dates & Heures ────────────────────────────────────────────
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return dateStr; }
  };

  const formatShortDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('fr-FR');
    } catch { return dateStr; }
  };

  const formatTimestamp = (ts) => {
    if (!ts) return '—';
    try {
      const d = new Date(ts);
      return d.toLocaleDateString('fr-FR') + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch { return ts; }
  };

  const now = () => new Date().toISOString();

  // Time string (HH:MM) → minutes depuis minuit
  const timeToMin = (t) => {
    if (!t || !t.includes(':')) return 0;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  // Minutes depuis minuit → time string HH:MM
  const minToTime = (min) => {
    const h = Math.floor(min / 60) % 24;
    const m = min % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  // Ajouter des minutes à un time string
  const addMinutes = (timeStr, minutes) => {
    return minToTime(timeToMin(timeStr) + minutes);
  };

  // Comparer deux time strings (retourne positif si t1 > t2)
  const compareTime = (t1, t2) => timeToMin(t1) - timeToMin(t2);

  // Différence en minutes (t2 - t1)
  const timeDiff = (t1, t2) => timeToMin(t2) - timeToMin(t1);

  // Heure actuelle HH:MM
  const currentTime = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  // Durée en texte lisible
  const durationText = (minutes) => {
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
  };

  // ── Tableaux ──────────────────────────────────────────────────
  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // Round robin complet pour un tableau d'équipes
  const roundRobinPairs = (teams) => {
    const t = teams.length % 2 === 0 ? [...teams] : [...teams, null];
    const half = t.length / 2;
    const pairs = [];
    for (let round = 0; round < t.length - 1; round++) {
      for (let i = 0; i < half; i++) {
        const a = t[i];
        const b = t[t.length - 1 - i];
        if (a !== null && b !== null) pairs.push([a, b]);
      }
      t.splice(1, 0, t.pop());
    }
    return pairs;
  };

  // Grouper un tableau en chunks de taille n
  const chunk = (arr, n) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += n) chunks.push(arr.slice(i, i + n));
    return chunks;
  };

  // Grouper par clé
  const groupBy = (arr, key) => {
    return arr.reduce((acc, item) => {
      const k = typeof key === 'function' ? key(item) : item[key];
      if (!acc[k]) acc[k] = [];
      acc[k].push(item);
      return acc;
    }, {});
  };

  // Trier tableau d'objets
  const sortBy = (arr, key, direction = 'asc') => {
    return [...arr].sort((a, b) => {
      let va = typeof key === 'function' ? key(a) : a[key];
      let vb = typeof key === 'function' ? key(b) : b[key];
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return direction === 'asc' ? -1 : 1;
      if (va > vb) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  // ── Objets ────────────────────────────────────────────────────
  const clone = (obj) => JSON.parse(JSON.stringify(obj));

  // ── Chaînes ───────────────────────────────────────────────────
  const escAttr = (str) => String(str || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const escHtml = (str) => {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const initials = (firstName, lastName) => {
    return ((firstName || '')[0] || '').toUpperCase() +
           ((lastName  || '')[0] || '').toUpperCase();
  };

  const fullName = (player) => {
    if (!player) return '?';
    return `${player.firstName || ''} ${player.lastName || ''}`.trim();
  };

  const normalize = (str) =>
    (str || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  // ── Couleurs ──────────────────────────────────────────────────
  const colorFromStr = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 60%, 50%)`;
  };

  const colorFromIndex = (i) => {
    const palette = ['#2563eb','#16a34a','#d97706','#dc2626','#7c3aed',
                     '#0891b2','#db2777','#059669','#f97316','#6366f1'];
    return palette[i % palette.length];
  };

  // ── Formulaires ───────────────────────────────────────────────
  const debounce = (fn, delay = 300) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  };

  const formData = (form) => {
    const data = {};
    new FormData(form).forEach((val, key) => { data[key] = val; });
    return data;
  };

  // ── Fichiers ──────────────────────────────────────────────────
  const downloadJSON = (data, filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const readJSONFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try { resolve(JSON.parse(e.target.result)); }
        catch { reject(new Error('Fichier JSON invalide')); }
      };
      reader.onerror = () => reject(new Error('Erreur de lecture'));
      reader.readAsText(file);
    });
  };

  // ── DOM ───────────────────────────────────────────────────────
  const el = (selector, context = document) => context.querySelector(selector);
  const els = (selector, context = document) => [...context.querySelectorAll(selector)];

  const create = (tag, props = {}, children = []) => {
    const elem = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => {
      if (k === 'class') elem.className = v;
      else if (k === 'html') elem.innerHTML = v;
      else if (k === 'text') elem.textContent = v;
      else if (k.startsWith('on')) elem.addEventListener(k.slice(2), v);
      else elem.setAttribute(k, v);
    });
    children.forEach(child => {
      if (typeof child === 'string') elem.appendChild(document.createTextNode(child));
      else if (child) elem.appendChild(child);
    });
    return elem;
  };

  // ── Ordinaux ─────────────────────────────────────────────────
  const ordinal = (n) => {
    if (n === 1) return '1er';
    return `${n}ème`;
  };

  // ── Validation ────────────────────────────────────────────────
  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValidPhone = (phone) => /^[\d\s\+\-\(\)\.]{7,20}$/.test(phone);

  // Public API
  return {
    uuid, formatDate, formatShortDate, formatTimestamp, now,
    timeToMin, minToTime, addMinutes, compareTime, timeDiff,
    currentTime, durationText,
    shuffle, roundRobinPairs, chunk, groupBy, sortBy,
    clone, escHtml, escAttr, initials, fullName, normalize,
    colorFromStr, colorFromIndex,
    debounce, formData,
    downloadJSON, readJSONFile,
    el, els, create, ordinal,
    isValidEmail, isValidPhone
  };
})();
