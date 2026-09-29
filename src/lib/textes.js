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
  /**
   * @param {string} titres
   */
  descriptionSpectacles: (titres) => `Les spectacles de la Compagnie Cliffhanger, compagnie de théâtre bruxelloise : ${titres}.`,
  // La prochaine série, s'il y en a une : « Hamlet, 17 et 18 avr. 2026, Théâtre L'Improviste, Forest ».
  /**
   * @param {string|null} prochaine
   */
  descriptionAgenda: (prochaine) =>
    prochaine
      ? `Les représentations de la Compagnie Cliffhanger, compagnie de théâtre bruxelloise. Prochainement : ${prochaine}.`
      : 'Les représentations de la Compagnie Cliffhanger, compagnie de théâtre bruxelloise : dates, lieux, réservations.',
  /**
   * @param {string} titres
   */
  descriptionGalerie: (titres) => `Les photos des spectacles de la Compagnie Cliffhanger, compagnie de théâtre bruxelloise : ${titres}.`,
  descriptionContact: 'Écrire à la Compagnie Cliffhanger, compagnie de théâtre bruxelloise : réservations, diffusion, presse.',
  // Une fiche sans biographie : ses spectacles, s'il y en a.
  /**
   * @param {string} nom
   * @param {string|null} titres
   */
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
  /**
   * @param {number|string} année
   */
  pied: (année) => `© ${année} Compagnie Cliffhanger · Bruxelles · Montréal`,

  // Pages légales. Les valeurs de `l` (informations légales des réglages) arrivent déjà échappées ;
  // chaque section est un intitulé et son HTML, rendus par Intitule et TexteRiche.
  mentionsLégales: 'Mentions légales',
  confidentialité: 'Confidentialité',
  descriptionMentionsLégales: "Mentions légales du site de la Compagnie Cliffhanger : éditeur, responsable de la publication, hébergeur et droits d'auteur.",
  descriptionConfidentialité: "Politique de confidentialité du site de la Compagnie Cliffhanger : données des demandes de réservation, destinataires, durée de conservation, cookies et droits.",
  /**
   * @param {{ denomination: string, adresse: string[], bce: string, responsable: string, email: string }} l
   */
  sectionsMentionsLégales: (l) => [
    {
      titre: 'Éditeur',
      html: `<p>${l.denomination}<br>${(l.adresse ?? []).join('<br>')}<br>Numéro d'entreprise : ${l.bce}<br>E-mail : <a href="mailto:${l.email}">${l.email}</a></p>`,
    },
    { titre: 'Responsable de la publication', html: `<p>${l.responsable}</p>` },
    {
      titre: 'Hébergement',
      html: `<p>Infomaniak Network SA, Rue Eugène-Marziano 25, 1227 Genève, Suisse. <a href="https://www.infomaniak.com" target="_blank" rel="noopener">infomaniak.com</a></p>`,
    },
    {
      titre: "Droits d'auteur",
      html: `<p>Les photographies, affiches, textes et vidéos de ce site appartiennent à la compagnie et à leurs auteurs. Toute reproduction, même partielle, sans autorisation écrite préalable est interdite, y compris pour l'entraînement de systèmes d'intelligence artificielle.</p>`,
    },
    {
      titre: 'Données personnelles',
      html: `<p>Le traitement des données personnelles est décrit dans la <a href="/confidentialite/">politique de confidentialité</a>.</p>`,
    },
  ],
  /**
   * @param {{ denomination: string, adresse: string[], email: string, conservation: string|null }} l
   */
  sectionsConfidentialité: (l) => [
    {
      titre: 'Responsable du traitement',
      html: `<p>${l.denomination}, ${(l.adresse ?? []).join(', ')}. Contact : <a href="mailto:${l.email}">${l.email}</a>.</p>`,
    },
    {
      titre: 'Données collectées',
      html: `<p>Le site ne collecte des données que lorsque vous demandez une réservation : prénom, nom, adresse e-mail, nombre de places, représentation choisie et, si vous le souhaitez, un message. Il n'y a ni compte, ni newsletter, ni autre formulaire.</p>`,
    },
    {
      titre: 'Pourquoi et sur quelle base',
      html: `<p>Ces données servent uniquement à traiter votre demande de réservation et à vous répondre. Le traitement repose sur votre demande, en vue de conclure la réservation (article 6, paragraphe 1, point b du RGPD).</p>`,
    },
    {
      titre: 'Qui les reçoit',
      html: `<p>La compagnie, par son outil de gestion Prodysos, qui enregistre la demande et envoie les e-mails de réponse. Prodysos s'appuie sur la plateforme d'hébergement Supabase. Vos données ne sont ni vendues ni cédées.</p><p>L'hébergeur du site, Infomaniak, tient des journaux techniques de connexion (adresse IP, date, page demandée), nécessaires à la sécurité et au bon fonctionnement du site.</p>`,
    },
    {
      titre: 'Durée de conservation',
      html: `<p>Votre demande est conservée ${l.conservation ?? 'le temps nécessaire à son traitement'}, puis supprimée.</p>`,
    },
    {
      titre: 'Cookies',
      html: `<p>Ce site n'utilise aucun cookie, aucun traceur et aucun outil de mesure d'audience, et ne charge aucun contenu de tiers : polices, images et vidéos viennent du site lui-même. Aucun consentement n'est donc demandé. Les liens vers Instagram et Facebook mènent hors du site, où s'appliquent les règles de ces services.</p>`,
    },
    {
      titre: 'Vos droits',
      html: `<p>Vous pouvez demander l'accès à vos données, leur rectification, leur effacement, la limitation du traitement, vous y opposer ou en demander la portabilité, en écrivant à <a href="mailto:${l.email}">${l.email}</a>. La compagnie répond dans un délai d'un mois.</p><p>Vous pouvez aussi introduire une réclamation auprès de l'Autorité de protection des données, Rue de la Presse 35, 1000 Bruxelles, <a href="https://www.autoriteprotectiondonnees.be" target="_blank" rel="noopener">autoriteprotectiondonnees.be</a>.</p>`,
    },
  ],

  spectacles: 'Spectacles',
  découvrir: 'Découvrir',
  voirLaSuite: 'Voir la suite',
  /**
   * @param {string} titre
   */
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
  /**
   * @param {string} nom
   */
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
  /**
   * @param {string} légende
   */
  agrandir: (légende) => `Agrandir la photo : ${légende}`,
  photoAgrandie: 'Photo agrandie',
  // La légende de la visionneuse : « Coulisses · 3 / 9 ».
  /**
   * @param {string} légende
   * @param {number} position
   * @param {number} total
   */
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
