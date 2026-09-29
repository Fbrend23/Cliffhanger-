// Le contenu tel que les pages le lisent : les collections du Content Layer,
// rassemblées une fois par build (les promesses sont gardées) et reliées
// entre elles par slug. Les règles de rendu, elles, sont dans les modules
// purs (dates.js, generique.js) ; ici, seulement l'assemblage.

import { getCollection, getEntry } from 'astro:content';
import { lignesGenerique } from './generique.js';
import { légal } from './legal.js';

/** @type {ReturnType<typeof charger> | null} */
let promesse = null;

/** Tout le contenu du site, relié. */
export function contenu() {
  promesse ??= charger();
  return promesse;
}

async function charger() {
  const [spectacles, photos, personnes, generique, representations, montreal, reglages] = await Promise.all([
    getCollection('spectacles'),
    getCollection('photos'),
    getCollection('personnes'),
    getCollection('generique'),
    getCollection('representations'),
    getEntry('montreal', 'site'),
    getEntry('reglages', 'site'),
  ]);

  // Le loader des réglages arrête déjà le build s'ils sont vides ; cette garde
  // le dit au typage, et protège d'une entrée absente du magasin.
  if (!reglages) throw new Error('Les réglages du site sont absents : ouvrir « Réglages » dans le Studio et enregistrer.');

  /**
   * @param {{ sort: number }} a
   * @param {{ sort: number }} b
   */
  const parOrdre = (a, b) => a.sort - b.sort;
  // L'ordre du Studio, puis le plus récent, puis le slug : un ordre total,
  // pour que deux spectacles jamais triés et de même année ne changent pas de
  // place d'un build à l'autre.
  const tousSpectacles = spectacles
    .map((e) => e.data)
    .sort((a, b) => parOrdre(a, b) || (b.year ?? 0) - (a.year ?? 0) || a.slug.localeCompare(b.slug));
  const photosParId = new Map(photos.map((e) => [e.id, { id: e.id, ...e.data }]));
  const personnesParSlug = new Map(personnes.map((e) => [e.id, e.data]));

  const lignesParSpectacle = new Map(
    tousSpectacles.map((s) => [
      s.slug,
      lignesGenerique(generique.map((e) => e.data).filter((g) => g.spectacle === s.slug)),
    ])
  );

  // Seules comptent les représentations d'un spectacle publié.
  const slugs = new Set(tousSpectacles.map((s) => s.slug));
  const toutesReprésentations = representations.map((e) => e.data).filter((r) => slugs.has(r.spectacle));

  return {
    spectacles: tousSpectacles,
    // Le site est centré sur Bruxelles : Montréal a sa page, et seulement elle.
    belges: tousSpectacles.filter((s) => s.troupe === 'bruxelles'),
    montrealSpectacle: tousSpectacles.find((s) => s.troupe === 'montreal') ?? null,
    photos: [...photosParId.values()].sort((a, b) => parOrdre(a, b) || Number(a.id) - Number(b.id)),
    /** @param {string|number|null|undefined} id */
    photo: (id) => (id ? (photosParId.get(String(id)) ?? null) : null),
    personnes: personnes.map((e) => e.data).sort((a, b) => parOrdre(a, b) || a.name.localeCompare(b.name, 'fr')),
    /** @param {string} slug */
    personne: (slug) => personnesParSlug.get(slug) ?? null,
    lignesParSpectacle,
    représentations: toutesReprésentations,
    /** @param {string} slug */
    représentationsDe: (slug) => toutesReprésentations.filter((r) => r.spectacle === slug).sort((a, b) => a.day.localeCompare(b.day) || (a.time ?? '').localeCompare(b.time ?? '')),
    montreal: montreal?.data ?? { sub: null, lead: null, text: null },
    reglages: reglages.data,
    /** Les informations légales, ou null tant qu'il en manque : sans elles, ni pages légales ni liens. */
    légal: légal(reglages.data),
  };
}

/**
 * L'adresse d'un spectacle : sa page, ou celle de Montréal pour la troupe de Montréal.
 * @param {{ troupe: string, slug: string }} s
 */
export const adresseSpectacle = (s) => (s.troupe === 'montreal' ? '/montreal/' : `/spectacle/${s.slug}/`);
