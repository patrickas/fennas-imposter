<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useApp } from '../composables/useApp'
import Screen from '../components/ui/Screen.vue'
import StickerCard from '../components/ui/StickerCard.vue'
import PopButton from '../components/ui/PopButton.vue'
import LanguageSwitch from '../components/ui/LanguageSwitch.vue'

const app = useApp()
const router = useRouter()

function play(): void {
  app.ensureSession()
  void router.push('/play')
}
</script>

<template>
  <Screen tone="sun">
    <template #top>
      <LanguageSwitch />
    </template>
    <StickerCard motion="wobble">
      <h1 class="title-xl">{{ app.t('app.title') }}</h1>
    </StickerCard>
    <p class="guide">{{ app.t('app.tagline') }}</p>
    <template #actions>
      <PopButton attention data-testid="play" @click="play">
        {{ app.state.session ? app.t('home.continue') : app.t('home.play') }}
      </PopButton>
      <PopButton variant="secondary" data-testid="nav-setup" @click="router.push('/setup')">{{ app.t('home.setup') }}</PopButton>
      <PopButton variant="secondary" data-testid="nav-words" @click="router.push('/words')">{{ app.t('home.words') }}</PopButton>
      <PopButton variant="secondary" data-testid="nav-data" @click="router.push('/data')">{{ app.t('home.data') }}</PopButton>
    </template>
  </Screen>
</template>
