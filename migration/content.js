/* =========================================================================
   CONTENU : tout le texte du site est ici. C'est le seul fichier à modifier
   pour changer un texte, une date, une photo ou une personne.
   Un champ vide (null / absent) n'est jamais affiché.
   ========================================================================= */
const CONTACT = {
  email: "compagnie.cliffhanger@gmail.com",
  instagram: "https://www.instagram.com/compagnie.cliffhanger/",
  facebook: "https://www.facebook.com/100057761165578/",
};

// Les personnes. La clé sert d'adresse : #/personne/<clé>.
// Les projets de chaque personne sont calculés à partir des crédits des spectacles.
// guest: true = invité·e (apparaît sur sa fiche et dans les crédits, pas dans « L'équipe »).
// montreal: true = membre du collectif de Montréal (pas dans « L'équipe » bruxelloise).
const PEOPLE = {
  "alexandre-van-campenhout": {
    name: "Alexandre Van Campenhout",
    bio: [
      "Alexandre Van Campenhout est un auteur, metteur en scène et interprète autodidacte d'origine bruxelloise. Il se consacre à la création de théâtre contemporain qui a pour message « Avancer plus loin, ensemble, au rythme de nos différences ».",
      "Ses pièces interrogent avant tout la recherche identitaire et les relations humaines, et explorent différentes problématiques modernes en alternant légèreté et émotions brutes. Son but est d'utiliser le théâtre comme outil pour sensibiliser les gens à ces problématiques, tout en les transportant dans un univers onirique.",
    ],
  },
  "alize-cookie": { name: "Alizé Cookie" },
  "audrey-colomb": { name: "Audrey Colomb" },
  "hans-melot": { name: "Hans Mélot" },
  "hugo-ortiz": { name: "Hugo Ortiz" },
  "ildiko-acs": { name: "Ildikó Ács" },
  "julie-gloesener": { name: "Julie Gloesener" },
  "laurie-stevens": { name: "Laurie Stevens" },
  "nathan-leclercq": { name: "Nathan Leclercq" },
  "sophie-decaestecker": { name: "Sophie Decaestecker" },
  "thomas-kesmarki": { name: "Thomas Kesmarki" },
  "anthony-quere": { name: "Anthony Quéré" },
  "david-palsterman": { name: "David Palsterman" },
  "lara-franken": { name: "Lara Franken" },
  "pauline-wielemans": { name: "Pauline Wielemans" },
  "robin-vico": { name: "Robin Vico" },
  "virginie-michaux": { name: "Virginie Michaux" },
  "marie-courcoutelis": { name: "Marie Courcoutelis" },
  "pascal-graulus": { name: "Pascal Graulus" },
  "marie-helene-ruiz": { name: "Marie-Hélène Ruiz", guest: true },
  // Collectif de Montréal
  "amelie-dupe-laforgue": { name: "Amélie Dupé-Laforgue", montreal: true },
  "anais-legrand": { name: "Anaïs Legrand", montreal: true },
  "ann-chloe-mentor": { name: "Ann-Chloé Mentor", montreal: true },
  "clara-jacquoudet": { name: "Clara Jacquoudet", montreal: true },
  "coralyne-jullien": { name: "Coralyne Jullien", montreal: true },
  "gabrielle-bouin": { name: "Gabrielle Bouin", montreal: true },
  "lara-pandev-herault": { name: "Lara Pandev-Hérault", montreal: true },
};

