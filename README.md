# PadelPro — Gestion de Tournois

Application web (PWA) de gestion de tournois de padel : joueurs, équipes, poules, terrains, planning, scores, tableaux à élimination directe, classements et barème de points FFT 2026.

100% JavaScript vanilla (aucune dépendance, aucune étape de build), les données sont stockées en local dans le navigateur (`localStorage`).

## Utilisation en local

Ouvrir `index.html` dans un navigateur, ou servir le dossier avec un petit serveur statique, par exemple :

```
npx serve .
```

## Déploiement

- **Firebase Hosting** : `firebase deploy --only hosting` (voir `firebase.json`)
- **GitHub Pages** : activer Pages dans Settings → Pages du dépôt, branche `main`, dossier racine

## Structure

- `index.html` — application principale
- `viewer.html` — page d'affichage public autonome (écran de club)
- `css/` — styles
- `js/` — logique applicative (modules par page : joueurs, équipes, poules, tableaux, scores, classements…)
- `manifest.json`, `sw.js` — PWA (installable, fonctionne hors-ligne)
