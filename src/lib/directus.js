// Lecture du CMS au build. Le site n'a pas d'autre source.
//
// Le jeton est celui de la policy de lecture du build de la compagnie (« lecture build », préfixe cliff) : lecture seule,
// filtrée sur `status = published` par Directus lui-même, et limitée aux
// fichiers du dossier de la compagnie. Un spectacle en brouillon reste donc
// invisible ici, même si une requête l'oubliait.
//
// AUCUN REPLI LOCAL, volontairement. Un site qui se construit sans ses sources
// publierait un contenu figé sans rien dire. Quand le build échoue, le
// déploiement précédent reste en ligne : le visiteur voit l'agenda d'hier,
// ce qui est vrai, plutôt qu'une page vide.
//
// LES IMAGES SONT TÉLÉCHARGÉES ICI, EN ORIGINAL. L'instance Directus est
// mutualisée, sur un hébergement d'un peu moins d'un Go, et ses
// transformations d'image sont limitées : lui demander cinq tailles de chaque
// photo à chaque build, c'est la mettre à genoux pour un travail que le runner
// du build fait mieux et sans conséquence pour les autres clients. On rapatrie
// donc l'original, une fois, et Astro fabrique les tailles. `/assets/<id>`
// sans paramètre ne passe pas par sharp côté serveur.

import { DIRECTUS_URL, DIRECTUS_TOKEN } from 'astro:env/server';
import { access, mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

/**
 * Le dossier du cache, RELATIF à la racine du projet et en séparateurs posix :
 * c'est ce que le Content Layer exige d'un `filePath`, et c'est depuis ce
 * dossier qu'il résout `./<id>.webp` pour confier l'image à astro:assets.
 */
export const CACHE_REL = '.cache/directus-assets';

/**
 * Le « fichier » que chaque entrée qui porte une image déclare. Il n'est pas
 * lu comme contenu : il sert de point d'ancrage pour résoudre le chemin des
 * images, qui vivent à côté de lui.
 */
export const MANIFEST_REL = `${CACHE_REL}/manifest.json`;

/**
 * Les champs de `directus_files` que la policy du build autorise, moins ceux
 * dont le site n'a pas l'usage (platform-cms, scripts/lib/permissions.mjs).
 * En demander un qui n'y est pas fait échouer la requête.
 */
export const CHAMPS_FICHIER = ['id', 'filename_download', 'type', 'width', 'height', 'modified_on', 'title', 'focal_point_x', 'focal_point_y'];

/**
 * `hero.id,hero.type,…` : les mêmes champs, préfixés pour une relation.
 * @param {string} relation
 */
export const champsFichier = (relation) => CHAMPS_FICHIER.map((c) => `${relation}.${c}`).join(',');

// Le limiteur de l'instance : vingt-cinq requêtes par seconde, tous clients
// confondus. Un 429 n'est pas une panne, c'est un « pas maintenant » : on
// attend ce que le serveur demande, et on rejoue. Cinq fois, puis on renonce
// bruyamment plutôt que de boucler en silence.
/**
 * @param {string} url
 * @param {number} [tentative]
 * @returns {Promise<Response>}
 */
async function appeler(url, tentative = 0) {
  let res;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
  } catch (e) {
    throw new Error(`CMS injoignable (${url.replace(DIRECTUS_URL, '')}) : ${e instanceof Error ? e.message : String(e)}`);
  }

  if (res.status === 429 && tentative < 5) {
    const secondes = Number(res.headers.get('retry-after')) || 1;
    await new Promise((r) => setTimeout(r, secondes * 1000 + 50));
    return appeler(url, tentative + 1);
  }

  if (!res.ok) {
    const détail = await res.text().catch(() => '');
    throw new Error(`CMS ${url.replace(DIRECTUS_URL, '')} : HTTP ${res.status} ${détail}`.trim());
  }

  return res;
}

/**
 * Une requête, son `data`.
 * @param {string} chemin
 * @returns {Promise<any>}
 */
export async function request(chemin) {
  const json = await (await appeler(`${DIRECTUS_URL}${chemin}`)).json();
  return json?.data ?? null;
}

// Combien d'éléments par requête. `limit=-1` demanderait tout en une fois ;
// l'instance le plafonne de toute façon à mille.
const PAR_PAGE = 1000;

/**
 * Lit une collection entière, page par page. La boucle s'arrête sur une page
 * incomplète, la seule condition qui ne suppose rien du total.
 *
 * @param {string} chemin  l'adresse SANS « limit » ni « page », avec au moins un paramètre
 * @returns {Promise<any[]>}
 */