// Les spectacles.
// troupe : "bruxelles" (site principal) ou "montreal" (rubrique Montréal).
// hero / poster / slides : nom des photos dans img/, sans extension (le site sert les versions WebP).
// slides : photos en plus, sans répéter la photo du haut ni l'affiche.
// credits : { role, people: [clé, ou [clé, "personnage"]], note, text }.
// dates : une ligne par représentation ; l'agenda les regroupe par série.
const SHOWS = [
  {
    slug: "linedit-de-moliere", troupe: "bruxelles", title: "L'Inédit de Molière", year: 2026,
    hero: "bleu", focus: "50% 22%", credit: null,
    punch: "Entre cupidité, séduction et ruse, qui donc parviendra à tirer son épingle du jeu ?",
    poster: "affiche-inedit",
    text: [
      "Brigands, impostures, larcins, farces et autres joyeuses fourberies : tous les ingrédients chers à Molière se mêlent sous la plume de Marie-Hélène Ruiz, qui tisse, à partir d'extraits du maître, une intrigue entièrement inédite.",
      "Vadius, Lépine, Criquet et Vénus complotent pour mettre la main sur la fortune du Comte, tandis que les filles de celui-ci rêvent plutôt de conquérir le cœur de deux galants complices.",
    ],
    slides: [["groupe", "La troupe"], ["affiche-inedit-2", "Seconde affiche"]],
    credits: [
      { role: "Texte", people: ["marie-helene-ruiz"] },
      { role: "Mise en scène", note: "collective, sous la direction d’", people: ["alize-cookie"] },
      { role: "Avec", people: ["ildiko-acs", "audrey-colomb", "alize-cookie", "sophie-decaestecker", "thomas-kesmarki", "nathan-leclercq", "hugo-ortiz"] },
    ],
    dates: [
      { day: "2026-04-17", time: "20:00", venue: "Théâtre L'Improviste", city: "Forest", price: "12 €" },
      { day: "2026-04-18", time: "20:00", venue: "Théâtre L'Improviste", city: "Forest", price: "12 €" },
    ],
  },
  {
    slug: "par-endroits", troupe: "bruxelles", title: "Par Endroits", year: 2024,
    hero: "trio", focus: "50% 38%", credit: null,
    punch: "Dans un monde où chacun peine à s'exprimer, la construction de soi s'arrête-t-elle une fois que l'on quitte l'enfance pour entrer dans l'âge adulte ?",
    poster: "affiche-par-endroits",
    text: [
      "Gaël s'est fait plaquer par sa copine, Juju a perdu son ami et Ti-Cul s'est énervé sur la personne la plus chère à ses yeux. Alors que chacun cherche à identifier et résoudre la source de ses maux, ils se retrouvent emportés, malgré eux, à naviguer à travers leurs relations, leurs souvenirs et leurs pensées les plus intimes.",
      "Par Endroits est un projet théâtral à l'initiative d'Alexandre Van Campenhout, créé par écriture de plateau avec la Compagnie Cliffhanger. La pièce a été élaborée à partir de témoignages de personnes venues de Belgique, de France, de Suisse et même du Québec, et veut donner la parole aux enfants d'hier pour la laisser à ceux de demain.",
      "Saurez-vous les écouter ?",
    ],
    credits: [
      { role: "Initiative et mise en scène", people: ["alexandre-van-campenhout"] },
      { role: "Écriture", text: "de plateau, avec la Compagnie Cliffhanger" },
      { role: "Avec", people: ["anthony-quere", "audrey-colomb", "david-palsterman", "hugo-ortiz", "julie-gloesener", "lara-franken", "pauline-wielemans", "robin-vico", "thomas-kesmarki", "virginie-michaux"] },
      { role: "Scénographie", people: ["marie-courcoutelis"] },
      { role: "Assistanat", people: ["pauline-wielemans", "thomas-kesmarki", "pascal-graulus"] },
      { role: "Affiche", people: ["nathan-leclercq"] },
    ],
    dates: [
      { day: "2024-05-24", time: "20:00", venue: "Institut Européen de la Culture Arabe", city: "Saint-Josse-ten-Noode", price: "10 €" },
      { day: "2024-05-25", time: "20:00", venue: "Institut Européen de la Culture Arabe", city: "Saint-Josse-ten-Noode", price: "10 €" },
      { day: "2024-05-26", time: "15:00", venue: "Institut Européen de la Culture Arabe", city: "Saint-Josse-ten-Noode", price: "prix libre" },
    ],
  },
  {
    slug: "les-femmes-se-vantent", troupe: "bruxelles", title: "Les Femmes Se Vantent", year: 2019,
    hero: "pull", focus: "50% 22%", credit: null,
    punch: "« Molière ne se retournerait nullement dans sa tombe, mais applaudirait des deux mains. »", cite: "Karoo, novembre 2019",
    poster: "affiche-fsv",
    text: [
      "Librement inspiré des Femmes savantes de Molière, Les Femmes Se Vantent est un saut dans le temps dans ce qu'auraient pu vivre les personnages du dramaturge. Henriette et Clitandre souhaitent emménager ensemble sans nécessairement passer par le mariage. Une situation commune et sans drame, qui fera pourtant réagir toute la famille noble d'Henriette, qui ne conçoit pas les choses de la même manière.",
      "Une critique d'une noblesse vétuste, sur fond de musique des années 80.",
    ],
    credits: [
      { role: "D'après", text: "Les Femmes savantes, de Molière" },
      { role: "Mise en scène", text: "collective" },
      { role: "Avec", people: [["sophie-decaestecker", "Henriette"], ["hans-melot", "Clitandre"], ["laurie-stevens", "Philaminte"], ["alexandre-van-campenhout", "Chrysale"], ["audrey-colomb", "Armande"], ["alize-cookie", "Bélise"], ["julie-gloesener", "la tante"], ["nathan-leclercq", "Trissotin"]] },
    ],
    dates: [
      { day: "2019-11-04", time: "20:30", venue: "Salle Delvaux", city: "ULB Solbosch", price: "5 €" },
      { day: "2019-11-05", time: "20:30", venue: "Salle Delvaux", city: "ULB Solbosch", price: "5 €" },
    ],
  },
  {
    slug: "un-choeur-silencieux", troupe: "montreal", title: "Un C(h)œur silencieux", year: 2025,
    hero: "choeur-duo", focus: "50% 40%", credit: null,
    punch: "Quand tout n'est plus que bruit, notre musique peut-elle encore vibrer ?",
    poster: "affiche-choeur",
    text: [
      "Une chanteuse brillante en quête de son public, une danseuse sociale en lutte avec son tempo, une pianiste virtuose enfermée dans sa partition, une régisseuse explosive orchestrant la vie des autres, une âme solitaire bercée par son casque et une jeune femme à la recherche de sa mélodie. Six personnes que rien ne relie, à part la musique.",
      "Alors que chacune traverse la cacophonie de sa propre vie, ses pensées et ses relations, comment la musique s'impose-t-elle, s'écoute, se vit dans l'existence de chacune ? Au fond, qu'est-ce que la musique ?",
      "Un C(h)œur silencieux est une pièce contemporaine composée de témoignages et de performances musicales. Véritable symphonie humaine de rires, d'émotions et de silences, elle explore les musiques que seuls les cœurs entendent… Parviendrez-vous à écouter la vôtre ?",
    ],
    slides: [["choeur-jean", "Un C(h)œur silencieux"], ["choeur-chemise", "Un C(h)œur silencieux"]],
    credits: [
      { role: "Texte et mise en scène", people: ["alexandre-van-campenhout"] },
      { role: "Avec", people: ["amelie-dupe-laforgue", "anais-legrand", "ann-chloe-mentor", "clara-jacquoudet", "coralyne-jullien", "gabrielle-bouin", "lara-pandev-herault"] },
      { role: "Genre", text: "pièce de théâtre musicale, jouée à 270°, le public sur trois côtés" },
    ],
    duration: "1 h 30, sans entracte",
    dates: [
      { day: "2025-06-06", venue: "Place des Arts, salle Claude-Léveillée", city: "Montréal" },
      { day: "2025-06-07", venue: "Place des Arts, salle Claude-Léveillée", city: "Montréal" },
    ],
  },
];

