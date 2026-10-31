/** The published site, not location.origin: a share from the dev server must not send a localhost link. */
export const GAME_URL = 'https://fennas-game.abisalloum.com'

export function shareMessage(text: string): string {
  return `${text} ${GAME_URL}`
}

/** Opens WhatsApp with the message typed in; the user picks who gets it. */
export function whatsappLink(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`
}
