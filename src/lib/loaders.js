// Les huit collections du site, telles que le Content Layer les charge.
//
// Chaque loader lit une collection du CMS, rapatrie les originaux qui manquent
// au cache, et range les entrées dans le store d'Astro. Le schéma
// (src/content.config.js) valide ensuite chaque entrée et convertit les
// chemins d'images en ImageMetadata, ce qui permet à getImage() de fabriquer
// les tailles au build.
//
// Les liens entre collections sont rangés par slug (spectacle, personne) ou
// par id (photo) : les pages les résolvent. Une ligne dont le spectacle ou la
// personne est dépublié revient de Directus sans les champs de la cible (la
// policy du build ne lit que le publié) : elle est ignorée avec un warning,
// comme si le lien n'existait pas.

import {
  MANIFEST_REL,
  assurerAperçu,
  assurerFichier,
  assurerFichierExterne,
  assurerPortrait,
  champsFichier,
  dimensionsFichier,
  mapLimit,
  ouvrirCache,
  pointFocal,
  purgerCache,
  request,
  requestAll,
} from './directus.js';
import { T } from './textes.js';
import {
  fusionner,
  idAfficheProdysos,
  lignesProdysos,
  lireSpectaclesProdysos,
  parSpectacleCms,
  prodysosConfiguré,
  relier,
  synopsisEnHtml,
} from './prodysos.js';
import { PRODYSOS_COMPANY, PRODYSOS_KEY, PRODYSOS_URL } from 'astro:env/server';

/** @typedef {import('astro/loaders').Loader} Loader */
/** @typedef {{ id: string, spectacle: string, day: string, time: string|null, venue: string|null, city: string|null, street: string|null, postalCode: string|null, price: string|null, reservation: { slug: string, id: string }|null }} Représentation */

/** Les variables de Prodysos, toutes optionnelles : voir prodysosConfiguré. */
const ENV_PRODYSOS = { PRODYSOS_URL, PRODYSOS_KEY, PRODYSOS_COMPANY };

export const SPECTACLES = 'cliff_spectacles';
export const PERSONNES = 'cliff_personnes';
export const DISTRIBUTION = 'cliff_distribution';
export const GENERIQUE = 'cliff_generique';
export const REPRESENTATIONS = 'cliff_representations';
export const PHOTOS = 'cliff_photos';
export const MONTREAL = 'cliff_montreal';
export const REGLAGES = 'cliff_reglages';

/** Les fonds de page des réglages : des ids de photos. */
const FONDS = ['fond_accueil', 'fond_spectacles', 'fond_agenda', 'fond_compagnie', 'fond_contact'];

/** Le filtre ceinture : la policy du build l'impose déjà. */
const PUBLIÉ = 'filter[status][_eq]=published';

/**
 * Une chaîne non vide, sinon null : un champ vide n'est jamais affiché.
 * @param {unknown} v
 */
export const texte = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * Le contenu vient du Studio : on ne refuse pas un build pour un tiret long,
 * mais on le dit. Au rendu, `typographier` (lib/typo.js) les remplace de
 * toute façon : la règle de la compagnie tient même si quelqu'un l'oublie.
 *
 * @param {{ warn(m: string): void }} logger
 * @param {string} où
 * @param {unknown[]} valeurs
 */
function signalerTirets(logger, où, valeurs) {
  for (const v of valeurs) {
    if (typeof v === 'string' && /[—–]/.test(v)) {
      logger.warn(`${où} : tiret long ou demi-cadratin dans « ${v.slice(0, 60)}… », remplacé au rendu. À corriger dans le Studio.`);
      return;
    }
  }
}

/**
 * Un slug fait l'adresse de la page : on ne refuse pas l'entrée (la page existe
 * peut-être déjà, et changer son adresse est la décision de la compagnie), mais
 * on dit ce qui s'écarte de « lettres minuscules, chiffres, tirets », ou ce qui
 * en écrase un autre : `store.set` garderait silencieusement le dernier.
 *
 * @param {{ warn(m: string): void }} logger
 * @param {string} où
 * @param {string} slug
 * @param {Set<string>} vus  les slugs déjà rencontrés dans cette collection
 */
