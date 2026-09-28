# Notes pour un assistant IA (Claude, Copilot…)

Site de la Compagnie Cliffhanger (théâtre, Bruxelles) : Astro 7 statique, alimenté au build par
Directus (`../platform-cms`, client `cliff`). Lis d'abord `README.md`. Tout est en français : code,
commentaires (qui disent pourquoi), identifiants, commits.

## Sources de vérité

1. **Le CMS** fait foi pour le contenu ; **ce dépôt** pour la structure, les textes de l'interface
   (`src/lib/textes.js`) et les animations. Le modèle du CMS vit dans
   `../platform-cms/clients/cliffhanger.json`.
2. **Figma** : https://www.figma.com/design/vP8Z0mWn7ytbZk3IoL3Z6u
   - Page « Site · maquettes (V2) » : section 1 desktop 1440 (01 Accueil `5:3`, 02 Spectacles `5:46`, 03 Spectacle `6:2`, 04 Agenda `6:54`, 05 La compagnie `9:6`, 06 Galerie `9:75`, 07 Contact `9:113`, 08 Fiche personne `27:2`, 09 Montréal `27:50`), section 2 états (survol, menu ouvert), section 3 téléphone 390, section 4 tablette 820. Breakpoints : 40em (tableaux en colonne, texte non justifié), 48em, 64em (en dessous, « Découvrir » réduit à son trait), 80em.
   - Page « Guide dev » : couleurs, styles de texte, espacements, animations chiffrées.
3. **Référence de style** : https://www.focusandchaliwate.be/fr

## Règles à ne jamais casser

- **Aucun tiret long (—), demi-cadratin (–) ni tiret entouré d'espaces** dans les textes visibles. Virgule, deux points ou « · ». `typographier()` (`src/lib/typo.js`) les remplace au rendu et le loader signale ceux du Studio ; les tests le vérifient pour `textes.js`.
- Aucun champ vide rendu, aucun texte provisoire.
- Tous les textes d'interface dans `src/lib/textes.js`, jamais en dur dans un gabarit.
- Le site est centré sur **Bruxelles**. Montréal n'apparaît que sur `/montreal/` (et le pied, et l'entrée du menu).
- Marie-Hélène Ruiz est l'autrice de L'Inédit de Molière, **pas** un membre de l'équipe (groupe « invite »).
- La devise et la démarche artistique sont celles d'**Alexandre Van Campenhout** (sa biographie), pas de la compagnie.
- Transitions entre pages : fondu d'une photo à l'autre, **jamais** en passant par le noir.
- Rester sobre : fond noir, texte blanc, la couleur vient uniquement des photos et des affiches.

## Architecture

