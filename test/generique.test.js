import assert from 'node:assert/strict';
import { test } from 'node:test';
import { joindreFr, lignesGenerique, projetsDe, valeurLigne } from '../src/lib/generique.js';

const g = (sort, role, extra = {}) => ({ sort, role, note: null, text: null, personnes: [], ...extra });
const d = (sort, personne, personnage = null) => ({ sort, personne, personnage });

test('joindreFr', () => {
  assert.equal(joindreFr([]), '');
  assert.equal(joindreFr(['a']), 'a');
  assert.equal(joindreFr(['a', 'b']), 'a et b');
  assert.equal(joindreFr(['a', 'b', 'c']), 'a, b et c');
});

test('la distribution prend la place de la ligne « Avec », dans l’ordre du Studio', () => {
  const lignes = lignesGenerique(
    [g(1, 'Texte', { personnes: ['mhr'] }), g(3, 'Genre', { text: 'musical' }), g(2, 'Avec')],
    [d(2, 'b'), d(1, 'a', 'Henriette')]
  );
  assert.deepEqual(
    lignes.map((l) => l.role),
    ['Texte', 'Avec', 'Genre']
  );
  assert.deepEqual(lignes[1].noms, [
    { slug: 'a', personnage: 'Henriette' },
    { slug: 'b', personnage: null },
  ]);
});

test('sans ligne « Avec », la distribution vient en dernier ; une ligne vide disparaît', () => {
  const lignes = lignesGenerique([g(1, 'Mise en scène', { text: 'collective' }), g(2, 'Vide')], [d(1, 'a')]);
  assert.deepEqual(
    lignes.map((l) => l.role),
    ['Mise en scène', 'Avec']
  );
  assert.deepEqual(lignesGenerique([g(1, 'Avec')], []), []);
});

test('valeur : la note qui finit par une apostrophe se colle au nom', () => {
  const nom = (n) => `<a>${n.slug}</a>${n.personnage ? ` (${n.personnage})` : ''}`;
  const texte = (s) => s;
  assert.equal(valeurLigne({ role: 'Mise en scène', note: 'collective, sous la direction d’', noms: [{ slug: 'alize', personnage: null }], text: null }, nom, texte), 'collective, sous la direction d’<a>alize</a>');
  assert.equal(valeurLigne({ role: 'Écriture', note: null, noms: [], text: 'de plateau' }, nom, texte), 'de plateau');
  assert.equal(
    valeurLigne({ role: 'Avec', note: null, noms: [{ slug: 'a', personnage: 'X' }, { slug: 'b', personnage: null }, { slug: 'c', personnage: null }], text: null }, nom, texte),
    '<a>a</a> (X), <a>b</a> et <a>c</a>'
  );
  // Une personne dépubliée (nomHtml rend null) sort de la ligne.
  assert.equal(valeurLigne({ role: 'Avec', note: null, noms: [{ slug: 'a', personnage: null }, { slug: 'x', personnage: null }], text: null }, (n) => (n.slug === 'x' ? null : n.slug), texte), 'a');
});

test('projets : rôles par spectacle, interprétation avec le personnage, les plus récents d’abord', () => {
  const spectacles = [
    { slug: 'fsv', year: 2019 },
    { slug: 'inedit', year: 2026 },
  ];
  const lignes = new Map([
    ['fsv', lignesGenerique([g(1, 'Mise en scène', { text: 'collective' })], [d(1, 'sophie', 'Henriette')])],
    ['inedit', lignesGenerique([g(1, 'Mise en scène', { personnes: ['sophie'] }), g(2, 'Avec')], [d(1, 'sophie')])],
  ]);
  assert.deepEqual(
    projetsDe('sophie', spectacles, lignes).map((p) => [p.spectacle.slug, p.roles]),
    [
      ['inedit', ['Mise en scène', 'Interprétation']],
      ['fsv', ['Interprétation (Henriette)']],
    ]
  );
  assert.deepEqual(projetsDe('personne', spectacles, lignes), []);
});
