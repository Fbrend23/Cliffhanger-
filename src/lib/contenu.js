// Le contenu tel que les pages le lisent : les collections du Content Layer,
// rassemblées une fois par build (les promesses sont gardées) et reliées
// entre elles par slug. Les règles de rendu, elles, sont dans les modules
// purs (dates.js, generique.js) ; ici, seulement l'assemblage.

import { getCollection, getEntry } from 'astro:content';
import { lignesGenerique } from './generique.js';

/** @type {ReturnType<typeof charger> | null} */
let promesse = null;

/** Tout le contenu du site, relié. */
export function contenu() {
  promesse ??= charger();
  return promesse;
}

async function charger() {
  const [spectacles, photos, personnes, distribution, generique, representations, montreal, reglages] = await Promise.all([
    getCollection('spectacles'),
    getCollection('photos'),
    getCollection('personnes'),
    getCollection('distribution'),
    getCollection('generique'),
    getCollection('representations'),
    getEntry('montreal', 'site'),
    getEntry('reglages', 'site'),
  ]);

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
      lignesGenerique(
        generique.map((e) => e.data).filter((g) => g.spectacle === s.slug),
        distribution.map((e) => e.data).filter((d) => d.spectacle === s.slug && personnesParSlug.has(d.personne))
      ),
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
    photo: (id) => (id ? (photosParId.get(String(id)) ?? null) : null),
    personnes: personnes.map((e) => e.data).sort((a, b) => parOrdre(a, b) || a.name.localeCompare(b.name, 'fr')),
    personne: (slug) => personnesParSlug.get(slug) ?? null,
    lignesParSpectacle,
    représentations: toutesReprésentations,
    représentationsDe: (slug) => toutesReprésentations.filter((r) => r.spectacle === slug).sort((a, b) => a.day.localeCompare(b.day) || (a.time ?? '').localeCompare(b.time ?? '')),
    montreal: montreal?.data ?? { sub: null, lead: null, text: null },
    reglages: reglages.data,
  };
}

/** L'adresse d'un spectacle : sa page, ou celle de Montréal pour la troupe de Montréal. */
export const adresseSpectacle = (s) => (s.troupe === 'montreal' ? '/montreal/' : `/spectacle/${s.slug}/`);
