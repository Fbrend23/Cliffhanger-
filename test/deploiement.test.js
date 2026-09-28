// Le manifeste du déploiement : voir scripts/lib/deploiement.mjs.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ancêtres, diffManifestes, dossiersACréer } from '../scripts/lib/deploiement.mjs';

test('ancêtres : les dossiers parents, du plus proche au plus loin', () => {
  assert.deepEqual(ancêtres('spectacle/hamlet/index.html'), ['spectacle/hamlet', 'spectacle']);
  assert.deepEqual(ancêtres('index.html'), []);
});

test('diffManifestes : nouveau et changé partent, inchangé reste', () => {
  const ancien = { 'index.html': 'a', 'agenda/index.html': 'b', '_astro/vieux.js': 'c' };
  const nouveau = { 'index.html': 'a', 'agenda/index.html': 'B', '_astro/neuf.js': 'd' };
  const { envoyer, supprimer } = diffManifestes(ancien, nouveau);
  assert.deepEqual(envoyer.sort(), ['_astro/neuf.js', 'agenda/index.html']);
  // agenda/index.html a changé, mais existe encore : ce n'est pas une suppression.
  assert.deepEqual(supprimer, ['_astro/vieux.js']);
});

test('diffManifestes : /_astro/ toujours avant le reste dans envoyer', () => {
  const nouveau = { 'index.html': 'a', '_astro/z.js': 'b', 'agenda/index.html': 'c' };
  const { envoyer } = diffManifestes({}, nouveau);
  assert.deepEqual(envoyer, ['_astro/z.js', 'agenda/index.html', 'index.html']);
});

test('diffManifestes : les dossiers vidés, du plus profond au moins profond', () => {
  const ancien = {
    'personne/a/index.html': 'x',
    'spectacle/hamlet/index.html': 'y',
    'spectacle/hamlet/slides/1.html': 'z',
  };
  // spectacle/hamlet et son sous-dossier disparaissent ; personne/a reste.
  const nouveau = { 'personne/a/index.html': 'x' };
  const { supprimer, dossiersASupprimer } = diffManifestes(ancien, nouveau);
  assert.deepEqual(supprimer.sort(), ['spectacle/hamlet/index.html', 'spectacle/hamlet/slides/1.html']);
  assert.deepEqual(dossiersASupprimer, ['spectacle/hamlet/slides', 'spectacle/hamlet', 'spectacle']);
});

test('diffManifestes : deux manifestes vides, rien à faire', () => {
  assert.deepEqual(diffManifestes({}, {}), { envoyer: [], supprimer: [], dossiersASupprimer: [] });
});

test('dossiersACréer : le dossier direct de chaque fichier, jamais ses ancêtres (mkdir -p les crée seul)', () => {
  assert.deepEqual(dossiersACréer(['personne/alexandre-van-campenhout/index.html', 'x.html', 'a/y.html']), ['a', 'personne/alexandre-van-campenhout']);
});
