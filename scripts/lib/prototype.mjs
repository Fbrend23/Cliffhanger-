// Le contenu du prototype (migration/content.js), traduit dans le modèle du
// CMS (platform-cms, clients/cliffhanger.json).
//
// Deux lecteurs : la migration (scripts/migrer.mjs), qui l'écrit dans
// Directus, et le faux Directus des tests (test/faux-directus/), qui le sert
// avec la forme de l'API pour construire le site sans jeton. Une seule
// traduction pour les deux : ce que les tests construisent est exactement ce
// que la migration écrira.
//
// Rien ici ne parle au réseau. `lirePrototype` lit le fichier, le reste est pur.

import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
// Le même échappement que le site : typo.js est pur, sans rien d'Astro.
import { échapper } from '../../src/lib/typo.js';

/**
 * Les constantes de content.js. Le fichier est un script de navigateur, sans
 * `export` : on l'exécute dans un bac à sable et on lui demande ses
 * constantes, plutôt que de le modifier. Il reste tel que le prototype
 * l'avait, jusqu'à son retrait.
 *
 * @param {string|URL} fichier
 */
export async function lirePrototype(fichier) {
  const source = await readFile(fichier, 'utf8');
  return vm.runInNewContext(`${source}\n;({ CONTACT, PEOPLE, SHOWS, MONTREAL, GALLERY, BACKDROPS })`, {});
}

// Ce que le prototype écrivait en dur dans app.js (page La compagnie) et
// dans index.html (titre, description) : dans le CMS, ce sont des réglages.
// Recopiés tels quels, l'italique et le lien vers Montréal compris.
export const RÉGLAGES_EN_DUR = {
  site_title: 'Compagnie Cliffhanger',
  site_description: 'Compagnie de théâtre bruxelloise.',
  compagnie_sub: 'Bruxelles, depuis 2018',
  compagnie_punch: "Des spectacles inédits et originaux, et 1001 sensations. Car la Compagnie Cliffhanger, c'est une histoire sans fin.",
  compagnie_text:
    "<p>Créée en 2018 dans les locaux de l'ULB par des passionnés de littérature, de théâtre et d'improvisation, la Compagnie Cliffhanger s'est d'abord fait remarquer avec une adaptation audacieuse des <em>Femmes savantes</em> de Molière, réinventée à la manière d'une sitcom des années 1980.</p>" +
    "<p>Après la crise du COVID, la troupe a retrouvé le chemin des planches avec <em>Par Endroits</em>, une création originale, puis avec <em>L'Inédit de Molière</em>. Parallèlement, la compagnie s'est développée outre-Atlantique grâce à l'un de ses membres fondateurs, donnant naissance à un <a href=\"/montreal/\">collectif-sœur à Montréal</a>, dont les liens perdurent aujourd'hui.</p>",
};

// Le cadrage du portrait de La compagnie, écrit en dur dans app.js
// (`object-position: 50% 30%`) : il devient le point focal de son fichier.
const FOCUS_EN_DUR = { 'noir-blanc': '50% 30%' };


/** Des paragraphes du prototype (`text: [...]`) au HTML du champ riche. */
export const enParagraphes = (lignes) => (lignes?.length ? lignes.map((p) => `<p>${échapper(p)}</p>`).join('') : null);

/** « 50% 22% » → { x: 50, y: 22 } (en %). */
export function lireFocus(focus) {
  const m = /^\s*([\d.]+)%\s+([\d.]+)%\s*$/.exec(focus ?? '');
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
}

/** Le point focal en pixels, comme le Studio le pose sur un fichier. */
export const focalEnPixels = (focus, largeur, hauteur) =>
  focus ? { focal_point_x: Math.round((focus.x / 100) * largeur), focal_point_y: Math.round((focus.y / 100) * hauteur) } : { focal_point_x: null, focal_point_y: null };

/** La clé naturelle d'une photo : une ligne par couple (fichier, légende). */
export const cléPhoto = (fichier, caption) => `${fichier}|${caption}`;

/**
 * Le prototype dans le modèle du CMS : des lignes par collection, chacune
 * avec sa clé naturelle, liées entre elles par ces clés (slug, nom de
 * fichier, clé de photo). Les identifiants Directus n'existent pas encore :
 * c'est l'écrivain (migration ou faux Directus) qui les donne.
 *
 * Aucun tiret long ni demi-cadratin ne doit entrer dans le CMS : la
 * traduction s'arrête s'il en trouve un.
 */
