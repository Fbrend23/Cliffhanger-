#!/usr/bin/env node
// Le manifeste du déploiement, en ligne de commande, depuis
// .github/workflows/deploy.yml (« Déployer ») :
//
//   node scripts/deployer.mjs construire dist manifeste.json
//   node scripts/deployer.mjs diff ancien.json nouveau.json dossier-sortie/
//
// « construire » range dist/ (le build) en { chemin: empreinte }. « diff »
// compare deux manifestes et écrit quatre listes, une ligne par élément et
// jamais de ligne vide en trop (le workflow les relit avec sed et while
// read) : envoyer.txt, supprimer.txt, dossiers-a-creer.txt,
// dossiers-a-supprimer.txt.
//
// La logique du diff est pure, testée dans test/deploiement.test.js ; ici,
// seulement lire dist/ et écrire les listes.

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { diffManifestes, dossiersACréer } from './lib/deploiement.mjs';

const empreinte = (fichier) => createHash('sha256').update(readFileSync(fichier)).digest('hex');

function fichiersDe(racine, sousDossier = '') {
  const résultat = [];
  for (const nom of readdirSync(path.join(racine, sousDossier)).sort()) {
    const relatif = sousDossier ? `${sousDossier}/${nom}` : nom;
    if (statSync(path.join(racine, relatif)).isDirectory()) résultat.push(...fichiersDe(racine, relatif));
    else résultat.push(relatif);
  }
  return résultat;
}

const écrireListe = (fichier, éléments) => writeFileSync(fichier, éléments.length ? `${éléments.join('\n')}\n` : '');

const [, , commande, ...args] = process.argv;

if (commande === 'construire') {
  const [dist, sortie] = args;
  const manifeste = Object.fromEntries(fichiersDe(dist).map((chemin) => [chemin, empreinte(path.join(dist, chemin))]));
  writeFileSync(sortie, JSON.stringify(manifeste));
  console.log(`${Object.keys(manifeste).length} fichier(s) dans ${dist}.`);
} else if (commande === 'diff') {
  const [ancienFichier, nouveauFichier, dossierSortie] = args;
  // Absent au premier déploiement, ou après l'avoir supprimé à la main pour
  // forcer un envoi complet : comme si rien n'était encore en ligne.
  const ancien = existsSync(ancienFichier) && statSync(ancienFichier).size ? JSON.parse(readFileSync(ancienFichier, 'utf8')) : {};
  const nouveau = JSON.parse(readFileSync(nouveauFichier, 'utf8'));
  const { envoyer, supprimer, dossiersASupprimer } = diffManifestes(ancien, nouveau);
  écrireListe(path.join(dossierSortie, 'envoyer.txt'), envoyer);
  écrireListe(path.join(dossierSortie, 'supprimer.txt'), supprimer);
  écrireListe(path.join(dossierSortie, 'dossiers-a-creer.txt'), dossiersACréer(envoyer));
  écrireListe(path.join(dossierSortie, 'dossiers-a-supprimer.txt'), dossiersASupprimer);
  console.log(`${envoyer.length} fichier(s) à envoyer, ${supprimer.length} à supprimer, ${dossiersASupprimer.length} dossier(s) vidé(s).`);
} else {
  console.error(`Commande inconnue : ${commande || '(aucune)'}. Attendu : construire | diff.`);
  process.exit(1);
}
