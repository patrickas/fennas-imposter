<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useApp } from '../composables/useApp'
import Screen from '../components/ui/Screen.vue'
import PopButton from '../components/ui/PopButton.vue'

const HELP_EMAIL = 'fennas.game@abisalloum.com'

const app = useApp()
const router = useRouter()

const magic = ref('')
/** Counts wrong tries; keying the message on it replays the shake every time. */
const wrongTries = ref(0)

function tryUnlock(): void {
  if (app.unlock(magic.value) === 'wrong') wrongTries.value++
}

const theirWord = ref('')
const keyResult = ref<{ word: string | null } | null>(null)

function makeKey(): void {
  keyResult.value = { word: app.makeKey(theirWord.value) }
}

// English on purpose: it lands in Alex's inbox, and the secret word is English anyway.
const helpLink = computed(() => {
  const subject = encodeURIComponent('Fennass key')
  const body = encodeURIComponent(`My secret word: ${app.secretWord.value}`)
  return `mailto:${HELP_EMAIL}?subject=${subject}&body=${body}`
})
</script>

<template>
  <Screen tone="sun" align="start">
    <template #top>
      <h1>{{ app.t('about.title') }}</h1>
      <button type="button" class="icon-btn" data-testid="back" @click="router.push('/')">{{ app.t('common.back') }}</button>
    </template>

    <img src="/pwa-512x512.png" alt="" class="face anim-loop anim-spin" data-testid="about-face">

    <template v-if="!app.isUnlocked.value">
      <p class="guide">{{ app.t('about.free') }}</p>
      <section class="panel stack">
        <p class="label">{{ app.t('about.secretWord') }}</p>
        <p class="big" dir="ltr" data-testid="my-secret-word">{{ app.secretWord.value }}</p>
        <form class="stack" @submit.prevent="tryUnlock">
          <label class="field">
            {{ app.t('about.magicWord') }}
            <input
              v-model="magic"
              type="text"
              dir="ltr"
              class="input"
              autocapitalize="off"
              autocomplete="off"
              spellcheck="false"
              data-testid="magic-input"
            >
          </label>
          <p v-if="wrongTries > 0" :key="wrongTries" class="error-text anim-nope" role="alert" data-testid="unlock-wrong">
            {{ app.t('about.wrong') }}
          </p>
          <PopButton type="submit" data-testid="unlock">{{ app.t('about.unlock') }}</PopButton>
        </form>
      </section>
      <p class="guide">
        {{ app.t('about.help') }}
        <a :href="helpLink" data-testid="help-email">{{ app.t('about.helpLink') }}</a>
      </p>
    </template>
    <p v-else class="guide" role="status" data-testid="unlocked">{{ app.t('about.unlocked') }}</p>

    <section v-if="app.isOwner.value" class="panel stack" data-testid="owner-tools">
      <h2>{{ app.t('about.makeKey') }}</h2>
      <form class="stack" @submit.prevent="makeKey">
        <label class="field">
          {{ app.t('about.theirWord') }}
          <input
            v-model="theirWord"
            type="text"
            dir="ltr"
            class="input"
            autocapitalize="off"
            autocomplete="off"
            spellcheck="false"
            data-testid="key-input"
          >
        </label>
        <PopButton type="submit" variant="secondary" data-testid="make-key">{{ app.t('about.makeKeyButton') }}</PopButton>
      </form>
      <p v-if="keyResult" :class="keyResult.word ? 'big' : 'error-text'" dir="ltr" data-testid="key-result">
        {{ keyResult.word ?? app.t('about.notAWord') }}
      </p>
    </section>
  </Screen>
</template>

<style scoped>
h1 { font-size: 1.8rem; }
h2 { font-size: 1.3rem; }
.face { align-self: center; width: min(50vw, 200px); height: auto; }
.label { font-weight: 700; text-align: center; }
.big { color: var(--grape); font-size: clamp(1.8rem, 9vw, 2.6rem); font-weight: 800; line-height: 1.1; text-align: center; overflow-wrap: anywhere; }
a { color: var(--grape); font-weight: 800; }
</style>
