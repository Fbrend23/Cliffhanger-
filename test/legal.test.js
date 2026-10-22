import assert from 'node:assert/strict';
import { test } from 'node:test';
import { légal, légalÉchappé } from '../src/lib/legal.js';
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

test('le RPM est facultatif et n’apparaît que rempli', () => {
  const sans = T.sectionsMentionsLégales(légal(complet)).map((s) => s.html).join('');
  assert.doesNotMatch(sans, /RPM/);
  const avec = légal({ ...complet, legal_rpm: 'RPM Bruxelles, section francophone' });
  assert.match(T.sectionsMentionsLégales(avec).map((s) => s.html).join(''), /RPM Bruxelles, section francophone/);
});

test('la ligne d’identification omet le RPM vide et n’a aucun tiret long', () => {
  const sans = T.identification(légalÉchappé(légal(complet)));
  assert.equal(sans, 'Compagnie Cliffhanger ASBL · Rue de Test 1, 1000 Bruxelles · N° d\'entreprise 0123.456.789 · <a href="mailto:contact@exemple.be">contact@exemple.be</a>');
  const avec = T.identification(légalÉchappé(légal({ ...complet, legal_rpm: 'RPM Bruxelles' })));
  assert.match(avec, /0123\.456\.789 · RPM Bruxelles · <a/);
  assert.doesNotMatch(avec, /[—–]| - /);
});

test('les valeurs échappées ne laissent passer aucune balise', () => {
  const l = légalÉchappé({ ...légal(complet), denomination: 'A & <b>B</b>', conservation: '<i>1 an</i>' });
  assert.equal(l.denomination, 'A &amp; &lt;b&gt;B&lt;/b&gt;');
  assert.equal(l.conservation, '&lt;i&gt;1 an&lt;/i&gt;');
});
