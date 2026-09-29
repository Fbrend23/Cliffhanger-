// Le drapeau posé par le script de Base.astro : il évite d'ajouter deux fois
// l'écouteur `astro:after-swap` quand le routeur recopie l'en-tête.
interface Window {
  __cliffJs?: boolean;
}