export function modèleDuPrototype({ CONTACT, PEOPLE, SHOWS, MONTREAL, GALLERY, BACKDROPS }) {
  // --- Fichiers : chaque image, une fois, avec son cadrage s'il en a un.
  /** @type {Map<string, { nom: string, focus: {x:number,y:number}|null }>} */
  const fichiers = new Map();
  const fichier = (nom, focus = null) => {
    if (!nom) return null;
    const connu = fichiers.get(nom);
    const f = lireFocus(focus ?? FOCUS_EN_DUR[nom]);
    if (!connu) fichiers.set(nom, { nom, focus: f });
    else if (f && !connu.focus) connu.focus = f;
    return nom;
  };

  // --- Personnes, dans l'ordre du prototype (celui de « L'équipe »).
  const personnes = Object.entries(PEOPLE).map(([slug, p]) => ({
    slug,
    name: p.name,
    groupe: p.guest ? 'invite' : p.montreal ? 'montreal' : 'equipe',
    bio: enParagraphes(p.bio),
  }));

  // --- Photos : la galerie d'abord (son ordre est celui du Studio), puis les
  // photos des carrousels, puis les fonds qui ne seraient ni l'un ni l'autre.
  /** @type {Map<string, { clé: string, fichier: string, caption: string, spectacle: string|null, galerie: boolean }>} */
  const photos = new Map();
  const photo = (nom, caption, spectacle, galerie) => {
    const clé = cléPhoto(nom, caption);
    const connue = photos.get(clé);
    if (connue) {
      connue.galerie ||= galerie;
      return clé;
    }
    photos.set(clé, { clé, fichier: fichier(nom), caption, spectacle, galerie });
    return clé;
  };
  for (const [nom, légende, show] of GALLERY) photo(nom, légende, show === 'coulisses' ? null : show, true);

  // --- Spectacles, génériques, représentations.
  const spectacles = [];
  const generique = [];
  const representations = [];
  for (const s of SHOWS) {
    spectacles.push({
      slug: s.slug,
      title: s.title,
      year: s.year ?? null,
      troupe: s.troupe,
      punch: s.punch ?? null,
      cite: s.cite ?? null,
      text: enParagraphes(s.text),
      credit: s.credit ?? null,
      duration: s.duration ?? null,
      hero: fichier(s.hero, s.focus),
      poster: fichier(s.poster),
      slides: (s.slides ?? []).map(([nom, légende]) => photo(nom, légende, s.slug, false)),
    });
    for (const c of s.credits ?? []) {
      // Une personne est un slug, ou [slug, personnage] pour les interprètes.
      generique.push({
        spectacle: s.slug,
        role: c.role,
        note: c.note ?? null,
        personnes: (c.people ?? []).map((p) => {
          const [slug, personnage] = Array.isArray(p) ? p : [p, null];
          return { slug, personnage };
        }),
        text: c.text ?? null,
      });
    }
    for (const d of s.dates ?? []) {
      representations.push({
        spectacle: s.slug,
        day: d.day,
        time: d.time ? `${d.time}:00` : null,
        venue: d.venue ?? null,
        city: d.city ?? null,
        price: d.price ?? null,
      });
    }
  }

  // --- Les fonds : la photo de la photothèque qui montre ce fichier, la
  // première venue (celle de la galerie, s'il y en a une).
  const photoDuFichier = (nom) => {
    for (const p of photos.values()) if (p.fichier === nom) return p.clé;
    return photo(nom, null, null, false);
  };
  const reglages = {
    ...RÉGLAGES_EN_DUR,
    email: CONTACT.email ?? null,
    instagram: CONTACT.instagram ?? null,
    facebook: CONTACT.facebook ?? null,
    fond_accueil: photoDuFichier(BACKDROPS.home),
    fond_spectacles: photoDuFichier(BACKDROPS.spectacles),
    fond_agenda: photoDuFichier(BACKDROPS.agenda),
    fond_compagnie: photoDuFichier(BACKDROPS.compagnie),
    fond_contact: photoDuFichier(BACKDROPS.contact),
    // L'image des partages du prototype était le groupe : le fond d'accueil.
    og_image: fichier(BACKDROPS.home),
    head_verification: null,
  };

  const montreal = { sub: MONTREAL.sub ?? null, lead: MONTREAL.lead ?? null, text: enParagraphes(MONTREAL.text) };

  const modèle = {
    fichiers: [...fichiers.values()],
    personnes,
    spectacles,
    photos: [...photos.values()],
    generique,
    representations,
    montreal,
    reglages,
  };

  const tiret = JSON.stringify(modèle).match(/.{0,40}[—–].{0,20}/);
  if (tiret) throw new Error(`Tiret long ou demi-cadratin dans le prototype : « ${tiret[0]} ». À corriger avant la migration.`);
  return modèle;
}
