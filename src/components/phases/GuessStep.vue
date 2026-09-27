<script setup lang="ts">
import { computed } from 'vue'
import { useApp } from '../../composables/useApp'
import Screen from '../ui/Screen.vue'
import StickerCard from '../ui/StickerCard.vue'
import PopButton from '../ui/PopButton.vue'

const app = useApp()
const round = computed(() => app.state.round)
const name = computed(() => {
  const id = round.value?.votedOut?.playerId
  return id ? app.playerName(id) : ''
})
</script>

<template>
  <Screen v-if="round" tone="bubblegum" data-testid="guess">
    <StickerCard tone="ink" motion="shake">
      <p class="title">{{ app.t('guess.title', { name }) }}</p>
    </StickerCard>
    <template #actions>
      <PopButton data-testid="guess-yes" @click="app.dispatch({ type: 'imposterGuess', correct: true })">{{ app.t('guess.yes') }}</PopButton>
      <PopButton variant="secondary" data-testid="guess-no" @click="app.dispatch({ type: 'imposterGuess', correct: false })">{{ app.t('guess.no') }}</PopButton>
    </template>
  </Screen>
</template>

<style scoped>
.title { font-size: 1.5rem; font-weight: 800; }
</style>
