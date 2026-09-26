// Le générique d'un spectacle et les projets d'une personne. Pur, testé dans
// test/generique.test.js.
//
// Dans le CMS, le générique tient en deux collections : la distribution (une
// ligne par interprète, avec son personnage) et les autres rôles (note,
// personnes, texte). Le site les remet en une liste, dans l'ordre du Studio.
// La distribution devient la ligne « Avec » : elle prend la place d'une ligne
// de générique de rôle « Avec » s'il y en a une (c'est ce qui permet de la
// placer où l'on veut), sinon elle vient en dernier.

import { T } from './textes.js';

/** « a, b et c ». */
export const joindreFr = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`);

/**
 * @typedef {{ slug: string, personnage: string|null }} Nom
 * @typedef {{ role: string, note: string|null, noms: Nom[], text: string|null }} Ligne
 */

/**
 * Les lignes du générique d'un spectacle, dans l'ordre.
 *
 * @param {{ role: string, note: string|null, text: string|null, personnes: string[], sort: number }[]} generique  les lignes de ce spectacle
 * @param {{ personne: string, personnage: string|null, sort: number }[]} distribution  ses interprètes
 * @returns {Ligne[]}
 */
export function lignesGenerique(generique, distribution) {
  const parOrdre = (a, b) => a.sort - b.sort;
  const avec = [...distribution].sort(parOrdre).map((d) => ({ slug: d.personne, personnage: d.personnage }));
  const lignes = [];
  let placée = false;
  for (const g of [...generique].sort(parOrdre)) {
    const repère = g.role.trim() === T.avec;
    if (repère && placée) continue;
    lignes.push({
      role: g.role,
      note: g.note,
      noms: [...g.personnes.map((slug) => ({ slug, personnage: null })), ...(repère ? avec : [])],
      text: g.text,
    });
    if (repère) placée = true;
  }
  if (!placée && avec.length) lignes.push({ role: T.avec, note: null, noms: avec, text: null });
  // Une ligne sans rien après son rôle serait un champ vide affiché.
  return lignes.filter((l) => l.note || l.noms.length || l.text);
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
 * @template {{ slug: string, year: number|null }} S
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