export function signalerSlug(logger, où, slug, vus) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    logger.warn(`${où} : le slug « ${slug} » n'est pas une adresse propre (minuscules, chiffres et tirets). À corriger dans le Studio.`);
  }
  if (vus.has(slug)) logger.warn(`${où} : le slug « ${slug} » est déjà pris, cette entrée écrase l'autre.`);
  vus.add(slug);
}

/**
 * Prodysos, lu une fois pour les trois loaders qui s'en servent : ses
 * spectacles publiés, les spectacles du CMS qu'ils rejoignent (relier), et
 * ces spectacles du CMS eux-mêmes. Les représentations y prennent leurs
 * dates, les spectacles l'affiche et le synopsis qui leur manquent, les
 * photos de quoi ne pas purger ces affiches.
 *
 * Astro lance les loaders ensemble : ils partagent la lecture en cours. Elle
 * est oubliée une fois finie, pour qu'`astro dev` relise à neuf. Prodysos non
 * configuré : `shows` est null.
 *
 * @param {{ info(m: string): void, warn(m: string): void }} logger
 * @returns {Promise<{ spectaclesCms: any[], shows: any[]|null, liens: Map<string, { slug: string, price: string|null }> }>}
 */
function prodysosDuBuild(logger) {
  lectureProdysos ??= (async () => {
    const spectaclesCms = await requestAll(`/items/${SPECTACLES}?${PUBLIÉ}&fields=slug,title,prodysos_slug,price`);
    if (!prodysosConfiguré(ENV_PRODYSOS)) return { spectaclesCms, shows: null, liens: new Map() };
    const shows = await lireSpectaclesProdysos(ENV_PRODYSOS);
    const liens = relier(shows, spectaclesCms, { avertir: (m) => logger.warn(m), informer: (m) => logger.info(m) });
    return { spectaclesCms, shows, liens };
  })().finally(() => {
    lectureProdysos = null;
  });
  return lectureProdysos;
}

/** @type {ReturnType<typeof prodysosDuBuild> | null} */
let lectureProdysos = null;


/**
 * Les spectacles publiés, dans l'ordre du Studio, puis du plus récent.
 *
 * L'affiche et le texte du CMS font foi. Un spectacle qui n'en a pas prend
 * ceux de sa page publique Prodysos, s'il y est relié (prodysosDuBuild).
 *
 * ZÉRO SPECTACLE N'EST PAS UN SITE VIDE, c'est une chaîne cassée : on refuse
 * de construire plutôt que d'écraser le site en ligne par un accueil sans
 * titres. Un spectacle sans photo, lui, est un oubli d'édition : on le signale
 * et on passe.
 * @returns {Loader}
 */
