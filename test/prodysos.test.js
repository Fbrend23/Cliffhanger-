// Le connecteur Prodysos : l'heure de Bruxelles, la commune tirée de
// l'adresse, le lien par le titre ou prodysos_slug, la fusion avec les
// dates du CMS, et ce que le build fait d'une réponse vide ou d'une
// configuration partielle.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { commune, fusionner, jourEtHeure, lignesProdysos, lireSpectaclesProdysos, prodysosConfiguré, relier, titreNormalisé } from '../src/lib/prodysos.js';
import { démarrer } from './faux-directus/serveur.mjs';

test('une date Prodysos devient le jour et l’heure de Bruxelles', () => {
  assert.deepEqual(jourEtHeure('2026-11-14T20:00:00+01:00'), { day: '2026-11-14', time: '20:00' });
  // En UTC la veille, à Bruxelles le lendemain : c'est Bruxelles qui compte.
  assert.deepEqual(jourEtHeure('2026-06-30T22:30:00Z'), { day: '2026-07-01', time: '00:30' });
  assert.equal(jourEtHeure(null), null);
  assert.equal(jourEtHeure('pas une date'), null);
});

test('la commune est ce qui suit le code postal, pays final permis', () => {
  assert.equal(commune('Rue Traversière 45, 1210 Saint-Josse-ten-Noode'), 'Saint-Josse-ten-Noode');
  assert.equal(commune('Chaussée de Waterloo 12 1180 Uccle, Belgique'), 'Uccle');
  assert.equal(commune('1000 Bruxelles'), 'Bruxelles');
  assert.equal(commune('Rue Traversière 45'), null);
  assert.equal(commune(null), null);
});

test('seuls les spectacles réclamés par le CMS donnent des dates, au prix du spectacle', () => {
  const avertissements = [];
  const lignes = lignesProdysos(
    [
      { slug: 'pe', representations: [{ id: 'a', date: '2027-03-12T20:00:00+01:00', location_name: ' Théâtre de la Vie ', location_address: 'Rue X 1, 1210 Saint-Josse' }] },
      { slug: 'orphelin', representations: [{ id: 'b', date: '2027-01-08T19:00:00+01:00' }] },
      { slug: 'vide', representations: [] },
    ],
    new Map([['pe', { slug: 'par-endroits', price: '12 €' }]]),
    (m) => avertissements.push(m)
  );
  assert.deepEqual(lignes, [
    { id: 'prodysos-a', spectacle: 'par-endroits', day: '2027-03-12', time: '20:00', venue: 'Théâtre de la Vie', city: 'Saint-Josse', price: '12 €' },
  ]);
  // L'orphelin est dit ; un spectacle sans date n'a rien à dire.
  assert.equal(avertissements.length, 1);
  assert.match(avertissements[0], /orphelin/);
});

test('un titre se compare sans casse, accents, apostrophes ni ponctuation', () => {
  assert.equal(titreNormalisé('L’Inédit de Molière'), titreNormalisé("l'inedit de moliere"));
  assert.equal(titreNormalisé('Un C(h)œur silencieux'), 'un c h oeur silencieux');
  assert.equal(titreNormalisé('  Par   Endroits ! '), 'par endroits');
  assert.equal(titreNormalisé(null), '');
});

test('relier : le même titre suffit, le champ Prodysos force un autre lien', () => {
  const informations = [];
  const avertissements = [];
  const liens = relier(
    [
      { slug: 'hamlet', title: 'L’inédit de Molière' },
      { slug: 'pe-2027', title: 'Par Endroits' },
      { slug: 'sans-titre', title: '' },
      { slug: 'inconnu', title: 'Rien à voir' },
    ],
    [
      { slug: 'linedit-de-moliere', title: "L'Inédit de Molière", prodysos_slug: null, price: ' 15 € ' },
      // Relié à la main : il ne prend pas en plus le projet qui porte son titre.
      { slug: 'par-endroits', title: 'Par endroits', prodysos_slug: 'pe', price: null },
    ],
    { avertir: (m) => avertissements.push(m), informer: (m) => informations.push(m) }
  );
  assert.deepEqual(
    [...liens],
    [
      ['pe', { slug: 'par-endroits', price: null }],
      ['hamlet', { slug: 'linedit-de-moliere', price: '15 €' }],
    ]
  );
  assert.equal(informations.length, 1);
  assert.match(informations[0], /hamlet.*linedit-de-moliere/);
  assert.deepEqual(avertissements, []);
});

