// Le manifeste du déploiement : chaque fichier de dist/ avec l'empreinte de
// son contenu. Comparé à celui du déploiement précédent, il dit ce qui a
// changé sans jamais lister le serveur : voir scripts/deployer.mjs et
// .github/workflows/deploy.yml (« Déployer »). Un mirror complet ouvre une
// connexion FTP par fichier ET par dossier listé ; passé un certain nombre,
// l'hébergeur bloquait la moitié du déploiement une minute.
//
// Pur, testé dans test/deploiement.test.js.

/** Les dossiers parents d'un chemin (« a/b/c.html » → [« a/b », « a »]). */
export function ancêtres(chemin) {
  const résultat = [];
  let i = chemin.lastIndexOf('/');
  while (i !== -1) {
    résultat.push(chemin.slice(0, i));
    i = chemin.lastIndexOf('/', i - 1);
  }
  return résultat;
}

/**
 * Ce qui change entre deux manifestes ({ chemin: empreinte }).
 *
 * `envoyer` : nouveau ou changé, /_astro/ d'abord (ses fichiers portent une
 * empreinte de leur contenu dans leur nom : une page ne doit jamais
 * référencer un tel fichier avant qu'il n'existe sur le serveur). Rien n'est
 * effacé avant d'être renvoyé : chaque chemin part en `put` direct, le site
 * en ligne garde toujours une version complète de chaque fichier.
 *
 * `dossiersASupprimer` : ceux qu'une suppression vide entièrement, du plus
 * profond au moins profond, pour que chacun soit vide au moment de le
 * supprimer.
 *
 * @param {Record<string, string>} ancien
 * @param {Record<string, string>} nouveau
 */
export function diffManifestes(ancien, nouveau) {
  const envoyer = Object.keys(nouveau)
    .filter((chemin) => ancien[chemin] !== nouveau[chemin])
    .sort((a, b) => Number(!a.startsWith('_astro/')) - Number(!b.startsWith('_astro/')) || a.localeCompare(b));

  const supprimer = Object.keys(ancien).filter((chemin) => !(chemin in nouveau));

  const dossiersVivants = new Set(Object.keys(nouveau).flatMap(ancêtres));
  const dossiersASupprimer = [...new Set(Object.keys(ancien).flatMap(ancêtres))]
    .filter((d) => !dossiersVivants.has(d))
    .sort((a, b) => b.split('/').length - a.split('/').length || b.localeCompare(a));

  return { envoyer, supprimer, dossiersASupprimer };
}

/**
 * Le dossier direct de chaque fichier à envoyer, sans doublon : `mkdir -p`
 * crée seul les parents manquants, pas besoin de les lister un à un (ce que
 * `ancêtres` donnerait en entier) ni de les trier par profondeur.
 */
export const dossiersACréer = (envoyer) => [...new Set(envoyer.map((chemin) => ancêtres(chemin)[0]).filter(Boolean))].sort();
