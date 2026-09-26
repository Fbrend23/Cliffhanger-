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
async function réactive(image, taille, largeurs, sizes) {
  const max = taille?.width ?? Math.max(...largeurs);
  const retenues = largeurs.filter((l) => l < max);
  const width = Math.min(max, Math.max(...largeurs));
  if (!retenues.includes(width)) retenues.push(width);
  const img = await getImage({ src: image, width, widths: retenues, sizes, format: 'webp', quality: 78 });
  const height = taille?.width && taille?.height ? Math.round((taille.height / taille.width) * width) : Number(img.attributes.height) || width;
  return { src: img.src, srcset: img.srcSet.attribute, sizes, width, height };
}

/**
 * La grande photo du haut d'une page, et les fonds plein écran : 960 px pour
 * un téléphone, 1440 pour un portable, 2048 au-delà (les tailles du prototype).
 */
export const heros = (image, taille) => réactive(image, taille, [960, 1440, 2048], '100vw');

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

/** La photo agrandie de la visionneuse : l'écran entier. */
export const grande = (image, taille) => réactive(image, taille, [1200, 2048], '100vw');

/**
 * L'image des partages : les réseaux veulent un JPEG de 1200 px.
 * @param {import('astro').ImageMetadata} image
 */
export async function og(image) {
  return (await getImage({ src: image, width: 1200, format: 'jpeg', quality: 80 })).src;
}

/** Le cadrage d'une photo, d'après son point focal (en %). Sans lui, le centre. */
export const cadrage = (focal) => (focal ? `object-position:${focal.x}% ${focal.y}%` : undefined);
