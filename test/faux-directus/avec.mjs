// Lance une commande avec le faux Directus en marche, et les variables qui
// pointent dessus. `astro check` et `astro build` chargent les collections :
// sans CMS ni jeton, ils s'arrêtent, et c'est voulu pour le site. Ceci sert à
// les faire tourner malgré tout, en local, sur le contenu du prototype.
//
//   node test/faux-directus/avec.mjs npm run check
//   node test/faux-directus/avec.mjs npm run build
//
// Le cache des images n'est pas celui du vrai CMS (autres ids) : le build le
// purge de lui-même quand on repasse de l'un à l'autre.

import { spawn } from 'node:child_process';
import { démarrer } from './serveur.mjs';

const [commande, ...args] = process.argv.slice(2);
if (!commande) {
  console.error('Usage : node test/faux-directus/avec.mjs <commande> [arguments]');
  process.exit(2);
}

const faux = await démarrer(0);
console.log(`Faux Directus sur ${faux.url}`);
// Une seule chaîne, par le shell : npm est un .cmd sous Windows, et Node
// refuse désormais de lui passer des arguments séparés sans échappement.
const enfant = spawn([commande, ...args].join(' '), {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, DIRECTUS_URL: faux.url, DIRECTUS_TOKEN: 'faux', PRODYSOS_URL: faux.url, PRODYSOS_KEY: 'faux', PRODYSOS_COMPANY: 'cliffhanger', SITE_URL: process.env.SITE_URL ?? 'https://www.exemple-cliffhanger.test' },
});
enfant.on('exit', async (code) => {
  await faux.fermer();
  process.exit(code ?? 1);
});
