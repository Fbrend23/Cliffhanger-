#!/usr/bin/env node
// Le prototype versé dans le CMS : migration/content.js et migration/img/,
// dans les collections cliff_* de l'instance (platform-cms, client
// « Compagnie Cliffhanger »).
//
//   npm run migrer -- --hors-ligne     ce qui serait écrit, sans même lire l'instance
//   npm run migrer -- --dry-run        lit l'instance, liste ce qui serait écrit, n'écrit rien
//   npm run migrer                     écrit
//
// Lit .env.migration : DIRECTUS_URL, DIRECTUS_ADMIN_TOKEN (voir
// .env.migration.example). Un --dry-run sans ces variables passe hors ligne.
//
// USAGE UNIQUE, MAIS REJOUABLE. Chaque élément est retrouvé par sa clé
// naturelle avant d'écrire : un fichier par son titre (le nom de l'image),
// une personne ou un spectacle par son slug, une photo par (fichier,
// légende), une ligne de distribution par (spectacle, personne), une ligne
// de générique par (spectacle, rôle), une représentation par (spectacle,
// jour, heure). Ce qui existe est mis à jour si besoin, jamais recréé ; un
// rejeu finit sur « 0 créé, 0 modifié ». Rien n'est jamais supprimé.
//
// POURQUOI LE JETON D'ADMINISTRATION. Le jeton de build ne lit que le publié
// et n'écrit rien ; la policy « écriture » n'a aucun droit sur les fichiers,
// et c'est voulu. La migration est le seul geste qui envoie des médias, une
// fois, depuis ce poste.
//
// La traduction du prototype vers le modèle est dans scripts/lib/prototype.mjs,
// partagée avec le faux Directus des tests : ce que le site construit en test
// est ce que ce script écrit. Elle refuse tout tiret long ou demi-cadratin.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { cléPhoto, focalEnPixels, lirePrototype, modèleDuPrototype } from './lib/prototype.mjs';

const racine = fileURLToPath(new URL('../', import.meta.url));
const IMAGES = path.join(racine, 'migration', 'img');

const args = process.argv.slice(2);
const { DIRECTUS_URL, DIRECTUS_ADMIN_TOKEN } = process.env;
const NOM_CLIENT = process.env.CLIFF_CLIENT_NAME || 'Compagnie Cliffhanger';

let HORS_LIGNE = args.includes('--hors-ligne');
const DRY = HORS_LIGNE || args.includes('--dry-run');
if (!HORS_LIGNE && (!DIRECTUS_URL || !DIRECTUS_ADMIN_TOKEN)) {
  if (!DRY) {
    console.error('DIRECTUS_URL ou DIRECTUS_ADMIN_TOKEN manque : copier .env.migration.example en .env.migration et le remplir.');
    process.exit(1);
  }
  console.log("Pas d'instance configurée (.env.migration) : dry-run hors ligne, tout est compté comme à créer.\n");
  HORS_LIGNE = true;
}

// --- Le CMS ------------------------------------------------------------------

async function appeler(méthode, chemin, corps, tentative = 0) {
  const init = { method: méthode, headers: { Authorization: `Bearer ${DIRECTUS_ADMIN_TOKEN}` } };
  if (corps instanceof FormData) init.body = corps;
  else if (corps !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(corps);
  }
  const res = await fetch(`${DIRECTUS_URL}${chemin}`, init);
  // Le limiteur de l'instance : un 429 est un « pas maintenant ».
  if (res.status === 429 && tentative < 5) {
    await new Promise((r) => setTimeout(r, (Number(res.headers.get('retry-after')) || 1) * 1000 + 50));
    return appeler(méthode, chemin, corps, tentative + 1);
  }
  if (!res.ok) throw new Error(`${méthode} ${chemin} : HTTP ${res.status} ${await res.text().catch(() => '')}`.trim());
  if (res.status === 204) return null;
  return (await res.json())?.data ?? null;
}

const bilan = { créés: 0, modifiés: 0, inchangés: 0 };
let prochainFaux = 1;

