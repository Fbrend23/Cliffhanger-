// Ce que les pages disent aux moteurs : les descriptions tirées d'un texte
// riche, et les données structurées (schema.org), la compagnie sur l'accueil,
// une représentation par TheaterEvent sur la fiche d'un spectacle. C'est ce
// qui permet à un moteur de montrer « 17 avr., Théâtre L'Improviste » sous le
// lien. Pur, testé dans test/seo.test.js ; Base.astro pose le contexte.

import { jourEtHeure } from './prodysos.js';

const ENTITÉS = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/**
 * La description d'une page tirée d'un texte riche du CMS (une biographie, un
 * texte de spectacle) : le texte seul, sur une ligne, arrêté à la fin d'une
 * phrase si elle tombe assez loin, sinon au dernier mot avant `max`, avec
 * « … ». Google coupe vers 155 caractères : au-delà, la fin serait perdue.
 * @param {string|null|undefined} html
 * @param {number} [max]
 * @returns {string|null} null pour un texte vide
 */
export function extrait(html, max = 155) {
  const texte = String(html ?? '')
    .replace(/<\/(p|li|h\d)>|<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (tout, e) => {
      if (e[0] !== '#') return ENTITÉS[e.toLowerCase()] ?? tout;
      return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    })
    .replace(/\s+/g, ' ')
    .trim();
  if (!texte) return null;
  if (texte.length <= max) return texte;
  const début = texte.slice(0, max);
  // Une phrase entière vaut mieux qu'une coupe, si elle dit assez.
  const phrase = Math.max(...['. ', '! ', '? ', '… '].map((f) => début.lastIndexOf(f)));
  if (phrase >= max / 2) return début.slice(0, phrase + 1);
  const mot = début.lastIndexOf(' ');
  return `${(mot > 0 ? début.slice(0, mot) : début).replace(/[\s,;:.]+$/, '')}…`;
}

/**
 * Le décalage de Bruxelles à une date donnée, « +01:00 » ou « +02:00 » : une
 * heure sans fuseau serait lue dans celui du moteur.
 * @param {string} jour  AAAA-MM-JJ
 * @param {string} heure HH:MM
 */
export function décalageBruxelles(jour, heure) {
  const instant = new Date(`${jour}T${heure}:00Z`);
  const nom = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Brussels', timeZoneName: 'longOffset' })
    .formatToParts(instant)
    .find((p) => p.type === 'timeZoneName')?.value;
  const m = /GMT([+-]\d{2}):?(\d{2})?/.exec(nom ?? '');
  return m ? `${m[1]}:${m[2] ?? '00'}` : '+01:00';
}

/** « 12 € » → « 12 » ; « prix libre » → null (pas d'offre chiffrée). */
export function prixEnEuros(prix) {
  const m = /(\d+(?:[.,]\d{1,2})?)\s*€/.exec(prix ?? '');
  return m ? m[1].replace(',', '.') : null;
}

/**
 * Une personne, sur sa fiche. Seule l'équipe est membre de la compagnie ;
 * un invité ou quelqu'un de Montréal y a sa fiche sans en être.
 * @param {{ nom: string, url: string, description?: string|null, membre: boolean, compagnie: string }} o  compagnie : l'accueil
 */
export function personne({ nom, url, description = null, membre, compagnie }) {
  return {
    '@type': 'Person',
    '@id': idPersonne(url),
    name: nom,
    url,
    ...(description ? { description } : {}),
    ...(membre ? { memberOf: { '@id': idCompagnie(compagnie) } } : {}),
  };
}

/**
 * Le fil d'Ariane d'une page, que Google montre à la place de l'adresse.
 * @param {{ nom: string, url: string }[]} étapes  de l'accueil à la page
 */
export function filAriane(étapes) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: étapes.map((é, i) => ({ '@type': 'ListItem', position: i + 1, name: é.nom, item: é.url })),
  };
}

/**
 * La durée d'un spectacle, telle que le Studio la dit, en minutes :
 * « 1 h 30, sans entracte » → 90, « 1h15 » → 75, « 75 min » → 75. Illisible : null.
 * @param {string|null|undefined} durée
 */
export function duréeEnMinutes(durée) {
  const h = /(\d+)\s*h(?:\s*(\d{1,2}))?/i.exec(durée ?? '');
  if (h) return Number(h[1]) * 60 + Number(h[2] ?? 0);
  const m = /(\d+)\s*min/i.exec(durée ?? '');
  return m ? Number(m[1]) : null;
}

