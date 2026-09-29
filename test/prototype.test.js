// La traduction du prototype vers le modèle du CMS, partagée par la
// migration et le faux Directus : ce que ce test garantit, les deux le font.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { enParagraphes, focalEnPixels, lireFocus, lirePrototype, modèleDuPrototype } from '../scripts/lib/prototype.mjs';

const proto = await lirePrototype(new URL('../migration/content.js', import.meta.url));
const m = modèleDuPrototype(proto);

test('le focus du prototype devient un point focal en pixels', () => {
  assert.deepEqual(lireFocus('50% 22%'), { x: 50, y: 22 });
  assert.equal(lireFocus(null), null);
  assert.deepEqual(focalEnPixels({ x: 50, y: 22 }, 1080, 1587), { focal_point_x: 540, focal_point_y: 349 });
  assert.deepEqual(m.fichiers.find((f) => f.nom === 'noir-blanc').focus, { x: 50, y: 30 });
});

test('une ligne de photo par couple (fichier, légende), un seul fichier', () => {
  const groupe = m.photos.filter((p) => p.fichier === 'groupe');
  assert.deepEqual(groupe.map((p) => [p.caption, p.galerie]), [["L'Inédit de Molière", true], ['La troupe', false]]);
  assert.equal(m.fichiers.filter((f) => f.nom === 'groupe').length, 1);
  assert.equal(m.photos.filter((p) => p.galerie).length, proto.GALLERY.length);
});

test('personnes : Marie-Hélène Ruiz invitée, le collectif de Montréal à part', () => {
  const groupe = Object.fromEntries(m.personnes.map((p) => [p.slug, p.groupe]));
  assert.equal(groupe['marie-helene-ruiz'], 'invite');
  assert.equal(groupe['anais-legrand'], 'montreal');
  assert.equal(groupe['alexandre-van-campenhout'], 'equipe');
});

test('la ligne « Avec » garde sa place et porte les interprètes', () => {
  const pe = m.generique.filter((g) => g.spectacle === 'par-endroits').map((g) => g.role);
  assert.deepEqual(pe, ['Initiative et mise en scène', 'Écriture', 'Avec', 'Scénographie', 'Assistanat', 'Affiche']);
  const avec = m.generique.find((g) => g.spectacle === 'les-femmes-se-vantent' && g.role === 'Avec');
  assert.deepEqual(avec.personnes[2], { slug: 'laurie-stevens', personnage: 'Philaminte' });
});

test('textes en paragraphes HTML, réglages et fonds', () => {
  assert.equal(enParagraphes(['a & b', 'c']), '<p>a &amp; b</p><p>c</p>');
  assert.equal(enParagraphes(undefined), null);
  assert.match(m.reglages.compagnie_text, /<a href="\/montreal\/">collectif-sœur à Montréal<\/a>/);
  assert.equal(m.reglages.fond_compagnie, 'noir-blanc|Coulisses');
  assert.equal(m.reglages.og_image, 'groupe');
});

test('aucun tiret long ni demi-cadratin n’entre dans le CMS', () => {
  assert.doesNotMatch(JSON.stringify(m), /[—–]/);
  assert.throws(() => modèleDuPrototype({ ...proto, MONTREAL: { ...proto.MONTREAL, sub: 'Montréal — 2020' } }), /Tiret long/);
});
