// Les collections du site. Toutes viennent du CMS, aucune du disque : les
// loaders (src/lib/loaders.js) lisent Directus au build, et les schémas
// ci-dessous disent ce que les pages peuvent attendre de chaque entrée.
//
// `image()` transforme le chemin d'un original du cache en ImageMetadata :
// c'est ce qui permet à getImage() de fabriquer les tailles. Les dimensions
// sont rangées à part (`heroTaille`, `width`…) : lire `.width` sur une
// ImageMetadata dans un gabarit ferait émettre l'original dans dist/.

import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import {
  distributionLoader,
  generiqueLoader,
  montrealLoader,
  personnesLoader,
  photosLoader,
  reglagesLoader,
  representationsLoader,
  spectaclesLoader,
} from './lib/loaders.js';

const focal = z.object({ x: z.number(), y: z.number() }).nullable();
const taille = z.object({ width: z.number().nullable(), height: z.number().nullable() });

const spectacles = defineCollection({
  loader: spectaclesLoader(),
  schema: ({ image }) =>
    z.object({
      slug: z.string(),
      title: z.string(),
      year: z.number().nullable(),
      troupe: z.enum(['bruxelles', 'montreal']),
      punch: z.string().nullable(),
      cite: z.string().nullable(),
      text: z.string().nullable(),
      credit: z.string().nullable(),
      duration: z.string().nullable(),
      sort: z.number(),
      hero: image(),
      heroTaille: taille,
      // Le recadrage 9:16 pour les téléphones tenus droits, et l'aperçu flou en data: URI (lib/directus.js).
      heroPortrait: image(),
      heroApercu: z.string(),
      focal,
      poster: image().nullable(),
      posterTaille: taille.nullable(),
      slides: z.array(z.string()),
    }),
});

const photos = defineCollection({
  loader: photosLoader(),
  schema: ({ image }) =>
    z.object({
      caption: z.string(),
      galerie: z.boolean(),
      spectacle: z.string().nullable(),
      sort: z.number(),
      image: image(),
      // Seulement pour les fonds de page : voir le loader.
      portrait: image().nullable(),
      apercu: z.string(),
      width: z.number().nullable(),
      height: z.number().nullable(),
      focal,
    }),
});

const personnes = defineCollection({
  loader: personnesLoader(),
  schema: z.object({
    slug: z.string(),
    name: z.string(),
    groupe: z.enum(['equipe', 'invite', 'montreal']),
    bio: z.string().nullable(),
    sort: z.number(),
  }),
});

const distribution = defineCollection({
  loader: distributionLoader(),
  schema: z.object({
    spectacle: z.string(),
    personne: z.string(),
    personnage: z.string().nullable(),
    sort: z.number(),
  }),
});

const generique = defineCollection({
  loader: generiqueLoader(),
  schema: z.object({
    spectacle: z.string(),
    role: z.string(),
    note: z.string().nullable(),
    text: z.string().nullable(),
    personnes: z.array(z.string()),
    sort: z.number(),
  }),
});

const representations = defineCollection({
  loader: representationsLoader(),
  schema: z.object({
    spectacle: z.string(),
    day: z.string(),
    time: z.string().nullable(),
    venue: z.string().nullable(),
    city: z.string().nullable(),
    // La rue et le code postal, pour les moteurs : Prodysos seulement.
    street: z.string().nullable(),
    postalCode: z.string().nullable(),
    price: z.string().nullable(),
    // De quoi la réserver dans Prodysos : le spectacle (sa page publique) et
    // la représentation. Null pour une date qui n'existe que dans le CMS.
    reservation: z.object({ slug: z.string(), id: z.string() }).nullable(),
  }),
});

const montreal = defineCollection({
  loader: montrealLoader(),
  schema: z.object({
    sub: z.string().nullable(),
    lead: z.string().nullable(),
    text: z.string().nullable(),
  }),
});

const reglages = defineCollection({
  loader: reglagesLoader(),
  schema: ({ image }) =>
    z.object({
      site_title: z.string(),
      site_description: z.string().nullable(),
      email: z.string().nullable(),
      instagram: z.string().nullable(),
      facebook: z.string().nullable(),
      compagnie_sub: z.string().nullable(),
      compagnie_punch: z.string().nullable(),
      compagnie_text: z.string().nullable(),
      fonds: z.object({
        accueil: z.string().nullable(),
        spectacles: z.string().nullable(),
        agenda: z.string().nullable(),
        compagnie: z.string().nullable(),
        contact: z.string().nullable(),
      }),
      head_verification: z.string().nullable(),
      og_image: image().nullable(),
    }),
});

export const collections = { spectacles, photos, personnes, distribution, generique, representations, montreal, reglages };
