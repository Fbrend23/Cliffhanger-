// Ce que `astro:env/server` rend au site, lu dans process.env pour les tests
// (le crochet de résolution est posé dans loaders.test.js).
export const DIRECTUS_URL = process.env.DIRECTUS_URL;
export const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN;
