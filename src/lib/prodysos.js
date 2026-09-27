// Prodysos, le back-office de la compagnie : la source des dates qu'on y
// programme. Le site ne lui prend QUE les représentations ; le spectacle
// lui-même (textes, photos, générique) reste dans le CMS.
//
// Prodysos n'ouvre au rôle anonyme que des fonctions, aucune table. On appelle
// `get_public_company_shows` en désignant la COMPAGNIE, jamais un spectacle :
// le slug d'un spectacle est unique sur toute la base Prodysos, en nommer un à
// la main exposerait à afficher la création d'une autre troupe. Chaque
// spectacle du CMS dit ensuite lequel des spectacles Prodysos est le sien
// (champ `prodysos_slug`).
//
// Lu au build seulement : Prodysos en panne fait échouer le build, et le site
// en ligne reste intact. Même connecteur que Maisallezfieu.

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
 * Les représentations Prodysos, sous la forme des lignes du CMS. Seules
 * comptent celles d'un spectacle Prodysos qu'un spectacle publié du CMS
 * réclame par son `prodysos_slug` ; le prix est celui de ce spectacle.
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
      if (représentations.length) avertir(`Prodysos « ${show?.slug} » : aucun spectacle publié ne le réclame (prodysos_slug), ${représentations.length} date(s) ignorée(s)`);
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
      lignes.push({ id: `prodysos-${r.id}`, spectacle: cible.slug, ...quand, venue, city, price: cible.price });
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
 * @template {{ spectacle: string, day: string, time: string|null }} L
 * @param {L[]} duCms
 * @param {L[]} deProdysos
 * @returns {{ lignes: L[], écartées: number }}
 */
export function fusionner(duCms, deProdysos) {
  const jourEntier = new Set(duCms.filter((l) => !l.time).map((l) => `${l.spectacle}|${l.day}`));
  const exactes = new Set(duCms.map((l) => `${l.spectacle}|${l.day}|${l.time ?? ''}`));
  const gardées = deProdysos.filter((l) => !jourEntier.has(`${l.spectacle}|${l.day}`) && !exactes.has(`${l.spectacle}|${l.day}|${l.time ?? ''}`));
  return { lignes: [...duCms, ...gardées], écartées: deProdysos.length - gardées.length };
}