/** Lire : rien hors ligne, l'instance sinon. */
const lire = async (chemin, défaut = []) => (HORS_LIGNE ? défaut : ((await appeler('GET', chemin)) ?? défaut));

/** Créer, ou dire qu'on créerait. Rend l'id (un id factice en dry-run). */
async function créer(collection, données, libellé) {
  bilan.créés++;
  if (DRY) {
    console.log(`   + ${libellé}`);
    return `nouveau-${prochainFaux++}`;
  }
  const créé = await appeler('POST', `/items/${collection}`, données);
  console.log(`   + ${libellé}`);
  return créé.id;
}

/** Les champs qui diffèrent entre ce qu'on veut et ce qui est là. */
function différences(voulu, existant) {
  const d = {};
  for (const [k, v] of Object.entries(voulu)) {
    const e = existant?.[k];
    const pareil = Array.isArray(v) ? JSON.stringify(v) === JSON.stringify(e) : (v ?? null) === (e ?? null) || String(v) === String(e);
    if (!pareil) d[k] = v;
  }
  return d;
}

/** Mettre à jour ce qui diffère, ou ne rien faire. */
async function aligner(collection, id, voulu, existant, libellé) {
  const d = différences(voulu, existant);
  if (!Object.keys(d).length) {
    bilan.inchangés++;
    return;
  }
  bilan.modifiés++;
  console.log(`   ~ ${libellé} : ${Object.keys(d).join(', ')}`);
  if (!DRY) await appeler('PATCH', id == null ? `/items/${collection}` : `/items/${collection}/${id}`, d);
}

/** Une collection : retrouver chaque élément par sa clé, créer ou aligner. */
async function verser(collection, champs, lignes, clé, libellé) {
  const existants = await lire(`/items/${collection}?fields=id,${champs.join(',')}&limit=-1`);
  const parClé = new Map(existants.map((e) => [clé(e), e]));
  const ids = new Map();
  for (const [i, l] of lignes.entries()) {
    const k = clé(l);
    const e = parClé.get(k);
    if (e) {
      await aligner(collection, e.id, l, e, libellé(l, i));
      ids.set(k, e.id);
    } else {
      ids.set(k, await créer(collection, l, libellé(l, i)));
    }
  }
  return ids;
}

// --- Programme ---------------------------------------------------------------

console.log(`Migration du prototype vers « ${NOM_CLIENT} »${HORS_LIGNE ? '  [HORS LIGNE]' : DRY ? '  [DRY-RUN]' : ''}\n`);
const modèle = modèleDuPrototype(await lirePrototype(path.join(racine, 'migration', 'content.js')));
const publié = { status: 'published' };

// 1 · Le dossier de fichiers du client, posé par le provisionnement.
let dossier = null;
if (!HORS_LIGNE) {
  [dossier] = await lire(`/folders?filter[name][_eq]=${encodeURIComponent(NOM_CLIENT)}&fields=id&limit=1`);
  if (!dossier) {
    console.error(`Dossier « ${NOM_CLIENT} » introuvable : provisionner le client d'abord (platform-cms).`);
    process.exit(1);
  }
}
console.log(`1. dossier de fichiers : ${dossier?.id ?? '(hors ligne)'}`);

// 2 · Les fichiers : la plus grande version de chaque image, son point focal
//     en pixels (converti du `focus` du prototype), retrouvés par leur titre.
console.log(`2. fichiers (${modèle.fichiers.length})`);
const fichiersExistants = dossier
  ? await lire(`/files?filter[folder][_eq]=${dossier.id}&fields=id,title,focal_point_x,focal_point_y&limit=-1`)
  : [];