// La rubrique Montréal
const MONTREAL = {
  sub: "Collectif Cliffhanger, depuis 2020",
  lead: "Le collectif-sœur de la Compagnie Cliffhanger, né à Montréal grâce à l'un de ses membres fondateurs.",
  text: [
    "Le Collectif Cliffhanger de Montréal a fait ses débuts en janvier 2020 avec une adaptation de Hamlet, réécrite comme une tragicomédie dans le contexte des années 1950. Le Covid ayant mis un frein à ce projet, le collectif a véritablement pris naissance en juin 2025 avec Un C(h)œur silencieux, une création originale d'Alexandre Van Campenhout.",
  ],
};

// [fichier, légende, spectacle (clé) ou "coulisses"]. Les photos des spectacles de Montréal restent sur la page Montréal.
const GALLERY = [
  ["groupe", "L'Inédit de Molière", "linedit-de-moliere"],
  ["bleu", "L'Inédit de Molière", "linedit-de-moliere"],
  ["script", "Coulisses", "coulisses"],
  ["rose", "Coulisses", "coulisses"],
  ["noir-blanc", "Coulisses", "coulisses"],
  ["trio", "Par Endroits", "par-endroits"],
  ["vert", "Coulisses", "coulisses"],
  ["sourire", "Coulisses", "coulisses"],
  ["pull", "Les Femmes Se Vantent", "les-femmes-se-vantent"],
];

// fond de chaque rubrique
const BACKDROPS = { home: "groupe", spectacles: "rose", agenda: "script", compagnie: "noir-blanc", contact: "vert" };
