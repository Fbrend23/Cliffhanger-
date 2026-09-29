// Ce que `astro:env/server` rend au site, lu dans process.env pour les tests
// (le crochet de résolution est posé dans loaders.test.js).
export const DIRECTUS_URL = process.env.DIRECTUS_URL;
export const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN;
export const PRODYSOS_URL = process.env.PRODYSOS_URL;
export const PRODYSOS_KEY = process.env.PRODYSOS_KEY;
export const PRODYSOS_COMPANY = process.env.PRODYSOS_COMPANY;
