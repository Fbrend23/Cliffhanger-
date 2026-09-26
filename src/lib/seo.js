// Les données structurées (schema.org) : la compagnie sur l'accueil, une
// représentation par TheaterEvent sur la fiche d'un spectacle. C'est ce qui
// permet à un moteur de montrer « 17 avr., Théâtre L'Improviste » sous le
// lien. Pur, testé dans test/seo.test.js ; Base.astro pose le contexte.

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
 * La compagnie.
 * @param {{ nom: string, url: string, description?: string|null, email?: string|null, réseaux?: (string|null)[], image?: string|null }} o
 */
export function organisation({ nom, url, description = null, email = null, réseaux = [], image = null }) {
  const liens = réseaux.filter(Boolean);
  return {
    '@type': 'TheaterGroup',
    name: nom,
    url,
    ...(description ? { description } : {}),
    ...(email ? { email } : {}),
    ...(image ? { image } : {}),
    ...(liens.length ? { sameAs: liens } : {}),
    address: { '@type': 'PostalAddress', addressLocality: 'Bruxelles', addressCountry: 'BE' },
  };
}

/**
 * Une représentation.
 * @param {{ title: string, punch?: string|null }} spectacle
 * @param {{ day: string, time: string|null, venue: string|null, city: string|null, price: string|null }} r
 * @param {{ url: string, image?: string|null, organisateur: { nom: string, url: string } }} o
 */
export function theaterEvent(spectacle, r, { url, image = null, organisateur }) {
  const début = r.time ? `${r.day}T${r.time}:00${décalageBruxelles(r.day, r.time)}` : r.day;
  const prix = prixEnEuros(r.price);
  return {
    '@type': 'TheaterEvent',
    name: spectacle.title,
    startDate: début,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    url,
    ...(spectacle.punch ? { description: spectacle.punch } : {}),
    ...(image ? { image } : {}),
    location: {
      '@type': 'Place',
      name: r.venue ?? r.city ?? organisateur.nom,
      address: { '@type': 'PostalAddress', ...(r.city ? { addressLocality: r.city } : {}), addressCountry: 'BE' },
    },
    ...(prix ? { offers: { '@type': 'Offer', price: prix, priceCurrency: 'EUR', url } } : {}),
    organizer: { '@type': 'TheaterGroup', name: organisateur.nom, url: organisateur.url },
  };
}
