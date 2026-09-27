// Les loaders, contre le faux Directus (test/faux-directus/) : ce qu'ils
// demandent au CMS est accepté (champs de fichiers permis compris), et ce
// qu'ils rangent est ce que les pages attendent. Sans le vrai CMS ni jeton.

import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { démarrer } from './faux-directus/serveur.mjs';

// Hors d'Astro, `astro:env/server` n'existe pas : on le remplace, pour les
// tests seulement, par un module qui lit les mêmes variables dans process.env.
registerHooks({
  resolve(spécificateur, contexte, suivant) {
    if (spécificateur === 'astro:env/server') {
      return { url: new URL('./soutien/env-serveur.mjs', import.meta.url).href, shortCircuit: true };
    }
    return suivant(spécificateur, contexte);
  },
});

let faux;
let racine;
/** @type {typeof import('../src/lib/loaders.js')} */
let L;

before(async () => {
  faux = await démarrer(0);
  process.env.DIRECTUS_URL = faux.url;
  process.env.DIRECTUS_TOKEN = 'faux';
  process.env.PRODYSOS_URL = faux.url;
  process.env.PRODYSOS_KEY = 'faux';
  process.env.PRODYSOS_COMPANY = 'cliffhanger';
  racine = await mkdtemp(path.join(tmpdir(), 'cliff-loaders-'));
  L = await import('../src/lib/loaders.js');
});

after(async () => {
  await faux?.fermer();
  if (racine) await rm(racine, { recursive: true, force: true });
});

/** Ce qu'Astro passe à un loader, réduit à ce que les nôtres utilisent. */
function contexte() {
  const entrées = new Map();
  const avertissements = [];
  return {
    entrées,
    avertissements,
    ctx: {
      store: { clear: () => entrées.clear(), set: (e) => entrées.set(e.id, e) },
      parseData: async ({ data }) => data,
      logger: { info() {}, warn: (m) => avertissements.push(m) },
      config: { root: pathToFileURL(racine + path.sep) },
    },
  };
}

test('spectacles : slugs, troupe, carrousel ordonné, point focal en %', async () => {
  const { entrées, ctx } = contexte();
  await L.spectaclesLoader().load(ctx);
  const inédit = entrées.get('linedit-de-moliere').data;
  assert.equal(inédit.title, "L'Inédit de Molière");
  assert.equal(inédit.troupe, 'bruxelles');
  assert.equal(inédit.credit, null);
  assert.equal(inédit.slides.length, 2);
  assert.deepEqual(inédit.focal, { x: 50, y: 22 });
  assert.match(inédit.hero, /^\.\/[\w-]+\.webp$/);
  assert.match(inédit.text, /^<p>Brigands/);
  assert.equal(entrées.get('un-choeur-silencieux').data.troupe, 'montreal');
  assert.equal(entrées.get('les-femmes-se-vantent').data.cite, 'Karoo, novembre 2019');
});

test('spectacles : rangés dans l’ordre du CMS, quelle que soit la fin des téléchargements', async () => {
  const { entrées, ctx } = contexte();
  await L.spectaclesLoader().load(ctx);
  assert.deepEqual([...entrées.keys()], ['linedit-de-moliere', 'par-endroits', 'les-femmes-se-vantent', 'un-choeur-silencieux']);
});

test('spectacles : sans spectacle de Bruxelles affichable, le build est refusé', async () => {
  const spectacles = faux.base.collections.cliff_spectacles;
  const héros = spectacles.map((s) => s.hero);
  // Tous les belges sans grande photo : le CMS rend des lignes, le site n'en garde que Montréal.
  for (const s of spectacles) if (s.troupe === 'bruxelles') s.hero = null;
  try {
    const { ctx } = contexte();
    await assert.rejects(L.spectaclesLoader().load(ctx), /Aucun spectacle de Bruxelles/);
  } finally {
    spectacles.forEach((s, i) => (s.hero = héros[i]));
  }
});

test('photos : légendes, galerie, et purge qui garde les fichiers affichés', async () => {
  const { ctx: c1 } = contexte();
  await L.spectaclesLoader().load(c1);
  const dossier = path.join(racine, '.cache', 'directus-assets');
  await writeFile(path.join(dossier, 'orphelin.webp'), 'x');
  const { entrées, ctx } = contexte();
  await L.photosLoader().load(ctx);
  const photos = [...entrées.values()].map((e) => e.data);
  assert.equal(photos.filter((p) => p.galerie).length, 9);
  // groupe : deux légendes, deux lignes, un seul fichier.
  assert.ok(photos.some((p) => p.caption === 'La troupe' && !p.galerie));
  assert.ok(photos.some((p) => p.caption === "L'Inédit de Molière" && p.galerie));
  const fichiers = await readdir(dossier);
  assert.ok(!fichiers.includes('orphelin.webp'), 'la purge retire ce que rien n’utilise');
  assert.ok(fichiers.length > 10, 'les grandes photos et affiches des spectacles restent');
});

