# ImmoLab — l'assistant personnel de l'agent immobilier

ImmoLab complète le logiciel métier de l'agence (Hektor, Apimo…) sans le remplacer : fichier clients,
biens suivis, rapprochement biens / acquéreurs, relances, et estimations basées sur les ventes réelles (DVF).

- Utilisable sur **ordinateur et téléphone**, avec les mêmes données (synchronisation en ligne).
- Chaque agent a **son espace privé** : ses données ne sont visibles que par lui.
- Interface 100 % en français, montants en euros, dates au format français.

> Hors périmètre : registre officiel des mandats, diffusion sur les portails, comptabilité, gestion multi-agents.

---

## Sommaire

1. [Fonctionnalités](#1-fonctionnalités)
2. [Ce dont vous avez besoin](#2-ce-dont-vous-avez-besoin)
3. [Mise en ligne pas à pas (sans rien installer)](#3-mise-en-ligne-pas-à-pas-sans-rien-installer)
4. [Variables d'environnement](#4-variables-denvironnement)
5. [Données de démonstration](#5-données-de-démonstration)
6. [Comment tester chaque fonctionnalité](#6-comment-tester-chaque-fonctionnalité)
7. [Travailler sur le code en local (facultatif)](#7-travailler-sur-le-code-en-local-facultatif)
8. [Sources de données et limites](#8-sources-de-données-et-limites)
9. [Coûts et limites des offres gratuites](#9-coûts-et-limites-des-offres-gratuites)
10. [Dépannage](#10-dépannage)
11. [Organisation du code](#11-organisation-du-code)

---

## 1. Fonctionnalités

| Domaine | Ce que vous pouvez faire |
|---|---|
| Compte | Créer un compte, se connecter, mot de passe oublié, profil agent et agence |

*(La liste s'enrichit à chaque étape du développement.)*

---

## 2. Ce dont vous avez besoin

| Service | Rôle | Prix |
|---|---|---|
| [GitHub](https://github.com) | Héberge le code (vous l'avez déjà : dépôt ImmoLab) | Gratuit |
| [Supabase](https://supabase.com) | Base de données, comptes utilisateurs, stockage des photos | Gratuit pour démarrer (voir §9) |
| [Vercel](https://vercel.com) | Met l'application en ligne | Gratuit pour tester (voir §9) |

Aucun logiciel n'est à installer sur votre ordinateur pour mettre l'application en ligne.

---

## 3. Mise en ligne pas à pas (sans rien installer)

Comptez environ 30 minutes la première fois.

### 3.1 Créer le projet Supabase

1. Allez sur <https://supabase.com> et cliquez sur **Start your project**. Connectez-vous avec **GitHub** (le plus simple).
2. Cliquez sur **New project**.
3. Remplissez :
   - **Name** : `immolab` ;
   - **Database Password** : cliquez sur **Generate a password**, puis **copiez-le dans un endroit sûr** (gestionnaire de mots de passe). Vous n'en aurez normalement pas besoin, mais il est impossible de le retrouver ensuite ;
   - **Region** : choisissez **West EU (Paris)**. Vos données clients restent ainsi en France (RGPD).
4. Cliquez sur **Create new project** et patientez 1 à 2 minutes.

### 3.2 Créer les tables de la base (migrations)

Les « migrations » sont des fichiers SQL qui créent les tables et les règles de sécurité.
Ils se trouvent dans le dossier [`supabase/migrations`](supabase/migrations) du dépôt.

1. Dans Supabase, menu de gauche : **SQL Editor**.
2. Pour **chaque fichier** du dossier `supabase/migrations`, **dans l'ordre des noms** (ils commencent par une date) :
   1. ouvrez le fichier sur GitHub, cliquez sur l'icône **Copy raw file** (deux carrés superposés) ;
   2. dans Supabase, cliquez sur **+ New query**, collez le contenu ;
   3. cliquez sur **Run** (ou Ctrl + Entrée). Le message **Success. No rows returned** doit apparaître.
3. Vérifiez dans **Table Editor** que les tables sont créées (par exemple `profiles`).

> Si un fichier a déjà été exécuté, ne le relancez pas : vous obtiendriez une erreur « already exists » (sans gravité).

### 3.3 Récupérer les clés Supabase

1. Menu de gauche : **Project Settings** (roue dentée), puis **Data API** : copiez l'**URL** du projet
   (de la forme `https://abcdefgh.supabase.co`).
2. Toujours dans **Project Settings**, rubrique **API Keys** : copiez la **Publishable key** (commence par `sb_publishable_`).

La *Publishable key* peut être visible dans le navigateur : la sécurité est assurée par les règles RLS de la base.
La *Secret key* (`sb_secret_…`), elle, ne doit **jamais** être partagée ni mise dans Vercel.

### 3.4 Mettre l'application en ligne avec Vercel

1. Allez sur <https://vercel.com>, cliquez sur **Sign Up** et choisissez **Continue with GitHub**.
2. Cliquez sur **Add New…** → **Project**, puis **Import** à côté du dépôt **ImmoLab**
   (si le dépôt n'apparaît pas : **Adjust GitHub App Permissions** et autorisez-le).
3. Dépliez **Environment Variables** et ajoutez les deux variables de la [section 4](#4-variables-denvironnement) :
   `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. Cliquez sur **Deploy**. Au bout de 2 à 3 minutes, Vercel affiche l'adresse de votre application,
   par exemple `https://immolab-xxxx.vercel.app`. **Notez-la.**

> Vercel publie la branche principale du dépôt (`main`). Tant que le code de la V1 est sur une autre branche,
> fusionnez-la d'abord dans `main` (bouton **Merge pull request** de la *pull request* sur GitHub).
> Les autres branches sont aussi publiées, mais à des adresses de « prévisualisation » qui changent.

À chaque modification du code poussée sur GitHub, Vercel met l'application à jour automatiquement.

### 3.5 Régler l'authentification dans Supabase

1. **Adresse de l'application** : **Authentication** → **URL Configuration**.
   - **Site URL** : l'adresse Vercel notée plus haut (ex. `https://immolab-xxxx.vercel.app`) ;
   - **Redirect URLs** : cliquez sur **Add URL** et ajoutez `https://immolab-xxxx.vercel.app/**`
     (et `http://localhost:3000/**` si vous travaillez en local).
2. **Emails (recommandé)** : **Authentication** → **Emails** → onglet **Templates**.
   Ces modèles permettent d'ouvrir le lien reçu par email sur n'importe quel appareil (téléphone ou ordinateur).
   - Modèle **Confirm signup** : remplacez le lien par
     ```html
     <h2>Confirmez votre adresse</h2>
     <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirmer mon adresse email</a></p>
     ```
   - Modèle **Reset password** : remplacez le lien par
     ```html
     <h2>Nouveau mot de passe</h2>
     <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reinitialiser-mot-de-passe">Choisir un nouveau mot de passe</a></p>
     ```
   - Cliquez sur **Save** pour chacun.
3. Ouvrez votre application, cliquez sur **Créer un compte**, puis confirmez votre adresse via l'email reçu.
4. **Fermez les inscriptions** une fois votre compte créé (et éventuellement un compte de démonstration) :
   **Authentication** → **Sign In / Providers** → désactivez **Allow new users to sign up** → **Save**.
   Personne d'autre ne pourra alors créer de compte sur votre application.

> L'envoi d'emails intégré à Supabase est limité (quelques emails par heure, et seulement vers les adresses
> des membres de votre projet Supabase). C'est suffisant pour vous. Pour davantage, configurez un service
> d'envoi (SMTP) dans **Authentication** → **Emails** → **SMTP Settings**.

---

## 4. Variables d'environnement

| Nom | Où la trouver | Où la mettre |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → Data API → URL | Vercel + `.env.local` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys → Publishable key | Vercel + `.env.local` |

Dans Vercel, les variables se modifient dans **Settings** → **Environment Variables**.
Après une modification, relancez un déploiement : **Deployments** → **⋯** → **Redeploy**.

---

## 5. Données de démonstration

*(Disponible à partir de l'étape 2.)*

---

## 6. Comment tester chaque fonctionnalité

### Étape 1 — Compte et connexion

1. Ouvrez l'application : vous arrivez sur **Connexion**.
2. **Créer un compte** : saisissez votre nom, email et un mot de passe (8 caractères minimum).
   Confirmez l'adresse via l'email reçu, puis connectez-vous.
3. Vous arrivez sur **Ma journée** (« Bonjour … »).
4. **Réglages** (menu **Plus** sur téléphone) : renseignez votre téléphone et le nom de l'agence, puis **Enregistrer le profil**.
5. Ouvrez l'application sur votre téléphone et connectez-vous avec le même compte : vous retrouvez le même profil.
6. Testez **Mot de passe oublié** depuis la page de connexion.
7. **Se déconnecter** : vous revenez à la page de connexion ; les pages privées ne sont plus accessibles.

---

## 7. Travailler sur le code en local (facultatif)

Uniquement si vous voulez modifier le code et le tester sur votre ordinateur.

1. Installez [Node.js](https://nodejs.org) (version 20 ou plus récente, bouton « LTS ») et [Git](https://git-scm.com).
2. Dans un terminal :
   ```bash
   git clone https://github.com/lucasduvette-oss/ImmoLab.git
   cd ImmoLab
   npm install
   ```
3. Copiez le fichier `.env.example` en `.env.local` et remplacez les valeurs (voir [section 4](#4-variables-denvironnement)).
4. Lancez l'application : `npm run dev`, puis ouvrez <http://localhost:3000>.
5. Commandes utiles :
   - `npm run lint` : vérifie la qualité du code ;
   - `npm run typecheck` : vérifie les types TypeScript ;
   - `npm test` : lance les tests automatiques ;
   - `npm run build` : construit la version de production (comme Vercel).

**Appliquer les migrations avec la ligne de commande** (alternative au copier-coller de la section 3.2) :
```bash
npx supabase login                          # ouvre le navigateur pour vous connecter
npx supabase link --project-ref abcdefgh    # « abcdefgh » = identifiant dans l'URL du projet
npx supabase db push                        # applique les migrations manquantes
```
N'utilisez qu'**une seule** des deux méthodes (copier-coller *ou* ligne de commande) pour un même projet.

---

## 8. Sources de données et limites

*(Complété à l'étape 6.)*

---

## 9. Coûts et limites des offres gratuites

- **Supabase (offre Free)** : 500 Mo de base, 1 Go de fichiers. Le projet se met en pause après 7 jours
  sans aucune utilisation (il suffit de le relancer depuis le tableau de bord).
  **Attention : pas de sauvegarde automatique** dans l'offre gratuite. Pour un usage quotidien avec de vraies
  données clients, l'offre **Pro** (environ 25 $/mois) ajoute des sauvegardes quotidiennes.
- **Vercel (offre Hobby)** : gratuite mais **réservée à un usage non commercial** selon les conditions de Vercel.
  Pour votre activité professionnelle, passez à l'offre **Pro** (environ 20 $/mois) ou choisissez un autre hébergeur.

---

## 10. Dépannage

| Problème | Solution |
|---|---|
| Page blanche ou erreur « Variables Supabase manquantes » | Vérifiez les deux variables dans Vercel (section 4), puis **Redeploy**. |
| « Le lien utilisé est invalide ou a expiré » | Le lien a déjà servi ou date de plus d'une heure : recommencez. Vérifiez la *Site URL* et les *Redirect URLs* (section 3.5). |
| Je ne reçois pas l'email | Regardez dans les indésirables. L'envoi intégré de Supabase est limité à quelques emails par heure. |
| « Les inscriptions sont fermées » | Normal si vous avez désactivé les inscriptions (section 3.5). |

---

## 11. Organisation du code

```
src/
  app/
    (auth)/            pages de connexion, inscription, mot de passe
    (app)/             pages de l'espace connecté (Ma journée, contacts, biens…)
    auth/confirm/      arrivée des liens reçus par email
  components/
    ui/                composants d'interface (boutons, champs, fenêtres) de type shadcn/ui
  lib/
    supabase/          connexion à Supabase (navigateur, serveur, proxy)
    format.ts          mise en forme française (euros, dates, téléphones)
  proxy.ts             protège les pages privées (redirige vers /connexion)
supabase/
  migrations/          création des tables et des règles de sécurité (SQL)
docs/PLAN.md           plan validé de la V1
```
