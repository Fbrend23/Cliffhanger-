import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cléNom, joindreFr, lignesGenerique, lireNoms, projetsDe, valeurLigne } from '../src/lib/generique.js';

const g = (sort, role, extra = {}) => ({ sort, role, note: null, text: null, personnes: [], ...extra });
const n = (slug, personnage = null) => ({ slug, nom: slug, personnage });

test('joindreFr', () => {
  assert.equal(joindreFr([]), '');
  assert.equal(joindreFr(['a']), 'a');
  assert.equal(joindreFr(['a', 'b']), 'a et b');
  assert.equal(joindreFr(['a', 'b', 'c']), 'a, b et c');
});

test('un nom se retrouve sans accents ni majuscules, le personnage est entre parenthèses', () => {
  assert.equal(cléNom('  Alizé   COOKIE '), 'alize cookie');
  const personnes = [{ slug: 'alize-cookie', name: 'Alizé Cookie' }, { slug: 'hans-melot', name: 'Hans Mélot' }];
  const { noms, inconnus } = lireNoms('Alize cookie\r\nHans Mélot (Clitandre)\n\n  Inconnu Personne  ', personnes);
  assert.deepEqual(noms, [
    { slug: 'alize-cookie', nom: 'Alize cookie', personnage: null },
    { slug: 'hans-melot', nom: 'Hans Mélot', personnage: 'Clitandre' },
    { slug: null, nom: 'Inconnu Personne', personnage: null },
  ]);
  assert.deepEqual(inconnus, ['Inconnu Personne']);
  assert.deepEqual(lireNoms(null, personnes), { noms: [], inconnus: [] });
});

test('les lignes suivent l’ordre du Studio, les noms gardent leur personnage', () => {
  const lignes = lignesGenerique([
    g(1, 'Texte', { personnes: [n('mhr')] }),
    g(3, 'Genre', { text: 'musical' }),
    g(2, 'Avec', { personnes: [n('a', 'Henriette'), n('b')] }),
  ]);
  assert.deepEqual(
    lignes.map((l) => l.role),
    ['Texte', 'Avec', 'Genre']
  );
  assert.deepEqual(lignes[1].noms, [n('a', 'Henriette'), n('b')]);
});

test('une ligne sans note, sans nom et sans texte disparaît', () => {
  const lignes = lignesGenerique([g(1, 'Mise en scène', { text: 'collective' }), g(2, 'Vide'), g(3, 'Avec')]);
  assert.deepEqual(
    lignes.map((l) => l.role),
    ['Mise en scène']
  );
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
    ['fsv', lignesGenerique([g(1, 'Mise en scène', { text: 'collective' }), g(2, 'Avec', { personnes: [n('sophie', 'Henriette')] })])],
    ['inedit', lignesGenerique([g(1, 'Mise en scène', { personnes: [n('sophie')] }), g(2, 'Avec', { personnes: [n('sophie')] })])],
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
