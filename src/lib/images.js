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
/** @typedef {{ src: string, srcset: string, sizes: string, width: number, height: number }} Réactive */

/**
 * Une image en plusieurs largeurs, jamais au-dessus de l'original : ce qu'un
 * `<img srcset sizes>` attend, avec les dimensions qui réservent sa place.
 *
 * @param {import('astro').ImageMetadata} image
 * @param {Taille|null|undefined} taille  les dimensions de l'original, lues par le loader
 * @param {number[]} largeurs
 * @param {string} sizes
 * @returns {Promise<Réactive>}
 */
async function réactive(image, taille, largeurs, sizes, qualité = 78) {
  const max = taille?.width ?? Math.max(...largeurs);
  const retenues = largeurs.filter((l) => l < max);
  const width = Math.min(max, Math.max(...largeurs));
  if (!retenues.includes(width)) retenues.push(width);
  const img = await getImage({ src: image, width, widths: retenues, sizes, format: 'webp', quality: qualité });
  const height = taille?.width && taille?.height ? Math.round((taille.height / taille.width) * width) : Number(img.attributes.height) || width;
  return { src: img.src, srcset: img.srcSet.attribute, sizes, width, height };
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

/**
 * La grande photo du haut d'une page, et les fonds plein écran : 960 px pour
 * un téléphone, 1440 pour un portable en 1×, 2048 à 3200 pour les écrans 2×.
 */
export const heros = (image, taille) => réactive(image, taille, PLEIN_ÉCRAN, '100vw', QUALITÉ_PLEIN_ÉCRAN);

/**
 * La même taille pour une photo de la photothèque (fond de page, photo de La
 * compagnie), qui porte ses dimensions à plat. Sans photo, rien.
 * @param {{ image: import('astro').ImageMetadata, width: number|null, height: number|null } | null | undefined} photo
 */
export const herosPhoto = (photo) => (photo ? heros(photo.image, { width: photo.width, height: photo.height }) : Promise.resolve(null));

/** L'affiche, à ses proportions, 40rem de large au plus. */
export const affiche = (image, taille) => réactive(image, taille, [400, 800, 1200], '(max-width: 40em) 100vw, 40rem');

/**
 * Une photo du carrousel : 38rem de haut au plus, sa largeur suit son
 * ratio. Trois largeurs couvrent un portrait et un paysage en 1× et 2×.
 */
export const diapo = (image, taille) => réactive(image, taille, [700, 1100, 1600], '(max-width: 40em) 90vw, 45vw');

/** La vignette de la galerie : une, deux ou trois colonnes. */
export const vignetteGalerie = (image, taille) =>
  réactive(image, taille, [480, 800, 1200], '(max-width: 40em) 100vw, (max-width: 64em) 50vw, 33vw');

/** La photo agrandie de la visionneuse : l'écran entier, mêmes exigences que le héros. */
export const grande = (image, taille) => réactive(image, taille, [1200, 2048, 2560, 3200], '100vw', QUALITÉ_PLEIN_ÉCRAN);

/**
 * L'image des partages : les réseaux veulent un JPEG de 1200 px.
 * @param {import('astro').ImageMetadata} image
 */
export async function og(image) {
  return (await getImage({ src: image, width: 1200, format: 'jpeg', quality: 80 })).src;
}

/** Le cadrage d'une photo, d'après son point focal (en %). Sans lui, le centre. */
export const cadrage = (focal) => (focal ? `object-position:${focal.x}% ${focal.y}%` : undefined);
