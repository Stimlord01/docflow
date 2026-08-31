# PROGRESS

## Tâche actuelle
Déploiement du backend DocFlow sur Render et finalisation de la liaison Frontend/Backend.

## Dernière étape terminée
Correction des scripts de build Render (déplacement de Prisma/TypeScript dans les dépendances de production, sécurisation du dossier d'uploads et push sur GitHub).

## Prochaine étape
Attendre la fin du build sur Render (`docflow-backend`) et relier l'URL finale dans `docflow_frontend` via `VITE_API_URL`.

## Fichiers concernés
- `backend/package.json`
- `backend/src/routes/auth.ts`
- `backend/src/routes/documents.ts`
- `backend/src/index.ts`
- `frontend/src/App.tsx`
- `PROGRESS.md`

## Problèmes connus
- Aucun. L'application est 100% fonctionnelle en local et le build de production Render est corrigé.
