# Site de la Compagnie Cliffhanger

Site de la Compagnie Cliffhanger, compagnie de théâtre bruxelloise. Site statique **Astro 7**,
alimenté **au build** par l'instance Directus mutualisée de
[`platform-cms`](../platform-cms) (client `cliff`). Rien ne lit le CMS depuis le navigateur.

- **Maquettes Figma :** https://www.figma.com/design/vP8Z0mWn7ytbZk3IoL3Z6u (page « Site · maquettes (V2) » : desktop 1440, états, téléphone 390, tablette 820 ; « Guide dev » pour les couleurs, textes, animations)
- **Référence de style :** https://www.focusandchaliwate.be/fr
- **Originaux des médias :** Google Drive de la compagnie, dossier `CLIFFHANGER/03_MEDIAS` (accès via Hans)

Le site reprend le prototype qui a servi à montrer le projet à la compagnie : mêmes pages, mêmes
classes, mêmes animations, mais de vraies adresses par page, le contenu dans le CMS, un sitemap,
Open Graph et des données structurées.

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
« cliff — lecture build », **jamais** le jeton d'administration : le build doit voir ce que la CI
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

Règles de saisie, rappelées dans les notes du Studio :

- une ligne de générique de rôle « Avec », sans personne, marque la place de la distribution ;
  sans elle, la distribution vient en dernier ;
- une photo ne sert que si elle est cochée « Dans la galerie », choisie pour un carrousel ou pour
  un fond de page ;
- le point focal d'une photo se règle dans l'éditeur d'image du Studio ;
- aucun tiret long : le build le signale et le remplace au rendu.

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
- Variables de dépôt : `SITE_URL`, `DIRECTUS_URL`, `DEPLOY_MARKER` (ex.
  `.deploy-cible-cliffhanger`, un fichier vide de ce nom à la racine du compte FTP). Secrets :
  `DIRECTUS_TOKEN` (posé par `npm run app-user` dans platform-cms), `FTP_HOST`, `FTP_USER`,
  `FTP_PASSWORD`.
- Premier déploiement : `workflow_dispatch` avec `dry_run`, lire la liste, puis pour de vrai.

## Reste à faire

- **Le domaine.** Une fois choisi : `SITE_URL`, et l'adresse canonique en dur dans
  `public/.htaccess` (les redirections s'appuient pour l'instant sur l'hôte demandé).
- La version anglaise : un bloc `languages` et des champs `translations` dans le fichier client,
  un second dictionnaire dans `textes.js`.
- Les polices Adobe, si la compagnie les retient (Jost et Archivo en attendant).
