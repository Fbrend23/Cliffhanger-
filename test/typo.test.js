import assert from 'node:assert/strict';
import { test } from 'node:test';
import { T } from '../src/lib/textes.js';
import { tx, typographier } from '../src/lib/typo.js';

test('apostrophe, deux points, ponctuation haute et guillemets', () => {
  assert.equal(typographier("L'équipe : qui ? Oui ! « Molière »"), 'L’équipe : qui ? Oui ! « Molière »');
});

test('les balises et leurs attributs restent intacts', () => {
  const html = `<a href="/montreal/" title="l'autre">l'autre : ici</a>`;
  assert.equal(typographier(html), `<a href="/montreal/" title="l'autre">l’autre : ici</a>`);
});

test('aucun tiret long ni demi-cadratin ne passe', () => {
  const sortie = typographier('Bruxelles — Montréal, 2019–2026, un – deux, a - b');
  assert.doesNotMatch(sortie, /[—–]/);
  assert.equal(sortie, 'Bruxelles, Montréal, 2019-2026, un, deux, a, b');
});

test('les traits d’union des mots restent', () => {
  assert.equal(typographier('Saint-Josse-ten-Noode, collectif-sœur'), 'Saint-Josse-ten-Noode, collectif-sœur');
});

test('tx échappe avant de typographier', () => {
  assert.equal(tx('<b>A & B</b>'), '&lt;b&gt;A &amp; B&lt;/b&gt;');
  assert.equal(tx(null), '');
  assert.equal(tx(2026), '2026');
});

test('les textes de l’interface ne portent aucun tiret long', () => {
  const tout = JSON.stringify(T, (_, v) => (typeof v === 'function' ? v('x') : v));
  assert.doesNotMatch(tout, /[—–]/);
  assert.doesNotMatch(tout, / - /);
});
