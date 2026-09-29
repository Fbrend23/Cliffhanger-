import assert from 'node:assert/strict';
import { test } from 'node:test';
import { légal } from '../src/lib/legal.js';
import { T } from '../src/lib/textes.js';

const complet = {
  legal_denomination: 'Compagnie Cliffhanger ASBL',
  legal_adresse: 'Rue de Test 1\r\n\r\n1000 Bruxelles\n',
  legal_bce: '0123.456.789',
  legal_responsable: 'Une Personne',
  legal_conservation: null,
  email: 'contact@exemple.be',
};

test('les informations légales complètes donnent les lignes de l’adresse', () => {
  const l = légal(complet);
  assert.deepEqual(l?.adresse, ['Rue de Test 1', '1000 Bruxelles']);
  assert.equal(l?.conservation, null);
});

test('il suffit qu’une information manque pour qu’il n’y ait pas de pages légales', () => {
  for (const champ of ['legal_denomination', 'legal_adresse', 'legal_bce', 'legal_responsable', 'email']) {
    assert.equal(légal({ ...complet, [champ]: null }), null, champ);
  }
  assert.equal(légal({ ...complet, legal_adresse: ' \n ' }), null);
});

test('les pages légales rendent chaque section, sans tiret long', () => {
  const l = légal(complet);
  for (const sections of [T.sectionsMentionsLégales(l), T.sectionsConfidentialité(l)]) {
    assert.ok(sections.length > 3);
    for (const s of sections) assert.ok(s.titre && s.html);
  }
  const html = T.sectionsConfidentialité({ ...l, conservation: '12 mois' }).map((s) => s.html).join('');
  assert.match(html, /conservée 12 mois/);
  assert.match(html, /aucun cookie/);
});
