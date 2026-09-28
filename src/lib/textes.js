// Les textes de l'interface : tout ce que le site écrit lui-même, par
// opposition au contenu, qui vient du CMS. Un seul endroit, pour qu'une
// formulation se change sans chercher dans les gabarits, et pour que le jour
// où l'anglais arrive, il suffise d'un second dictionnaire aux mêmes clés.
//
// Aucun tiret long ni demi-cadratin ici (règle de la compagnie) : une virgule,
// deux points ou « · ». Le test typo.test.js le vérifie.

export const T = {
  compagnie: 'Compagnie Cliffhanger',
  // La première étape du fil d'Ariane, pour les moteurs.
  accueil: 'Accueil',
  // Le h1 caché de l'accueil : la page n'a pas de titre visible, la liste des
  // spectacles en tient lieu, mais un lecteur d'écran et un moteur en veulent un.
  accueilH1: 'Compagnie Cliffhanger, compagnie de théâtre bruxelloise',
  // Les descriptions des pages (ce que Google montre sous le lien), quand le
  // CMS n'en donne pas : chacune la sienne, un moteur signale les doublons.
  // Moins de 155 caractères, où il coupe.
  // Ce que le titre de l'accueil ajoute au nom : ce qu'on cherche pour la trouver.
  titreAccueil: 'Théâtre à Bruxelles',
  descriptionParDéfaut: 'La Compagnie Cliffhanger, compagnie de théâtre bruxelloise : ses spectacles, ses prochaines dates, son équipe.',
  descriptionSpectacles: (titres) => `Les spectacles de la Compagnie Cliffhanger, compagnie de théâtre bruxelloise : ${titres}.`,
  // La prochaine série, s'il y en a une : « Hamlet, 17 et 18 avr. 2026, Théâtre L'Improviste, Forest ».
  descriptionAgenda: (prochaine) =>
    prochaine
      ? `Les représentations de la Compagnie Cliffhanger, compagnie de théâtre bruxelloise. Prochainement : ${prochaine}.`
      : 'Les représentations de la Compagnie Cliffhanger, compagnie de théâtre bruxelloise : dates, lieux, réservations.',
  descriptionGalerie: (titres) => `Les photos des spectacles de la Compagnie Cliffhanger, compagnie de théâtre bruxelloise : ${titres}.`,
  descriptionContact: 'Écrire à la Compagnie Cliffhanger, compagnie de théâtre bruxelloise : réservations, diffusion, presse.',
  // Une fiche sans biographie : ses spectacles, s'il y en a.
  descriptionPersonne: (nom, titres) => (titres ? `${nom}, avec la Compagnie Cliffhanger : ${titres}.` : `${nom}, avec la Compagnie Cliffhanger, compagnie de théâtre bruxelloise.`),
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

  // La réservation, sur la fiche d'un spectacle : les dates venues de
  // Prodysos, où la demande arrive. Un refus de Prodysos s'affiche avec son
  // propre message, écrit pour le public ; les nôtres servent quand il n'en
  // donne pas.
  réserver: 'Réserver',
  réservationNom: 'Nom',
  réservationPrénom: 'Prénom',
  réservationEmail: 'E-mail',
  réservationDate: 'Représentation',
  réservationPlaces: 'Places',
  réservationMessage: 'Message (facultatif)',
  envoyer: 'Envoyer',
  envoiEnCours: 'Envoi en cours…',
  réservationEnvoyée: 'Merci, votre demande de réservation est bien arrivée. La compagnie vous répond par e-mail.',
  réservationRefusée: "Votre demande n'a pas pu être envoyée. Réessayez dans un instant.",
  réservationHorsLigne: 'Connexion impossible. Vérifiez votre réseau et réessayez.',
  réservationSansJs: 'Le formulaire demande JavaScript. Pour réserver, écrivez-nous :',
  réservationDonnées: "Vos coordonnées ne servent qu'à traiter votre réservation.",
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
