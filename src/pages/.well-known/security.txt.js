// security.txt (RFC 9116) : à qui signaler une faille. Fabriqué au build comme
// robots.txt, parce que `Expires` est obligatoire et doit rester dans le futur :
// la reconstruction de chaque nuit le repousse d'un an, sans que personne n'y pense.

const CONTACT = 'mailto:contact@brendanfleurdelys.ch';
const VALIDITÉ_MS = 365 * 24 * 60 * 60 * 1000;

/** @type {import('astro').APIRoute} */
export function GET({ site }) {
  const corps = [
    `Contact: ${CONTACT}`,
    `Expires: ${new Date(Date.now() + VALIDITÉ_MS).toISOString()}`,
    'Preferred-Languages: fr, en',
    `Canonical: ${new URL('/.well-known/security.txt', site)}`,
    '',
  ].join('\n');
  return new Response(corps, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
