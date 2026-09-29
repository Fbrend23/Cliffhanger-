// Le site construit (dist/), contre les règles du CLAUDE.md que seul le rendu
// final peut trahir : un tiret long venu du CMS, deux pages qui se ressemblent
// pour un moteur, des données structurées illisibles, une adresse de test.
//
// À part de `npm test` (qui tourne avant le build, sans dist/) :
//   npm run build && npm run test:dist
// Le CI le lance après « Construire le site ».

import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');

/** @type {{ chemin: string, html: string }[]} */
let pages = [];

async function html(dossier) {
  const sortie = [];
  for (const e of await readdir(dossier, { withFileTypes: true })) {
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) sortie.push(...(await html(p)));
    else if (e.name.endsWith('.html')) sortie.push(p);
  }
  return sortie;
}

before(async () => {
  pages = await Promise.all(
    (await html(dist)).map(async (p) => ({ chemin: path.relative(dist, p).replaceAll('\\', '/'), html: await readFile(p, 'utf8') }))
  );
  assert.ok(pages.length > 10, `dist/ semble vide (${pages.length} pages) : lancer npm run build d'abord`);
});

const meta = (h, attr, valeur) => new RegExp(`<meta[^>]*${attr}="${valeur}"[^>]*content="([^"]*)"`, 'i').exec(h)?.[1] ?? null;
const indexable = (p) => !/noindex/.test(meta(p.html, 'name', 'robots') ?? '');

/** Le texte que voit un visiteur : ni scripts, ni styles, ni balises. */
const texteVisible = (h) =>
  h
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ');

test('aucun tiret long, demi-cadratin ni tiret entouré d’espaces dans le texte visible', () => {
  const fautes = [];
  for (const p of pages) {
    const t = texteVisible(p.html);
    for (const m of t.matchAll(/[—–]|\s-\s/g)) fautes.push(`${p.chemin} : « ${t.slice(Math.max(0, m.index - 25), m.index + 25).replace(/\s+/g, ' ')} »`);
  }
  assert.deepEqual(fautes, []);
});

test('chaque page indexable a un titre et une description à elle', () => {
  const vus = { titre: new Map(), description: new Map() };
  const doublons = [];
  for (const p of pages.filter(indexable)) {
    const titre = /<title>([\s\S]*?)<\/title>/.exec(p.html)?.[1]?.trim();
    const description = meta(p.html, 'name', 'description');
    assert.ok(titre, `${p.chemin} : pas de titre`);
    assert.ok(description, `${p.chemin} : pas de description`);
    for (const [clé, valeur] of [['titre', titre], ['description', description]]) {
      if (vus[clé].has(valeur)) doublons.push(`${clé} de ${p.chemin} = celui de ${vus[clé].get(valeur)}`);
      else vus[clé].set(valeur, p.chemin);
    }
  }
  assert.deepEqual(doublons, []);
});

test('une adresse canonique par page indexable, aucune sur les autres, toujours sur le domaine', () => {
  for (const p of pages) {
    const canoniques = [...p.html.matchAll(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"/gi)].map((m) => m[1]);
    if (indexable(p)) {
      assert.equal(canoniques.length, 1, `${p.chemin} : ${canoniques.length} canonical`);
      assert.match(canoniques[0], /^https:\/\/[^/]+\//, `${p.chemin} : canonical relatif ou non https`);
    } else {
      assert.equal(canoniques.length, 0, `${p.chemin} : une page noindex n'a pas de canonical`);
    }
  }
});

test('les données structurées se lisent et portent un @type', () => {
  let total = 0;
  for (const p of pages) {
    for (const m of p.html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      const données = JSON.parse(m[1]);
      for (const d of Array.isArray(données) ? données : [données]) {
        assert.ok(d['@type'], `${p.chemin} : JSON-LD sans @type`);
        total++;
      }
    }
  }
  assert.ok(total > 0, 'aucune donnée structurée dans tout le site');
});

test('aucune adresse de développement dans les pages', () => {
  const fautes = pages.filter((p) => /localhost|127\.0\.0\.1|\.test\//.test(p.html)).map((p) => p.chemin);
  assert.deepEqual(fautes, []);
});

test('aucune page n’est sans <h1> (hors 404 sans index)', () => {
  const fautes = pages.filter((p) => indexable(p) && !/<h1[\s>]/.test(p.html)).map((p) => p.chemin);
  assert.deepEqual(fautes, []);
});
