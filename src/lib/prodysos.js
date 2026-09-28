// Prodysos, le back-office de la compagnie : la source des dates qu'on y
// programme, et le guichet des réservations. Le spectacle lui-même (textes,
// photos, générique) reste dans le CMS ; l'affiche et le synopsis de sa page
// publique Prodysos ne servent que quand le CMS n'en a pas.
//
// Prodysos n'ouvre au rôle anonyme que des fonctions, aucune table. On appelle
// `get_public_company_shows` en désignant la COMPAGNIE, jamais un spectacle :
// le slug d'un spectacle est unique sur toute la base Prodysos, en nommer un à
// la main exposerait à afficher la création d'une autre troupe. Chaque
// spectacle Prodysos rejoint ensuite celui du CMS qui porte le même titre, ou
// celui qui le réclame par son champ `prodysos_slug` (voir relier).
//
// Lu au build seulement : Prodysos en panne fait échouer le build, et le site
// en ligne reste intact. Écrit depuis le navigateur, par le formulaire de
// réservation (voir réserver) : ce module n'importe donc rien de Node. Même
// connecteur que Maisallezfieu.

import { échapper } from './typo.js';

/**
 * Les trois variables vont ensemble. Aucune : le site vit sur les dates du
 * CMS seul. Une partie seulement : une configuration cassée, on refuse.
 * @param {{ PRODYSOS_URL?: string, PRODYSOS_KEY?: string, PRODYSOS_COMPANY?: string }} env
 */
export function prodysosConfiguré(env) {
  const noms = ['PRODYSOS_URL', 'PRODYSOS_KEY', 'PRODYSOS_COMPANY'];
  const manquantes = noms.filter((n) => !env[n]);
  if (manquantes.length === noms.length) return false;
  if (manquantes.length) throw new Error(`Prodysos à moitié configuré : ${manquantes.join(', ')} manque(nt).`);
  return true;
}

// Un 522 de Cloudflare devant Supabase est souvent un raté de quelques
// secondes : deux nouveaux essais avant de faire échouer le build.
const DÉLAIS = [2000, 5000];

