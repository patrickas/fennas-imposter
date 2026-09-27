<script setup lang="ts">
import { computed, onErrorCaptured, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useApp } from '../composables/useApp'
import { useWakeLock } from '../composables/useWakeLock'
import Screen from '../components/ui/Screen.vue'
import StickerCard from '../components/ui/StickerCard.vue'
import PopButton from '../components/ui/PopButton.vue'
import BetweenRounds from '../components/phases/BetweenRounds.vue'
import GmEntry from '../components/phases/GmEntry.vue'
import RevealStep from '../components/phases/RevealStep.vue'
import Discussion from '../components/phases/Discussion.vue'
import VoteStep from '../components/phases/VoteStep.vue'
import GuessStep from '../components/phases/GuessStep.vue'
import ResultStep from '../components/phases/ResultStep.vue'

const app = useApp()
const crashed = ref(false)
const phase = computed(() => app.state.round?.phase ?? null)
const revealKey = computed(() => `reveal-${app.state.round?.revealIndex ?? 0}`)

useWakeLock(computed(() => phase.value === 'reveal' || phase.value === 'discussion'))

onErrorCaptured((error) => {
  console.error(error)
  crashed.value = true
  return false
})

onBeforeRouteLeave(() => {
  const round = app.state.round
  if (!round || round.phase === 'result' || crashed.value) return true
  return window.confirm(app.t('play.leaveConfirm'))
})

function abandon(): void {
  app.abandonRound()
  crashed.value = false
}
</script>

<template>
  <Screen v-if="crashed" tone="bubblegum" data-testid="crashed">
    <StickerCard tone="ink">
      <p>{{ app.t('play.crashed') }}</p>
    </StickerCard>
    <template #actions>
      <PopButton @click="abandon">{{ app.t('play.abandonRound') }}</PopButton>
    </template>
  </Screen>
  <Transition v-else name="pop" mode="out-in">
    <BetweenRounds v-if="phase === null" key="between" />
    <GmEntry v-else-if="phase === 'gmEntry'" key="gm" />
    <RevealStep v-else-if="phase === 'reveal'" :key="revealKey" />
    <Discussion v-else-if="phase === 'discussion'" key="discussion" />
    <VoteStep v-else-if="phase === 'vote'" key="vote" />
    <GuessStep v-else-if="phase === 'guess'" key="guess" />
    <ResultStep v-else key="result" />
  </Transition>
</template>