export async function requestAll(chemin) {
  const tout = [];
  for (let page = 1; ; page++) {
    const lot = await request(`${chemin}&limit=${PAR_PAGE}&page=${page}`);
    if (!lot?.length) break;
    tout.push(...lot);
    if (lot.length < PAR_PAGE) break;
    if (page > 100) throw new Error(`CMS ${chemin} : plus de cent pages, la pagination ne termine pas.`);
  }
  return tout;
}

// --- Le cache des originaux --------------------------------------------------

/** @param {string} chemin */
const existe = (chemin) => access(chemin).then(() => true, () => false);

/** @typedef {{ modified_on: string, fichier: string, aperçu?: string, portrait?: { focal: string, fichier: string } }} Entrée */
/** @typedef {{ dossier: string, manifest: Record<string, Entrée>, enregistrer(): Promise<void> }} Cache */

/** Un seul cache par dossier, partagé entre les loaders (voir `ouvrirCache`). */
const caches = new Map();

/**
 * Ouvre le cache : le dossier, créé s'il manque, et son manifeste.
 *
 * Le manifeste dit, pour chaque fichier Directus, la date de modification
 * connue et le nom sous lequel l'original est rangé. C'est lui qui évite de
 * retélécharger chaque photo à chaque build : seul un fichier absent, ou
 * modifié dans le Studio depuis, est redemandé.
 *
 * UN SEUL OBJET PAR DOSSIER, quel que soit le nombre d'appels : Astro lance
 * les loaders en parallèle, et trois d'entre eux (spectacles, photos,
 * réglages) écrivent dans le même manifeste. Chacun avec sa copie, le dernier
 * à enregistrer effacerait ce que les autres ont ajouté, et la purge prendrait
 * ces entrées perdues pour des fichiers à jeter.
 *
 * @param {URL} racine  `config.root` du projet
 * @returns {Promise<Cache>}
 */
export function ouvrirCache(racine) {
  const dossier = path.join(fileURLToPath(racine), CACHE_REL);
  let cache = caches.get(dossier);
  if (!cache) {
    cache = (async () => {
      await mkdir(dossier, { recursive: true });
      let manifest = {};
      try {
        manifest = JSON.parse(await readFile(path.join(dossier, 'manifest.json'), 'utf8'));
      } catch {
        // Pas de manifeste : premier build, ou cache effacé. Tout sera téléchargé.
      }
      // Les écritures du manifeste passent l'une après l'autre, et chacune
      // par un fichier temporaire renommé : trois loaders enregistrent en
      // parallèle, et deux writeFile qui se chevauchent pouvaient laisser un
      // JSON tronqué. Le build suivant l'aurait pris pour un cache vide (la
      // lecture ci-dessus avale l'erreur), retéléchargé tout, et le cache du
      // CI aurait gardé le fichier cassé.
      let file = Promise.resolve();
      const écrire = async () => {
        const cible = path.join(dossier, 'manifest.json');
        await writeFile(`${cible}.part`, JSON.stringify(manifest, null, 2));
        await rename(`${cible}.part`, cible);
      };
      return {
        dossier,
        manifest,
        enregistrer() {
          file = file.then(écrire, écrire);
          return file;
        },
      };
    })();
    caches.set(dossier, cache);
  }
  return cache;
}

/**
 * Retire du cache ce que le site n'utilise plus : l'original d'une photo
 * supprimée ou dépubliée, une affiche remplacée, un `.part` laissé par un
 * build interrompu. Sans purge, le cache (et celui du CI, envoyé et rendu à
 * chaque run) ne fait que grossir.
 *
 * Un fichier appartient à un identifiant par son nom (`<id>.<ext>`) : c'est le
 * seul lien entre le dossier et le CMS, et les identifiants sont des UUID,
 * sans risque qu'un en préfixe un autre. Un `.part` d'un fichier gardé est
 * laissé : c'est peut-être un autre loader qui est en train de l'écrire.
 *
 * @param {Cache} cache
 * @param {Set<string>} garder  les ids des fichiers que le site affiche
 * @returns {Promise<number>}  le nombre de fichiers retirés
 */