async function rpc(env, fonction, corps, délais = DÉLAIS) {
  for (let essai = 0; ; essai++) {
    let res;
    try {
      res = await fetch(`${env.PRODYSOS_URL}/rest/v1/rpc/${fonction}`, {
        method: 'POST',
        headers: { apikey: env.PRODYSOS_KEY, Authorization: `Bearer ${env.PRODYSOS_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(corps),
      });
    } catch (e) {
      // Une erreur réseau est aussi passagère qu'un 5xx : mêmes essais.
      if (essai >= délais.length) throw new Error(`Prodysos injoignable (${fonction}) : ${e.message}`);
      await attendre(délais[essai], fonction, e.message);
      continue;
    }
    if (res.ok) return res.json();
    // Un 4xx ne s'arrangera pas en réessayant.
    const message = `Prodysos ${fonction} : HTTP ${res.status} ${await décrireErreur(res)}`.trim();
    if (res.status < 500 || essai >= délais.length) throw new Error(message);
    await attendre(délais[essai], fonction, message);
  }
}

function attendre(ms, fonction, raison) {
  console.warn(`${raison}, nouvel essai de ${fonction} dans ${ms / 1000} s`);
  return new Promise((ok) => setTimeout(ok, ms));
}

// Une panne derrière Cloudflare rend une page HTML de centaines de lignes qui
// noierait le log ; une erreur PostgREST est un JSON court, gardé.
async function décrireErreur(res) {
  const détail = await res.text().catch(() => '');
  if ((res.headers.get('content-type') ?? '').includes('text/html')) return '(page HTML : Prodysos injoignable derrière Cloudflare)';
  return détail.length > 300 ? `${détail.slice(0, 300)}…` : détail;
}

/**
 * Les spectacles publiés de la compagnie, chacun avec ses représentations.
 *
 * Prodysos rend null pour une compagnie inconnue OU sans `public_slug`
 * (l'exposition publique y est un choix explicite). On lève : un agenda
 * silencieusement privé de ses dates serait pire qu'un build en échec.
 */
export async function lireSpectaclesProdysos(env, { délais } = {}) {
  const data = await rpc(env, 'get_public_company_shows', { p_company_slug: env.PRODYSOS_COMPANY }, délais);
  if (!data) {
    throw new Error(
      `Prodysos ne connaît aucune compagnie publique « ${env.PRODYSOS_COMPANY} » : ` +
        'le slug est faux, ou la compagnie n’a pas encore de public_slug dans Prodysos.'
    );
  }
  return Array.isArray(data.shows) ? data.shows : [];
}

const bruxelles = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Brussels',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/**
 * Un horodatage Prodysos (« 2026-11-14T20:00:00+01:00 ») devient le jour et
 * l'heure À BRUXELLES, la forme des lignes du CMS : « 2026-11-14 », « 20:00 ».
 * Illisible : null.
 */
export function jourEtHeure(horodatage) {
  const d = new Date(horodatage ?? '');
  if (Number.isNaN(d.getTime())) return null;
  const p = Object.fromEntries(bruxelles.formatToParts(d).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/**
 * La commune d'une adresse Prodysos, rangée en un seul champ : ce qui suit le
 * code postal belge en fin d'adresse (« Rue Traversière 45, 1210
 * Saint-Josse-ten-Noode » → « Saint-Josse-ten-Noode »), pays final permis.
 * Autre forme : null, et la salle s'affiche seule.
 */
export function commune(adresse) {
  if (typeof adresse !== 'string') return null;
  const sansPays = adresse.trim().replace(/[,\s]+(Belgique|Belgium|België|Belgien)$/i, '');
  const m = /(?:^|[\s,])\d{4}\s+([^\d,][^,]*)$/.exec(sansPays);
  return m ? m[1].trim() : null;
}

/**
 * Un titre réduit à ce qui le distingue : sans casse, accents, apostrophes
 * ni ponctuation. « L’Inédit de Molière » et « L'inedit de moliere » se
 * valent ; la compagnie ne tape pas deux fois la même typographie.
 */
export function titreNormalisé(titre) {
  if (typeof titre !== 'string') return '';
  return titre
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * Quel spectacle du CMS reçoit les dates de quel spectacle Prodysos.
 *
 * 1. Le `prodysos_slug` saisi dans le CMS : le lien forcé, pour des titres qui
 *    diffèrent. Deux spectacles qui réclament le même arrêtent le build.
 * 2. Sinon, le même titre (titreNormalisé). C'est le cas courant, et il ne
 *    demande rien à la compagnie : elle nomme son projet dans Prodysos comme
 *    sur le site. Un spectacle du CMS déjà relié à la main n'est pas candidat.
 *    Un titre porté par deux spectacles du CMS ne relie rien : on n'en choisit
 *    aucun au hasard, et on le dit.
 *
 * Les titres comparés sont ceux de la compagnie seule (la réponse de
 * Prodysos ne contient qu'elle) : aucun risque d'attraper la création d'une
 * autre troupe du même nom.
 *
 * @param {any[]} spectaclesProdysos  la réponse de Prodysos
 * @param {{ slug: string, title?: string|null, prodysos_slug?: string|null, price?: string|null }[]} spectaclesCms  publiés
 * @param {{ avertir: (message: string) => void, informer?: (message: string) => void }} journal
 * @returns {Map<string, { slug: string, price: string|null }>}  slug Prodysos → spectacle du CMS
 */
export function relier(spectaclesProdysos, spectaclesCms, { avertir, informer = () => {} }) {
  const liens = new Map();
  const libres = [];
  for (const s of spectaclesCms) {
    const clé = texteOuNull(s.prodysos_slug);
    if (!clé) {
      libres.push(s);
      continue;
    }
    if (liens.has(clé)) {
      throw new Error(`Deux spectacles publiés réclament le spectacle Prodysos « ${clé} » : ${liens.get(clé).slug} et ${s.slug}.`);
    }
    liens.set(clé, { slug: s.slug, price: texteOuNull(s.price) });
  }

  const parTitre = new Map();
  for (const s of libres) {
    const titre = titreNormalisé(s.title);
    if (titre) parTitre.set(titre, [...(parTitre.get(titre) ?? []), s]);
  }
  for (const show of spectaclesProdysos) {
    if (!show?.slug || liens.has(show.slug)) continue;
    const candidats = parTitre.get(titreNormalisé(show.title)) ?? [];
    if (candidats.length > 1) {
      avertir(`Prodysos « ${show.slug} » : le titre « ${show.title} » est celui de ${candidats.map((s) => s.slug).join(' et ')}, aucun n'est relié (préciser le champ Prodysos de l'un d'eux)`);
    } else if (candidats.length === 1) {
      const [s] = candidats;
      liens.set(show.slug, { slug: s.slug, price: texteOuNull(s.price) });
      informer(`Prodysos « ${show.slug} » relié par son titre à ${s.slug}`);
    }
  }
  return liens;
}

/**
 * Les représentations Prodysos, sous la forme des lignes du CMS. Seules
 * comptent celles d'un spectacle Prodysos relié à un spectacle publié du CMS
 * (voir relier) ; le prix est celui de ce spectacle.
 *
 * @param {any[]} spectaclesProdysos  la réponse de Prodysos
 * @param {Map<string, { slug: string, price: string|null }>} parSlugProdysos
 * @param {(message: string) => void} avertir
 */
export function lignesProdysos(spectaclesProdysos, parSlugProdysos, avertir) {
  const lignes = [];
  for (const show of spectaclesProdysos) {
    const cible = parSlugProdysos.get(show?.slug);
    const représentations = Array.isArray(show?.representations) ? show.representations : [];
    if (!cible) {
      if (représentations.length) avertir(`Prodysos « ${show?.slug} » (« ${show?.title} ») : aucun spectacle publié de ce titre ni qui le réclame (prodysos_slug), ${représentations.length} date(s) ignorée(s)`);
      continue;
    }
    for (const r of représentations) {
      const quand = jourEtHeure(r?.date);
      if (!quand) {
        avertir(`Prodysos « ${show.slug} » : représentation ${r?.id} sans date lisible, ignorée`);
        continue;
      }
      const venue = texteOuNull(r.location_name);
      const city = commune(r.location_address);
      if (r.location_address && !city) avertir(`Prodysos « ${show.slug} » : commune introuvable dans « ${r.location_address} », la salle s’affiche seule`);
      // De quoi réserver cette date : le spectacle Prodysos (sa page publique)
      // et la représentation, ce qu'attend create_public_reservation.
      const reservation = { slug: show.slug, id: String(r.id) };
      lignes.push({ id: `prodysos-${r.id}`, spectacle: cible.slug, ...quand, venue, city, price: cible.price, reservation });
    }
  }
  return lignes;
}

const texteOuNull = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * Les dates du CMS et celles de Prodysos en une liste. Une date saisie dans
 * le CMS l'emporte sur la même de Prodysos (même spectacle, même jour, même
 * heure ; une ligne du CMS sans heure couvre tout le jour) : c'est la
 * correction voulue par quelqu'un, avec sa salle, sa ville, son prix.
 *
 * Elle reste réservable : elle reprend la réservation de la date Prodysos
 * qu'elle remplace. Une ligne sans heure qui en couvre plusieurs ne dit pas
 * laquelle on réserve : elle n'en prend aucune plutôt que d'en choisir une.
 *
 * @template {{ spectacle: string, day: string, time: string|null, reservation?: any }} L
 * @param {L[]} duCms
 * @param {L[]} deProdysos
 * @returns {{ lignes: L[], écartées: number }}
 */
export function fusionner(duCms, deProdysos) {
  const jour = (l) => `${l.spectacle}|${l.day}`;
  const exacte = (l) => `${jour(l)}|${l.time ?? ''}`;
  const jourEntier = new Set(duCms.filter((l) => !l.time).map(jour));
  const exactes = new Set(duCms.map(exacte));
  const gardées = [];
  const écartées = [];
  for (const l of deProdysos) (jourEntier.has(jour(l)) || exactes.has(exacte(l)) ? écartées : gardées).push(l);

  const corrigées = duCms.map((l) => {
    if (l.reservation) return l;
    const remplacées = écartées.filter((p) => (l.time ? exacte(p) === exacte(l) : jour(p) === jour(l)));
    return remplacées.length === 1 && remplacées[0].reservation ? { ...l, reservation: remplacées[0].reservation } : l;
  });
  return { lignes: [...corrigées, ...gardées], écartées: écartées.length };
}

/**
 * Le spectacle Prodysos relié à chaque spectacle du CMS, pour son affiche et
 * son synopsis. Deux spectacles Prodysos du même titre peuvent rejoindre le
 * même spectacle du CMS (une reprise) : le premier, celui que Prodysos met en
 * tête (à l'affiche d'abord), l'emporte.
 *
 * @param {any[]} spectaclesProdysos
 * @param {Map<string, { slug: string }>} liens  voir relier
 * @returns {Map<string, any>}  slug du CMS → spectacle Prodysos
 */
export function parSpectacleCms(spectaclesProdysos, liens) {
  const par = new Map();
  for (const show of spectaclesProdysos) {
    const cible = liens.get(show?.slug);
    if (cible && !par.has(cible.slug)) par.set(cible.slug, show);
  }
  return par;
}

/**
 * Le nom de l'affiche d'un spectacle Prodysos dans le cache des originaux.
 * Sans point : la purge du cache lit l'id jusqu'au premier.
 */
export const idAfficheProdysos = (slug) => `prodysos-affiche-${String(slug).replace(/[^\w-]/g, '-')}`;

/**
 * Le synopsis d'une page publique Prodysos, du texte brut, en HTML de la
 * forme du texte du CMS : une ligne vide sépare deux paragraphes, un retour
 * simple reste un retour. Vide : null.
 */
export function synopsisEnHtml(synopsis) {
  if (typeof synopsis !== 'string' || !synopsis.trim()) return null;
  return synopsis
    .replace(/\r\n?/g, '\n')
    .trim()
    .split(/\n[ \t]*\n\s*/)
    .map((p) => `<p>${p.split('\n').map((l) => échapper(l.trim())).join('<br>')}</p>`)
    .join('');
}

/**
 * Envoie une demande de réservation, depuis le navigateur. Prodysos revalide
 * tout de son côté (page publiée, représentation du bon spectacle et pas
 * encore jouée, nombre de places, adresse) et répond, en cas de refus, un
 * message écrit pour le public (« Représentation invalide ou déjà passée »).
 * On le rend tel quel ; sans message, null, et la page dit le sien.
 * Une erreur réseau lève.
 *
 * @param {{ url: string, clé: string }} prodysos
 * @param {{ slug: string, id: string, nom: string, email: string, places: number, message: string|null }} demande
 * @returns {Promise<{ ok: true } | { ok: false, message: string|null }>}
 */
export async function réserver(prodysos, demande) {
  const res = await fetch(`${prodysos.url}/rest/v1/rpc/create_public_reservation`, {
    method: 'POST',
    headers: { apikey: prodysos.clé, Authorization: `Bearer ${prodysos.clé}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_slug: demande.slug,
      p_name: demande.nom,
      p_email: demande.email,
      p_party_size: demande.places,
      p_rehearsal_id: demande.id,
      p_message: demande.message,
      p_locale: 'fr',
    }),
  });
  if (res.ok) return { ok: true };
  const corps = await res.json().catch(() => null);
  return { ok: false, message: typeof corps?.message === 'string' && corps.message.trim() ? corps.message.trim() : null };
}
