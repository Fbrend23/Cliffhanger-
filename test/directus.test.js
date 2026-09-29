// Le client Directus (src/lib/directus.js) contre un serveur qui répond ce
// qu'on lui écrit : rejeu des 429 et des pannes, réponse mal formée, pagination,
// purge du cache, dimensions, point focal, recadrage portrait. Sans CMS.

import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { registerHooks } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

registerHooks({
  resolve(spécificateur, contexte, suivant) {
    if (spécificateur === 'astro:env/server') {
      return { url: new URL('./soutien/env-serveur.mjs', import.meta.url).href, shortCircuit: true };
    }
    return suivant(spécificateur, contexte);
  },
});

/** Les réponses à rendre, dans l'ordre : { statut, corps, entêtes }. Chaque requête en consomme une. */
let scénario = [];
/** Les adresses demandées. */
let demandes = [];
let serveur;
let racine;
/** @type {typeof import('../src/lib/directus.js')} */
let D;

before(async () => {
  serveur = http.createServer((req, res) => {
    demandes.push(req.url);
    const r = scénario.shift() ?? { statut: 500, corps: 'scénario épuisé' };
    if (r.figer) return; // ne répond jamais : c'est le délai du client qui tranche
    res.writeHead(r.statut ?? 200, { 'Content-Type': 'application/json', ...(r.entêtes ?? {}) });
    res.end(typeof r.corps === 'string' ? r.corps : JSON.stringify(r.corps ?? {}));
  });
  await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
  process.env.DIRECTUS_URL = `http://127.0.0.1:${serveur.address().port}`;
  process.env.DIRECTUS_TOKEN = 'faux';
  racine = await mkdtemp(path.join(tmpdir(), 'cliff-directus-'));
  D = await import('../src/lib/directus.js');
  D.DÉLAIS.panne = [5, 5];
});

after(async () => {
  await new Promise((ok) => serveur?.close(ok));
  if (racine) await rm(racine, { recursive: true, force: true });
});

const jouer = (...réponses) => {
  scénario = réponses;
  demandes = [];
};

test('un 429 est rejoué après le Retry-After', async () => {
  jouer({ statut: 429, entêtes: { 'Retry-After': '1' }, corps: {} }, { corps: { data: { ok: true } } });
  const t0 = Date.now();
  assert.deepEqual(await D.request('/items/x'), { ok: true });
  assert.equal(demandes.length, 2);
  assert.ok(Date.now() - t0 >= 1000, 'a attendu ce que le serveur demande');
});

test('un 5xx est rejoué, puis l’erreur remonte avec son statut', async () => {
  jouer({ statut: 502, corps: 'passerelle' }, { corps: { data: 1 } });
  assert.equal(await D.request('/items/x'), 1);
  assert.equal(demandes.length, 2);

  jouer({ statut: 503, corps: 'a' }, { statut: 503, corps: 'b' }, { statut: 503, corps: 'c' });
  await assert.rejects(D.request('/items/x'), /HTTP 503 c/);
  assert.equal(demandes.length, 3, 'un essai, deux rejeux');
});

test('un 4xx n’est pas rejoué', async () => {
  jouer({ statut: 403, corps: { errors: [] } });
  await assert.rejects(D.request('/items/x'), /HTTP 403/);
  assert.equal(demandes.length, 1);
});

test('une connexion figée s’arrête au délai, est rejouée, puis l’erreur dit que le CMS est injoignable', async () => {
  const max = D.DÉLAIS.max;
  D.DÉLAIS.max = 50;
  try {
    jouer({ figer: true }, { figer: true }, { figer: true });
    await assert.rejects(D.request('/items/x'), /CMS injoignable/);
    assert.equal(demandes.length, 3, 'un essai, deux rejeux');
  } finally {
    D.DÉLAIS.max = max;
  }
});

test('requestAll : une réponse sans liste « data » est une erreur, pas une collection vide', async () => {
  jouer({ corps: { errors: [{ message: 'proxy' }] } });
  await assert.rejects(D.requestAll('/items/x?a=1'), /sans liste/);
  jouer({ corps: 'pas du json', statut: 200 });
  await assert.rejects(D.requestAll('/items/x?a=1'));
});

test('requestAll : une collection vide est une liste vide', async () => {
  jouer({ corps: { data: [] } });
  assert.deepEqual(await D.requestAll('/items/x?a=1'), []);
});