test('photos : une photo qui ne sert nulle part est laissée de côté', async () => {
  const photos = faux.base.collections.cliff_photos;
  const modèle = photos.find((p) => p.caption === 'Coulisses');
  photos.push({ ...modèle, id: 999, sort: 999, galerie: false, caption: 'Inutile' });
  try {
    const { entrées, ctx } = contexte();
    await L.photosLoader().load(ctx);
    assert.ok(!entrées.has('999'));
    assert.ok(entrées.has(String(modèle.id)));
  } finally {
    photos.pop();
  }
});

test('le manifeste reste un JSON valide quand trois loaders enregistrent ensemble', async () => {
  const [a, b, c] = [contexte(), contexte(), contexte()];
  await Promise.all([L.spectaclesLoader().load(a.ctx), L.photosLoader().load(b.ctx), L.reglagesLoader().load(c.ctx)]);
  const texteManifeste = await readFile(path.join(racine, '.cache', 'directus-assets', 'manifest.json'), 'utf8');
  const manifeste = JSON.parse(texteManifeste);
  assert.ok(Object.keys(manifeste).length > 10);
});

test('personnes : groupes, Marie-Hélène Ruiz invitée, bio en HTML', async () => {
  const { entrées, ctx } = contexte();
  await L.personnesLoader().load(ctx);
  assert.equal(entrées.get('marie-helene-ruiz').data.groupe, 'invite');
  assert.equal(entrées.get('anais-legrand').data.groupe, 'montreal');
  assert.match(entrées.get('alexandre-van-campenhout').data.bio, /Avancer plus loin/);
  assert.equal(entrées.get('audrey-colomb').data.bio, null);
});

test('distribution et générique : liens par slug, ordre, note gardée', async () => {
  const d = contexte();
  await L.distributionLoader().load(d.ctx);
  const fsv = [...d.entrées.values()].map((e) => e.data).filter((l) => l.spectacle === 'les-femmes-se-vantent');
  assert.deepEqual(fsv[0], { spectacle: 'les-femmes-se-vantent', personne: 'sophie-decaestecker', personnage: 'Henriette', sort: fsv[0].sort });
  const g = contexte();
  await L.generiqueLoader().load(g.ctx);
  const mes = [...g.entrées.values()].map((e) => e.data).find((l) => l.spectacle === 'linedit-de-moliere' && l.role === 'Mise en scène');
  assert.equal(mes.note, 'collective, sous la direction d’');
  assert.deepEqual(mes.personnes, ['alize-cookie']);
});

test('représentations : jour, heure sans secondes, champs vides à null', async () => {
  const { entrées, ctx } = contexte();
  await L.representationsLoader().load(ctx);
  const toutes = [...entrées.values()].map((e) => e.data);
  const première = toutes.find((r) => r.day === '2026-04-17');
  assert.equal(première.time, '20:00');
  const montréal = toutes.find((r) => r.day === '2025-06-06');
  assert.equal(montréal.time, null);
  assert.equal(montréal.price, null);
});

test('représentations : les dates de Prodysos rejoignent celles du CMS', async () => {
  const { entrées, avertissements, ctx } = contexte();
  await L.representationsLoader().load(ctx);
  const pe = [...entrées.entries()].filter(([, e]) => e.data.spectacle === 'par-endroits');
  // Trois dates du CMS, deux de Prodysos ; la troisième de Prodysos est déjà dans le CMS.
  assert.equal(pe.length, 5);
  const venue = entrées.get('prodysos-p2').data;
  assert.deepEqual(venue, { spectacle: 'par-endroits', day: '2027-03-12', time: '20:00', venue: 'Théâtre de la Vie', city: 'Saint-Josse-ten-Noode', price: '12 €' });
  // La date du CMS garde son prix à elle.
  assert.equal(pe.find(([, e]) => e.data.day === '2024-05-24')[1].data.price, '10 €');
  assert.ok(!entrées.has('prodysos-p1'));
  // Le spectacle Prodysos qu'aucun spectacle du CMS ne réclame est signalé.
  assert.ok(avertissements.some((m) => /une-autre-creation/.test(m)));
});

test('réglages et Montréal : singletons, fonds par id de photo', async () => {
  const r = contexte();
  await L.reglagesLoader().load(r.ctx);
  const site = r.entrées.get('site').data;
  assert.equal(site.site_title, 'Compagnie Cliffhanger');
  assert.match(site.compagnie_text, /href="\/montreal\/"/);
  assert.ok(site.fonds.accueil && site.fonds.contact);
  assert.match(site.og_image, /\.webp$/);
  const m = contexte();
  await L.montrealLoader().load(m.ctx);
  assert.equal(m.entrées.get('site').data.sub, 'Collectif Cliffhanger, depuis 2020');
});