export async function purgerCache(cache, garder) {
  let retirés = 0;
  for (const nom of await readdir(cache.dossier)) {
    if (nom.startsWith('manifest.json')) continue;
    const id = /^([^.]+)\./.exec(nom)?.[1] ?? '';
    if (garder.has(id)) continue;
    await unlink(path.join(cache.dossier, nom));
    retirés++;
  }
  for (const id of Object.keys(cache.manifest)) {
    if (!garder.has(id)) delete cache.manifest[id];
  }
  return retirés;
}

/**
 * S'assure que l'original d'un fichier Directus est dans le cache, et rend le
 * chemin RELATIF AU MANIFESTE (`./<id>.webp`) que le schéma `image()` attend.
 *
 * @param {{id:string, filename_download?:string, type?:string, modified_on?:string}} fichier
 * @param {Cache} cache
 * @param {{ info(msg:string):void }} logger
 */
export async function assurerFichier(fichier, cache, logger) {
  const ext = (
    path.extname(fichier.filename_download ?? '').slice(1) ||
    fichier.type?.split('/')[1] ||
    'jpg'
  ).toLowerCase();
  const nom = `${fichier.id}.${ext}`;
  await ranger(cache, fichier.id, nom, fichier.modified_on ?? '', logger, fichier.filename_download ?? fichier.id, () =>
    appeler(`${DIRECTUS_URL}/assets/${fichier.id}`)
  );
  return `./${nom}`;
}

/**
 * Les dimensions d'un fichier : celles du CMS, sinon lues sur l'original du
 * cache (déjà là : appeler après `assurerFichier`). Directus ne les calcule
 * pas toujours (la photo de fond de l'accueil, 8256 px, n'en avait pas) :
 * sans elles, `sizes` ne sait pas que la photo couvre l'écran, et un recadrage
 * ne peut pas être calculé.
 *
 * @param {{id:string, width?:number|null, height?:number|null}} fichier
 * @param {Cache} cache
 * @returns {Promise<{ width: number|null, height: number|null }>}
 */
export async function dimensionsFichier(fichier, cache) {
  if (fichier.width && fichier.height) return { width: fichier.width, height: fichier.height };
  const entrée = cache.manifest[fichier.id];
  if (!entrée) return { width: null, height: null };
  // Depuis un tampon, comme plus bas : Windows et les fichiers restés ouverts.
  const méta = await sharp(await readFile(path.join(cache.dossier, entrée.fichier))).metadata();
  const { width = null, height = null } = méta.autoOrient ?? méta;
  return { width, height };
}

/**
 * Le même cache pour une image qui ne vient pas de Directus : l'affiche de
 * la page publique Prodysos d'un spectacle (lib/prodysos.js). L'URL tient
 * lieu de date de modification : Prodysos la change (`?v=`) quand l'affiche
 * change. Rend le chemin et les dimensions, lues sur le fichier : Prodysos ne
 * les donne pas, et une ImageMetadata ne doit jamais être lue pour ça.
 *
 * @param {string} url
 * @param {string} id  sans point (voir purgerCache)
 * @param {Cache} cache
 * @param {{ info(msg:string):void }} logger
 * @returns {Promise<{ chemin: string, width: number|null, height: number|null }>}
 */
export async function assurerFichierExterne(url, id, cache, logger) {
  const ext = (path.extname(new URL(url).pathname).slice(1) || 'jpg').toLowerCase();
  const nom = `${id}.${ext}`;
  await ranger(cache, id, nom, url, logger, url, async () => {
    let res;
    try {
      res = await fetch(url);
    } catch (e) {
      throw new Error(`Image injoignable (${url}) : ${e instanceof Error ? e.message : String(e)}`);
    }
    if (!res.ok) throw new Error(`Image ${url} : HTTP ${res.status}`);
    return res;
  });
  // Lu depuis un tampon : sharp, sur un chemin, garde le fichier ouvert, et
  // Windows refuse alors de le purger ou de le remplacer.
  const { width = null, height = null } = await sharp(await readFile(path.join(cache.dossier, nom))).metadata();
  return { chemin: `./${nom}`, width, height };
}

/**
 * Range un original dans le cache, sauf s'il y est déjà dans sa version.
 *
 * L'écriture passe par un `.part` renommé à la fin : un build interrompu ne
 * laisse jamais un fichier à moitié écrit que le suivant croirait complet.
 *
 * @param {Cache} cache
 * @param {string} id  la clé du manifeste, et le début du nom
 * @param {string} nom  `<id>.<ext>`
 * @param {string} version  ce qui change quand le fichier change
 * @param {{ info(msg:string):void }} logger
 * @param {string} libellé  pour le log
 * @param {() => Promise<Response>} charger
 */