export function spectaclesLoader() {
  return {
    name: 'directus-spectacles',
    async load({ store, parseData, logger, config }) {
      const cache = await ouvrirCache(config.root);
      const [lignes, prodysos] = await Promise.all([
        requestAll(
          `/items/${SPECTACLES}?${PUBLIÉ}&sort=sort,-year` +
            `&fields=id,sort,slug,title,year,troupe,punch,cite,text,credit,duration,` +
            `${champsFichier('hero')},${champsFichier('poster')},slides.${PHOTOS}_id` +
            `&deep[slides][_sort]=sort`
        ),
        prodysosDuBuild(logger),
      ]);
      const deProdysos = prodysos.shows ? parSpectacleCms(prodysos.shows, prodysos.liens) : new Map();

      // Les téléchargements se font en parallèle, mais les entrées sont
      // rangées ensuite dans l'ordre reçu du CMS : rangées au fil des
      // téléchargements, deux spectacles jamais triés dans le Studio
      // changeaient de place d'un build à l'autre.
      const slugsVus = new Set();
      const entrées = await mapLimit(lignes, 3, async (s) => {
        const slug = texte(s.slug);
        const title = texte(s.title);
        if (!slug || !title) {
          logger.warn(`spectacle ${s.id} sans slug ou sans titre : ignoré`);
          return null;
        }
        signalerSlug(logger, `spectacle « ${title} »`, slug, slugsVus);
        if (!s.hero?.id) {
          logger.warn(`spectacle « ${title} » sans grande photo : ignoré`);
          return null;
        }
        const show = deProdysos.get(slug);
        const text = texte(s.text) ?? synopsisEnHtml(show?.synopsis);
        signalerTirets(logger, `spectacle « ${title} »`, [s.title, s.punch, s.cite, text, s.credit, s.duration]);
        const hero = await assurerFichier(s.hero, cache, logger);
        const focal = pointFocal(s.hero);
        // La grande photo couvre l'écran : son recadrage pour les téléphones
        // tenus droits, et son aperçu flou (lib/directus.js).
        const heroPortrait = await assurerPortrait(s.hero.id, focal, cache, logger);
        const heroApercu = await assurerAperçu(s.hero.id, cache);
        let poster = null;
        let posterTaille = null;
        if (s.poster?.id) {
          poster = await assurerFichier(s.poster, cache, logger);
          posterTaille = await dimensionsFichier(s.poster, cache);
        } else if (texte(show?.poster_url)) {
          const a = await assurerFichierExterne(show.poster_url.trim(), idAfficheProdysos(show.slug), cache, logger);
          poster = a.chemin;
          posterTaille = { width: a.width, height: a.height };
        }
        const data = await parseData({
          id: slug,
          filePath: MANIFEST_REL,
          data: {
            slug,
            title,
            year: s.year ?? null,
            troupe: s.troupe === 'montreal' ? 'montreal' : 'bruxelles',
            punch: texte(s.punch),
            cite: texte(s.cite),
            text,
            credit: texte(s.credit),
            duration: texte(s.duration),
            sort: s.sort ?? 0,
            hero,
            heroTaille: await dimensionsFichier(s.hero, cache),
            heroPortrait,
            heroApercu,
            focal,
            poster,
            posterTaille,
            slides: (s.slides ?? []).map((/** @type {any} */ l) => l?.[`${PHOTOS}_id`]).filter((/** @type {unknown} */ id) => id != null).map(String),
          },
        });
        return {
          id: slug,
          data,
          filePath: MANIFEST_REL,
          // Tout ce qui se rend : le point focal se déplace sans que le
          // fichier change, il doit invalider l'entrée lui aussi ; l'affiche
          // et le synopsis de Prodysos aussi.
          digest: JSON.stringify([s, s.hero?.modified_on, s.poster?.modified_on, show?.poster_url ?? null, show?.synopsis ?? null]),
        };
        // Le manifeste est enregistré même si un téléchargement échoue : sans
        // lui, ce qui a déjà été téléchargé serait à refaire au build suivant.
      }).finally(() => cache.enregistrer());

      // La garde porte sur ce qui sera affiché, pas sur ce que le CMS a
      // rendu : des spectacles tous sans photo, ou seulement celui de
      // Montréal, publieraient eux aussi un accueil vide.
      const gardées = entrées.filter((e) => e !== null);
      if (!gardées.some((e) => e.data.troupe === 'bruxelles')) {
        throw new Error(
          'Aucun spectacle de Bruxelles publié et complet (titre, slug, grande photo) dans le CMS. ' +
            "Le site ne sera pas reconstruit : le déploiement précédent reste en ligne, ce qui vaut mieux qu'un accueil vide."
        );
      }
      store.clear();
      for (const e of gardées) store.set(e);
      logger.info(`${gardées.length} spectacle(s) chargé(s)`);
    },
  };
}

