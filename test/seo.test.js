import assert from 'node:assert/strict';
import { test } from 'node:test';
import { décalageBruxelles, organisation, prixEnEuros, theaterEvent } from '../src/lib/seo.js';

test('le décalage de Bruxelles suit l’heure d’été', () => {
  assert.equal(décalageBruxelles('2026-04-17', '20:00'), '+02:00');
  assert.equal(décalageBruxelles('2019-11-04', '20:30'), '+01:00');
});

test('prix : un montant en euros, sinon rien', () => {
  assert.equal(prixEnEuros('12 €'), '12');
  assert.equal(prixEnEuros('7,50 €'), '7.50');
  assert.equal(prixEnEuros('prix libre'), null);
  assert.equal(prixEnEuros(null), null);
});

const organisateur = { nom: 'Compagnie Cliffhanger', url: 'https://exemple.test/' };

test('TheaterEvent : date avec fuseau, lieu, offre chiffrée', () => {
  const e = theaterEvent(
    { title: "L'Inédit de Molière", punch: 'Qui donc ?' },
    { day: '2026-04-17', time: '20:00', venue: "Théâtre L'Improviste", city: 'Forest', price: '12 €' },
    { url: 'https://exemple.test/spectacle/linedit-de-moliere/', image: 'https://exemple.test/a.jpg', organisateur }
  );
  assert.equal(e['@type'], 'TheaterEvent');
  assert.equal(e.startDate, '2026-04-17T20:00:00+02:00');
  assert.equal(e.location.name, "Théâtre L'Improviste");
  assert.equal(e.location.address.addressLocality, 'Forest');
  assert.deepEqual(e.offers, { '@type': 'Offer', price: '12', priceCurrency: 'EUR', url: 'https://exemple.test/spectacle/linedit-de-moliere/' });
  assert.equal(e.description, 'Qui donc ?');
});

test('TheaterEvent : sans heure ni prix, rien d’inventé', () => {
  const e = theaterEvent({ title: 'X' }, { day: '2024-05-26', time: null, venue: null, city: 'Forest', price: 'prix libre' }, { url: 'u', organisateur });
  assert.equal(e.startDate, '2024-05-26');
  assert.equal(e.offers, undefined);
  assert.equal(e.image, undefined);
  assert.equal(e.location.name, 'Forest');
});

test('organisation : les réseaux vides ne sont pas listés', () => {
  const o = organisation({ nom: 'Compagnie Cliffhanger', url: 'https://exemple.test/', réseaux: ['https://instagram.com/x', null] });
  assert.deepEqual(o.sameAs, ['https://instagram.com/x']);
  assert.equal(o.email, undefined);
  assert.equal(o.address.addressLocality, 'Bruxelles');
});
