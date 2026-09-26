// Les dates de l'agenda et des fiches : formats du prototype, séries de
// représentations, date du jour. Pur, testé dans test/dates.test.js.
//
// Les jours sont des chaînes « AAAA-MM-JJ » (le type date de Directus) : on
// les formate en UTC, pour qu'un runner en UTC et un poste à Bruxelles
// écrivent le même jour. Seule « aujourd'hui » dépend du fuseau, et c'est
// celui de Bruxelles, où les représentations ont lieu.

const formatJourMois = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** @param {string} iso */
const parties = (iso) => Object.fromEntries(formatJourMois.formatToParts(new Date(`${iso}T00:00:00Z`)).map((p) => [p.type, p.value]));

/** « 17 avr. 2026 ». */
export function formatJour(iso) {
  const p = parties(iso);
  return `${p.day} ${p.month} ${p.year}`;
}

/** « 20:00 » ou « 20:00:00 » → « 20h00 ». Vide, rien. */
export const formatHeure = (t) => (t ? t.slice(0, 5).replace(':', 'h') : '');

/** Le jour et l'heure d'une représentation : « 17 avr. 2026, 20h00 ». */
export const formatJourHeure = (jour, heure) => (heure ? `${formatJour(jour)}, ${formatHeure(heure)}` : formatJour(jour));

const UN_JOUR = 864e5;
const écart = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / UN_JOUR);

/**
 * Une série de soirs : « 17 et 18 avr. 2026 » pour deux soirs, « 24 au 26
 * mai 2024 » pour plus, le mois et l'année dits une fois quand ils sont
 * communs.
 */
export function formatPlage(de, à) {
  if (de === à) return formatJour(de);
  const A = parties(de);
  const B = parties(à);
  const joint = écart(de, à) === 1 ? 'et' : 'au';
  if (A.year !== B.year) return `${formatJour(de)} ${joint} ${formatJour(à)}`;
  if (A.month !== B.month) return `${A.day} ${A.month} ${joint} ${B.day} ${B.month} ${B.year}`;
  return `${A.day} ${joint} ${B.day} ${B.month} ${B.year}`;
}

/** « Théâtre L'Improviste, Forest » : la salle et la ville, ce qui existe. */
export const lieu = (r) => [r.venue, r.city].filter(Boolean).join(', ');

/**
 * Les séries de l'agenda : les représentations consécutives (un jour d'écart
 * au plus) d'un même spectacle dans une même salle deviennent une ligne. Les
 * plus récentes d'abord, comme le prototype.
 *
 * @template {{ spectacle: string, day: string, venue: string|null, city: string|null }} R
 * @param {R[]} représentations
 * @returns {{ spectacle: string, de: string, à: string, lieu: string }[]}
 */
export function séries(représentations) {
  const parSpectacle = new Map();
  for (const r of représentations) {
    if (!parSpectacle.has(r.spectacle)) parSpectacle.set(r.spectacle, []);
    parSpectacle.get(r.spectacle).push(r);
  }
  const sortie = [];
  for (const [spectacle, liste] of parSpectacle) {
    let courante = null;
    for (const r of [...liste].sort((a, b) => a.day.localeCompare(b.day))) {
      if (courante && courante.venue === r.venue && écart(courante.à, r.day) <= 1) {
        courante.à = r.day;
        continue;
      }
      courante = { spectacle, de: r.day, à: r.day, venue: r.venue, lieu: lieu(r) };
      sortie.push(courante);
    }
  }
  return sortie.sort((x, y) => y.de.localeCompare(x.de)).map(({ venue, ...s }) => s);
}

/**
 * La date du jour à Bruxelles, « AAAA-MM-JJ ». Au build : la reconstruction
 * de la nuit fait passer les dates d'« À venir » aux « Passées ».
 * @param {Date} [maintenant]
 */
export const aujourdhui = (maintenant = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit' }).format(maintenant);