/**
 * La photothèque : galerie, carrousels, fonds de page, dans l'ordre du Studio.
 *
 * SEULES LES PHOTOS AFFICHÉES SONT CHARGÉES : celles de la galerie, des
 * carrousels et des fonds de page. Astro émet dans dist/ l'original de tout
 * champ image() qu'aucune page ne transforme ; une photo rangée dans la
 * photothèque sans servir nulle part partirait donc en ligne en pleine
 * résolution, sans lien pour y mener. On relit pour ça, en deux petites
 * requêtes, les carrousels des spectacles et les fonds des réglages.
 *
 * C'est aussi ici que le cache est purgé, avec les autres fichiers que le
 * site affiche (grandes photos et affiches des spectacles, celles venues de
 * Prodysos comprises, image de partage des réglages), pour ne jeter que ce
 * que plus rien n'utilise.
 * @returns {Loader}
 */
export function photosLoader() {
  return {
    name: 'directus-photos',
    async load({ store, parseData, logger, config }) {
      const cache = await ouvrirCache(config.root);
      const [photos, prodysos] = await Promise.all([
        requestAll(`/items/${PHOTOS}?${PUBLIÉ}&sort=sort,id&fields=id,sort,caption,galerie,spectacle.slug,spectacle.title,${champsFichier('image')}`),
        prodysosDuBuild(logger),
      ]);

      const autres = await requestAll(`/items/${SPECTACLES}?${PUBLIÉ}&fields=hero,poster,slides.${PHOTOS}_id`);
      const réglages = await request(`/items/${REGLAGES}?fields=og_image,${FONDS.join(',')}`);
      const servies = new Set();
      for (const s of autres) for (const l of s.slides ?? []) if (l?.[`${PHOTOS}_id`] != null) servies.add(String(l[`${PHOTOS}_id`]));
      // Les fonds couvrent l'écran : eux seuls ont un recadrage portrait.
      // Astro émet l'original de tout champ image() ; un portrait que rien ne
      // sert partirait en ligne tel quel.
      const fonds = new Set(FONDS.map((f) => réglages?.[f]).filter((id) => id != null).map(String));
      for (const id of fonds) servies.add(id);

      let ignorées = 0;
      // Même règle que les spectacles : téléchargées en parallèle, rangées
      // dans l'ordre du CMS.
      const entrées = await mapLimit(photos, 3, async (p) => {
        if (!p.galerie && !servies.has(String(p.id))) {
          ignorées++;
          return null;
        }
        if (!p.image?.id) {
          logger.warn(`photo ${p.id} sans image : ignorée`);
          return null;
        }
        // La légende retombe sur le titre du spectacle, sinon « Coulisses » :
        // elle est aussi le texte alternatif, et une photo n'en est jamais
        // privée.
        const caption = texte(p.caption) ?? texte(p.spectacle?.title) ?? T.coulisses;
        signalerTirets(logger, `photo ${p.id}`, [caption]);
        const id = String(p.id);
        const image = await assurerFichier(p.image, cache, logger);
        const focal = pointFocal(p.image);
        const data = await parseData({
          id,
          filePath: MANIFEST_REL,
          data: {
            caption,
            galerie: p.galerie === true,
            spectacle: texte(p.spectacle?.slug),
            sort: p.sort ?? 0,
            image,
            portrait: fonds.has(id) ? await assurerPortrait(p.image.id, focal, cache, logger) : null,
            apercu: await assurerAperçu(p.image.id, cache),
            ...(await dimensionsFichier(p.image, cache)),
            focal,
          },
        });
        // Devenir un fond (réglages) donne un portrait : ça compte dans le digest.
        return { id, data, filePath: MANIFEST_REL, digest: JSON.stringify([p, p.image.modified_on, fonds.has(id)]) };
        // Comme pour les spectacles : le manifeste survit à un téléchargement raté.
      }).finally(() => cache.enregistrer());
      store.clear();
      for (const e of entrées) if (e) store.set(e);

      // Ce que le cache doit garder : tout fichier encore affiché. Le reste
      // (photos supprimées, dépubliées ou qui ne servent plus, affiches
      // remplacées) s'en va, sinon le cache ne fait que grossir.
      const garder = new Set(photos.filter((p) => p.galerie || servies.has(String(p.id))).map((p) => p.image?.id).filter(Boolean));
      for (const s of autres) for (const f of [s.hero, s.poster]) if (f) garder.add(String(f));
      if (réglages?.og_image) garder.add(String(réglages.og_image));
      // Toutes les affiches de Prodysos : seules celles qui manquent au CMS
      // sont téléchargées, garder les autres ne coûte rien.
      for (const show of prodysos.shows ?? []) if (texte(show?.poster_url)) garder.add(idAfficheProdysos(show.slug));
      const retirés = await purgerCache(cache, garder);
      if (retirés) logger.info(`cache : ${retirés} fichier(s) retiré(s)`);

      await cache.enregistrer();
      if (ignorées) logger.info(`${ignorées} photo(s) ni en galerie, ni en carrousel, ni en fond : laissée(s) de côté`);
      logger.info(`${photos.length - ignorées} photo(s) chargée(s)`);
    },
  };
}