async function ranger(cache, id, nom, version, logger, libellé, charger) {
  const cible = path.join(cache.dossier, nom);
  const connu = cache.manifest[id];
  if (connu?.modified_on === version && connu.fichier === nom && (await existe(cible))) return;

  // Un même fichier sert à plusieurs loaders (la photo du groupe est dans la
  // galerie ET l'image de partage des réglages) : lancés en parallèle, ils le
  // téléchargeaient deux fois dans le même `.part`, et le second renommage
  // échouait sur un fichier déjà déplacé. Le premier télécharge, les autres
  // attendent sa promesse.
  const clé = `${id}|${version}`;
  let promesse = enCours.get(clé);
  if (!promesse) {
    promesse = (async () => {
      logger.info(`téléchargement de ${libellé}`);
      const res = await charger();
      const tmp = `${cible}.part`;
      await writeFile(tmp, Buffer.from(await res.arrayBuffer()));
      await rename(tmp, cible);
      cache.manifest[id] = { modified_on: version, fichier: nom };
    })().finally(() => enCours.delete(clé));
    enCours.set(clé, promesse);
  }
  await promesse;
}

/** Les téléchargements en cours, partagés entre loaders (voir `ranger`). */
const enCours = new Map();

// L'aperçu : trente-deux pixels de large. Assez pour la lumière et la
// composition, assez peu pour tenir en quelques centaines d'octets une fois
// en base64 dans la page. Le flou est cuit dedans : agrandi cent fois par le
// navigateur, un aperçu net montrerait ses blocs.
const APERÇU_LARGEUR = 32;

/**
 * L'aperçu flou d'un fichier du cache, en `data:` URI, posé sous la photo le
 * temps qu'elle arrive : le visiteur voit la photo se préciser, jamais un
 * rectangle noir. C'est aussi ce qui tient le fondu de page « photo sur
 * photo » quand la photo de la page suivante n'est pas encore en cache.
 *
 * Gardé dans le manifeste, à côté du nom du fichier : le fabriquer demande de
 * décoder l'original, et il ne change qu'avec lui. `ranger` remplace l'entrée
 * entière quand le fichier est retéléchargé, ce qui jette l'aperçu avec.
 * Même fonction que le portfolio.
 *
 * @param {string} id  la clé du manifeste
 * @param {Cache} cache
 */
export async function assurerAperçu(id, cache) {
  const entrée = cache.manifest[id];
  if (!entrée) throw new Error(`aperçu demandé pour ${id} avant son téléchargement`);
  if (!entrée.aperçu) {
    // Lu depuis un tampon : sur un chemin, sharp garde le fichier ouvert, et
    // Windows refuse alors de le purger ou de le remplacer.
    const buf = await sharp(await readFile(path.join(cache.dossier, entrée.fichier)))
      .rotate()
      .resize(APERÇU_LARGEUR, APERÇU_LARGEUR, { fit: 'inside' })
      .blur(0.8)
      .webp({ quality: 45 })
      .toBuffer();
    entrée.aperçu = `data:image/webp;base64,${buf.toString('base64')}`;
  }
  return entrée.aperçu;
}

// Le recadrage portrait : 9:16, un téléphone tenu droit. Plus étroit (9:19,5
// sur les récents), le navigateur rogne encore un peu les côtés avec
// `object-fit: cover` ; plus large (une tablette), un peu le haut et le bas.
export const PORTRAIT = 9 / 16;

/**
 * Le cadre 9:16 d'une image de W × H autour de son point focal. Même règle
 * que `object-position` : la fenêtre visible commence à `(W − cw) · x`. Le
 * sujet, à `x · W`, tombe alors à `x · cw` dans le recadrage : les
 * pourcentages du point focal sont conservés, et le même `object-position`
 * sert à l'image paysage et à la portrait. Sans point focal, le centre.
 *
 * @param {number} W
 * @param {number} H
 * @param {{x:number, y:number}|null} focal  en % (voir `pointFocal`)
 * @returns {{ left: number, top: number, width: number, height: number }}
 */
export function cadrePortrait(W, H, focal) {
  const x = (focal?.x ?? 50) / 100;
  const y = (focal?.y ?? 50) / 100;
  const width = W / H > PORTRAIT ? Math.round(H * PORTRAIT) : W;
  const height = W / H > PORTRAIT ? H : Math.round(W / PORTRAIT);
  return { left: Math.round((W - width) * x), top: Math.round((H - height) * y), width, height };
}

