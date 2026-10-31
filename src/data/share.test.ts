import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { GAME_URL, shareMessage, whatsappLink } from './share'

describe('sharing the game', () => {
  it('links to the site as published, never to the host the app runs on, so a share from the dev server still works', () => {
    const cname = readFileSync(new URL('../../public/CNAME', import.meta.url), 'utf8').trim()
    const url = new URL(GAME_URL)
    expect(url.protocol).toBe('https:') // the offline app needs HTTPS
    expect(url.hostname).toBe(cname)
  })

  it('ends the message with the link, so the friend gets something to tap', () => {
    expect(shareMessage('Play Fennass with me!')).toBe(`Play Fennass with me! ${GAME_URL}`)
  })

  it('hands WhatsApp the whole message, even with characters that mean something in a link', () => {
    const message = shareMessage('Tom & Jerry? 100% فنّاص #1')
    const link = new URL(whatsappLink(message))
    expect(`${link.origin}${link.pathname}`).toBe('https://wa.me/')
    expect(link.searchParams.get('text')).toBe(message)
  })
})
