# Plan de la V1 (validé)

## Choix techniques

- **Next.js** (App Router) + **TypeScript** : écrans et partie serveur (DVF, PDF).
- **Tailwind CSS** + composants **shadcn/ui** : interface pensée d'abord pour le téléphone.
- **Supabase** : authentification email + mot de passe, base PostgreSQL, stockage des photos et du logo.
- **Row Level Security** sur toutes les tables : chaque agent ne voit que ses données.
- **Vercel** (région Paris `cdg1`) pour l'hébergement ; Supabase en région Paris (RGPD).
- Bibliothèques : `@dnd-kit` (Kanban tactile), `react-leaflet` (carte OpenStreetMap), `@react-pdf/renderer` (PDF), `vitest` (tests).

## Sources de données

| Besoin | Source | Remarques |
|---|---|---|
| Ventes comparables | API « Données foncières » du Cerema (DVF+ open data), `apidf-preprod.cerema.fr` | Gratuite, sans clé. Recherche par emprise géographique. Données 2014 → fin 2025 (version 2026.1). Hors Alsace, Moselle, Mayotte. Appelée uniquement depuis le serveur, via un « adaptateur » remplaçable (fichiers geo-dvf d'Etalab en solution de repli). |
| Adresse → coordonnées GPS | Géoplateforme IGN, `data.geopf.fr/geocodage` | Remplace l'ancienne API Adresse (arrêtée fin janvier 2026). |
| Fond de carte | OpenStreetMap | Attribution obligatoire, usage modéré. |

Aucun site d'annonces n'est aspiré.

## Décisions prises (réponse « OK » au plan)

1. Données de démonstration situées à **Nantes**.
2. Source DVF : **API Cerema**.
3. Relances « retour de visite » :
   - visite passée sans retour saisi : « Demander son avis à l'acquéreur » ;
   - retour saisi mais pas encore transmis : « Transmettre le retour au vendeur ».
4. Honoraires dans l'estimation : en % ou en €, à la charge du vendeur (net vendeur = prix − honoraires) ou de l'acquéreur (prix affiché = net vendeur + honoraires).
5. Aucune fonctionnalité hors V1 ajoutée (voir « Propositions » plus bas).

## Base de données

Toutes les tables ont une colonne `user_id` et la règle RLS « `user_id = auth.uid()` ».
Les liens entre tables utilisent des clés étrangères composites `(id, user_id)` : impossible de rattacher une donnée d'un autre compte.

| Table | Contenu |
|---|---|
| `profiles` | Profil de l'agent (nom, téléphone, email, agence, logo) |
| `contacts` | Fiche contact, rôles, source, étapes des pipelines vendeur / acquéreur |
| `buyer_profiles` | Qualification et critères de recherche d'un acquéreur |
| `interactions` | Timeline des échanges (appel, SMS, mail, rendez-vous, visite, note) |
| `properties` | Biens suivis + mandat en cours |
| `property_photos` | Photos des biens (fichiers dans le stockage privé) |
| `visits` | Visites et retours de visite |
| `matches` | Correspondances bien / acquéreur, score, « vue le » |
| `tasks` | Tâches et relances |
| `estimations` | Estimations DVF (comparables figés, ajustements, résultat) |

## Écrans

Connexion / inscription / mot de passe oublié · Ma journée · Contacts (liste, fiche, formulaire, pipelines Kanban) · Biens (liste, fiche, formulaire, visites) · Tâches · Correspondances · Estimations (nouvelle, détail, historique, PDF) · Réglages · Plus (menu mobile).

## Étapes

1. Projet + authentification
2. Contacts
3. Biens
4. Rapprochement
5. Tâches et « Ma journée »
6. Estimation DVF
7. Rapport PDF
8. PWA + README final

## Propositions (non incluses dans la V1)

1. Surface du terrain pour les maisons (utile à l'estimation).
2. Historique des mandats (renouvellements, avenants).
3. Plusieurs recherches par acquéreur.
4. RGPD : consentement du contact, export / suppression de ses données.
5. Envoi du compte rendu de visite au vendeur (SMS / mail pré-rempli).
6. Export CSV de toutes les données.
7. Export des rendez-vous vers l'agenda du téléphone.
