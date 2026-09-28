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

test('cadre portrait : 9:16 autour du point focal, sans sortir de l’image', async () => {
  const { cadrePortrait } = await import('../src/lib/directus.js');
  // Paysage : toute la hauteur, la largeur d'un 9:16.
  assert.deepEqual(cadrePortrait(1600, 900, null), { left: 547, top: 0, width: 506, height: 900 });
  assert.equal(cadrePortrait(1600, 900, { x: 0, y: 50 }).left, 0);
  assert.equal(cadrePortrait(1600, 900, { x: 100, y: 50 }).left, 1600 - 506);
  // Plus étroit qu'un 9:16 : toute la largeur, le haut et le bas rognés selon le point.
  assert.deepEqual(cadrePortrait(900, 2000, { x: 30, y: 25 }), { left: 0, top: 100, width: 900, height: 1600 });
  // Exactement 9:16 : l'image entière.
  assert.deepEqual(cadrePortrait(900, 1600, { x: 80, y: 80 }), { left: 0, top: 0, width: 900, height: 1600 });
});

test('spectacles : la grande photo a son recadrage portrait et son aperçu flou', async () => {
  const { entrées, ctx } = contexte();
  await L.spectaclesLoader().load(ctx);
  const d = entrées.get('par-endroits').data;
  assert.match(d.heroPortrait, /^\.\/[\w-]+\.portrait\.webp$/);
  assert.match(d.heroApercu, /^data:image\/webp;base64,/);
  assert.ok(d.heroApercu.length < 2000, 'quelques centaines d’octets dans la page, pas plus');
  const fichiers = await readdir(path.join(racine, '.cache', 'directus-assets'));
  assert.ok(fichiers.includes(d.heroPortrait.slice(2)));
});

test('spectacles : sans affiche ni texte dans le CMS, ceux de la page publique Prodysos', async () => {
  const inédit = faux.base.collections.cliff_spectacles.find((s) => s.slug === 'linedit-de-moliere');
  const { poster, text } = inédit;
  Object.assign(inédit, { poster: null, text: null });
  try {
    const { entrées, ctx } = contexte();
    await L.spectaclesLoader().load(ctx);
    const d = entrées.get('linedit-de-moliere').data;
    assert.equal(d.poster, './prodysos-affiche-hamlet.webp');
    assert.ok(d.posterTaille.width > 0 && d.posterTaille.height > 0, 'les dimensions sont lues sur le fichier');
    assert.equal(d.text, '<p>Molière, inédit.<br>Une pièce &lt;retrouvée&gt;.</p><p>Deuxième paragraphe.</p>');
    // Le CMS fait foi : un spectacle qui a les siens les garde.
    assert.match(entrées.get('par-endroits').data.poster, /^\.\/[\w-]+\.webp$/);
    assert.doesNotMatch(entrées.get('par-endroits').data.poster, /prodysos/);

    // La purge garde l'affiche venue de Prodysos.
    const p = contexte();
    await L.photosLoader().load(p.ctx);
    assert.ok((await readdir(path.join(racine, '.cache', 'directus-assets'))).includes('prodysos-affiche-hamlet.webp'));
  } finally {
    Object.assign(inédit, { poster, text });
  }
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
  assert.ok(fichiers.some((f) => f.endsWith('.portrait.webp')), 'et leurs recadrages portrait');
  // Toutes ont un aperçu ; seuls les fonds de page ont un portrait.
  assert.ok(photos.every((p) => p.apercu.startsWith('data:image/webp;base64,')));
  const r = faux.base.singletons.cliff_reglages;
  const fonds = new Set(['fond_accueil', 'fond_spectacles', 'fond_agenda', 'fond_compagnie', 'fond_contact'].map((f) => r[f]?.id).filter((v) => v != null).map(String));
  for (const [id, e] of entrées) assert.equal(e.data.portrait !== null, fonds.has(id), `photo ${id}`);
  assert.ok(photos.some((p) => p.portrait !== null));
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
  assert.deepEqual(venue, {
    spectacle: 'par-endroits',
    day: '2027-03-12',
    time: '20:00',
    venue: 'Théâtre de la Vie',
    city: 'Saint-Josse-ten-Noode',
    price: '12 €',
    reservation: { slug: 'par-endroits-cliffhanger', id: 'p2' },
  });
  // La date du CMS garde son prix à elle, et la réservation de celle qu'elle remplace.
  const duCms = pe.find(([, e]) => e.data.day === '2024-05-24')[1].data;
  assert.equal(duCms.price, '10 €');
  assert.deepEqual(duCms.reservation, { slug: 'par-endroits-cliffhanger', id: 'p1' });
  // Une date du CMS seule ne se réserve pas.
  assert.ok([...entrées.values()].some((e) => !e.id.startsWith('prodysos-') && e.data.reservation === null));
  assert.ok(!entrées.has('prodysos-p1'));
  // Le spectacle Prodysos qu'aucun spectacle du CMS ne réclame est signalé.
  assert.ok(avertissements.some((m) => /une-autre-creation/.test(m)));
  // Sans champ Prodysos, le même titre suffit.
  assert.deepEqual(entrées.get('prodysos-p5').data, {
    spectacle: 'linedit-de-moliere',
    day: '2027-02-05',
    time: '20:30',
    venue: 'Théâtre L’Improviste',
    city: 'Forest',
    price: null,
    reservation: { slug: 'hamlet', id: 'p5' },
  });
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