test('requestAll : lit page après page jusqu’à une page incomplète', async () => {
  const pleine = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
  jouer({ corps: { data: pleine } }, { corps: { data: [{ id: 1000 }] } });
  const tout = await D.requestAll('/items/x?a=1');
  assert.equal(tout.length, 1001);
  assert.match(demandes[0], /limit=1000&page=1/);
  assert.match(demandes[1], /page=2/);
});

test('purgerCache : retire ce qui n’est plus affiché, les .part orphelins, et les entrées du manifeste', async () => {
  const cache = await D.ouvrirCache(pathToFileURL(racine + path.sep));
  for (const nom of ['garde.jpg', 'garde.portrait.webp', 'jette.jpg', 'orphelin.jpg.part', 'manifest.json.part']) {
    await writeFile(path.join(cache.dossier, nom), 'x');
  }
  cache.manifest.garde = { modified_on: '', fichier: 'garde.jpg' };
  cache.manifest.jette = { modified_on: '', fichier: 'jette.jpg' };
  const retirés = await D.purgerCache(cache, new Set(['garde']));
  assert.equal(retirés, 2, 'jette.jpg et orphelin.jpg.part');
  const restes = await readdir(cache.dossier);
  assert.ok(restes.includes('garde.jpg') && restes.includes('garde.portrait.webp'));
  assert.ok(restes.includes('manifest.json.part'), 'le manifeste n’est jamais touché');
  assert.deepEqual(Object.keys(cache.manifest), ['garde']);
});

test('dimensionsFichier : celles du CMS, sinon lues sur l’original, sinon null', async () => {
  const cache = await D.ouvrirCache(pathToFileURL(racine + path.sep));
  assert.deepEqual(await D.dimensionsFichier({ id: 'a', width: 300, height: 200 }, cache), { width: 300, height: 200 });
  assert.deepEqual(await D.dimensionsFichier({ id: 'inconnu' }, cache), { width: null, height: null });

  await sharp({ create: { width: 40, height: 20, channels: 3, background: '#888' } }).jpeg().toFile(path.join(cache.dossier, 'lu.jpg'));
  cache.manifest.lu = { modified_on: '', fichier: 'lu.jpg' };
  assert.deepEqual(await D.dimensionsFichier({ id: 'lu', width: null, height: null }, cache), { width: 40, height: 20 });
});

test('pointFocal : pixels en pourcentages, borné, null sans point ni dimensions', () => {
  assert.deepEqual(D.pointFocal({ focal_point_x: 500, focal_point_y: 250, width: 1000, height: 1000 }), { x: 50, y: 25 });
  assert.deepEqual(D.pointFocal({ focal_point_x: 5000, focal_point_y: -10, width: 1000, height: 1000 }), { x: 100, y: 0 });
  assert.equal(D.pointFocal({ focal_point_x: 1, focal_point_y: 1, width: null, height: 10 }), null);
  assert.equal(D.pointFocal({ width: 10, height: 10 }), null);
  assert.equal(D.pointFocal(null), null);
});

test('cadrePortrait : 9:16 autour du point focal, dans l’image', () => {
  // Paysage 1600×900 : la fenêtre fait 506×900 ; à x = 0 elle colle à gauche, à 100 à droite.
  assert.deepEqual(D.cadrePortrait(1600, 900, { x: 0, y: 0 }), { left: 0, top: 0, width: 506, height: 900 });
  assert.deepEqual(D.cadrePortrait(1600, 900, { x: 100, y: 50 }), { left: 1094, top: 0, width: 506, height: 900 });
  assert.equal(D.cadrePortrait(1600, 900, null).left, Math.round((1600 - 506) * 0.5));
  // Plus étroite que 9:16 : c'est la hauteur qui est rognée.
  const étroite = D.cadrePortrait(400, 1000, { x: 50, y: 100 });
  assert.equal(étroite.width, 400);
  assert.equal(étroite.height, 711);
  assert.equal(étroite.top, 1000 - 711);
});

test('mapLimit : au plus n à la fois, résultats dans l’ordre', async () => {
  let actifs = 0;
  let max = 0;
  const r = await D.mapLimit([5, 1, 4, 2, 3], 2, async (n) => {
    actifs++;
    max = Math.max(max, actifs);
    await new Promise((ok) => setTimeout(ok, n));
    actifs--;
    return n * 10;
  });
  assert.deepEqual(r, [50, 10, 40, 20, 30]);
  assert.ok(max <= 2);
});