const fichierParNom = new Map(fichiersExistants.map((f) => [f.title, f]));
const fichierId = new Map();
for (const f of modèle.fichiers) {
  const chemin = path.join(IMAGES, `${f.nom}.webp`);
  const { width, height } = await sharp(chemin).metadata();
  const focal = focalEnPixels(f.focus, width, height);
  const existant = fichierParNom.get(f.nom);
  if (existant) {
    fichierId.set(f.nom, existant.id);
    const d = différences(focal, existant);
    if (Object.keys(d).length) {
      bilan.modifiés++;
      console.log(`   ~ ${f.nom} : point focal`);
      if (!DRY) await appeler('PATCH', `/files/${existant.id}`, d);
    } else bilan.inchangés++;
    continue;
  }
  bilan.créés++;
  console.log(`   + ${f.nom}.webp (${width}×${height}${f.focus ? `, focal ${f.focus.x} % ${f.focus.y} %` : ''})`);
  if (DRY) {
    fichierId.set(f.nom, `nouveau-${prochainFaux++}`);
    continue;
  }
  // Les champs avant le fichier : Directus les lit dans cet ordre.
  const fd = new FormData();
  fd.append('folder', dossier.id);
  fd.append('title', f.nom);
  if (focal.focal_point_x != null) {
    fd.append('focal_point_x', String(focal.focal_point_x));
    fd.append('focal_point_y', String(focal.focal_point_y));
  }
  fd.append('file', new Blob([await readFile(chemin)], { type: 'image/webp' }), `${f.nom}.webp`);
  fichierId.set(f.nom, (await appeler('POST', '/files', fd)).id);
}
const fichier = (nom) => (nom ? fichierId.get(nom) : null);

// 3 · Les personnes.
console.log(`3. personnes (${modèle.personnes.length})`);
const personneId = await verser(
  'cliff_personnes',
  ['slug', 'name', 'groupe', 'bio', 'status', 'sort'],
  modèle.personnes.map((p, i) => ({ ...p, ...publié, sort: i + 1 })),
  (p) => p.slug,
  (p) => p.name
);

// 4 · Les spectacles, sans leur carrousel : les photos n'existent pas encore.
console.log(`4. spectacles (${modèle.spectacles.length})`);
const spectacleId = await verser(
  'cliff_spectacles',
  ['slug', 'title', 'year', 'troupe', 'punch', 'cite', 'text', 'credit', 'duration', 'hero', 'poster', 'status', 'sort'],
  modèle.spectacles.map(({ slides, hero, poster, ...s }, i) => ({ ...s, hero: fichier(hero), poster: fichier(poster), ...publié, sort: i + 1 })),
  (s) => s.slug,
  (s) => s.title
);

// 5 · La photothèque : une ligne par couple (fichier, légende).
console.log(`5. photos (${modèle.photos.length})`);
const nomDuFichier = new Map([...fichierId].map(([nom, id]) => [String(id), nom]));
const photoId = await verser(
  'cliff_photos',
  ['image', 'caption', 'spectacle', 'galerie', 'status', 'sort'],
  modèle.photos.map((p, i) => ({
    image: fichier(p.fichier),
    caption: p.caption,
    spectacle: p.spectacle ? spectacleId.get(p.spectacle) : null,
    galerie: p.galerie,
    ...publié,
    sort: i + 1,
  })),
  (p) => cléPhoto(nomDuFichier.get(String(p.image)) ?? p.image, p.caption),
  (p) => `${p.caption} (${nomDuFichier.get(String(p.image))})`
);
const photo = (clé) => (clé ? photoId.get(clé) : null);

// 6 · Les carrousels : la liste ordonnée des photos, remplacée si elle diffère.
console.log('6. carrousels');
const carrousels = await lire(`/items/cliff_spectacles?fields=id,slug,slides.cliff_photos_id&deep[slides][_sort]=sort&limit=-1`);
const carrouselParSlug = new Map(carrousels.map((s) => [s.slug, (s.slides ?? []).map((l) => l.cliff_photos_id)]));
for (const s of modèle.spectacles) {
  if (!s.slides.length) continue;
  const voulu = s.slides.map(photo);
  if (JSON.stringify(voulu) === JSON.stringify(carrouselParSlug.get(s.slug) ?? [])) {
    bilan.inchangés++;
    continue;
  }
  bilan.modifiés++;
  console.log(`   ~ ${s.title} : ${voulu.length} photo(s)`);
  if (!DRY) await appeler('PATCH', `/items/cliff_spectacles/${spectacleId.get(s.slug)}`, { slides: voulu.map((id) => ({ cliff_photos_id: id })) });
}

