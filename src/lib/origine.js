// D'où l'on vient : le lien retour d'une fiche ramène à la page d'où l'on a cliqué
// (une fiche personne depuis le générique d'un spectacle, un spectacle depuis
// l'agenda), pas toujours à la même liste. Gardé dans `sessionStorage`, propre à
// l'onglet : une fiche ouverte directement (Google, lien partagé) n'a pas d'origine
// et garde son lien par défaut. Lu et écrit dans le navigateur seulement.
const CLÉ = 'cliff-origines';

/** @typedef {{ chemin: string, nom: string, index: number }} Origine */

/** @returns {Record<string, Origine>} */
function lire() {
  try {
    return JSON.parse(sessionStorage.getItem(CLÉ) ?? '{}') ?? {};
  } catch {
    return {};
  }
}

/**
 * Retient que `destination` a été ouverte depuis `origine`.
 * @param {string} destination chemin de la page ouverte
 * @param {Origine} origine page d'où part le clic ; `index` : sa place dans l'historique
 */
export function retenirOrigine(destination, origine) {
  if (destination === origine.chemin) return;
  try {
    sessionStorage.setItem(CLÉ, JSON.stringify({ ...lire(), [destination]: origine }));
  } catch {
    // Stockage refusé (navigation privée) : le lien garde son adresse par défaut.
  }
}

/** @param {string} destination @returns {Origine | null} */
export function origineDe(destination) {
  const o = lire()[destination];
  return o && typeof o.chemin === 'string' && typeof o.nom === 'string' ? o : null;
}
