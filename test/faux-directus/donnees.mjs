// Les données du faux Directus : le prototype (migration/content.js et
// migration/img/), traduit par scripts/lib/prototype.mjs comme la migration le
// fera, puis rangé comme Directus le rend, relations dépliées.
//
// Les identifiants sont stables d'un lancement à l'autre (un UUID tiré du nom
// du fichier, des entiers dans l'ordre du prototype) : le cache des images du
// build n'est pas invalidé à chaque essai.

import { createHash } from 'node:crypto';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { focalEnPixels, lirePrototype, modèleDuPrototype } from '../../scripts/lib/prototype.mjs';

const racine = fileURLToPath(new URL('../../', import.meta.url));
export const DOSSIER_IMAGES = path.join(racine, 'migration', 'img');

/** Un UUID stable tiré d'un nom : la forme d'un id de directus_files. */
const uuid = (nom) => {
  const h = createHash('md5').update(`cliff:${nom}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
};

/**
 * La base du faux Directus : `collections[nom]` est un tableau de lignes
 * dépliées (un m2o est l'objet visé, un m2m la liste des lignes de jonction),
 * `singletons[nom]` un objet, `fichiers` les lignes de directus_files avec le
 * chemin de l'original.
 */
/**
 * Ce que `get_public_company_shows` rend pour la compagnie : une date déjà
 * saisie dans le CMS (écartée à la fusion), deux à venir, et un spectacle
 * qu'aucun spectacle du CMS ne réclame (ses dates sont ignorées).
 */
export const PRODYSOS = {
  company: { name: 'Compagnie Cliffhanger', slug: 'cliffhanger' },
  shows: [
    {
      slug: 'par-endroits-cliffhanger',
      title: 'Par endroits',
      representations: [
        { id: 'p1', date: '2024-05-24T20:00:00+02:00', location_name: 'Institut Européen de la Culture Arabe', location_address: null },
        { id: 'p2', date: '2027-03-12T20:00:00+01:00', location_name: 'Théâtre de la Vie', location_address: 'Rue Traversière 45, 1210 Saint-Josse-ten-Noode' },
        { id: 'p3', date: '2027-03-13T20:00:00+01:00', location_name: 'Théâtre de la Vie', location_address: 'Rue Traversière 45, 1210 Saint-Josse-ten-Noode' },
      ],
    },
    {
      slug: 'une-autre-creation',
      title: 'Une autre création',
      representations: [{ id: 'p4', date: '2027-01-08T19:00:00+01:00', location_name: 'Ailleurs', location_address: null }],
    },
  ],
};

export async function construireBase() {
  const modèle = modèleDuPrototype(await lirePrototype(path.join(racine, 'migration', 'content.js')));

  // directus_files : la plus grande version de chaque image (« nom.webp »),
  // ses vraies dimensions, et le point focal en pixels.
  const fichiers = new Map();
  for (const f of modèle.fichiers) {
    const chemin = path.join(DOSSIER_IMAGES, `${f.nom}.webp`);
    const { width, height } = await sharp(chemin).metadata();
    fichiers.set(f.nom, {
      id: uuid(f.nom),
      filename_download: `${f.nom}.webp`,
      type: 'image/webp',
      width,
      height,
      modified_on: (await stat(chemin)).mtime.toISOString(),
      title: f.nom,
      ...focalEnPixels(f.focus, width, height),
      chemin,
    });
  }
  const fichierPublic = (nom) => {
    if (!nom) return null;
    const { chemin, ...f } = fichiers.get(nom);
    return f;
  };

  const publié = { status: 'published' };
  const numéroter = (lignes) => lignes.map((l, i) => ({ id: i + 1, sort: i + 1, ...publié, ...l }));

  const spectacles = numéroter(modèle.spectacles.map(({ slides, hero, poster, ...s }) => ({ ...s, hero: fichierPublic(hero), poster: fichierPublic(poster), _slides: slides })));
  const parSlug = new Map(spectacles.map((s) => [s.slug, s]));

  // Prodysos ne vient pas du prototype : un spectacle relié, et son tarif,
  // pour que le build local fusionne des dates comme le vrai.
  Object.assign(parSlug.get('par-endroits'), { prodysos_slug: 'par-endroits-cliffhanger', price: '12 €' });
  const personnes = numéroter(modèle.personnes);
  const parPersonne = new Map(personnes.map((p) => [p.slug, p]));

  const photos = numéroter(
    modèle.photos.map((p) => ({ caption: p.caption, galerie: p.galerie, spectacle: p.spectacle ? parSlug.get(p.spectacle) : null, image: fichierPublic(p.fichier), _clé: p.clé }))
  );
  const parClé = new Map(photos.map((p) => [p._clé, p]));

  for (const s of spectacles) {
    s.slides = s._slides.map((clé, i) => ({ id: s.id * 100 + i, sort: i + 1, cliff_photos_id: parClé.get(clé) }));
  }

  const distribution = numéroter(
    modèle.distribution.map((d) => ({ spectacle: parSlug.get(d.spectacle), personne: parPersonne.get(d.personne), personnage: d.personnage }))
  );
  const generique = numéroter(
    modèle.generique.map((g) => ({
      spectacle: parSlug.get(g.spectacle),
      role: g.role,
      note: g.note,
      text: g.text,
      personnes: g.personnes.map((slug, i) => ({ sort: i + 1, cliff_personnes_id: parPersonne.get(slug) })),
    }))
  );
  const representations = numéroter(modèle.representations.map((r) => ({ ...r, spectacle: parSlug.get(r.spectacle) })));

  const r = modèle.reglages;
  const reglages = {
    ...r,
    fond_accueil: parClé.get(r.fond_accueil) ?? null,
    fond_spectacles: parClé.get(r.fond_spectacles) ?? null,
    fond_agenda: parClé.get(r.fond_agenda) ?? null,
    fond_compagnie: parClé.get(r.fond_compagnie) ?? null,
    fond_contact: parClé.get(r.fond_contact) ?? null,
    og_image: fichierPublic(r.og_image),
  };

  return {
    collections: {
      cliff_spectacles: spectacles,
      cliff_personnes: personnes,
      cliff_photos: photos,
      cliff_distribution: distribution,
      cliff_generique: generique,
      cliff_representations: representations,
    },
    singletons: { cliff_montreal: modèle.montreal, cliff_reglages: reglages },
    prodysos: PRODYSOS,
    fichiers: new Map([...fichiers.values()].map((f) => [f.id, f])),
  };
}
