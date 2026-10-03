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
   — dont [installer l'application sur le téléphone](#36-installer-lapplication-sur-le-téléphone)
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
| Contacts | Fiche (coordonnées, source, notes), plusieurs rôles (vendeur, acquéreur, prospect, partenaire), boutons Appeler / SMS / Mail, recherche sans accents et filtres |
| Échanges | Timeline : appel, SMS, mail, rendez-vous (y compris planifiés), visite, note |
| Acquéreurs | Qualification (budget, accord de principe, apport, délai, vente préalable, motivation) et critères de recherche |
| Pipelines | Vue Kanban vendeurs et acquéreurs avec glisser-déposer (appui long sur téléphone) |
| Biens | Fiche complète (type, adresse localisée, surface, pièces, étage, DPE/GES, état, prix, charges, taxe foncière…), statut, lien vers le vendeur |
| Photos | Ajout depuis l'appareil photo ou la galerie du téléphone (photos réduites automatiquement), photo principale, stockage privé |
| Mandat | Type, dates, honoraires, alerte 30 jours avant l'échéance |
| Visites | Date, acquéreur, retour de visite (note sur 5 + avis), suivi de la transmission au vendeur |
| Rapprochement | Score de correspondance bien / acquéreur (sur 100) recalculé automatiquement, listes « acquéreurs compatibles » et « biens compatibles », notification des nouvelles correspondances |
| Tâches | Tâches avec échéance, liées à un contact et/ou un bien ; en retard / aujourd'hui / à venir / terminées |
| Relances suggérées | Acquéreur sans contact depuis 30 jours, mandat qui arrive à échéance, avis de visite à demander, retour de visite à transmettre au vendeur |
| Ma journée | Écran d'accueil : rendez-vous et visites du jour, tâches en retard et du jour, relances suggérées, nouvelles correspondances |
| Estimation DVF | Ventes réelles comparables (même type, rayon, période, surface ±X %), carte et tableau, exclusion de ventes, ajustements en %, fourchette basse / moyenne / haute, prix conseillé, honoraires et net vendeur, historique sur la fiche du bien |
| Rapport PDF | Avis de valeur à remettre au vendeur : logo et coordonnées de l'agence, le bien et sa photo, l'estimation, la carte et le tableau des ventes, l'argumentaire, la méthode |
| Application installable | Icône sur l'écran d'accueil du téléphone (iPhone et Android) ou de l'ordinateur, ouverture en plein écran, page « hors connexion » sans réseau |

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

Les 7 fichiers, dans l'ordre :

| Fichier | Contenu |
|---|---|
| `20261001000100_profiles.sql` | profils des agents (création automatique à l'inscription) |
| `20261001000200_contacts.sql` | contacts, rôles, acquéreurs (critères), échanges |
| `20261001000300_properties.sql` | biens, photos (stockage privé), visites |
| `20261001000400_matches.sql` | rapprochement biens / acquéreurs (calcul du score) |
| `20261001000500_tasks.sql` | tâches et relances |
| `20261001000600_estimations.sql` | estimations DVF |
| `20261001000700_logos.sql` | stockage privé des logos d'agence |

Chaque fichier active la sécurité « RLS » : un agent ne peut lire ou modifier que ses propres données.

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

### 3.6 Installer l'application sur le téléphone

ImmoLab est une « application web installable » : pas besoin d'App Store ni de Play Store.
Une fois installée, elle s'ouvre depuis une icône sur l'écran d'accueil, en plein écran, et affiche les mêmes données
que sur l'ordinateur. La carte **Installer l'application** (menu **Plus**, ou **Réglages**) rappelle la marche à suivre.

**iPhone / iPad (Safari)**
1. Ouvrez l'adresse de l'application dans **Safari** et connectez-vous.
2. Touchez le bouton **Partager** (carré avec une flèche vers le haut).
3. Choisissez **Sur l'écran d'accueil**, puis **Ajouter**.

**Android (Chrome)**
1. Ouvrez l'adresse de l'application dans **Chrome** et connectez-vous.
2. Touchez le bouton **Installer ImmoLab** de la carte « Installer l'application » (menu **Plus**), ou le menu **⋮** de
   Chrome → **Installer l'application** (ou **Ajouter à l'écran d'accueil**).

**Ordinateur (Chrome ou Edge)** : cliquez sur l'icône d'installation à droite de la barre d'adresse.

> Une connexion Internet reste nécessaire : les données ne sont pas copiées sur le téléphone (elles sont toujours
> à jour et protégées). Sans réseau, une page « Vous êtes hors connexion » s'affiche avec un bouton **Réessayer**.

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

Le fichier [`supabase/demo-data.sql`](supabase/demo-data.sql) crée des données **fictives** situées à Nantes
(contacts, acquéreurs avec leurs critères, échanges, rendez-vous du jour…) pour tester l'application.

1. Dans l'application, créez un compte **dédié à la démonstration** (par exemple `prenom.nom+demo@gmail.com` :
   avec Gmail, le « +demo » arrive dans la même boîte mail). Confirmez-le via l'email reçu.
2. Ouvrez le fichier `supabase/demo-data.sql` sur GitHub et copiez son contenu.
3. Dans Supabase → **SQL Editor** → **+ New query**, collez-le.
4. **Remplacez** `demo@exemple.fr` (ligne `v_email`, vers le haut du fichier) par l'email de votre compte de démonstration.
5. Cliquez sur **Run**. Le message *Données de démonstration créées* s'affiche dans l'onglet **Messages**.
6. Connectez-vous à l'application avec ce compte : tout est prêt.

Par sécurité, le script refuse de s'exécuter si le compte contient déjà des contacts
(il ne mélange jamais démo et vraies données). Pour repartir de zéro, supprimez le compte de démonstration dans
Supabase → **Authentication** → **Users** (ses données sont supprimées avec lui), recréez-le, et relancez le script.

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

### Étape 2 — Contacts

Avec les données de démonstration chargées (section 5) :

1. **Contacts** : 12 contacts s'affichent. Tapez `helene` (sans accent) dans la recherche : *Hélène Moreau* apparaît.
   Tapez un numéro `06 39 98 10 06` : *Thomas Petit* apparaît.
2. Touchez **Acquéreurs**, puis choisissez une étape (ex. *Qualifié*) : la liste se filtre.
3. Ouvrez la fiche de **Camille Robin** :
   - sur téléphone, **Appeler** ouvre le composeur et **SMS** l'application de messages ;
   - le bloc **Projet d'achat** résume sa qualification et ses critères ; **Modifier** permet de les changer ;
   - changez l'étape du **pipeline acquéreur** : un message confirme l'enregistrement.
4. **Ajouter un échange** : choisissez *Rendez-vous*, une date future et un texte. Il apparaît en haut de la timeline avec la mention « À venir ».
5. **Nouveau** contact : cochez *Partenaire* (un champ « Type de partenaire » apparaît), saisissez un code postal à 3 chiffres :
   une erreur s'affiche **sans effacer** ce que vous avez saisi.
6. **Pipelines** (menu latéral sur ordinateur, ou bouton à côté de « Nouveau » sur téléphone) :
   glissez *Sophie Garnier* de « Prospect » vers « Estimation » (sur téléphone : appui long sur la carte, puis glisser).
   Rechargez la page : le changement est conservé.
7. Supprimez un contact (icône corbeille sur sa fiche) : une confirmation est demandée.

### Étape 3 — Biens

1. **Biens** : 10 biens s'affichent avec leur statut. Deux portent une alerte orange « Mandat : échéance dans … jours ».
   Le filtre **Échéance < 30 jours** ne garde que ceux-là.
2. Ouvrez l'appartement du **12 rue Crébillon** : un bandeau rappelle l'échéance du mandat.
3. Sur téléphone, touchez **Ajouter des photos** : choisissez **Prendre une photo** ou la galerie. La photo apparaît
   (elle est réduite avant l'envoi pour aller vite en 4G). Le menu **⋮** d'une photo permet d'en faire la photo principale ou de la supprimer.
4. **Ajouter une visite** : choisissez un acquéreur, une note et un avis, cochez ou non « Retour transmis au vendeur ».
   Le bouton **Marquer le retour comme transmis** enregistre la date de transmission.
5. Changez le **statut** du bien avec le menu à côté du prix.
6. **Nouveau** bien : tapez le début d'une adresse (ex. `5 place royale nantes`) puis choisissez une suggestion :
   le code postal, la ville et la position GPS se remplissent (message « Adresse localisée »).
   Mettez une date de fin de mandat antérieure à la date de début : une erreur s'affiche sans effacer la saisie.
7. Ouvrez la fiche du vendeur **Jean-Luc Bernard** : le bloc **Biens en vente** liste ses biens. Sur la fiche de
   **Camille Robin**, la visite de la maison de Rezé apparaît dans la timeline.

### Étape 4 — Rapprochement biens / acquéreurs

**Comment le score est calculé** (sur 100) :
- critères **éliminatoires** : type de bien recherché, ville ou code postal recherchés, prix au plus 10 % au-dessus du budget ;
- **pénalités** : prix au-dessus du budget (jusqu'à −25), surface sous le minimum (−2 par % manquant, max −40),
  pièces manquantes (−15 par pièce), critère indispensable absent (−20 chacun) ;
- seules les correspondances d'au moins **50/100** sont affichées ;
- seuls les biens **en estimation ou en vente** et les acquéreurs **ni « acheté » ni « perdu »** sont rapprochés.

Le calcul est fait automatiquement par la base de données à chaque modification d'un bien, d'une recherche ou d'un contact.

1. Avec les données de démonstration, une pastille rouge apparaît sur **Correspondances** (menu latéral) ou sur **Plus**
   (téléphone) : 9 nouvelles correspondances.
2. Ouvrez **Correspondances** : chaque ligne montre le score, le bien, l'acquéreur et le détail des critères
   (✓ respecté, ✗ non respecté, ? non renseigné).
3. Fiche de **Thomas Petit** : le bloc **Biens compatibles** liste 3 biens. Cliquez sur **Modifier** (projet d'achat),
   passez le budget à `350000` et enregistrez : un 4ᵉ bien (rue Kervégan) apparaît, marqué **Nouveau**.
4. Fiche de la **maison de Rezé** : le bloc **Acquéreurs compatibles** montre Camille Robin (100/100).
5. Passez un acquéreur à l'étape **Perdu** (sur sa fiche) : ses correspondances disparaissent.
6. Sur **Correspondances**, **Tout marquer comme vu** : la pastille de notification disparaît.

### Étape 5 — Tâches et « Ma journée »

**Les relances suggérées** sont calculées à chaque affichage (elles ne sont pas enregistrées) :
- **Relancer un acquéreur** : aucun échange ni visite depuis 30 jours (acquéreurs ni « acheté » ni « perdu ») ;
- **Renouvellement du mandat** : échéance dans 30 jours ou moins (biens en estimation, en vente ou sous offre) ;
- **Demander son avis à l'acquéreur** : visite passée sans retour saisi ;
- **Transmettre le retour au vendeur** : retour saisi mais pas encore marqué « transmis ».

Une relance disparaît d'elle-même quand la situation est réglée (échange saisi, mandat prolongé, retour saisi ou transmis),
ou quand vous la transformez en tâche avec le bouton **+ Tâche**.

1. Ouvrez **Ma journée** (écran d'accueil) avec les données de démonstration :
   - **Agenda du jour** : rendez-vous d'estimation à 10 h, visite à 14 h, rendez-vous à 17 h 30 (avec boutons Appeler / SMS) ;
   - **Relances suggérées** : 5 relances (Thomas Petit sans contact depuis 40 jours, deux mandats à échéance,
     avis de visite à demander à Nadia Benali, retour à transmettre à Jean-Luc Bernard) ; après 14 h, une 6ᵉ apparaît :
     « Demander son avis à Julien Faure » (la visite du jour est passée).
2. Touchez **+ Tâche** sur « Relancer Thomas Petit » : la relance disparaît et une tâche apparaît dans **Tâches → Aujourd'hui**.
3. Cochez la tâche (rond à gauche) : elle passe dans « Terminées ».
4. **Tâches** → **Nouvelle tâche** : saisissez un intitulé, une date passée et choisissez un bien. Elle apparaît dans **En retard** (en rouge).
5. Ouvrez la fiche de **Thomas Petit** : le bloc **Tâches** montre la tâche liée. Le bouton **Nouvelle tâche** de la fiche
   pré-remplit le contact (idem depuis la fiche d'un bien).
6. Sur la fiche de la **maison de Rezé**, cliquez sur **Marquer le retour comme transmis** : la relance
   « Transmettre le retour de visite à Jean-Luc Bernard » disparaît de **Ma journée**.

### Étape 6 — Estimation DVF

**Méthode de calcul :**
1. ventes « classiques » (ni VEFA, ni adjudication, ni échange) d'**un seul** appartement ou d'**une seule** maison
   (dépendances acceptées), dans le rayon (500 m par défaut, 3 km au plus), sur la période (3 ans par défaut, 5 ans au plus),
   avec une surface à ±20 % ; au-delà de 500 ventes, seules les 500 plus proches sont gardées ;
2. les prix au m² **atypiques** (règle de l'écart interquartile) sont pré-exclus ; vous pouvez exclure ou réintégrer toute vente ;
3. fourchette **basse / moyenne / haute** = 1er quartile / médiane / 3e quartile des prix au m² × surface × (1 + ajustements) ;
4. **prix de mise en vente conseillé** (honoraires inclus, arrondi au millier, modifiable). Les prix DVF sont ceux des actes
   de vente : ils **incluent** les honoraires payés par le vendeur mais **pas** ceux payés par l'acquéreur. Donc :
   - honoraires **à la charge du vendeur** : prix conseillé = valeur moyenne ; honoraires = % du prix ;
   - honoraires **à la charge de l'acquéreur** : la valeur moyenne est le net vendeur ; prix conseillé = valeur moyenne + honoraires
     (% du net vendeur) ;
5. **net vendeur** = prix de mise en vente − honoraires (honoraires en % ou en €).

1. Ouvrez un bien (ex. **56 boulevard Guist'hau**), bloc **Estimations** → **Estimer** : le formulaire est pré-rempli
   (type, adresse localisée, surface, pièces).
2. **Rechercher les ventes comparables** : la carte (OpenStreetMap) et le tableau des ventes s'affichent.
   Touchez un point de la carte ou décochez une ligne pour **exclure** une vente : le résultat se met à jour aussitôt.
   Sur téléphone, la carte ne bouge pas au doigt (pour pouvoir faire défiler la page) : zoomez avec deux doigts ou les boutons + / −.
   Un point plus gros réunit plusieurs ventes du même immeuble.
3. Saisissez des **ajustements** (ex. DPE `-3`, Extérieur `2,5`) et les **honoraires** : la fourchette, le prix conseillé
   et le net vendeur sont recalculés. Passez les honoraires « à la charge de l'acquéreur » : le net vendeur devient égal
   à la valeur moyenne et le prix conseillé augmente du montant des honoraires.
4. Changez le **rayon** après une recherche : le message « Les critères ont changé » apparaît et l'enregistrement est
   bloqué jusqu'à une nouvelle recherche (les ventes affichées doivent correspondre aux critères enregistrés).
5. Rédigez l'**argumentaire** puis **Enregistrer l'estimation** : la page de l'estimation s'ouvre ; elle apparaît aussi
   dans l'historique de la fiche du bien et dans **Plus → Estimations**.
6. **Modifier** une estimation recharge les ventes enregistrées (copie figée) ; **Relancer la recherche** les met à jour.
   Le prix conseillé suit les nouveaux ajustements, sauf si vous l'aviez saisi vous-même.

### Étape 7 — Rapport PDF (avis de valeur)

1. **Réglages** (menu **Plus** sur téléphone) : renseignez **Mon profil** (nom, téléphone, agence, adresse), puis
   **Logo de l'agence** → **Ajouter un logo** (PNG ou JPEG ; l'image est réduite automatiquement). Le logo s'affiche ;
   **Changer le logo** remplace l'ancien (qui est supprimé du stockage), **Retirer** l'enlève.
2. Ouvrez une estimation enregistrée (fiche d'un bien → bloc **Estimations**, ou **Plus → Estimations**) et touchez
   **Rapport PDF** : le rapport s'ouvre dans un nouvel onglet. Sur téléphone, utilisez le bouton de partage du lecteur PDF
   pour l'enregistrer ou l'envoyer par mail.
3. Vérifiez le contenu :
   - **page 1** : logo (ou nom de l'agence) et vos coordonnées, le bien avec sa photo principale, le prix de mise en vente
     conseillé, la fourchette, les honoraires et le net vendeur ;
   - **page 2** : la carte (fond OpenStreetMap, cercle de recherche, ventes retenues en bleu, exclues en gris) et le tableau
     des ventes retenues (les 60 plus proches ; toutes comptent dans le calcul) ;
   - **dernière page** : votre argumentaire, la méthode de calcul et les mentions « À savoir » ;
   - en bas de chaque page : agence, date de l'avis et numéro de page.
4. La date « établie le » est celle de la dernière modification de l'estimation. Les caractères que la police du PDF
   ne connaît pas sont remplacés (« → » devient « -> », « ≥ » devient « >= ») ; les emoji sont retirés.

### Étape 8 — Application installable (PWA)

1. Sur un téléphone Android avec Chrome, ouvrez l'application, puis **Plus** : la carte **Installer l'application** propose
   un bouton **Installer ImmoLab** (ou, s'il n'apparaît pas encore, la marche à suivre par le menu ⋮). Installez-la.
2. Sur iPhone avec Safari, ouvrez **Plus** : la carte explique **Partager → Sur l'écran d'accueil**. Ajoutez-la.
3. Ouvrez ImmoLab depuis l'icône de l'écran d'accueil : elle s'affiche en plein écran, sans barre d'adresse,
   et la carte « Installer l'application » n'apparaît plus.
4. Passez le téléphone en **mode avion** et ouvrez une page (ex. **Contacts**) : la page « Vous êtes hors connexion »
   s'affiche. Réactivez le réseau et touchez **Réessayer** : la page demandée s'ouvre.
5. Appui long sur l'icône (Android) : les raccourcis **Ma journée**, **Nouveau contact** et **Tâches** sont proposés.

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

### Tout sur votre ordinateur, sans compte Supabase

Pour essayer l'application sans rien créer en ligne, Supabase peut tourner sur votre ordinateur
(base de données, comptes et stockage des photos). Il faut en plus [Docker Desktop](https://www.docker.com/products/docker-desktop/),
installé et **démarré**.

1. Faites les étapes 1 et 2 ci-dessus (Node.js, Git, `git clone`, `npm install`).
2. Démarrez Supabase en local (la première fois, le téléchargement prend plusieurs minutes) :
   ```bash
   npx supabase start
   ```
   Les 7 migrations sont appliquées automatiquement. À la fin, la commande affiche notamment l'**API URL**
   (`http://127.0.0.1:54321`) et la **Publishable key** (ou « anon key » selon la version).
   Vous pouvez les réafficher avec `npx supabase status`.
3. Créez le fichier `.env.local` avec ces deux valeurs :
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=collez-ici-la-publishable-key
   ```
4. Lancez l'application : `npm run dev`, puis ouvrez <http://localhost:3000> et **créez un compte**
   (en local, aucune confirmation par email n'est demandée).
5. Données de démonstration : ouvrez le tableau de bord local <http://127.0.0.1:54323> → **SQL Editor**,
   collez le contenu de `supabase/demo-data.sql`, remplacez `demo@exemple.fr` par l'email de votre compte, puis **Run**
   (comme en [section 5](#5-données-de-démonstration)).
6. Pour arrêter : `Ctrl + C` dans le terminal de l'application, puis `npx supabase stop`
   (vos données sont conservées pour la prochaine fois).

> En local, l'application n'est accessible que sur cet ordinateur. Pour l'utiliser sur votre téléphone
> (et l'installer sur l'écran d'accueil), mettez-la en ligne (section 3) : l'installation exige une adresse en `https://`.
> Les estimations DVF, le géocodage et les cartes utilisent les services publics en ligne : une connexion Internet reste nécessaire.

---

## 8. Sources de données et limites

| Donnée | Source | Remarques |
|---|---|---|
| Ventes comparables | **API « Données foncières » du Cerema**, jeu DVF+ open data (`apidf-preprod.cerema.fr`) | Gratuite, sans clé. Ventes du 1er janvier 2014 au 31 décembre 2025 (version 2026.1). Service en « préproduction » : il peut être lent ou indisponible. |
| Ventes (repli automatique) | **Fichiers « DVF géolocalisées »** d'Etalab (`files.data.gouv.fr/geo-dvf`) | Utilisés automatiquement si l'API du Cerema ne répond pas (un message le signale). 5 dernières années. |
| Adresse → position GPS | **Géoplateforme IGN** (`data.geopf.fr/geocodage`) | Remplace l'ancienne API Adresse, arrêtée fin janvier 2026. Limite : 50 requêtes par seconde. |
| Fond de carte | **OpenStreetMap** | Attribution « © contributeurs OpenStreetMap » affichée. Usage modéré. |

**Limites à connaître :**
- DVF ne couvre **ni l'Alsace (67, 68), ni la Moselle (57), ni Mayotte** (livre foncier) : l'application le signale.
- Les données sont publiées **avec plusieurs mois de décalage** (mises à jour en avril et en octobre) :
  les ventes les plus récentes n'y figurent pas encore. La date de la vente la plus récente trouvée est affichée.
- DVF ne donne ni l'état, ni l'étage, ni le DPE des biens vendus : ce sont vos **ajustements** qui en tiennent compte.
- Aucun site d'annonces n'est consulté ni aspiré.

**Variables facultatives** (à ne renseigner que si besoin, dans Vercel) :
- `DVF_SOURCE=geodvf` : utiliser directement les fichiers d'Etalab (si l'API du Cerema est durablement indisponible) ;
- `DVF_API_URL`, `GEODVF_URL`, `GEOCODING_API_URL`, `OSM_TILE_URL`, `NEXT_PUBLIC_OSM_TILE_URL` : adresses des services
  (utiles uniquement pour les tests).

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
| Le bouton « Installer ImmoLab » n'apparaît pas (Android) | Chrome le propose après quelques secondes d'utilisation ; sinon passez par le menu ⋮ → **Installer l'application**. L'adresse doit être en `https://` (c'est le cas sur Vercel). |
| L'application installée affiche une ancienne version | Fermez-la complètement puis rouvrez-la : la nouvelle version est chargée automatiquement. |
| Le rapport PDF n'a pas de carte | Le service de cartes OpenStreetMap n'a pas répondu à temps : régénérez le rapport un peu plus tard. |
| « Le service DVF du Cerema ne répond pas » | Normal de temps en temps (service en préproduction) : les fichiers de data.gouv.fr prennent le relais automatiquement. |

---

## 11. Organisation du code

```
src/
  app/
    (auth)/            pages de connexion, inscription, mot de passe
    (app)/             pages de l'espace connecté (Ma journée, contacts, biens…)
    auth/confirm/      arrivée des liens reçus par email
    hors-ligne/        page affichée sans réseau (application installée)
    manifest.ts        manifeste de l'application installable (nom, icônes, couleurs)
  components/
    ui/                composants d'interface (boutons, champs, fenêtres) de type shadcn/ui
    address-autocomplete.tsx  saisie d'adresse avec suggestions (géocodage IGN)
    estimation/        carte des ventes comparables (Leaflet / OpenStreetMap)
    pwa/               enregistrement du service worker, carte « Installer l'application »
  lib/
    supabase/          connexion à Supabase (navigateur, serveur, proxy)
    queries/           lectures en base réutilisées par plusieurs pages
    constants.ts       listes de valeurs et libellés (rôles, étapes, types de bien…)
    types.ts           types TypeScript des tables
    format.ts          mise en forme française (euros, dates, téléphones)
    geocoding.ts       adresse → coordonnées GPS (Géoplateforme IGN)
    property.ts        titre d'un bien, alerte d'échéance du mandat
    matching.ts        libellés des critères de correspondance (le calcul est en SQL)
    suggestions.ts     relances suggérées (acquéreurs, mandats, retours de visite)
    estimation.ts      calculs de l'estimation (distance, quartiles, ajustements, honoraires)
    dvf/               lecture des ventes DVF : cerema.ts (source principale), geodvf.ts (repli), index.ts (choix)
    pdf/               rapport PDF (avis de valeur) : mise en page, caractères, contrôle des images
    static-map.ts      carte du rapport PDF (tuiles OpenStreetMap assemblées sur le serveur)
  proxy.ts             protège les pages privées (redirige vers /connexion)
public/
  sw.js                service worker (démarrage rapide, page hors connexion ; aucune donnée mise en cache)
  icons/               icônes de l'application
supabase/
  migrations/          création des tables et des règles de sécurité (SQL)
  demo-data.sql        données de démonstration fictives (Nantes)
docs/PLAN.md           plan validé de la V1
```
