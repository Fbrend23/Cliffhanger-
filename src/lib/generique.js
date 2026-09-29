// Le générique d'un spectacle et les projets d'une personne. Pur, testé dans
// test/generique.test.js.
//
// Dans le CMS, le générique d'un spectacle est une liste de lignes saisie dans
// sa fiche (rôle, note, noms un par ligne, texte), dans l'ordre du Studio. Un
// nom se tape tel qu'il s'affiche, avec le personnage entre parenthèses pour
// un interprète (« Sophie Decaestecker (Henriette) ») : le site le relie à la
// fiche de la personne par son nom.

import { T } from './textes.js';

/**
 * « a, b et c ».
 * @param {unknown[]} items
 */
export const joindreFr = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`);

/**
 * @typedef {{ slug: string|null, nom: string, personnage: string|null }} Nom
 * @typedef {{ role: string, note: string|null, noms: Nom[], text: string|null }} Ligne
 */

/**
 * Un nom comparable : sans accents, majuscules ni ponctuation, pour qu'une
 * étourderie de saisie (« Alize  cookie ») retrouve quand même la fiche.
 * @param {string} s
 */
export const cléNom = (s) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Les noms d'une ligne : un par ligne du texte saisi, « Nom (Personnage) ».
 * Un nom sans fiche publiée reste un nom sans lien, et est rendu à l'appelant
 * dans `inconnus` pour qu'il le signale.
 *
 * @param {unknown} saisie
 * @param {{ slug: string, name: string }[]} personnes  les personnes publiées
 * @returns {{ noms: Nom[], inconnus: string[] }}
 */
export function lireNoms(saisie, personnes) {
  const parClé = new Map(personnes.map((p) => [cléNom(p.name), p.slug]));
  /** @type {Nom[]} */
  const noms = [];
  /** @type {string[]} */
  const inconnus = [];
  for (const brut of typeof saisie === 'string' ? saisie.split(/\r?\n/) : []) {
    const m = brut.trim().match(/^(.*?)\s*\(([^)]*)\)$/);
    const nom = (m ? m[1] : brut).trim();
    if (!nom) continue;
    const slug = parClé.get(cléNom(nom)) ?? null;
    if (!slug) inconnus.push(nom);
    noms.push({ slug, nom, personnage: m?.[2].trim() || null });
  }
  return { noms, inconnus };
}

/**
 * Les lignes du générique d'un spectacle, dans l'ordre.
 *
 * @param {{ role: string, note: string|null, text: string|null, personnes: Nom[], sort: number }[]} generique  les lignes de ce spectacle
 * @returns {Ligne[]}
 */
export function lignesGenerique(generique) {
  return (
    [...generique]
      .sort((a, b) => a.sort - b.sort)
      .map((g) => ({ role: g.role, note: g.note, noms: g.personnes, text: g.text }))
      // Une ligne sans rien après son rôle serait un champ vide affiché.
      .filter((l) => l.note || l.noms.length || l.text)
  );
}

/**
 * La valeur d'une ligne, en HTML : la note, les noms (liens) et le texte. La
 * note qui finit par une apostrophe (« sous la direction d’ ») se colle au
 * nom qui suit.
 *
 * @param {Ligne} ligne
 * @param {(nom: Nom) => string|null} nomHtml  le lien d'une personne, null si elle n'est plus publiée
 * @param {(texte: string) => string} texte  échappe et typographie un texte
 */
export function valeurLigne(ligne, nomHtml, texte) {
  const noms = ligne.noms.map(nomHtml).filter(Boolean);
  const morceaux = [];
  if (ligne.note) morceaux.push(texte(ligne.note.trimStart()));
  if (noms.length) morceaux.push(joindreFr(noms));
  if (ligne.text) morceaux.push(texte(ligne.text));
  let html = '';
  for (const [i, m] of morceaux.entries()) {
    const collé = i > 0 && /['’]\s*$/.test(morceaux[i - 1]);
    html = i === 0 ? m : collé ? html.replace(/\s+$/, '') + m : `${html} ${m}`;
  }
  return html;
}

/**
 * Tous les spectacles auxquels une personne a pris part, avec ses rôles
 * (« Interprétation (Henriette) », « Mise en scène »), les plus récents
 * d'abord. L'ordre des rôles est celui du générique.
 *
 * @template {{ slug: string, year?: number|null }} S
 * @param {string} personne
 * @param {S[]} spectacles  dans l'ordre du site
 * @param {Map<string, Ligne[]>} lignesParSpectacle
 * @returns {{ spectacle: S, roles: string[] }[]}
 */
export function projetsDe(personne, spectacles, lignesParSpectacle) {
  return spectacles
    .map((spectacle) => ({
      spectacle,
      roles: (lignesParSpectacle.get(spectacle.slug) ?? []).flatMap((l) =>
        l.noms
          .filter((n) => n.slug === personne)
          .map((n) => {
            const role = l.role === T.avec ? T.interprétation : l.role;
            return n.personnage ? `${role} (${n.personnage})` : role;
          })
      ),
    }))
    .filter((p) => p.roles.length)
    .sort((a, b) => (b.spectacle.year ?? 0) - (a.spectacle.year ?? 0));
}
