import assert from 'node:assert/strict';
import { test } from 'node:test';
import { décalageBruxelles, duréeEnMinutes, extrait, filAriane, organisation, personne, prixEnEuros, siteWeb, theaterEvent } from '../src/lib/seo.js';

test('le décalage de Bruxelles suit l’heure d’été', () => {
  assert.equal(décalageBruxelles('2026-04-17', '20:00'), '+02:00');
  assert.equal(décalageBruxelles('2019-11-04', '20:30'), '+01:00');
});

test('prix : un montant en euros, sinon rien', () => {
  assert.equal(prixEnEuros('12 €'), '12');
  assert.equal(prixEnEuros('7,50 €'), '7.50');
  assert.equal(prixEnEuros('prix libre'), null);
  assert.equal(prixEnEuros(null), null);
  // Un nombre seul (le format de Prodysos) est un prix en euros.
  assert.equal(prixEnEuros('6,07'), '6.07');
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
  assert.equal(o.member, undefined);
});

test('le site, la compagnie et ses représentations partagent un identifiant', () => {
  const url = 'https://exemple.test/';
  const o = organisation({ nom: 'Compagnie Cliffhanger', url, membres: [{ nom: 'Alexandre Van Campenhout', url: `${url}personne/a/` }] });
  assert.equal(o['@id'], 'https://exemple.test/#compagnie');
  // Chaque membre porte l'identifiant de sa fiche (voir personne()).
  assert.deepEqual(o.member, [{ '@type': 'Person', '@id': `${url}personne/a/#personne`, name: 'Alexandre Van Campenhout', url: `${url}personne/a/` }]);
  assert.deepEqual(siteWeb({ nom: 'Compagnie Cliffhanger', url }).publisher, { '@id': o['@id'] });
  const e = theaterEvent({ title: 'X' }, { day: '2027-01-01', time: null, venue: null, city: null, price: null }, { url: 'u', organisateur: { nom: 'Compagnie Cliffhanger', url } });
  assert.equal(e.organizer['@id'], o['@id']);
  assert.equal(e.performer['@id'], o['@id']);
});

test('extrait : le texte seul, entier s’il est court', () => {
  assert.equal(extrait('<p>Comédienne &amp; metteuse en scène.</p><p>Née à Liège.</p>'), 'Comédienne & metteuse en scène. Née à Liège.');
  assert.equal(extrait('<p>Un&nbsp;texte<br>sur deux lignes&#39;</p>'), "Un texte sur deux lignes'");
  assert.equal(extrait('<p> </p>'), null);
  assert.equal(extrait(null), null);
});

test('extrait : coupé à la fin d’une phrase, sinon au dernier mot', () => {
  const phrases = `${'a'.repeat(100)}. ${'b'.repeat(100)}.`;
  assert.equal(extrait(phrases), `${'a'.repeat(100)}.`);
  const mots = Array.from({ length: 40 }, () => 'mot').join(' ');
  const e = extrait(mots, 20);
  assert.equal(e, 'mot mot mot mot mot…');
  assert.ok(e.length <= 21);
});

test('durée : heures et minutes, telles que le Studio les écrit', () => {
  assert.equal(duréeEnMinutes('1 h 30, sans entracte'), 90);
  assert.equal(duréeEnMinutes('1h15'), 75);
  assert.equal(duréeEnMinutes('2 h'), 120);
  assert.equal(duréeEnMinutes('75 min'), 75);
  assert.equal(duréeEnMinutes('une soirée'), null);
  assert.equal(duréeEnMinutes(null), null);
});

test('TheaterEvent : adresse entière, fin, compagnie qui joue, places', () => {
  const e = theaterEvent(
    { title: 'Par Endroits', duration: '1 h 30' },
    { day: '2027-03-27', time: '23:00', venue: 'Théâtre de la Vie', city: 'Saint-Josse-ten-Noode', street: 'Rue Traversière 45', postalCode: '1210', price: '12 €' },
    { url: 'u', organisateur, réservable: true }
  );
  assert.deepEqual(e.location.address, {
    '@type': 'PostalAddress',
    streetAddress: 'Rue Traversière 45',
    postalCode: '1210',
    addressLocality: 'Saint-Josse-ten-Noode',
    addressCountry: 'BE',
  });
  // Minuit passé : la fin tombe le lendemain.
  assert.equal(e.endDate, '2027-03-28T00:30:00+01:00');
  assert.equal(e.performer.name, 'Compagnie Cliffhanger');
  assert.equal(e.offers.availability, 'https://schema.org/InStock');
});

test('TheaterEvent : sans heure, pas de fin ; passée, pas de places', () => {
  const e = theaterEvent({ title: 'X', duration: '1 h' }, { day: '2024-05-26', time: null, venue: null, city: null, price: '10 €' }, { url: 'u', organisateur });
  assert.equal(e.endDate, undefined);
  assert.equal(e.offers.availability, undefined);
});

test('personne : membre de la compagnie pour l’équipe seulement', () => {
  const url = 'https://exemple.test/personne/a/';
  const membre = personne({ nom: 'A', url, description: 'Comédienne.', membre: true, compagnie: 'https://exemple.test/' });
  assert.equal(membre['@id'], `${url}#personne`);
  assert.deepEqual(membre.memberOf, { '@id': 'https://exemple.test/#compagnie' });
  const invitée = personne({ nom: 'B', url, membre: false, compagnie: 'https://exemple.test/' });
  assert.equal(invitée.memberOf, undefined);
  assert.equal(invitée.description, undefined);
});

test('fil d’Ariane : les étapes numérotées depuis 1', () => {
  const f = filAriane([
    { nom: 'Accueil', url: 'https://exemple.test/' },
    { nom: 'Hamlet', url: 'https://exemple.test/spectacle/hamlet/' },
  ]);
  assert.equal(f['@type'], 'BreadcrumbList');
  assert.deepEqual(f.itemListElement[1], { '@type': 'ListItem', position: 2, name: 'Hamlet', item: 'https://exemple.test/spectacle/hamlet/' });
});