/**
 * Les personnes, dans l'ordre du Studio (celui de « L'équipe »).
 * @returns {Loader}
 */
export function personnesLoader() {
  return {
    name: 'directus-personnes',
    async load({ store, parseData, logger }) {
      const lignes = await requestAll(`/items/${PERSONNES}?${PUBLIÉ}&sort=sort,name&fields=id,sort,slug,name,groupe,bio`);
      store.clear();
      const slugsVus = new Set();
      for (const p of lignes) {
        const slug = texte(p.slug);
        const name = texte(p.name);
        if (!slug || !name) {
          logger.warn(`personne ${p.id} sans slug ou sans nom : ignorée`);
          continue;
        }
        signalerSlug(logger, `personne « ${name} »`, slug, slugsVus);
        signalerTirets(logger, `personne « ${name} »`, [p.name, p.bio]);
        const groupe = ['equipe', 'invite', 'montreal'].includes(p.groupe) ? p.groupe : 'equipe';
        const data = await parseData({ id: slug, data: { slug, name, groupe, bio: texte(p.bio), sort: p.sort ?? 0 } });
        store.set({ id: slug, data, digest: JSON.stringify(p) });
      }
      logger.info(`${lignes.length} personne(s) chargée(s)`);
    },
  };
}

/**
 * La ligne « Avec » de chaque spectacle : une entrée par interprète.
 * @returns {Loader}
 */
export function distributionLoader() {
  return {
    name: 'directus-distribution',
    async load({ store, parseData, logger }) {
      const lignes = await requestAll(
        `/items/${DISTRIBUTION}?${PUBLIÉ}&sort=sort,id&fields=id,sort,spectacle.slug,personne.slug,personnage`
      );
      store.clear();
      for (const l of lignes) {
        const spectacle = texte(l.spectacle?.slug);
        const personne = texte(l.personne?.slug);
        if (!spectacle || !personne) {
          logger.warn(`distribution ${l.id} : spectacle ou personne dépublié, ligne ignorée`);
          continue;
        }
        signalerTirets(logger, `distribution ${l.id}`, [l.personnage]);
        const id = String(l.id);
        const data = await parseData({
          id,
          data: { spectacle, personne, personnage: texte(l.personnage), sort: l.sort ?? 0 },
        });
        store.set({ id, data, digest: JSON.stringify(l) });
      }
      logger.info(`${lignes.length} ligne(s) de distribution chargée(s)`);
    },
  };
}

/**
 * Les autres lignes du générique : Texte, Mise en scène…
 * @returns {Loader}
 */
