// Le site construit (dist/), contre les règles du CLAUDE.md que seul le rendu
// final peut trahir : un tiret long venu du CMS, deux pages qui se ressemblent
// pour un moteur, des données structurées illisibles, une adresse de test.
//
// À part de `npm test` (qui tourne avant le build, sans dist/) :
//   npm run build && npm run test:dist
// Le CI le lance après « Construire le site ».
//
// Avec RAPPORT=<fichier>, chaque échec y ajoute une phrase pour la compagnie :
// le workflow la recopie dans la page Publication du Studio, où quelqu'un qui
// n'ouvre jamais GitHub saura pourquoi le site n'a pas changé.

import assert from 'node:assert/strict';
import { appendFileSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');

/** Dit à la compagnie ce qui a empêché la mise en ligne (une ligne par problème). */
function rapporter(phrases) {
  if (process.env.RAPPORT && phrases.length) appendFileSync(process.env.RAPPORT, phrases.join('\n') + '\n');
}

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
  rapporter(fautes.map((f) => `Un tiret long ou entouré d'espaces est écrit dans le texte (${f}). Remplacez-le par une virgule ou deux points dans le Studio.`));
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
  rapporter(doublons.map((d) => `Deux pages ont le même texte pour les moteurs de recherche (${d}). Changez le texte de l'une des deux dans le Studio.`));
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
  rapporter(fautes.map((f) => `La page ${f} n'a pas de titre principal : vérifiez son titre dans le Studio.`));
  assert.deepEqual(fautes, []);
});

test('security.txt est publié, avec un contact et une échéance à venir', async () => {
  const texte = await readFile(path.join(dist, '.well-known', 'security.txt'), 'utf8');
  assert.match(texte, /^Contact: mailto:\S+@\S+$/m);
  const expire = /^Expires: (\S+)$/m.exec(texte)?.[1];
  assert.ok(expire && new Date(expire) > new Date(), `Expires absent ou passé : ${expire}`);
});