test('relier : un titre porté par deux spectacles ne relie rien, et le dit', () => {
  const avertissements = [];
  const liens = relier(
    [{ slug: 'x', title: 'Hamlet' }],
    [
      { slug: 'hamlet-2019', title: 'Hamlet' },
      { slug: 'hamlet-2026', title: 'hamlet' },
    ],
    { avertir: (m) => avertissements.push(m) }
  );
  assert.equal(liens.size, 0);
  assert.match(avertissements[0], /hamlet-2019 et hamlet-2026/);
});

test('relier : deux spectacles qui réclament le même projet arrêtent le build', () => {
  assert.throws(
    () =>
      relier(
        [],
        [
          { slug: 'a', prodysos_slug: 'pe' },
          { slug: 'b', prodysos_slug: 'pe' },
        ],
        { avertir: () => {} }
      ),
    /Deux spectacles publiés réclament le spectacle Prodysos « pe » : a et b/
  );
});

test('une adresse sans code postal : la salle seule, et un avertissement', () => {
  const avertissements = [];
  const [l] = lignesProdysos(
    [{ slug: 'pe', representations: [{ id: 'a', date: '2027-03-12T20:00:00+01:00', location_name: 'Salle', location_address: 'Quelque part' }] }],
    new Map([['pe', { slug: 'par-endroits', price: null }]]),
    (m) => avertissements.push(m)
  );
  assert.equal(l.city, null);
  assert.equal(avertissements.length, 1);
});

test('la date saisie dans le CMS l’emporte sur la même de Prodysos', () => {
  const cms = [
    { spectacle: 'pe', day: '2027-03-12', time: '20:00' },
    { spectacle: 'pe', day: '2027-03-14', time: null },
  ];
  const prodysos = [
    { spectacle: 'pe', day: '2027-03-12', time: '20:00' }, // même heure : écartée
    { spectacle: 'pe', day: '2027-03-12', time: '15:00' }, // une matinée : gardée
    { spectacle: 'pe', day: '2027-03-14', time: '20:00' }, // jour entier dans le CMS : écartée
    { spectacle: 'autre', day: '2027-03-12', time: '20:00' }, // autre spectacle : gardée
  ];
  const { lignes, écartées } = fusionner(cms, prodysos);
  assert.equal(écartées, 2);
  assert.deepEqual(lignes.slice(2), [prodysos[1], prodysos[3]]);
});

test('toutes les variables ou aucune', () => {
  assert.equal(prodysosConfiguré({}), false);
  assert.equal(prodysosConfiguré({ PRODYSOS_URL: 'u', PRODYSOS_KEY: 'k', PRODYSOS_COMPANY: 'c' }), true);
  assert.throws(() => prodysosConfiguré({ PRODYSOS_URL: 'u' }), /PRODYSOS_KEY, PRODYSOS_COMPANY/);
});

test('une compagnie inconnue de Prodysos arrête le build', async () => {
  const faux = await démarrer(0);
  try {
    const env = { PRODYSOS_URL: faux.url, PRODYSOS_KEY: 'faux' };
    const shows = await lireSpectaclesProdysos({ ...env, PRODYSOS_COMPANY: 'cliffhanger' });
    assert.ok(shows.some((s) => s.slug === 'par-endroits-cliffhanger'));
    await assert.rejects(lireSpectaclesProdysos({ ...env, PRODYSOS_COMPANY: 'inconnue' }), /public_slug/);
  } finally {
    await faux.fermer();
  }
});

test('un 4xx échoue tout de suite, sans nouvel essai', async () => {
  const faux = await démarrer(0);
  try {
    // Sans clé, le faux Prodysos répond 401 ; des délais vides : aucune attente.
    await assert.rejects(lireSpectaclesProdysos({ PRODYSOS_URL: faux.url, PRODYSOS_KEY: '', PRODYSOS_COMPANY: 'cliffhanger' }, { délais: [] }), /HTTP 401/);
  } finally {
    await faux.fermer();
  }
});