export function generiqueLoader() {
  return {
    name: 'directus-generique',
    async load({ store, parseData, logger }) {
      const lignes = await requestAll(
        `/items/${GENERIQUE}?${PUBLIÉ}&sort=sort,id&fields=id,sort,spectacle.slug,role,note,text,personnes.${PERSONNES}_id.slug` +
          `&deep[personnes][_sort]=sort`
      );
      store.clear();
      for (const l of lignes) {
        const spectacle = texte(l.spectacle?.slug);
        const role = texte(l.role);
        if (!spectacle || !role) {
          logger.warn(`générique ${l.id} : spectacle dépublié ou rôle vide, ligne ignorée`);
          continue;
        }
        signalerTirets(logger, `générique « ${role} »`, [l.role, l.note, l.text]);
        // Une personne dépubliée revient sans slug : elle sort de la ligne,
        // les autres restent.
        const personnes = (l.personnes ?? []).map((/** @type {any} */ j) => texte(j?.[`${PERSONNES}_id`]?.slug)).filter(Boolean);
        // La note garde son espace final éventuel : « sous la direction d’ »
        // se colle au nom qui suit (lib/generique.js).
        const note = typeof l.note === 'string' && l.note.trim() ? l.note : null;
        const id = String(l.id);
        const data = await parseData({
          id,
          data: { spectacle, role, note, text: texte(l.text), personnes, sort: l.sort ?? 0 },
        });
        store.set({ id, data, digest: JSON.stringify(l) });
      }
      logger.info(`${lignes.length} ligne(s) de générique chargée(s)`);
    },
  };
}

/**
 * Les représentations : celles du CMS, puis celles de Prodysos (lib/prodysos.js)
 * pour les spectacles qui y sont reliés. Une date saisie dans le CMS l'emporte
 * sur la même date venue de Prodysos. Le prix manquant d'une ligne est celui de
 * son spectacle. Une date de Prodysos est réservable (`reservation`) ; une
 * date du CMS l'est si elle remplace une date de Prodysos.
 * @returns {Loader}
 */
export function representationsLoader() {
  return {
    name: 'directus-representations',
    async load({ store, parseData, logger }) {
      const [lignes, prodysos] = await Promise.all([
        requestAll(`/items/${REPRESENTATIONS}?${PUBLIÉ}&sort=day,time,id&fields=id,spectacle.slug,day,time,venue,city,price`),
        prodysosDuBuild(logger),
      ]);
      const prixDe = new Map(prodysos.spectaclesCms.map((s) => [s.slug, texte(s.price)]));

      /** @type {Représentation[]} */
      const duCms = [];
      for (const r of lignes) {
        const spectacle = texte(r.spectacle?.slug);
        const day = typeof r.day === 'string' ? r.day.slice(0, 10) : null;
        if (!spectacle || !day) {
          logger.warn(`représentation ${r.id} : spectacle dépublié ou jour vide, ligne ignorée`);
          continue;
        }
        signalerTirets(logger, `représentation ${r.id}`, [r.venue, r.city, r.price]);
        duCms.push({
          id: String(r.id),
          spectacle,
          day,
          // Directus rend « 20:00:00 » : on garde les heures et minutes.
          time: typeof r.time === 'string' && r.time ? r.time.slice(0, 5) : null,
          venue: texte(r.venue),
          city: texte(r.city),
          // Le CMS n'a que la salle et la ville ; la rue vient de Prodysos.
          street: null,
          postalCode: null,
          price: texte(r.price) ?? prixDe.get(spectacle) ?? null,
          reservation: null,
        });
      }

      /** @type {Représentation[]} */
      let deProdysos = [];
      if (prodysos.shows) {
        deProdysos = lignesProdysos(prodysos.shows, prodysos.liens, (m) => logger.warn(m));
        signalerTirets(logger, 'Prodysos', deProdysos.flatMap((l) => [l.venue, l.city]));
      } else {
        logger.warn('Prodysos non configuré (PRODYSOS_URL, PRODYSOS_KEY, PRODYSOS_COMPANY) : dates du CMS seules');
      }

      const { lignes: toutes, écartées } = fusionner(duCms, deProdysos);
      store.clear();
      for (const { id, ...champs } of toutes) {
        const data = await parseData({ id, data: champs });
        store.set({ id, data, digest: JSON.stringify(champs) });
      }
      logger.info(
        `${duCms.length} représentation(s) du CMS, ${deProdysos.length - écartées} de Prodysos` +
          (écartées ? ` (${écartées} déjà saisie(s) dans le CMS)` : '')
      );
    },
  };
}

