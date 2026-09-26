// @ts-check
import { defineConfig, envField } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { loadEnv } from 'vite';

// Astro ne charge le .env qu'après avoir lu cette configuration : sans
// loadEnv, un SITE_URL écrit dans .env était ignoré en local, et seul celui
// du shell (la CI) comptait. Préfixe vide : toutes les variables, celles du
// shell primant sur le fichier. vite vient avec Astro (c'est ce que sa
// documentation fait) : pas de dépendance à part, qui risquerait une seconde
// version.
const { SITE_URL } = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), '');

// https://astro.build/config
export default defineConfig({
  // Le .env en local, la variable de dépôt SITE_URL en CI (le domaine n'est
  // pas encore choisi). Sans lui, le sitemap, l'adresse canonique et les balises
  // Open Graph porteraient des adresses locales : des URL fausses sur un site
  // qui, lui, se construirait parfaitement. En développement, localhost est
  // la bonne réponse.
  site: SITE_URL || 'http://localhost:4321',

  // /spectacle/par-endroits/ et non /spectacle/par-endroits : Apache sert un
  // dossier avec son index.html, et une adresse sans barre finale lui ferait
  // ajouter un saut de redirection.
  trailingSlash: 'always',
  build: { format: 'directory' },

  integrations: [sitemap()],

  // Les deux variables ne sont PAS optionnelles : le site n'a aucun contenu
  // local sur lequel retomber, et c'est voulu. Sans source, le build doit
  // s'arrêter, et `astro:env` le fait mécaniquement, avant la première requête.
  env: {
    schema: {
      DIRECTUS_URL: envField.string({ context: 'server', access: 'public' }),
      // `access: 'secret'` fait échouer le build si le jeton est référencé
      // depuis du code client. Une garde mécanique, plus sûre que la discipline.
      DIRECTUS_TOKEN: envField.string({ context: 'server', access: 'secret' }),
    },
  },
});
