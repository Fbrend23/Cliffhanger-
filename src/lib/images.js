// Les tailles d'images du site : une seule décision par usage, écrite ici et
// pas dans chaque gabarit. Astro dédoublonne les transformations aux mêmes
// options : une photo qui est fond d'accueil et héros de sa page n'est
// fabriquée qu'une fois.
//
// Deux pièges, tous deux vus sur le portfolio :
// - Toujours passer `width` avec `widths` : sans lui, Astro fabrique le `src`
//   de repli à la taille de l'original, et l'émet dans dist/.
// - Ne jamais lire une propriété d'une ImageMetadata (`image.width`) dans un
//   gabarit : ça émet aussi l'original. Les dimensions viennent des loaders
//   (`heroTaille`, `width`/`height` des photos).

import { getImage } from 'astro:assets';

/** @typedef {{ width: number|null, height: number|null }} Taille */
/** @typedef {{ srcset: string, avif: string|null, sizes: string }} Portrait */
/**
 * Ce que Photo.astro rend : le WebP (`src`, `srcset`), et selon la taille
 * l'AVIF, le recadrage portrait et l'aperçu flou.
 * @typedef {{ src: string, srcset: string, sizes: string, width: number, height: number, avif: string|null, portrait: Portrait|null, apercu: string|null }} Réactive
 */

/**
 * Une image en plusieurs largeurs, jamais au-dessus de l'original : ce qu'un
 * `<img srcset sizes>` attend, avec les dimensions qui réservent sa place.
 * Avec `avif`, les mêmes largeurs aussi en AVIF, pour une `<source>`.
 *
 * @param {import('astro').ImageMetadata} image
 * @param {Taille|null|undefined} taille  les dimensions de l'original, lues par le loader
 * @param {number[]} largeurs
 * @param {string} sizes
 * @param {{ qualité?: number, avif?: boolean }} [options]
 * @returns {Promise<Réactive>}
 */
async function réactive(image, taille, largeurs, sizes, { qualité = 78, avif = false } = {}) {
  const max = taille?.width ?? Math.max(...largeurs);
  const retenues = largeurs.filter((l) => l < max);
  const width = Math.min(max, Math.max(...largeurs));
  if (!retenues.includes(width)) retenues.push(width);
  const options = { src: image, width, widths: retenues, sizes };
  const img = await getImage({ ...options, format: 'webp', quality: qualité });
  const enAvif = avif ? await getImage({ ...options, format: 'avif', quality: QUALITÉ_AVIF }) : null;
  const height = taille?.width && taille?.height ? Math.round((taille.height / taille.width) * width) : Number(img.attributes.height) || width;
  return { src: img.src, srcset: img.srcSet.attribute, sizes, width, height, avif: enAvif?.srcSet.attribute ?? null, portrait: null, apercu: null };
}

/**
 * Ce que `sizes` doit dire d'une image qui COUVRE l'écran (object-fit:
 * cover) : tant que l'écran est plus large qu'elle, elle est calée sur la
 * largeur (100vw) ; sinon sur la hauteur, et sa largeur affichée vaut
 * 100vh × son ratio. `100vw` seul la sous-estimait d'autant : un téléphone
 * tenu droit prenait une image trois fois trop petite, agrandie et floue.
 * @param {Taille|null|undefined} taille
 */
function couvre(taille) {
  if (!taille?.width || !taille?.height) return '100vw';
  return `(min-aspect-ratio: ${taille.width}/${taille.height}) 100vw, ${Math.round((taille.width / taille.height) * 100)}vh`;
}

/**
 * L'inverse pour une image CONTENUE dans l'écran (la visionneuse) : calée sur
 * la hauteur quand l'écran est plus large qu'elle, sur la largeur sinon. Un
 * portrait sur un écran large n'en occupe qu'un tiers.
 * @param {Taille|null|undefined} taille
 */
function contient(taille) {
  if (!taille?.width || !taille?.height) return '100vw';
  return `(min-aspect-ratio: ${taille.width}/${taille.height}) ${Math.round((taille.width / taille.height) * 100)}vh, 100vw`;
}

// Une photo qui couvre l'écran est la première chose que le visiteur regarde :
// un portable de 1440 px en 2× demande 2880 px de large, un écran 4K plus
// encore. Les largeurs montent donc jusqu'à 3200, jamais au-dessus de
// l'original ; et la qualité est plus haute qu'ailleurs, parce qu'un grain de
// compression se voit sur un aplat sombre en plein écran là où il disparaît
// dans une vignette. Les fichiers du prototype, petits et déjà compressés,
// avaient rendu tout le site flou : ce n'est pas le réglage qui les sauve,
// c'est le remplacement par les originaux dans le Studio.
const PLEIN_ÉCRAN = [960, 1440, 2048, 2560, 3200];
const QUALITÉ_PLEIN_ÉCRAN = 84;

// Les photos plein écran sont aussi servies en AVIF, WebP en repli : c'est le
// premier téléchargement de presque chaque page, et l'AVIF y pèse nettement
// moins à qualité vue égale. Seulement elles : sur les affiches et les
// vignettes, le gain fond et l'encodage AVIF, lent, allongerait le build.
// L'échelle de qualité n'est pas celle du WebP. Mesuré sur trois originaux du
// site (dont la photo sombre de l'accueil) en 960, 1440 et 2880 px, par
// l'écart à l'original (PSNR, image entière et ombres) : 60 égale ou dépasse
// le WebP 84 partout, pour 61 à 89 % de son poids ; 55 passait dessous.
const QUALITÉ_AVIF = 60;

