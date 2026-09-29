// Les informations légales de la compagnie, lues des réglages du CMS. Les
// pages Mentions légales et Confidentialité n'existent que si tout ce qu'elles
// doivent dire est renseigné : jamais de champ vide rendu, jamais de texte
// provisoire à sa place.

/**
 * @typedef {object} Légal
 * @property {string} denomination
 * @property {string[]} adresse  Les lignes de l'adresse du siège.
 * @property {string} bce
 * @property {string} responsable
 * @property {string} email
 * @property {string|null} conservation
 */

/**
 * @param {{ legal_denomination: string|null, legal_adresse: string|null, legal_bce: string|null,
 *   legal_responsable: string|null, legal_conservation: string|null, email: string|null }} reglages
 * @returns {Légal|null} Null tant qu'une information manque (dont l'e-mail, seul contact pour exercer ses droits).
 */
export function légal(reglages) {
  const adresse = (reglages.legal_adresse ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const { legal_denomination: denomination, legal_bce: bce, legal_responsable: responsable, email } = reglages;
  if (!denomination || !bce || !responsable || !email || adresse.length === 0) return null;
  return { denomination, adresse, bce, responsable, email, conservation: reglages.legal_conservation };
}
