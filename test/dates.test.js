import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aujourdhui, formatHeure, formatJour, formatJourHeure, formatPlage, lieu, séries } from '../src/lib/dates.js';

test('un jour, une heure', () => {
  assert.equal(formatJour('2026-04-17'), '17 avr. 2026');
  assert.equal(formatHeure('20:00:00'), '20h00');
  assert.equal(formatHeure('20:00'), '20h00');
  assert.equal(formatHeure(null), '');
  assert.equal(formatJourHeure('2019-11-04', '20:30'), '4 nov. 2019, 20h30');
  assert.equal(formatJourHeure('2025-06-06', null), '6 juin 2025');
});

test('les plages du prototype', () => {
  assert.equal(formatPlage('2026-04-17', '2026-04-18'), '17 et 18 avr. 2026');
  assert.equal(formatPlage('2024-05-24', '2024-05-26'), '24 au 26 mai 2024');
  assert.equal(formatPlage('2024-05-31', '2024-06-01'), '31 mai et 1 juin 2024');
  assert.equal(formatPlage('2025-12-31', '2026-01-01'), '31 déc. 2025 et 1 janv. 2026');
  assert.equal(formatPlage('2026-04-17', '2026-04-17'), '17 avr. 2026');
});

test('séries : soirs consécutifs d’un spectacle dans une salle, les plus récentes d’abord', () => {
  const r = (spectacle, day, venue = 'Salle', city = 'Forest') => ({ spectacle, day, venue, city });
  const s = séries([r('a', '2024-05-24'), r('a', '2024-05-26'), r('a', '2024-05-25'), r('b', '2026-04-17'), r('b', '2026-04-18'), r('b', '2026-05-01'), r('a', '2024-05-27', 'Autre')]);
  assert.deepEqual(s, [
    { spectacle: 'b', de: '2026-05-01', à: '2026-05-01', lieu: 'Salle, Forest' },
    { spectacle: 'b', de: '2026-04-17', à: '2026-04-18', lieu: 'Salle, Forest' },
    { spectacle: 'a', de: '2024-05-27', à: '2024-05-27', lieu: 'Autre, Forest' },
    { spectacle: 'a', de: '2024-05-24', à: '2024-05-26', lieu: 'Salle, Forest' },
  ]);
});

test('lieu : ce qui existe seulement', () => {
  assert.equal(lieu({ venue: null, city: 'Montréal' }), 'Montréal');
  assert.equal(lieu({ venue: null, city: null }), '');
});

test('aujourd’hui se compte à Bruxelles, quel que soit le fuseau du runner', () => {
  // 23 h 30 UTC le 31 mars : déjà le 1er avril à Bruxelles (UTC+2 en été).
  assert.equal(aujourdhui(new Date('2026-03-31T23:30:00Z')), '2026-04-01');
  assert.equal(aujourdhui(new Date('2026-01-15T12:00:00Z')), '2026-01-15');
});
