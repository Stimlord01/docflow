# PROGRESS

## Tâche actuelle
Tests locaux validés avec la base de données distante Neon.

## Dernière étape terminée
Vérification complète du frontend et du backend en local connectés à Neon PostgreSQL. Correction d'un bug de droit d'accès sur l'endpoint `/categories` pour les simples utilisateurs. Le dashboard de l'utilisateur standard (Amélie Rousseau) et la console administrateur (M. Petit) chargent et mettent à jour les données en direct avec succès.

## Prochaine étape
Déployer l'application sur un hébergeur web (ex : Render pour le backend, Vercel/Netlify pour le frontend) et configurer un stockage S3 pour les documents importés.

## Fichiers concernés
- `backend/prisma/schema.prisma`
- `backend/src/db.ts`
- `backend/src/routes/admin.ts`
- `backend/package.json`
- `backend/.env`
- `PROGRESS.md`

## Problèmes connus
- Aucun. L'application est pleinement fonctionnelle avec la base de données PostgreSQL de production.