- **Prodysos** (back-office de la compagnie) : le loader des représentations y ajoute les dates des spectacles reliés par leur titre, ou par `prodysos_slug` qui force le lien (`relier()`, `src/lib/prodysos.js`, compagnie `PRODYSOS_COMPANY`, jamais un slug de spectacle). Heure de Bruxelles, commune tirée de l'adresse, prix du spectacle ; une date du CMS l'emporte sur la même de Prodysos (et garde sa `reservation`). Une seule lecture partagée par les loaders (`prodysosDuBuild`) : les spectacles y prennent l'affiche et le synopsis de la page publique quand le CMS n'en a pas. Une date réservable se réserve sur la fiche (`Reservation.astro`, `réserver()` dans le navigateur, `data-astro-reload` sinon le ClientRouter avale l'envoi). Prodysos relance `deploy.yml` quand ses données publiques changent (`site_deploy_targets`). Les trois variables `PRODYSOS_*` : toutes ou aucune, exigées au déploiement.
- **Le CMS n'est lu que par les loaders** (`src/lib/loaders.js`, un par collection : spectacles, photos, personnes, distribution, generique, representations, montreal, reglages), via `src/lib/directus.js` (fetch, rejeu sur 429, originaux dans `.cache/directus-assets/`, téléchargements partagés entre loaders). `src/content.config.js` valide (zod) et convertit les images en `ImageMetadata`. `src/lib/contenu.js` rassemble et relie tout pour les pages.
- Zéro spectacle publié ou réglages sans titre : le build s'arrête. Une ligne liée à un spectacle ou une personne dépubliés est ignorée avec un warning.
- Le **digest** de chaque entrée inclut tout ce qui se rend.
- `CHAMPS_FICHIER` (`directus.js`) : seuls champs de `directus_files` que la policy du build autorise (`platform-cms/scripts/lib/permissions.mjs`) ; en demander un autre fait échouer la requête.
- **Images** : tailles dans `src/lib/images.js` (`heros`, `herosSpectacle`, `herosPhoto`, `affiche`, `diapo`, `vignetteGalerie`, `grande`, `og`), rendues par `Photo.astro`. Toujours `width` avec `widths` ; ne jamais lire `.width` d'une `ImageMetadata` dans un gabarit (les dimensions viennent du loader, `dimensionsFichier()` : celles du CMS, sinon lues sur l'original). Astro émet dans `dist/` l'original de tout champ `image()` qu'aucune page ne transforme : c'est pourquoi le loader des photos ne garde que celles de la galerie, des carrousels et des fonds, et que seuls les fonds ont un `portrait`. Un second spectacle de Montréal (seul le premier est montré) aurait le même problème. Photos plein écran (héros, fonds, visionneuse) : AVIF + WebP, recadrage portrait 9:16 au point focal (`assurerPortrait`), `sizes` qui tient compte du cover ; aperçu flou 32 px (`assurerAperçu`) en fond de l'`<img>` pour qu'aucune photo ne sorte du noir. Le préchargement de `Base.astro` vise l'AVIF, portrait ou paysage. Repris du portfolio (`../site-photos-v2`).
- **Générique** : deux collections (distribution, générique) remises en une liste par `lignesGenerique()` ; une ligne de générique de rôle « Avec » sans personne marque la place de la distribution, sinon elle vient en dernier.
- **Dates** : `src/lib/dates.js`, jours formatés en UTC, « aujourd'hui » à Bruxelles ; l'agenda est calculé au build, la reconstruction de la nuit le tient à jour.
- **Pages** : `/`, `/spectacles/`, `/spectacle/<slug>/` (Bruxelles seulement), `/agenda/`, `/compagnie/`, `/personne/<slug>/`, `/galerie/`, `/montreal/`, `/contact/`, `404`, `robots.txt` (fabriqué depuis `SITE_URL`).
- **Style** : Tailwind CSS 4 (plugin Vite, lit `src/` seulement). Gabarits en utilitaires ; `src/styles/site.css` ne garde que `@theme` (jetons du Guide dev, palette de Tailwind retirée, `--spacing-gouttiere`/`--spacing-respiration` car Tailwind réserve `--spacing`), les variantes `menu-ouvert:`, `sans-js:`, `visible:`, `parti:`, `tactile:`, les utilitaires `titre` et `lien-souligne`, `@layer base`, polices et keyframes. Balisage répété → composant (`Section`, `Accroche`, `TexteRiche`, `Intitule`, `Pastille`, `TitrePage`, `PageListe`, `PageCentree`, `LienRetour`), pas `@apply`. Toujours des noms de classes complets (jamais concaténés), y compris dans les chaînes HTML des gabarits et des scripts. Les scripts cherchent `js-*` ou `data-*` (`data-cascade`, `data-tete`, `data-for`), jamais une classe de style.
- **Comportements** : scripts dans les composants, relancés sur `astro:page-load` ou délégués sur le document. `Base.astro` : ClientRouter (repli `swap`), fondu posé sur `<html>` (l'ancienne image reste, la nouvelle monte en 0,7 s), burger et menu `transition:persist`, menu (focus piégé, Échap), cascade `rise`, flou du héros et Découvrir au défilement. Sans JS (`html.js` absent) le menu est une ligne de liens sous le logo. `Fond.astro` : photos de survol différées. `Galerie.astro` : visionneuse en `<dialog>`.
- **SEO** : `src/lib/seo.js` (TheaterGroup sur l'accueil, TheaterEvent par représentation), canonical, Open Graph, sitemap.

## Tester

Toujours avec les vraies données du CMS (le `.env` du poste pointe dessus) :

```sh
npm test                           # fonctions pures, loaders, migration : sans CMS
npm run check                      # astro check charge les collections
npm run build && npm run preview
```

Le faux Directus (`node test/faux-directus/avec.mjs <commande>`) seulement si le vrai CMS est injoignable, et en le disant : il partage `.cache/directus-assets/` avec le vrai, et la purge du loader des photos efface alors tous les originaux du vrai CMS (le `npm run dev` suivant retélécharge tout, quelques minutes). Ne jamais envoyer le formulaire de réservation d'un build fait sur le vrai CMS : la demande part pour de vrai dans Prodysos.

Vérifier au moins 390 px (téléphone), 820 px (tablette) et 1440 px. Chrome headless par CDP (`--remote-debugging-port`) fonctionne sur ce poste ; sous Git Bash, préfixer `MSYS_NO_PATHCONV=1` quand un argument commence par `/`.

## Git

- Travail sur `dev`, `main` déploie (fast-forward). Pousser `dev` lance `check.yml`.
- Commits : `type: Phrase en français` (`feat:`, `fix:`, `chore:`, `docs:`), petits, un corps qui dit le pourquoi. **Aucune ligne d'attribution** (ni Co-Authored-By, ni Claude-Session, ni mention d'un outil).
- Dans platform-cms : `feat(Cliffhanger) Phrase`, branche fusionnée par PR avec commit de merge.
- Les warnings git « LF will be replaced by CRLF » sont normaux sur ce poste.