// Le recadrage portrait (lib/directus.js) couvre un téléphone ou une
// tablette tenus droits : 56vh de large sur un téléphone (1420 px physiques
// en 3×), 100vw sur une tablette (1640 en 2×). Jusqu'à 1600 px, donc, et pas
// 1280 comme le portfolio : la netteté passe d'abord, comme pour le paysage
// (le fond de l'accueil sur téléphone pèse 390 Ko au lieu de 256).
const PORTRAIT_LARGEURS = [640, 960, 1280, 1600];
const PORTRAIT = { width: 9, height: 16 };

/**
 * Les dimensions du recadrage portrait d'un original : même calcul que
 * `cadrePortrait` (lib/directus.js), sans lire le fichier.
 * @param {Taille} taille
 * @returns {Taille}
 */
function taillePortrait({ width, height }) {
  if (!width || !height) return { width: null, height: null };
  const ratio = PORTRAIT.width / PORTRAIT.height;
  return width / height > ratio ? { width: Math.round(height * ratio), height } : { width, height: Math.round(width / ratio) };
}

/**
 * La grande photo du haut d'une page, et les fonds plein écran : 960 px pour
 * un téléphone, 1440 pour un portable en 1×, 2048 à 3200 pour les écrans 2×,
 * en AVIF et en WebP. Avec son recadrage portrait, les écrans tenus droits
 * reçoivent celui-ci ; avec son aperçu, il est posé dessous.
 *
 * @param {import('astro').ImageMetadata} image
 * @param {Taille|null|undefined} taille
 * @param {{ portrait?: import('astro').ImageMetadata|null, apercu?: string|null }} [extras]
 * @returns {Promise<Réactive>}
 */
export async function heros(image, taille, { portrait = null, apercu = null } = {}) {
  const options = { qualité: QUALITÉ_PLEIN_ÉCRAN, avif: true };
  const r = await réactive(image, taille, PLEIN_ÉCRAN, couvre(taille), options);
  if (portrait && taille?.width && taille?.height) {
    const tp = taillePortrait(taille);
    const p = await réactive(portrait, tp, PORTRAIT_LARGEURS, couvre(PORTRAIT), options);
    r.portrait = { srcset: p.srcset, avif: p.avif, sizes: p.sizes };
  }
  r.apercu = apercu;
  return r;
}

/**
 * La grande photo d'un spectacle, avec son portrait et son aperçu.
 * @param {{ hero: import('astro').ImageMetadata, heroTaille: Taille, heroPortrait: import('astro').ImageMetadata, heroApercu: string }} s
 */
export const herosSpectacle = (s) => heros(s.hero, s.heroTaille, { portrait: s.heroPortrait, apercu: s.heroApercu });

/**
 * La même taille pour une photo de la photothèque (fond de page, photo de La
 * compagnie), qui porte ses dimensions à plat. Sans photo, rien.
 * @param {{ image: import('astro').ImageMetadata, width: number|null, height: number|null, portrait?: import('astro').ImageMetadata|null, apercu?: string|null } | null | undefined} photo
 */
export const herosPhoto = (photo) =>
  photo ? heros(photo.image, { width: photo.width, height: photo.height }, { portrait: photo.portrait, apercu: photo.apercu }) : Promise.resolve(null);

/** L'affiche, à ses proportions, 40rem de large au plus. */
export const affiche = (image, taille) => réactive(image, taille, [400, 800, 1200], '(max-width: 40em) 100vw, 40rem');

/**
 * Une photo du carrousel : 38rem de haut au plus, sa largeur suit son
 * ratio. Trois largeurs couvrent un portrait et un paysage en 1× et 2×.
 */
export const diapo = (image, taille) => réactive(image, taille, [700, 1100, 1600], '(max-width: 40em) 90vw, 45vw');

/**
 * La vignette de la galerie : `columns-[3_18rem]` dans une page de 96rem au
 * plus, espacées de 1rem, entre deux gouttières (1 à 4rem). Deux colonnes
 * tiennent dès 39em d'écran, trois dès 60em, et au-delà de 104em la page ne
 * s'élargit plus : une colonne fait alors 31,5rem. `sizes` suit ces paliers
 * (gouttière la plus étroite de chacun, et un tiers exact, `100vw / 3`, pour
 * ne jamais sous-estimer) : dire 33vw sur un grand écran faisait prendre la
 * taille au-dessus.
 * Avec son aperçu flou dessous.
 * @param {import('astro').ImageMetadata} image
 * @param {Taille} taille
 * @param {string|null} [apercu]
 */
export async function vignetteGalerie(image, taille, apercu = null) {
  const r = await réactive(
    image,
    taille,
    [480, 800, 1200],
    '(max-width: 39em) calc(100vw - 2rem), (max-width: 60em) calc(50vw - 1.5rem), (max-width: 104em) calc(100vw / 3 - 2rem), 31.5rem'
  );
  r.apercu = apercu;
  return r;
}

/**
 * La photo agrandie de la visionneuse : l'écran entier, mêmes exigences que
 * le héros, AVIF compris. Contenue et non couverte : un portrait n'occupe
 * qu'une bande d'un écran large, `sizes` le dit.
 */
export const grande = (image, taille) => réactive(image, taille, [1200, 2048, 2560, 3200], contient(taille), { qualité: QUALITÉ_PLEIN_ÉCRAN, avif: true });

/**
 * L'image des partages : les réseaux veulent un JPEG de 1200 px.
 * @param {import('astro').ImageMetadata} image
 */
export async function og(image) {
  return (await getImage({ src: image, width: 1200, format: 'jpeg', quality: 80 })).src;
}

/**
 * Le cadrage d'une photo, d'après son point focal (en %). Sans lui, le
 * centre. Le fond suit le même point : c'est là que Photo.astro pose l'aperçu.
 */
export const cadrage = (focal) => (focal ? `object-position:${focal.x}% ${focal.y}%;background-position:${focal.x}% ${focal.y}%` : undefined);
