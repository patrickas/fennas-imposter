<script setup lang="ts">
import { computed } from 'vue'
import { useApp } from '../../composables/useApp'
import { useSound } from '../../composables/useSound'
import { useTimer } from '../../composables/useTimer'
import { formatClock } from '../../i18n'
import Screen from '../ui/Screen.vue'
import StickerCard from '../ui/StickerCard.vue'
import PopButton from '../ui/PopButton.vue'
import Chip from '../ui/Chip.vue'
import LeaveRoundButton from './LeaveRoundButton.vue'

const app = useApp()
const sound = useSound()
const round = computed(() => app.state.round)
const starter = computed(() => (round.value ? app.playerName(round.value.startingPlayerId) : ''))
const timer = useTimer(
  () => round.value?.timerEndsAt ?? null,
  () => {
    sound.beep()
    navigator.vibrate?.([300, 150, 300])
  },
)
// Screen readers: announce once per minute, then at 10 s, then at time-up.
const announcement = computed(() => {
  const view = timer.value
  if (!view.active) return ''
  if (view.ended) return app.t('discussion.timeUp')
  if (view.secondsLeft <= 10) return app.t('timer.secondsLeft', { count: 10 })
  return app.t('timer.minutesLeft', { count: Math.ceil(view.secondsLeft / 60) })
})

function end(): void {
  app.dispatch({ type: 'endDiscussion' })
}
</script>

<template>
  <Screen v-if="round" tone="sun" data-testid="discussion" @pointerdown="sound.prime()">
    <template #top>
      <Chip>{{ app.t('play.round', { n: round.number }) }}</Chip>
      <Chip data-testid="imposter-count">
        {{ round.settings.imposterCountHidden
          ? app.t('discussion.impostersHidden')
          : app.t('discussion.imposters', { count: round.imposterIds.length }) }}
      </Chip>
      <LeaveRoundButton />
    </template>
    <h2 class="center">{{ app.t('discussion.title') }}</h2>
    <StickerCard motion="wobble">
      <span class="title-xl" data-testid="starter">{{ starter }}</span>
    </StickerCard>
    <p class="guide">{{ app.t('discussion.guide', { name: starter }) }}</p>
    <div v-if="timer.active" class="timer" :class="{ ended: timer.ended }" data-testid="timer">
      {{ timer.ended ? app.t('discussion.timeUp') : formatClock(timer.secondsLeft) }}
    </div>
    <p class="visually-hidden" aria-live="polite">{{ announcement }}</p>
    <template #actions>
      <PopButton attention data-testid="end-discussion" @click="end">
        {{ round.settings.scoring ? app.t('discussion.toVote') : app.t('discussion.toReveal') }}
      </PopButton>
    </template>
  </Screen>
</template>

<style scoped>
.timer {
  align-self: center; min-width: 8ch; padding: 6px 20px;
  border: var(--outline); border-radius: var(--radius-pill); background: var(--paper); box-shadow: var(--shadow-hard-sm);
  font-size: 2.2rem; font-weight: 800; text-align: center; font-variant-numeric: tabular-nums; direction: ltr;
}
.timer.ended { background: var(--bubblegum); }
</style>
