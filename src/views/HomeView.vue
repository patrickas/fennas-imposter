<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useApp } from '../composables/useApp'
import { confirmDialog } from '../composables/useDialog'
import { GAME_URL, shareMessage, whatsappLink } from '../data/share'
import Screen from '../components/ui/Screen.vue'
import StickerCard from '../components/ui/StickerCard.vue'
import PopButton from '../components/ui/PopButton.vue'
import UpdatePrompt from '../components/ui/UpdatePrompt.vue'
import LanguageSwitch from '../components/ui/LanguageSwitch.vue'

const app = useApp()
const router = useRouter()

async function abandon(): Promise<void> {
  const confirmed = await confirmDialog({
    message: app.t('home.abandonConfirm'),
    confirmLabel: app.t('home.abandon'),
    cancelLabel: app.t('common.cancel'),
    danger: true,
  })
  if (confirmed) app.abandonRound()
}

function play(): void {
  // A new game opens Setup first so the group can confirm who is playing; a running one goes straight back in.
  void router.push(app.state.session ? '/play' : { path: '/setup', query: { start: '1' } })
}

const message = computed(() => shareMessage(app.t('home.shareText')))
/** Shown when the phone has no share menu (most computers), or it failed. */
const shareButtons = ref(false)
const copied = ref(false)

async function share(): Promise<void> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text: message.value })
      return
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return // closed without picking an app
    }
  }
  shareButtons.value = true
}

async function copyLink(): Promise<void> {
  try {
    await navigator.clipboard.writeText(GAME_URL)
    copied.value = true
  } catch {
    // Copying is not allowed here; the link is on screen to copy by hand.
  }
}
</script>

<template>
  <Screen tone="sun">
    <template #top>
      <LanguageSwitch />
    </template>
    <UpdatePrompt />
    <StickerCard motion="wobble">
      <h1 class="title-xl">{{ app.t('app.title') }}</h1>
    </StickerCard>
    <p class="guide">{{ app.t('app.tagline') }}</p>
    <p v-if="!app.isUnlocked.value" class="guide" data-testid="free-rounds">
      {{ app.t('home.freeRounds', { count: app.freeRoundsLeft() }) }}
    </p>
    <template #actions>
      <PopButton attention data-testid="play" @click="play">
        {{ app.state.session ? app.t('home.continue') : app.t('home.play') }}
      </PopButton>
      <PopButton v-if="app.state.round" variant="danger" data-testid="abandon-round" @click="abandon">
        {{ app.t('home.abandonRound') }}
      </PopButton>
      <PopButton variant="secondary" data-testid="nav-setup" @click="router.push('/setup')">{{ app.t('home.setup') }}</PopButton>
      <PopButton variant="secondary" data-testid="nav-words" @click="router.push('/words')">{{ app.t('home.words') }}</PopButton>
      <PopButton variant="secondary" data-testid="nav-data" @click="router.push('/data')">{{ app.t('home.data') }}</PopButton>
      <PopButton variant="secondary" data-testid="nav-about" @click="router.push('/about')">{{ app.t('home.about') }}</PopButton>
      <PopButton variant="secondary" data-testid="share" @click="share">{{ app.t('home.share') }}</PopButton>
      <div v-if="shareButtons" class="panel stack" data-testid="share-fallback">
        <PopButton :href="whatsappLink(message)" target="_blank" rel="noopener" data-testid="share-whatsapp">
          {{ app.t('home.shareWhatsapp') }}
        </PopButton>
        <PopButton variant="secondary" data-testid="share-copy" @click="copyLink">
          {{ copied ? app.t('home.shareCopied') : app.t('home.shareCopy') }}
        </PopButton>
        <p class="share-link" dir="ltr" data-testid="share-link">{{ GAME_URL }}</p>
      </div>
    </template>
  </Screen>
</template>

<style scoped>
.share-link { font-weight: 700; text-align: center; overflow-wrap: anywhere; user-select: all; }
</style>