/** « 2026-04-17T20:00:00+02:00 » : un jour et une heure de Bruxelles, avec leur décalage. */
const instantBruxelles = (jour, heure) => `${jour}T${heure}:00${décalageBruxelles(jour, heure)}`;

/**
 * L'identifiant de la compagnie dans les données structurées : le même sur
 * toutes les pages, pour qu'un moteur relie les représentations, les fiches
 * et le site à une seule compagnie.
 * @param {string} url  l'accueil
 */
export const idCompagnie = (url) => `${url}#compagnie`;

/** L'identifiant d'une personne : sa fiche. */
const idPersonne = (url) => `${url}#personne`;

/**
 * Le site : c'est lui qui donne son nom au site dans les résultats de Google.
 * @param {{ nom: string, url: string }} o
 */
export function siteWeb({ nom, url }) {
  return { '@type': 'WebSite', '@id': `${url}#site`, name: nom, url, inLanguage: 'fr-BE', publisher: { '@id': idCompagnie(url) } };
}

/**
 * La compagnie, et son équipe (le groupe « equipe » seulement : un invité
 * n'en est pas membre).
 * @param {{ nom: string, url: string, description?: string|null, email?: string|null, réseaux?: (string|null)[], image?: string|null, logo?: string|null, membres?: { nom: string, url: string }[] }} o
 */
export function organisation({ nom, url, description = null, email = null, réseaux = [], image = null, logo = null, membres = [] }) {
  const liens = réseaux.filter(Boolean);
  return {
    '@type': 'TheaterGroup',
    '@id': idCompagnie(url),
    name: nom,
    url,
    ...(description ? { description } : {}),
    ...(email ? { email } : {}),
    ...(logo ? { logo } : {}),
    ...(image ? { image } : {}),
    ...(liens.length ? { sameAs: liens } : {}),
    address: { '@type': 'PostalAddress', addressLocality: 'Bruxelles', addressCountry: 'BE' },
    ...(membres.length ? { member: membres.map((m) => ({ '@type': 'Person', '@id': idPersonne(m.url), name: m.nom, url: m.url })) } : {}),
  };
}

/**
 * Une représentation. La compagnie l'organise et la joue ; la fin se déduit
 * de la durée quand elle se lit ; une date encore réservable a des places.
 * @param {{ title: string, punch?: string|null, duration?: string|null }} spectacle
 * @param {{ day: string, time: string|null, venue: string|null, city: string|null, street?: string|null, postalCode?: string|null, price: string|null }} r
 * @param {{ url: string, image?: string|null, organisateur: { nom: string, url: string }, réservable?: boolean }} o
 */
export function theaterEvent(spectacle, r, { url, image = null, organisateur, réservable = false }) {
  const début = r.time ? instantBruxelles(r.day, r.time) : r.day;
  const minutes = r.time ? duréeEnMinutes(spectacle.duration) : null;
  const finale = minutes ? jourEtHeure(Date.parse(début) + minutes * 60_000) : null;
  const prix = prixEnEuros(r.price);
  const compagnie = { '@type': 'TheaterGroup', '@id': idCompagnie(organisateur.url), name: organisateur.nom, url: organisateur.url };
  return {
    '@type': 'TheaterEvent',
    name: spectacle.title,
    startDate: début,
    ...(finale ? { endDate: instantBruxelles(finale.day, finale.time) } : {}),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    url,
    ...(spectacle.punch ? { description: spectacle.punch } : {}),
    ...(image ? { image } : {}),
    location: {
      '@type': 'Place',
      name: r.venue ?? r.city ?? organisateur.nom,
      address: {
        '@type': 'PostalAddress',
        ...(r.street ? { streetAddress: r.street } : {}),
        ...(r.postalCode ? { postalCode: r.postalCode } : {}),
        ...(r.city ? { addressLocality: r.city } : {}),
        addressCountry: 'BE',
      },
    },
    ...(prix
      ? { offers: { '@type': 'Offer', price: prix, priceCurrency: 'EUR', url, ...(réservable ? { availability: 'https://schema.org/InStock' } : {}) } }
      : {}),
    organizer: compagnie,
    performer: compagnie,
  };
}