/**
 * Le recadrage portrait d'un fichier du cache, à servir en
 * `<source media="(orientation: portrait)">` aux photos plein écran. Un
 * téléphone tenu droit couvre son écran avec une photo paysage en n'en
 * montrant qu'un quart : télécharger l'image entière pour ce quart, c'est
 * soit un poids inutile, soit, plus petite, une image agrandie trois fois et
 * floue. Repris du portfolio (c8c7a7e).
 *
 * Pas de redimensionnement ici, Astro fabrique les tailles ; la qualité est
 * haute pour ne pas cumuler deux compressions visibles. Le résultat dépend du
 * fichier ET du point focal : le manifeste retient le point qui l'a produit.
 * Nommé `<id>.portrait.webp` : la purge rattache un fichier à son id par ce
 * qui précède le premier point.
 *
 * @param {string} id  la clé du manifeste
 * @param {{x:number, y:number}|null} focal
 * @param {Cache} cache
 * @param {{ info(msg:string):void }} logger
 * @returns {Promise<string>}  le chemin relatif au manifeste, comme `assurerFichier`
 */
export async function assurerPortrait(id, focal, cache, logger) {
  const entrée = cache.manifest[id];
  if (!entrée) throw new Error(`portrait demandé pour ${id} avant son téléchargement`);
  const clé = focal ? `${focal.x},${focal.y}` : 'centre';
  const nom = `${id}.portrait.webp`;
  const cible = path.join(cache.dossier, nom);
  if (entrée.portrait?.focal === clé && entrée.portrait.fichier === nom && (await existe(cible))) return `./${nom}`;

  // Deux loaders peuvent demander le même portrait (une photo de fond qui est
  // aussi dans la galerie) : le premier le fabrique, les autres l'attendent.
  const tâche = `${id}|portrait|${clé}`;
  let promesse = enCours.get(tâche);
  if (!promesse) {
    promesse = (async () => {
      logger.info(`recadrage portrait de ${entrée.fichier}`);
      // `rotate()` sans argument applique l'orientation EXIF avant le
      // recadrage ; les dimensions lues sont celles de l'image redressée.
      const original = sharp(await readFile(path.join(cache.dossier, entrée.fichier))).rotate();
      const méta = await original.metadata();
      const { width: W, height: H } = méta.autoOrient ?? méta;
      const tmp = `${cible}.part`;
      await original.extract(cadrePortrait(W, H, focal)).webp({ quality: 92 }).toFile(tmp);
      await rename(tmp, cible);
      entrée.portrait = { focal: clé, fichier: nom };
    })().finally(() => enCours.delete(tâche));
    enCours.set(tâche, promesse);
  }
  await promesse;
  return `./${nom}`;
}

/**
 * Le point focal d'un fichier, tel que le Studio le pose (en pixels, dans
 * l'éditeur d'image), ramené en pourcentages : c'est ce que `object-position`
 * attend, et ça ne dépend pas de la taille que le site fabrique. Sans point
 * focal, null : la page cadre au centre.
 *
 * @param {{focal_point_x?: number|null, focal_point_y?: number|null, width?: number|null, height?: number|null}|null|undefined} f
 * @returns {{x: number, y: number}|null}
 */
export function pointFocal(f) {
  if (f?.focal_point_x == null || f?.focal_point_y == null || !f.width || !f.height) return null;
  /** @param {number} v */
  const borne = (v) => Math.min(100, Math.max(0, Math.round(v * 10) / 10));
  return { x: borne((f.focal_point_x / f.width) * 100), y: borne((f.focal_point_y / f.height) * 100) };
}

/**
 * `fn` sur chaque élément, au plus `n` à la fois. Trois téléchargements en
 * parallèle suffisent : au-delà, c'est le limiteur de l'instance qu'on
 * rencontre, pas un gain.
 *
 * @template T, R
 * @param {T[]} items
 * @param {number} n
 * @param {(item: T, i: number) => Promise<R>} fn
 * @returns {Promise<R[]>}
 */
export async function mapLimit(items, n, fn) {
  const résultats = new Array(items.length);
  let suivant = 0;
  const ouvriers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (suivant < items.length) {
      const i = suivant++;
      résultats[i] = await fn(items[i], i);
    }
  });
  await Promise.all(ouvriers);
  return résultats;
}
