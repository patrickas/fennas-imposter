<script setup lang="ts">
import { computed } from 'vue'
import { useApp } from '../../composables/useApp'
import { formatList } from '../../i18n'
import Screen from '../ui/Screen.vue'
import StickerCard from '../ui/StickerCard.vue'
import PopButton from '../ui/PopButton.vue'
import Confetti from '../ui/Confetti.vue'
import Scoreboard from './Scoreboard.vue'

const app = useApp()
const round = computed(() => app.state.round)
const imposterNames = computed(() =>
  formatList((round.value?.imposterIds ?? []).map((id) => app.playerName(id)), app.state.language),
)
const winner = computed(() => {
  const r = round.value
  if (!r?.outcome) return null
  return r.outcome === 'crew' ? app.t('result.crewWins') : app.t('result.impostersWin', { count: r.imposterIds.length })
})
</script>

<template>
  <Screen v-if="round && round.secret" :tone="round.outcome === 'crew' ? 'mint' : 'bubblegum'" data-testid="result">
    <Confetti v-if="round.outcome" />
    <h2 v-if="winner" class="title-xl center" data-testid="winner">{{ winner }}</h2>
    <StickerCard tone="ink">
      <p>{{ app.t('result.imposters', { count: round.imposterIds.length }) }}</p>
      <p class="names" data-testid="result-imposters">{{ imposterNames }}</p>
    </StickerCard>
    <StickerCard motion="wobble">
      <p>{{ app.t('result.word') }}</p>
      <p class="secret-word" data-testid="result-word">{{ round.secret.word }}</p>
      <p>{{ app.t('result.category', { category: round.secret.categoryName }) }}</p>
    </StickerCard>
    <Scoreboard v-if="round.settings.scoring" />
    <template #actions>
      <PopButton attention data-testid="next-round" @click="app.finishRound()">{{ app.t('result.nextRound') }}</PopButton>
    </template>
  </Screen>
</template>

<style scoped>
.names { font-size: 1.6rem; font-weight: 800; overflow-wrap: anywhere; }
</style>
