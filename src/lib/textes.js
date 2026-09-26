// Les textes de l'interface : tout ce que le site écrit lui-même, par
// opposition au contenu, qui vient du CMS. Un seul endroit, pour qu'une
// formulation se change sans chercher dans les gabarits, et pour que le jour
// où l'anglais arrive, il suffise d'un second dictionnaire aux mêmes clés.
//
// Aucun tiret long ni demi-cadratin ici (règle de la compagnie) : une virgule,
// deux points ou « · ». Le test typo.test.js le vérifie.

export const T = {
  compagnie: 'Compagnie Cliffhanger',
  // Le h1 caché de l'accueil : la page n'a pas de titre visible, la liste des
  // spectacles en tient lieu, mais un lecteur d'écran et un moteur en veulent un.
  accueilH1: 'Compagnie Cliffhanger, compagnie de théâtre bruxelloise',
  descriptionParDéfaut: 'Compagnie de théâtre bruxelloise.',
  allerAuContenu: 'Aller au contenu',
  menuOuvrir: 'Ouvrir le menu',
  menuFermer: 'Fermer le menu',
  menuPrincipal: 'Menu principal',
  menu: [
    { href: '/compagnie/', label: 'La compagnie' },
    { href: '/spectacles/', label: 'Spectacles' },
    { href: '/agenda/', label: 'Agenda' },
    { href: '/galerie/', label: 'Galerie' },
    { href: '/montreal/', label: 'Montréal' },
    { href: '/contact/', label: 'Contact' },
  ],
  pied: (année) => `© ${année} Compagnie Cliffhanger · Bruxelles · Montréal`,

  spectacles: 'Spectacles',
  découvrir: 'Découvrir',
  voirLaSuite: 'Voir la suite',
  afficheDe: (titre) => `Affiche de ${titre}`,
  photoPrécédente: 'Photo précédente',
  photoSuivante: 'Photo suivante',
  durée: 'Durée',
  // Le rôle « Avec » d'un générique, et ce qu'il devient sur la fiche d'une
  // personne : « Interprétation (Henriette) ».
  avec: 'Avec',
  interprétation: 'Interprétation',
  àVenir: 'À venir',
  représentations: 'Représentations',
  passées: 'Passées',
  tousLesSpectacles: '← Tous les spectacles',
  crédit: (nom) => `© ${nom}`,

  agenda: 'Agenda',
  laCompagnie: 'La compagnie',
  léquipe: "L'équipe",
  retourCompagnie: '← La compagnie',
  projets: 'Projets',
  biographie: 'Biographie',

  galerie: 'Galerie',
  // La légende d'une photo qui n'en a pas et ne montre aucun spectacle.
  coulisses: 'Coulisses',
  agrandir: (légende) => `Agrandir la photo : ${légende}`,
  photoAgrandie: 'Photo agrandie',
  // La légende de la visionneuse : « Coulisses · 3 / 9 ».
  légendeVisionneuse: (légende, position, total) => `${légende} · ${position} / ${total}`,
  fermer: 'Fermer',

  montreal: 'Montréal',

  contact: 'Contact',
  contactLead: 'Réservations, diffusion, presse',
  nouvelOnglet: ' (nouvel onglet)',
  instagram: 'Instagram',
  facebook: 'Facebook',

  introuvable: 'Page introuvable',
  introuvableTexte: "Cette page n'existe pas, ou plus.",
  retourAccueil: "← Retour à l'accueil",
};
