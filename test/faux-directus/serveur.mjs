// Un faux Directus, pour construire et regarder le site sans jeton.
//
// Il sert le contenu du prototype avec la forme de l'API que les loaders
// interrogent : `/items/cliff_*` (fields, filter sur status, sort, deep,
// limit, page) et `/assets/<id>`. Il ne vit que dans test/ : le site, lui,
// n'a aucun contenu de repli, et ne connaît que le vrai CMS.
//
//   node test/faux-directus/serveur.mjs [port]      (8055 par défaut)
//   DIRECTUS_URL=http://localhost:8055 DIRECTUS_TOKEN=faux npm run build
//
// Ce qu'il imite, et rien de plus : la projection des champs demandés (un
// m2o sans sous-champ rend son id, comme Directus), les champs de
// directus_files limités à ceux que la policy du build autorise (demander un
// autre champ fait échouer la requête, comme sur l'instance), le jeton exigé.

import { createReadStream } from 'node:fs';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { construireBase } from './donnees.mjs';

// Les champs de directus_files que la policy de lecture du build de la compagnie (« lecture build », préfixe cliff) laisse
// lire (platform-cms, scripts/lib/permissions.mjs).
const CHAMPS_FICHIERS_PERMIS = new Set(['id', 'filename_download', 'type', 'width', 'height', 'modified_on', 'title', 'description', 'focal_point_x', 'focal_point_y']);

const estFichier = (v) => v && typeof v === 'object' && 'filename_download' in v;

/** La clé primaire d'une ligne dépliée, ce que Directus rend pour un m2o sans sous-champ. */
const clé = (v) => (v && typeof v === 'object' ? (v.id ?? null) : v);

/**
 * Projette une ligne sur les chemins demandés (`slug`, `hero.id`,
 * `personnes.cliff_personnes_id.slug`). Lève une erreur si un champ de
 * fichier n'est pas permis : l'instance refuserait la requête entière.
 */
function projeter(ligne, chemins) {
  const sortie = {};
  const groupes = new Map();
  for (const c of chemins) {
    const [tête, ...reste] = c.split('.');
    if (!groupes.has(tête)) groupes.set(tête, []);
    if (reste.length) groupes.get(tête).push(reste.join('.'));
  }
  for (const [champ, sous] of groupes) {
    if (champ === '*') {
      for (const [k, v] of Object.entries(ligne)) if (!k.startsWith('_') && !(k in sortie)) sortie[k] = Array.isArray(v) ? v.map(clé) : clé(v);
      continue;
    }
    const v = ligne?.[champ];
    if (!sous.length) {
      sortie[champ] = Array.isArray(v) ? v.map(clé) : clé(v);
    } else if (Array.isArray(v)) {
      sortie[champ] = v.map((l) => projeter(l, sous));
    } else if (v && typeof v === 'object') {
      if (estFichier(v)) {
        for (const s of sous) {
          if (!CHAMPS_FICHIERS_PERMIS.has(s)) throw Object.assign(new Error(`champ « ${s} » de directus_files non permis`), { code: 403 });
        }
      }
      sortie[champ] = projeter(v, sous);
    } else {
      sortie[champ] = null;
    }
  }
  return sortie;
}

/** Le tri `sort=sort,-year` : une clé après l'autre, `-` pour décroissant. */
function trier(lignes, sort) {
  if (!sort) return lignes;
  const clés = sort.split(',').map((k) => (k.startsWith('-') ? [k.slice(1), -1] : [k, 1]));
  return [...lignes].sort((a, b) => {
    for (const [k, sens] of clés) {
      const x = a[k] ?? '';
      const y = b[k] ?? '';
      if (x < y) return -sens;
      if (x > y) return sens;
    }
    return 0;
  });
}

/**
 * Démarre le serveur. Rend `{ url, fermer() }`.
 * @param {number} [port]  0 pour un port libre
 */
export async function démarrer(port = 8055) {
  const base = await construireBase();

  const serveur = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const répondre = (code, corps) => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(JSON.stringify(corps));
    };

    if (!/^Bearer .+/.test(req.headers.authorization ?? '')) {
      return répondre(401, { errors: [{ message: 'jeton absent' }] });
    }

    const asset = /^\/assets\/([\w-]+)$/.exec(url.pathname);
    if (asset) {
      const f = base.fichiers.get(asset[1]);
      if (!f) return répondre(404, { errors: [{ message: 'fichier inconnu' }] });
      res.writeHead(200, { 'content-type': f.type });
      return createReadStream(f.chemin).pipe(res);
    }

    const items = /^\/items\/(\w+)$/.exec(url.pathname);
    if (!items) return répondre(404, { errors: [{ message: 'route inconnue' }] });
    const nom = items[1];
    const chemins = (url.searchParams.get('fields') ?? '*').split(',').filter(Boolean);

    try {
      if (nom in base.singletons) return répondre(200, { data: projeter(base.singletons[nom], chemins) });
      const lignes = base.collections[nom];
      if (!lignes) return répondre(403, { errors: [{ message: `collection « ${nom} » inconnue ou interdite` }] });
      const statut = url.searchParams.get('filter[status][_eq]');
      const page = Number(url.searchParams.get('page') ?? 1);
      const limite = Number(url.searchParams.get('limit') ?? 100);
      const choisies = trier(lignes.filter((l) => !statut || l.status === statut), url.searchParams.get('sort'));
      const tranche = limite < 0 ? choisies : choisies.slice((page - 1) * limite, page * limite);
      return répondre(200, { data: tranche.map((l) => projeter(l, chemins)) });
    } catch (e) {
      return répondre(e.code ?? 500, { errors: [{ message: e.message }] });
    }
  });

  await new Promise((ok) => serveur.listen(port, '127.0.0.1', ok));
  const adresse = serveur.address();
  const réel = typeof adresse === 'object' && adresse ? adresse.port : port;
  return {
    url: `http://127.0.0.1:${réel}`,
    base,
    fermer: () => new Promise((ok) => serveur.close(() => ok(undefined))),
  };
}

// Lancé directement : un serveur au premier plan, jusqu'à Ctrl+C.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { url } = await démarrer(Number(process.argv[2] ?? 8055));
  console.log(`Faux Directus sur ${url} (contenu de migration/content.js)`);
  console.log(`DIRECTUS_URL=${url} DIRECTUS_TOKEN=faux npm run build`);
}
