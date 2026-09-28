# Site de la Compagnie Cliffhanger

Site de la Compagnie Cliffhanger, compagnie de théâtre bruxelloise. Site statique **Astro 7**,
alimenté **au build** par l'instance Directus mutualisée de
[`platform-cms`](../platform-cms) (client `cliff`). Rien ne lit le CMS depuis le navigateur.

- **Maquettes Figma :** https://www.figma.com/design/vP8Z0mWn7ytbZk3IoL3Z6u (page « Site · maquettes (V2) » : desktop 1440, états, téléphone 390, tablette 820 ; « Guide dev » pour les couleurs, textes, animations)
- **Référence de style :** https://www.focusandchaliwate.be/fr
- **Originaux des médias :** Google Drive de la compagnie, dossier `CLIFFHANGER/03_MEDIAS` (accès via Hans)

Le site reprend le prototype qui a servi à montrer le projet à la compagnie : mêmes pages, même
rendu, mêmes animations, mais de vraies adresses par page, le contenu dans le CMS, un sitemap,
Open Graph et des données structurées. Le style est écrit en **Tailwind CSS 4** (voir « Le style »).

## Commandes

```sh
npm install
npm run dev        # astro dev, lit le CMS au démarrage
npm run build      # télécharge les originaux manquants, fabrique les tailles (sharp)
npm run preview    # sert dist/
npm run check      # astro check (charge les collections : il faut le CMS)
npm test           # node --test : fonctions pures, loaders et migration, sans CMS
npm run migrer     # la migration du prototype vers le CMS (voir plus bas)
```

## `.env`

Copier `.env.example` en `.env`. Obligatoires : `DIRECTUS_URL`, `DIRECTUS_TOKEN`, `SITE_URL`.

`DIRECTUS_TOKEN` est le jeton d'un utilisateur de développement `dev+cliff` portant la policy
de lecture du build de la compagnie (« lecture build », préfixe cliff), **jamais** le jeton d'administration : le build doit voir ce que la CI
voit, le contenu publié seulement. Sans `.env`, `astro:env` fait échouer le build avant la
première requête : c'est voulu, le site n'a aucun contenu local de repli.

### Sans jeton : le faux Directus

Pour construire et regarder le site sans accès au CMS, `test/faux-directus/` sert le contenu du
prototype (`migration/content.js` et ses images) avec la forme de l'API :

```sh
node test/faux-directus/avec.mjs npm run build     # ou npm run check
npm run preview
```

Il ne vit que dans `test/` : le site, lui, ne connaît que le vrai CMS.

## Le cache des images

`.cache/directus-assets/` (git-ignoré) garde les originaux téléchargés et un manifeste : un
fichier absent ou modifié dans le Studio est retéléchargé, le reste ne l'est pas. Le loader des
photos le purge en fin de chargement. Le supprimer force un retéléchargement complet.

## Le contenu vit dans le CMS

Tout le contenu (spectacles, personnes, génériques, représentations, photothèque, page Montréal,
réglages) est dans les collections `cliff_*`. Le code garde la structure, les polices, la vidéo du
menu et le logo. Les textes de l'interface sont dans `src/lib/textes.js`.

Le modèle est décrit dans `../platform-cms/clients/cliffhanger.json`. Pour le faire évoluer :

1. modifier le JSON, puis dans platform-cms `npm run provision -- clients/cliffhanger.json --dry-run`,
   lire, puis sans `--dry-run`, et `npm run audit` ;
2. ici : le loader (`src/lib/loaders.js` : champ demandé, `data`, digest), le schéma zod
   (`src/content.config.js`), la page.

### Les dates de Prodysos

Les représentations programmées dans **Prodysos** (le back-office de la compagnie) rejoignent
celles du CMS au build (`src/lib/prodysos.js`). Le site appelle `get_public_company_shows` en
désignant la **compagnie** (`PRODYSOS_COMPANY`, son `public_slug`), jamais un spectacle : un slug
de spectacle est unique sur toute la base Prodysos, en taper un exposerait à afficher la création
d'une autre troupe. Chaque spectacle Prodysos rejoint ensuite le spectacle du CMS **du même titre**
(comparé sans casse, accents, apostrophes ni ponctuation) : la compagnie n'a rien à relier, il lui
suffit de nommer son projet dans Prodysos comme sur le site. Le champ `prodysos_slug` du CMS ne sert
qu'à forcer le lien quand les titres diffèrent.

- Le jour et l'heure sont ceux de Bruxelles ; la commune est lue après le code postal de
  l'adresse Prodysos (sinon la salle s'affiche seule, avec un warning).
- Prodysos n'a pas de prix : c'est le champ `price` du spectacle, qui sert aussi aux dates du CMS
  laissées sans prix.
- Une date saisie dans le CMS l'emporte sur la même venue de Prodysos (même spectacle, jour et
  heure ; sans heure, tout le jour) : c'est la correction à la main.
- Un spectacle Prodysos sans spectacle publié du même titre ni qui le réclame est ignoré avec un
  warning, qui donne son titre ; un titre porté par deux spectacles du CMS ne relie rien (warning) ;
  deux spectacles qui réclament le même arrêtent le build, comme une compagnie inconnue de Prodysos.
- Une date ajoutée dans Prodysos paraît à la reconstruction suivante : Prodysos la déclenche
  lui-même dans les minutes qui suivent (voir plus bas), sinon la nuit, ou « Mettre en ligne ».
- Seules les dates d'un spectacle dont la **page publique** est publiée dans Prodysos arrivent.

