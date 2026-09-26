// robots.txt, fabriqué au build plutôt que posé dans public/ : il doit
// annoncer l'adresse du sitemap, et le domaine du site n'est pas encore
// choisi. SITE_URL, variable du build, n'arrive pas jusqu'à un fichier
// statique ; ici, si.
//
// Les règles sont celles du portfolio. Les moteurs de recherche sont
// bienvenus : une compagnie vit de ce qu'on la trouve. Les robots qui
// aspirent textes et photos pour ENTRAÎNER des modèles sont refusés
// nommément ; ceux des assistants qui citent en liant la source
// (OAI-SearchBot, ChatGPT-User, PerplexityBot…) passent par la règle
// générale : ils amènent un lecteur, comme un moteur. C'est déclaratif, ceux
// qui trichent passent quand même, mais ces noms-là respectent le fichier.

const ENTRAÎNEMENT = [
  'GPTBot',
  'ClaudeBot',
  'anthropic-ai',
  'Claude-Web',
  'CCBot',
  'Google-Extended',
  'Applebot-Extended',
  'meta-externalagent',
  'FacebookBot',
  'Bytespider',
  'Diffbot',
  'Omgilibot',
  'omgili',
  'Timpibot',
  'Webzio-Extended',
  'ImagesiftBot',
  'img2dataset',
];

/** @type {import('astro').APIRoute} */
export function GET({ site }) {
  const sitemap = new URL('/sitemap-index.xml', site).toString();
  const corps = [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${sitemap}`,
    '',
    ...ENTRAÎNEMENT.map((r) => `User-agent: ${r}`),
    'Disallow: /',
    '',
  ].join('\n');
  return new Response(corps, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