// 7 · La distribution (la ligne « Avec ») et les autres lignes du générique.
console.log(`7. distribution (${modèle.distribution.length}) et générique (${modèle.generique.length})`);
await verser(
  'cliff_distribution',
  ['spectacle', 'personne', 'personnage', 'status', 'sort'],
  modèle.distribution.map((d, i) => ({ spectacle: spectacleId.get(d.spectacle), personne: personneId.get(d.personne), personnage: d.personnage, ...publié, sort: i + 1 })),
  (d) => `${d.spectacle}|${d.personne}`,
  (_, i) => `${modèle.distribution[i].spectacle} · ${modèle.distribution[i].personne}`
);
const génériqueId = await verser(
  'cliff_generique',
  ['spectacle', 'role', 'note', 'text', 'status', 'sort'],
  modèle.generique.map(({ personnes, ...g }, i) => ({ ...g, spectacle: spectacleId.get(g.spectacle), ...publié, sort: i + 1 })),
  (g) => `${g.spectacle}|${g.role}`,
  (g, i) => `${modèle.generique[i].spectacle} · ${g.role}`
);
const personnesDuGénérique = await lire(`/items/cliff_generique?fields=id,personnes.cliff_personnes_id&deep[personnes][_sort]=sort&limit=-1`);
const personnesParLigne = new Map(personnesDuGénérique.map((g) => [String(g.id), (g.personnes ?? []).map((l) => l.cliff_personnes_id)]));
for (const g of modèle.generique) {
  if (!g.personnes.length) continue;
  const id = génériqueId.get(`${spectacleId.get(g.spectacle)}|${g.role}`);
  const voulu = g.personnes.map((slug) => personneId.get(slug));
  if (JSON.stringify(voulu) === JSON.stringify(personnesParLigne.get(String(id)) ?? [])) {
    bilan.inchangés++;
    continue;
  }
  bilan.modifiés++;
  console.log(`   ~ ${g.spectacle} · ${g.role} : ${voulu.length} personne(s)`);
  if (!DRY) await appeler('PATCH', `/items/cliff_generique/${id}`, { personnes: voulu.map((p) => ({ cliff_personnes_id: p })) });
}

// 8 · Les représentations.
console.log(`8. représentations (${modèle.representations.length})`);
await verser(
  'cliff_representations',
  ['spectacle', 'day', 'time', 'venue', 'city', 'price', 'status'],
  modèle.representations.map((r) => ({ ...r, spectacle: spectacleId.get(r.spectacle), ...publié })),
  (r) => `${r.spectacle}|${r.day}|${r.time ?? ''}`,
  (r) => `${r.day}${r.time ? ` ${r.time.slice(0, 5)}` : ''} · ${r.venue ?? r.city}`
);

// 9 · Les deux singletons.
console.log('9. page Montréal et réglages');
await aligner('cliff_montreal', null, modèle.montreal, await lire('/items/cliff_montreal?fields=sub,lead,text', {}), 'page Montréal');
const r = modèle.reglages;
const réglages = {
  ...r,
  fond_accueil: photo(r.fond_accueil),
  fond_spectacles: photo(r.fond_spectacles),
  fond_agenda: photo(r.fond_agenda),
  fond_compagnie: photo(r.fond_compagnie),
  fond_contact: photo(r.fond_contact),
  og_image: fichier(r.og_image),
};
await aligner('cliff_reglages', null, réglages, await lire(`/items/cliff_reglages?fields=${Object.keys(réglages).join(',')}`, {}), 'réglages');

console.log(`\nBilan${DRY ? " (dry-run, rien n'a été écrit)" : ''} : ${bilan.créés} créé(s), ${bilan.modifiés} modifié(s), ${bilan.inchangés} inchangé(s).`);
if (!DRY) console.log('Ensuite : « Mettre en ligne » dans le Studio, ou relancer le workflow de déploiement.');
