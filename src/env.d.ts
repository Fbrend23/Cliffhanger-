// Les drapeaux posés par les scripts de Base.astro : ils évitent d'ajouter deux
// fois l'écouteur (`astro:after-swap`, `astro:page-load`) quand le routeur
// recopie l'en-tête. `goatcounter` vient du script de GoatCounter.
interface Window {
  __cliffJs?: boolean;
  __cliffCompteur?: boolean;
  goatcounter?: { count?: (vars: { path: string }) => void };
}