**Affiche et synopsis.** Le CMS fait foi. Un spectacle du CMS sans affiche prend celle de sa page
publique Prodysos (téléchargée au build dans le cache des originaux, sous
`prodysos-affiche-<slug>`, comme une affiche du Studio) ; sans texte, il prend son synopsis, du
texte brut mis en paragraphes.

**Réservation.** Une date à venir venue de Prodysos se réserve depuis la fiche du spectacle : un
lien « Réserver » sur sa ligne (et sur sa série dans l'agenda) mène au formulaire
(`src/components/Reservation.astro`), qui appelle `create_public_reservation` **depuis le
navigateur**, avec la clé publiable. C'est le seul appel du site au moment de la visite. La demande
arrive dans l'onglet « Page publique » du spectacle dans Prodysos, qui la valide (date à venir, 1 à
20 places) et envoie ses e-mails ; un refus s'affiche avec le message de Prodysos. Une date saisie
dans le CMS qui remplace une date de Prodysos reste réservable ; une date du CMS seule ne l'est
pas. Sans JavaScript, le formulaire est caché et une ligne renvoie vers l'e-mail des réglages.

**Reconstruction déclenchée par Prodysos.** Une date, une affiche ou un synopsis modifiés dans
Prodysos lancent `deploy.yml` (`workflow_dispatch` sur `main`) par la table `site_deploy_targets`
de Prodysos (voir `docs/ops/site-rebuild.md` dans le dépôt Prodysos : jeton GitHub, ligne de la
cible). La reconstruction de la nuit reste le filet : une date jouée ne change rien en base.

Règles de saisie, rappelées dans les notes du Studio :

- une ligne de générique de rôle « Avec », sans personne, marque la place de la distribution ;
  sans elle, la distribution vient en dernier ;
- une photo ne sert que si elle est cochée « Dans la galerie », choisie pour un carrousel ou pour
  un fond de page ;
- le point focal d'une photo se règle dans l'éditeur d'image du Studio ;
- aucun tiret long : le build le signale et le remplace au rendu.

## Le style

Tailwind CSS 4, par son plugin Vite, sans fichier de configuration. Les gabarits s'écrivent en
utilitaires ; `src/styles/site.css` ne garde que ce qu'ils partagent :

- les jetons du « Guide dev » dans `@theme` : noir, blanc, gris (la palette de Tailwind est
  retirée), Jost et Archivo, les tailles de texte sans interligne imposé, la gouttière et la
  respiration qui grandissent avec l'écran (`px-gouttiere`, `my-respiration`) ;
- les variantes d'état : `menu-ouvert:`, `sans-js:`, `visible:` (photo de survol), `parti:`
  (Découvrir), `tactile:` ;
- deux utilitaires maison, `titre` et `lien-souligne`, la base, les polices et les animations.

Le balisage qui revient d'une page à l'autre est un composant, pas une classe : `Section`,
`Accroche`, `TexteRiche` (le HTML du CMS, stylé depuis son conteneur), `Intitule`, `Pastille`,
`TitrePage`, `PageListe`, `PageCentree`, `LienRetour`. Les scripts trouvent leurs éléments par
`js-*` ou `data-*`, jamais par une classe de style.

## La migration du prototype

Le dossier `migration/` garde `content.js` et `img/` du prototype jusqu'à ce que le CMS soit
rempli. `npm run migrer` les verse dans le CMS avec le jeton **d'administration**
(`.env.migration`, modèle `.env.migration.example`). Idempotent : un rejeu ne crée rien de plus.

```sh
npm run migrer -- --hors-ligne   # ce qui serait écrit, sans lire l'instance
npm run migrer -- --dry-run      # lit l'instance, n'écrit rien
npm run migrer                   # écrit
```

Une fois la migration vérifiée dans le Studio, le dossier `migration/` s'en va (avec
`scripts/lib/prototype.mjs`, `scripts/migrer.mjs` et le faux Directus, ou ce dernier réécrit sur
des données de test).

## Déploiement

- Travail sur `dev`, `main` déploie. Pousser `dev` lance `check.yml` (astro check, tests, build,
  rien de publié).
- `deploy.yml` : tests (fuseau de Bruxelles puis UTC), build, garde-fou du fichier témoin, `lftp
  mirror` vers Infomaniak, puis date de mise en ligne écrite dans `cliff_publication`. Déclenché
  par un push sur `main`, par le bouton « Mettre en ligne » du Studio (`workflow_dispatch`), et
  **chaque nuit à 3 h UTC**, pour qu'une représentation jouée quitte « À venir » sans clic.
- Variables de dépôt : `SITE_URL`, `DIRECTUS_URL`, `PRODYSOS_URL`, `PRODYSOS_COMPANY`, `DEPLOY_MARKER` (ex.
  `.deploy-cible-cliffhanger`, un fichier vide de ce nom à la racine du compte FTP). Secrets :
  `DIRECTUS_TOKEN` (posé par `npm run app-user` dans platform-cms), `PRODYSOS_KEY` (la clé
  publiable de Supabase), `FTP_HOST`, `FTP_USER`,
  `FTP_PASSWORD`.
- Premier déploiement : `workflow_dispatch` avec `dry_run`, lire la liste, puis pour de vrai.

## Reste à faire

- **Le domaine.** Une fois choisi : `SITE_URL`, et l'adresse canonique en dur dans
  `public/.htaccess` (les redirections s'appuient pour l'instant sur l'hôte demandé).
- La version anglaise : un bloc `languages` et des champs `translations` dans le fichier client,
  un second dictionnaire dans `textes.js`.
- Les polices Adobe, si la compagnie les retient (Jost et Archivo en attendant).
