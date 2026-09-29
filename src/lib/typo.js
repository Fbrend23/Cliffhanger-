// La typographie française, appliquée au build à tout texte rendu : on tape
// les textes normalement dans le Studio, le site pose les bons signes.
//
// - ’ au lieu de ' ;
// - espace insécable avant « : » et après « « » ;
// - espace fine insécable avant « ? ! ; » et « » » ;
// - aucun tiret long ni demi-cadratin (règle de la compagnie) : entouré
//   d'espaces, il devient une virgule ; collé, un trait d'union. Le loader
//   signale ceux qui viennent du Studio ; ceci garantit qu'aucun n'est
//   publié, même oublié.
//
// Seuls les nœuds texte d'une chaîne HTML sont touchés, jamais les balises ni
// leurs attributs : un lien vers /montreal/ ou un style reste intact.
//
// Pure, sans dépendance : testée dans test/typo.test.js.

const INSÉCABLE = ' ';
const FINE = ' ';

/**
 * Un texte sans balise.
 * @param {string} t
 */
function nœud(t) {
  return t
    .replace(/'/g, '’')
    .replace(/[   ]+[—–][   ]+/g, ', ')
    .replace(/ - /g, ', ')
    .replace(/[—–]/g, '-')
    .replace(/ :/g, `${INSÉCABLE}:`)
    .replace(/ ([?!;»])/g, `${FINE}$1`)
    .replace(/« /g, `«${INSÉCABLE}`);
}

/**
 * La typographie d'une chaîne HTML (ou d'un texte simple), nœuds texte seuls.
 * @param {string|null|undefined} html
 * @returns {string}
 */
export function typographier(html) {
  if (!html) return '';
  return String(html)
    .split(/(<[^>]*>)/)
    .map((morceau) => (morceau.startsWith('<') ? morceau : nœud(morceau)))
    .join('');
}

/** @type {Record<string, string>} */
const ÉCHAPPEMENTS = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

/**
 * Échappe un texte pour le poser en HTML.
 * @param {unknown} s
 */
export const échapper = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ÉCHAPPEMENTS[c]);

/**
 * Un texte simple (titre, légende, lieu) prêt pour `set:html` : échappé, puis
 * typographié. C'est ce que les gabarits utilisent pour tout texte du CMS ou
 * de l'interface.
 * @param {string|number|null|undefined} texte
 */
export const tx = (texte) => typographier(échapper(texte));