/**
 * La page Montréal : un singleton, une seule entrée « site ». Jamais
 * enregistré, il rend une ligne vide, et la page n'affiche que ce qui existe.
 * @returns {Loader}
 */
export function montrealLoader() {
  return {
    name: 'directus-montreal',
    async load({ store, parseData, logger }) {
      const m = (await request(`/items/${MONTREAL}?fields=sub,lead,text`)) ?? {};
      signalerTirets(logger, 'page Montréal', [m.sub, m.lead, m.text]);
      store.clear();
      const data = await parseData({ id: 'site', data: { sub: texte(m.sub), lead: texte(m.lead), text: texte(m.text) } });
      store.set({ id: 'site', data, digest: JSON.stringify(m) });
    },
  };
}

/**
 * Les réglages du site : un singleton, une seule entrée « site ».
 *
 * Les fonds de page sont des ids de photos de la photothèque : la page les
 * retrouve parmi les photos publiées, et une photo dépubliée laisse la page
 * sans fond plutôt que de casser le build.
 *
 * Un singleton jamais enregistré rend une ligne vide. Sans titre, le site
 * n'a pas de nom : c'est le signe que personne n'a ouvert « Réglages » dans
 * le Studio, et le message le dit plutôt que de publier un site sans titre.
 * @returns {Loader}
 */
export function reglagesLoader() {
  return {
    name: 'directus-reglages',
    async load({ store, parseData, logger, config }) {
      const cache = await ouvrirCache(config.root);
      const s = await request(
        `/items/${REGLAGES}?fields=site_title,site_description,email,instagram,facebook,compagnie_sub,compagnie_punch,compagnie_text,` +
          `fond_accueil,fond_spectacles,fond_agenda,fond_compagnie,fond_contact,legal_denomination,legal_adresse,legal_bce,legal_responsable,legal_conservation,head_verification,${champsFichier('og_image')}`
      );

      if (!texte(s?.site_title)) {
        throw new Error(
          'Les réglages du site sont vides dans le CMS : ouvrir « Réglages » dans le Studio, ' +
            'renseigner au moins le titre du site, et enregistrer.'
        );
      }
      signalerTirets(logger, 'réglages', [s.site_title, s.site_description, s.compagnie_sub, s.compagnie_punch, s.compagnie_text, s.legal_denomination, s.legal_adresse, s.legal_responsable, s.legal_conservation]);

      const og_image = s.og_image?.id ? await assurerFichier(s.og_image, cache, logger) : null;
      await cache.enregistrer();

      /** @param {any} v */
      const fond = (v) => (v == null ? null : String(typeof v === 'object' ? v.id : v));
      store.clear();
      const data = await parseData({
        id: 'site',
        filePath: MANIFEST_REL,
        data: {
          site_title: texte(s.site_title),
          site_description: texte(s.site_description),
          email: texte(s.email),
          instagram: texte(s.instagram),
          facebook: texte(s.facebook),
          compagnie_sub: texte(s.compagnie_sub),
          compagnie_punch: texte(s.compagnie_punch),
          compagnie_text: texte(s.compagnie_text),
          fonds: {
            accueil: fond(s.fond_accueil),
            spectacles: fond(s.fond_spectacles),
            agenda: fond(s.fond_agenda),
            compagnie: fond(s.fond_compagnie),
            contact: fond(s.fond_contact),
          },
          legal_denomination: texte(s.legal_denomination),
          legal_adresse: texte(s.legal_adresse),
          legal_bce: texte(s.legal_bce),
          legal_responsable: texte(s.legal_responsable),
          legal_conservation: texte(s.legal_conservation),
          head_verification: texte(s.head_verification),
          og_image,
        },
      });
      store.set({ id: 'site', data, filePath: MANIFEST_REL, digest: JSON.stringify(s) });
      logger.info('réglages chargés');
    },
  };
}
